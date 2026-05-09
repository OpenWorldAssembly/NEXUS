/**
 * File: nexus-card-badge-strip.tsx
 * Description: Renders compact icon badges for Nexus cards without consuming body space.
 */
import { useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, Pressable, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusCardBadge, NexusCardBadgeIcon, NexusCardBadgeTone } from './nexus-card-types';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const BADGE_DISMISS_LAYER_STYLE =
  Platform.OS === 'web'
    ? ({ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 } as never)
    : undefined;

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

export type NexusCardBadgeStripProps = {
  badges?: NexusCardBadge[];
  className?: string;
  maxVisible?: number;
};

/**
 * Inputs: compact badge descriptors.
 * Output: an icon-only card badge strip with hover and tap detail popovers.
 */
export function NexusCardBadgeStrip({
  badges = [],
  className,
  maxVisible = 3,
}: NexusCardBadgeStripProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const visibleBadges = badges.filter((badge) => !badge.hidden);

  const shownBadges = visibleBadges.slice(0, maxVisible);
  const hiddenBadges = visibleBadges.slice(maxVisible);
  const hiddenCount = hiddenBadges.length;
  const overflowTone = getBadgeToneClasses('muted', themeMode);
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

  if (visibleBadges.length === 0) {
    return null;
  }

  const popoverClassName = joinClasses(
    'absolute right-0 top-full z-50 mt-2 min-w-[120px] max-w-[220px] rounded-xl border px-3 py-2 shadow-lg',
    themeMode === 'dark'
      ? 'border-nexus-line bg-nexus-panel'
      : 'border-slate-300 bg-white',
  );

  return (
    <View className={joinClasses('relative flex-row items-center gap-1 overflow-visible', className)}>
      {shownBadges.map((badge) => {
        const tone = getBadgeToneClasses(badge.tone ?? 'default', themeMode);
        const frameClassName = joinClasses(
          'items-center justify-center rounded-nexus border',
          uiDensity === 'large' ? 'h-7 w-7' : 'h-6 w-6',
          tone.frame,
        );
        const isActive = activeBadgeId === badge.id;

        return (
          <Pressable
            key={badge.id}
            accessibilityLabel={badge.accessibilityLabel ?? badge.label}
            accessibilityRole="button"
            className={joinClasses(frameClassName, isActive ? 'opacity-100' : undefined)}
            onHoverIn={() => setActiveBadgeId(badge.id)}
            onHoverOut={() => setActiveBadgeId((current) => (current === badge.id ? null : current))}
            onPress={(event) => {
              event.stopPropagation();
              setActiveBadgeId((current) => (current === badge.id ? null : badge.id));
              badge.onPress?.();
            }}
          >
            <NexusCardBadgeIconView badge={badge} />
          </Pressable>
        );
      })}

      {hiddenCount > 0 ? (
        <Pressable
          accessibilityLabel={`${hiddenCount} more badges`}
          accessibilityRole="button"
          className={joinClasses(
            'items-center justify-center rounded-nexus border px-1.5',
            uiDensity === 'large' ? 'h-7 min-w-[1.75rem]' : 'h-6 min-w-[1.5rem]',
            overflowTone.frame,
          )}
          onHoverIn={() => setActiveBadgeId('__overflow__')}
          onHoverOut={() =>
            setActiveBadgeId((current) => (current === '__overflow__' ? null : current))
          }
          onPress={(event) => {
            event.stopPropagation();
            setActiveBadgeId((current) => (current === '__overflow__' ? null : '__overflow__'));
          }}
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
        </Pressable>
      ) : null}

      {activeBadge ? (
        <Pressable
          accessibilityLabel="Close badge details"
          accessibilityRole="button"
          className={Platform.OS === 'web' ? 'fixed inset-0 z-40' : 'absolute inset-0 z-40'}
          onPress={(event) => {
            event.stopPropagation();
            setActiveBadgeId(null);
          }}
          style={BADGE_DISMISS_LAYER_STYLE}
        />
      ) : null}

      {activeBadge ? (
        <View className={popoverClassName} style={{ elevation: 70 }}>
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-sm' : 'text-xs',
              'font-semibold',
              getBadgeToneClasses(activeBadge.tone ?? 'default', themeMode).text,
            )}
          >
            {activeBadge.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
