/**
 * File: nexus-card-badge-strip.tsx
 * Description: Renders compact icon badges for Nexus cards without consuming body space.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusCardBadge, NexusCardBadgeIcon, NexusCardBadgeTone } from './nexus-card-types';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const BADGE_MODAL_PANEL_STYLE: ViewStyle = { elevation: 90 };
const BADGE_TOOLTIP_MARGIN = 12;
const BADGE_TOOLTIP_MAX_WIDTH = 220;
const BADGE_TOOLTIP_OFFSET = 8;

type BadgeAnchor = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type BadgeTooltipState =
  | { mode: 'idle' }
  | { anchor: BadgeAnchor | null; badgeId: string; mode: 'hover' }
  | { anchor: BadgeAnchor | null; badgeId: string; mode: 'pinned' };

const ICON_BY_BADGE: Record<NexusCardBadgeIcon, keyof typeof MaterialIcons.glyphMap> = {
  check: 'check-circle',
  flag: 'flag',
  link: 'link',
  lock: 'lock',
  warning: 'warning',
  history: 'history',
  signature: 'gesture',
  packet: 'inventory',
  visibility: 'visibility',
  archive: 'archive',
  verified: 'verified',
};

function getBadgeToneClasses(
  tone: NexusCardBadgeTone,
  themeMode: 'dark' | 'light',
): { frame: string; icon: string; text: string } {
  if (themeMode === 'light') {
    const lightToneClasses: Record<NexusCardBadgeTone, { frame: string; icon: string; text: string }> = {
      default: { frame: 'border-slate-300 bg-slate-100', icon: '#64748b', text: 'text-slate-600' },
      accent: { frame: 'border-sky-300 bg-sky-100', icon: '#0284c7', text: 'text-sky-700' },
      warning: { frame: 'border-amber-300 bg-amber-100', icon: '#b45309', text: 'text-amber-700' },
      danger: { frame: 'border-rose-300 bg-rose-100', icon: '#be123c', text: 'text-rose-700' },
      muted: { frame: 'border-slate-200 bg-slate-50', icon: '#94a3b8', text: 'text-slate-500' },
    };

    return lightToneClasses[tone];
  }

  const darkToneClasses: Record<NexusCardBadgeTone, { frame: string; icon: string; text: string }> = {
    default: { frame: 'border-nexus-line/70 bg-white/5', icon: '#9bb2c5', text: 'text-nexus-muted' },
    accent: { frame: 'border-nexus-sky/40 bg-nexus-sky/10', icon: '#7dd7ff', text: 'text-nexus-sky' },
    warning: { frame: 'border-nexus-gold/40 bg-nexus-gold/10', icon: '#ffd166', text: 'text-nexus-gold' },
    danger: { frame: 'border-nexus-rose/40 bg-nexus-rose/10', icon: '#ff7a9a', text: 'text-nexus-rose' },
    muted: { frame: 'border-nexus-line/50 bg-white/[0.03]', icon: '#6f8497', text: 'text-nexus-muted' },
  };

  return darkToneClasses[tone];
}

function getTooltipPanelStyle(anchor: BadgeAnchor | null): ViewStyle {
  const windowWidth = Dimensions.get('window').width;
  const panelLeft = anchor
    ? Math.min(
        Math.max(BADGE_TOOLTIP_MARGIN, anchor.x + anchor.width / 2 - BADGE_TOOLTIP_MAX_WIDTH / 2),
        Math.max(BADGE_TOOLTIP_MARGIN, windowWidth - BADGE_TOOLTIP_MAX_WIDTH - BADGE_TOOLTIP_MARGIN),
      )
    : BADGE_TOOLTIP_MARGIN;
  const panelTop = anchor ? anchor.y + anchor.height + BADGE_TOOLTIP_OFFSET : BADGE_TOOLTIP_MARGIN;

  return {
    ...BADGE_MODAL_PANEL_STYLE,
    left: panelLeft,
    maxWidth: BADGE_TOOLTIP_MAX_WIDTH,
    position: 'absolute',
    top: panelTop,
  };
}

function supportsFineHover(): boolean {
  if (Platform.OS !== 'web') {
    return false;
  }

  const webWindow = (globalThis as typeof globalThis & {
    matchMedia?: (query: string) => { matches: boolean };
  }).matchMedia;

  return webWindow?.('(hover: hover) and (pointer: fine)').matches ?? false;
}

function NexusCardBadgeIconView({ badge }: { badge: NexusCardBadge }) {
  const { themeMode, uiDensity } = useNexusShell();
  const tone = getBadgeToneClasses(badge.tone ?? 'default', themeMode);
  const size = uiDensity === 'large' ? 17 : 15;

  if (badge.renderIcon) {
    return <>{badge.renderIcon}</>;
  }

  return (
    <MaterialIcons
      color={tone.icon}
      name={ICON_BY_BADGE[badge.icon ?? 'packet']}
      size={size}
    />
  );
}

type NexusCardBadgeButtonProps = {
  accessibilityLabel: string;
  active: boolean;
  children: ReactNode;
  id: string;
  onHoverIn: (id: string, anchor: BadgeAnchor | null) => void;
  onHoverOut: (id: string) => void;
  onPressBadge: (id: string, anchor: BadgeAnchor | null) => void;
  tone: NexusCardBadgeTone;
};

function NexusCardBadgeButton({
  accessibilityLabel,
  active,
  children,
  id,
  onHoverIn,
  onHoverOut,
  onPressBadge,
  tone,
}: NexusCardBadgeButtonProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const buttonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const toneClasses = getBadgeToneClasses(tone, themeMode);
  const frameClassName = joinClasses(
    'items-center justify-center rounded-nexus border',
    uiDensity === 'large' ? 'h-7 w-7' : 'h-6 w-6',
    toneClasses.frame,
  );

  const measureBadge = useCallback(
    (callback: (anchor: BadgeAnchor | null) => void) => {
      const node = buttonRef.current;
      if (!node?.measureInWindow) {
        callback(null);
        return;
      }

      node.measureInWindow((x, y, width, height) => {
        callback({ height, width, x, y });
      });
    },
    [],
  );

  return (
    <Pressable
      ref={buttonRef}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className={joinClasses(frameClassName, active ? 'opacity-100' : undefined)}
      onHoverIn={() => {
        measureBadge((anchor) => onHoverIn(id, anchor));
      }}
      onHoverOut={() => {
        onHoverOut(id);
      }}
      onPress={(event) => {
        event.stopPropagation();
        measureBadge((anchor) => onPressBadge(id, anchor));
      }}
    >
      {children}
    </Pressable>
  );
}

export type NexusCardBadgeStripProps = {
  badges?: NexusCardBadge[];
  className?: string;
  maxVisible?: number;
};

/**
 * Inputs: compact badge descriptors.
 * Output: an icon-only card badge strip with a mutually exclusive hover/pinned tooltip mode.
 */
export function NexusCardBadgeStrip({
  badges = [],
  className,
  maxVisible = 3,
}: NexusCardBadgeStripProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const [canHover, setCanHover] = useState(false);
  const [tooltipState, setTooltipState] = useState<BadgeTooltipState>({ mode: 'idle' });
  const stripRef = useRef<ComponentRef<typeof View>>(null);
  const visibleBadges = badges.filter((badge) => !badge.hidden);

  useEffect(() => {
    setCanHover(supportsFineHover());
  }, []);

  const shownBadges = visibleBadges.slice(0, maxVisible);
  const hiddenBadges = visibleBadges.slice(maxVisible);
  const hiddenCount = hiddenBadges.length;
  const overflowTone = getBadgeToneClasses('muted', themeMode);
  const activeBadgeId = tooltipState.mode === 'idle' ? null : tooltipState.badgeId;
  const activeAnchor = tooltipState.mode === 'idle' ? null : tooltipState.anchor;

  const activeBadge = useMemo(() => {
    if (activeBadgeId === '__overflow__') {
      return hiddenCount > 0
        ? {
            id: '__overflow__',
            label: `${hiddenCount} more badges`,
            tone: 'muted' as const,
          }
        : null;
    }

    return visibleBadges.find((badge) => badge.id === activeBadgeId) ?? null;
  }, [activeBadgeId, hiddenCount, visibleBadges]);

  const closeTooltip = useCallback(() => {
    setTooltipState({ mode: 'idle' });
  }, []);

  const handleHoverIn = useCallback(
    (badgeId: string, anchor: BadgeAnchor | null) => {
      if (!canHover) {
        return;
      }

      setTooltipState((current) => {
        if (current.mode === 'pinned') {
          return current;
        }

        return { anchor, badgeId, mode: 'hover' };
      });
    },
    [canHover],
  );

  const handleHoverOut = useCallback(
    (badgeId: string) => {
      if (!canHover) {
        return;
      }

      setTooltipState((current) => {
        if (current.mode !== 'hover' || current.badgeId !== badgeId) {
          return current;
        }

        return { mode: 'idle' };
      });
    },
    [canHover],
  );

  const handlePressBadge = useCallback(
    (badgeId: string, anchor: BadgeAnchor | null) => {
      const currentState = tooltipState;

      if (currentState.mode === 'hover') {
        return;
      }

      if (currentState.mode === 'pinned' && currentState.badgeId === badgeId) {
        closeTooltip();
        return;
      }

      setTooltipState({ anchor, badgeId, mode: 'pinned' });
      visibleBadges.find((badge) => badge.id === badgeId)?.onPress?.();
    },
    [closeTooltip, tooltipState, visibleBadges],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || tooltipState.mode !== 'hover') {
      return undefined;
    }

    const webWindow = (globalThis as typeof globalThis & {
      window?: {
        addEventListener?: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
        removeEventListener?: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
      };
    }).window;

    const closeHover = () => {
      setTooltipState((current) => (current.mode === 'hover' ? { mode: 'idle' } : current));
    };

    webWindow?.addEventListener?.('scroll', closeHover, true);
    webWindow?.addEventListener?.('blur', closeHover);

    return () => {
      webWindow?.removeEventListener?.('scroll', closeHover, true);
      webWindow?.removeEventListener?.('blur', closeHover);
    };
  }, [tooltipState.mode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || tooltipState.mode !== 'pinned') {
      return undefined;
    }

    const webDocument = (globalThis as typeof globalThis & {
      document?: {
        addEventListener?: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
        removeEventListener?: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
      };
    }).document;

    const closePinnedFromOutside = (event: unknown) => {
      const rootNode = stripRef.current as unknown as { contains?: (target: unknown) => boolean } | null;
      const target = (event as { target?: unknown })?.target;

      if (target && rootNode?.contains?.(target)) {
        return;
      }

      closeTooltip();
    };

    webDocument?.addEventListener?.('pointerdown', closePinnedFromOutside, true);

    return () => {
      webDocument?.removeEventListener?.('pointerdown', closePinnedFromOutside, true);
    };
  }, [closeTooltip, tooltipState.mode]);

  if (visibleBadges.length === 0) {
    return null;
  }

  const modalPanelClassName = joinClasses(
    'min-w-[120px] max-w-[220px] rounded-xl border px-3 py-2 definition-lg',
    themeMode === 'dark'
      ? 'border-nexus-line bg-nexus-panel'
      : 'border-slate-300 bg-white',
  );

  const tooltipTextClassName = activeBadge
    ? joinClasses(
        uiDensity === 'large' ? 'text-sm' : 'text-xs',
        'font-semibold',
        getBadgeToneClasses(activeBadge.tone ?? 'default', themeMode).text,
      )
    : undefined;

  const hoverPanel = tooltipState.mode === 'hover' && activeBadge ? (
    <View
      className={joinClasses(
        modalPanelClassName,
        'absolute right-0 top-8 z-50',
      )}
      pointerEvents="none"
      style={BADGE_MODAL_PANEL_STYLE}
    >
      <Text className={tooltipTextClassName}>{activeBadge.label}</Text>
    </View>
  ) : null;

  const pinnedPanel = tooltipState.mode === 'pinned' && activeBadge ? (
    <Pressable
      accessibilityLabel={activeBadge.label}
      accessibilityRole="button"
      className={modalPanelClassName}
      onPress={(event) => {
        event.stopPropagation();
        closeTooltip();
      }}
      pointerEvents="auto"
      style={getTooltipPanelStyle(activeAnchor)}
    >
      <Text className={tooltipTextClassName}>{activeBadge.label}</Text>
    </Pressable>
  ) : null;

  const webPinnedModalContent = (
    <View className="flex-1" pointerEvents="box-none">
      {pinnedPanel}
    </View>
  );

  const nativePinnedModalContent = (
    <Pressable
      accessibilityLabel="Close badge details"
      accessibilityRole="button"
      className="flex-1"
      onPress={(event) => {
        event.stopPropagation();
        closeTooltip();
      }}
    >
      {pinnedPanel}
    </Pressable>
  );

  return (
    <View ref={stripRef} className={joinClasses('relative flex-row items-center gap-1 overflow-visible', className)}>
      {shownBadges.map((badge) => (
        <NexusCardBadgeButton
          key={badge.id}
          accessibilityLabel={badge.accessibilityLabel ?? badge.label}
          active={activeBadgeId === badge.id}
          id={badge.id}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          onPressBadge={handlePressBadge}
          tone={badge.tone ?? 'default'}
        >
          <NexusCardBadgeIconView badge={badge} />
        </NexusCardBadgeButton>
      ))}

      {hiddenCount > 0 ? (
        <NexusCardBadgeButton
          accessibilityLabel={`${hiddenCount} more badges`}
          active={activeBadgeId === '__overflow__'}
          id="__overflow__"
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          onPressBadge={handlePressBadge}
          tone="muted"
        >
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-xs' : 'text-[10px]',
              'font-bold',
              overflowTone.text,
            )}
          >
            +{hiddenCount}
          </Text>
        </NexusCardBadgeButton>
      ) : null}

      {hoverPanel}

      <Modal
        animationType="fade"
        onRequestClose={closeTooltip}
        transparent
        visible={tooltipState.mode === 'pinned' && activeBadge !== null}
      >
        {Platform.OS === 'web' ? webPinnedModalContent : nativePinnedModalContent}
      </Modal>
    </View>
  );
}
