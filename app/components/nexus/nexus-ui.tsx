/**
 * File: nexus-ui.tsx
 * Description: Provides shared NativeWind UI primitives for the guest nexus screens.
 */
import {
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { NexusFeatureStatusId } from '@app/components/nexus/nexus-feature-status-registry';
import { useNexusFeatureStatus } from '@app/components/nexus/nexus-feature-status-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import type { NexusThemeMode, NexusUiDensity } from '@runtime/nexus/nexus-shell';

type NexusCardProps = PropsWithChildren<{
  className?: string;
  tone?: NexusCardTone | 'default';
}>;

type NexusSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

type NexusBadgeProps = {
  label: string;
  tone?: NexusCardTone | 'default';
  className?: string;
  textClassName?: string;
};

type NexusChevronIconProps = {
  isOpen: boolean;
  className?: string;
};

type NexusActionButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  featureStatusId?: NexusFeatureStatusId;
};

type NexusSegmentedPillProps = {
  options: {
    id: string;
    label: string;
  }[];
  activeId: string;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

type NexusAttachedTabRailProps = {
  tabs: {
    id: string;
    title: string;
    detail?: string;
  }[];
  activeId: string;
  onSelect: (tabId: string) => void;
  compact?: boolean;
};

type NexusInlineSelectProps = {
  label?: string;
  valueLabel: string;
  options: {
    id: string;
    label: string;
  }[];
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  menuLayerClassName?: string;
};

type NexusAppearance = {
  bodyTextClass: string;
  cardInsetClass: string;
  headingTextClass: string;
  itemBodyClass: string;
  itemMetaClass: string;
  itemTitleClass: string;
  metricLabelClass: string;
  metricValueClass: string;
  pageContainerClass: string;
  sectionBodyClass: string;
  surfaceTitleClass: string;
  textInputClass: string;
  textInputPlaceholderColor: string;
};

type NexusChromeClasses = {
  actionButtonFrameClass: string;
  attachedTabActiveClass: string;
  attachedTabClass: string;
  badgeFrameClass: string;
  cardFrameClass: string;
  cardInsetClass: string;
  compactButtonActiveClass: string;
  compactButtonClass: string;
  discoverableScopeClass: string;
  ghostActionSurfaceClass: string;
  inlineSelectMenuClass: string;
  inlineSelectOptionClass: string;
  inlineSelectTriggerClass: string;
  mobileMenuButtonClass: string;
  navItemActiveClass: string;
  navItemClass: string;
  panelCardClass: string;
  preferenceButtonClass: string;
  preferencePanelClass: string;
  preferenceSwitchTrackActiveClass: string;
  preferenceSwitchTrackClass: string;
  primaryActionSurfaceClass: string;
  railToggleClass: string;
  secondaryActionSurfaceClass: string;
  segmentedActiveClass: string;
  segmentedContainerClass: string;
  scopeChipActiveClass: string;
  scopeChipClass: string;
  scopeRowActiveClass: string;
  scopeRowClass: string;
  statChipClass: string;
  textInputClass: string;
  topToggleButtonClass: string;
  topToggleButtonPrimaryClass: string;
};

/**
 * Inputs: any number of class names.
 * Output: a single space-delimited className string.
 */
function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Inputs: the active Nexus theme mode and optional subtle flag.
 * Output: non-interactive edge highlights that create a hard beveled frame.
 */
export function NexusThemedBevelEdges({
  themeMode,
  subtle = false,
}: {
  themeMode: NexusThemeMode;
  subtle?: boolean;
}) {
  const topEdgeClass =
    themeMode === 'dark'
      ? subtle
        ? 'bg-white/10'
        : 'bg-white/20'
      : subtle
        ? 'bg-white/60'
        : 'bg-white/100';
  const bottomEdgeClass =
    themeMode === 'dark'
      ? subtle
        ? 'bg-black/30'
        : 'bg-black/40'
      : subtle
        ? 'bg-slate-400/30'
        : 'bg-slate-500/30';

  return (
    <View pointerEvents="none" className="absolute inset-0">
      <View
        className={joinClasses('absolute inset-x-0 top-0 h-px', topEdgeClass)}
      />
      <View
        className={joinClasses(
          'absolute inset-x-0 bottom-0 h-px',
          bottomEdgeClass,
        )}
      />
      <View
        className={joinClasses('absolute inset-y-0 left-0 w-px', topEdgeClass)}
      />
      <View
        className={joinClasses(
          'absolute inset-y-0 right-0 w-px',
          bottomEdgeClass,
        )}
      />
    </View>
  );
}

/**
 * Inputs: optional subtle flag.
 * Output: non-interactive edge highlights using the current Nexus shell theme.
 */
export function NexusBevelEdges({ subtle = false }: { subtle?: boolean }) {
  const { themeMode } = useNexusShell();

  return <NexusThemedBevelEdges themeMode={themeMode} subtle={subtle} />;
}

/**
 * Inputs: the active Nexus shell theme and density.
 * Output: shared class recipes for sharp Nexus chrome surfaces.
 */
export function getNexusChromeClasses(
  themeMode: NexusThemeMode,
  uiDensity: NexusUiDensity,
): NexusChromeClasses {
  const darkSurface = themeMode === 'dark';
  const defaultSurfaceClass = darkSurface
    ? 'border-nexus-line bg-white/5'
    : 'border-slate-300 bg-slate-100';
  const panelSurfaceClass = darkSurface
    ? 'border-nexus-line/70 bg-nexus-panel'
    : 'border-slate-300 bg-white';
  const mutedPanelSurfaceClass = darkSurface
    ? 'border-nexus-line/70 bg-white/5'
    : 'border-slate-300 bg-slate-50';
  const activeSkySurfaceClass = darkSurface
    ? 'border-nexus-sky bg-nexus-sky/10'
    : 'border-sky-400 bg-sky-50';
  const activeMintSurfaceClass = darkSurface
    ? 'border-nexus-mint bg-nexus-mint/10'
    : 'border-emerald-400 bg-emerald-50';
  const compactControlSizeClass =
    uiDensity === 'large' ? 'px-4 py-2.5' : 'px-3 py-2';
  const actionButtonSizeClass =
    uiDensity === 'large' ? 'px-5 py-3.5' : 'px-4 py-3';

  return {
    actionButtonFrameClass: joinClasses(
      'relative self-start overflow-hidden rounded-nexus border',
      actionButtonSizeClass,
    ),
    attachedTabActiveClass: darkSurface
      ? 'border-nexus-line/70 border-b-nexus-panel bg-nexus-panel'
      : 'border-slate-300 border-b-white bg-white',
    attachedTabClass: darkSurface
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100',
    badgeFrameClass: joinClasses('rounded-nexus border', compactControlSizeClass),
    cardFrameClass: 'relative overflow-hidden rounded-nexus border shadow-none',
    cardInsetClass: darkSurface
      ? 'rounded-nexus border border-nexus-line/60 bg-white/5'
      : 'rounded-nexus border border-slate-300 bg-slate-100',
    compactButtonActiveClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      compactControlSizeClass,
      activeMintSurfaceClass,
    ),
    compactButtonClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      compactControlSizeClass,
      darkSurface ? 'border-nexus-line bg-nexus-ink/50' : 'border-slate-300 bg-white',
    ),
    discoverableScopeClass: joinClasses(
      'relative overflow-hidden rounded-nexus border px-3 py-3',
      defaultSurfaceClass,
    ),
    ghostActionSurfaceClass: 'border-transparent bg-transparent',
    inlineSelectMenuClass: darkSurface
      ? 'border-nexus-line/70 bg-nexus-panel'
      : 'border-slate-300 bg-white',
    inlineSelectOptionClass: 'rounded-nexus-sm px-3 py-3',
    inlineSelectTriggerClass: joinClasses(
      'relative min-w-[190px] overflow-hidden rounded-nexus border px-4 py-3',
      defaultSurfaceClass,
    ),
    mobileMenuButtonClass: joinClasses(
      'relative overflow-hidden rounded-nexus border px-4 py-3',
      defaultSurfaceClass,
    ),
    navItemActiveClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      activeSkySurfaceClass,
    ),
    navItemClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      defaultSurfaceClass,
    ),
    panelCardClass: panelSurfaceClass,
    preferenceButtonClass: darkSurface
      ? 'border-nexus-line/80 bg-nexus-ink/40'
      : 'border-slate-300 bg-slate-100',
    preferencePanelClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      mutedPanelSurfaceClass,
    ),
    preferenceSwitchTrackActiveClass: darkSurface
      ? 'border-nexus-sky bg-nexus-sky/10'
      : 'border-sky-400 bg-sky-50',
    preferenceSwitchTrackClass: defaultSurfaceClass,
    primaryActionSurfaceClass: 'border-nexus-sky bg-nexus-sky',
    railToggleClass: darkSurface
      ? 'border-nexus-line bg-nexus-ink'
      : 'border-slate-300 bg-white',
    secondaryActionSurfaceClass: defaultSurfaceClass,
    segmentedActiveClass: darkSurface ? 'bg-nexus-sky/10' : 'bg-sky-100',
    segmentedContainerClass: joinClasses(
      'relative flex-row self-start overflow-hidden rounded-nexus border',
      defaultSurfaceClass,
    ),
    scopeChipActiveClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      compactControlSizeClass,
      activeMintSurfaceClass,
    ),
    scopeChipClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      compactControlSizeClass,
      defaultSurfaceClass,
    ),
    scopeRowActiveClass: joinClasses(
      'relative flex-1 overflow-hidden rounded-nexus border',
      activeSkySurfaceClass,
    ),
    scopeRowClass: joinClasses(
      'relative flex-1 overflow-hidden rounded-nexus border',
      defaultSurfaceClass,
    ),
    statChipClass: darkSurface
      ? 'relative flex-1 overflow-hidden rounded-nexus border border-nexus-line bg-nexus-ink/40 px-2 py-3'
      : 'relative flex-1 overflow-hidden rounded-nexus border border-slate-300 bg-white px-2 py-3',
    textInputClass: darkSurface
      ? 'rounded-nexus border-nexus-line bg-white/5 text-nexus-text'
      : 'rounded-nexus border-slate-300 bg-slate-100 text-slate-900',
    topToggleButtonClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      compactControlSizeClass,
      defaultSurfaceClass,
    ),
    topToggleButtonPrimaryClass: joinClasses(
      'relative overflow-hidden rounded-nexus border',
      compactControlSizeClass,
      darkSurface ? 'border-nexus-sky bg-nexus-sky' : 'border-sky-500 bg-sky-500',
    ),
  };
}

/**
 * Inputs: none.
 * Output: shared class recipes for the current Nexus chrome theme.
 */
export function useNexusChrome(): NexusChromeClasses {
  const { themeMode, uiDensity } = useNexusShell();

  return getNexusChromeClasses(themeMode, uiDensity);
}

/**
 * Inputs: the active Nexus theme mode and card tone.
 * Output: the correct card surface classes for that theme and tone.
 */
function getNexusToneClasses(
  themeMode: NexusThemeMode,
  tone: NexusCardTone | 'default',
): string {
  if (themeMode === 'light') {
    const lightToneClasses: Record<NexusCardTone | 'default', string> = {
      default: 'border-slate-300 bg-white',
      sky: 'border-sky-300 bg-sky-50',
      mint: 'border-emerald-300 bg-emerald-50',
      gold: 'border-amber-300 bg-amber-50',
      rose: 'border-rose-300 bg-rose-50',
    };

    return lightToneClasses[tone];
  }

  const darkToneClasses: Record<NexusCardTone | 'default', string> = {
    default: 'border-nexus-line/70 bg-nexus-panel',
    sky: 'border-nexus-sky/30 bg-nexus-strong',
    mint: 'border-nexus-mint/30 bg-nexus-strong',
    gold: 'border-nexus-gold/30 bg-nexus-strong',
    rose: 'border-nexus-rose/30 bg-nexus-strong',
  };

  return darkToneClasses[tone];
}

/**
 * Inputs: the active Nexus theme mode and badge tone.
 * Output: badge wrapper classes for the requested theme and tone.
 */
function getNexusBadgeWrapperClasses(
  themeMode: NexusThemeMode,
  tone: NexusCardTone | 'default',
): string {
  if (themeMode === 'light') {
    const lightBadgeWrapperClasses: Record<NexusCardTone | 'default', string> = {
      default: 'border-slate-300 bg-slate-100',
      sky: 'border-sky-300 bg-sky-100',
      mint: 'border-emerald-300 bg-emerald-100',
      gold: 'border-amber-300 bg-amber-100',
      rose: 'border-rose-300 bg-rose-100',
    };

    return lightBadgeWrapperClasses[tone];
  }

  const darkBadgeWrapperClasses: Record<NexusCardTone | 'default', string> = {
    default: 'border-nexus-line/70 bg-white/5',
    sky: 'border-nexus-sky/40 bg-nexus-sky/10',
    mint: 'border-nexus-mint/40 bg-nexus-mint/10',
    gold: 'border-nexus-gold/40 bg-nexus-gold/10',
    rose: 'border-nexus-rose/40 bg-nexus-rose/10',
  };

  return darkBadgeWrapperClasses[tone];
}

/**
 * Inputs: the active Nexus theme mode and badge tone.
 * Output: badge text classes for the requested theme and tone.
 */
function getNexusBadgeTextClasses(
  themeMode: NexusThemeMode,
  tone: NexusCardTone | 'default',
): string {
  if (tone === 'default') {
    return themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  }

  const coloredBadgeTextClasses: Record<NexusCardTone, string> = {
    sky: 'text-nexus-sky',
    mint: 'text-nexus-mint',
    gold: 'text-nexus-gold',
    rose: 'text-nexus-rose',
  };

  return coloredBadgeTextClasses[tone];
}

/**
 * Inputs: the active Nexus UI density.
 * Output: the default card padding class for that density.
 */
function getNexusCardPaddingClass(uiDensity: NexusUiDensity): string {
  return uiDensity === 'large' ? 'p-6' : 'p-5';
}

/**
 * Inputs: none.
 * Output: shared theme and density class tokens for nexus route surfaces.
 */
export function useNexusAppearance(): NexusAppearance {
  const { themeMode, uiDensity } = useNexusShell();
  const headingTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const bodyTextClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return {
    bodyTextClass,
    cardInsetClass: chrome.cardInsetClass,
    headingTextClass,
    itemBodyClass: joinClasses(
      uiDensity === 'large' ? 'text-base leading-7' : 'text-sm leading-6',
      bodyTextClass,
    ),
    itemMetaClass: joinClasses(
      uiDensity === 'large'
        ? 'text-sm uppercase tracking-[2px]'
        : 'text-xs uppercase tracking-[2px]',
      bodyTextClass,
    ),
    itemTitleClass: joinClasses(
      uiDensity === 'large' ? 'text-lg' : 'text-base',
      'font-semibold',
      headingTextClass,
    ),
    metricLabelClass: joinClasses(
      uiDensity === 'large'
        ? 'text-base font-semibold uppercase tracking-[2px]'
        : 'text-sm font-semibold uppercase tracking-[2px]',
      bodyTextClass,
    ),
    metricValueClass: joinClasses(
      uiDensity === 'large' ? 'mt-4 text-5xl lg:text-6xl' : 'mt-3 text-4xl',
      'font-bold',
      headingTextClass,
    ),
    pageContainerClass:
      uiDensity === 'large'
        ? 'w-full max-w-[1680px] self-center gap-8 px-5 py-8 lg:px-12 lg:py-12'
        : 'w-full max-w-[1600px] self-center gap-6 px-4 py-6 lg:px-8 lg:py-8',
    sectionBodyClass: joinClasses(
      uiDensity === 'large' ? 'text-lg leading-8' : 'text-sm leading-7',
      bodyTextClass,
    ),
    surfaceTitleClass: joinClasses(
      uiDensity === 'large' ? 'text-3xl' : 'text-2xl',
      'font-bold',
      headingTextClass,
    ),
    textInputClass: joinClasses(
      chrome.textInputClass,
      uiDensity === 'large' ? 'text-lg' : 'text-base',
    ),
    textInputPlaceholderColor: themeMode === 'dark' ? '#8fa7ba' : '#64748b',
  };
}

/**
 * Inputs: children content plus optional layout and tone classes.
 * Output: a styled nexus card container.
 */
export function NexusCard({
  children,
  className,
  tone = 'default',
}: NexusCardProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return (
    <View
      className={joinClasses(
        chrome.cardFrameClass,
        getNexusCardPaddingClass(uiDensity),
        getNexusToneClasses(themeMode, tone),
        className,
      )}
    >
      {children}
      <NexusThemedBevelEdges themeMode={themeMode} />
    </View>
  );
}

/**
 * Inputs: eyebrow, title, optional description, and optional trailing content.
 * Output: a standard section header block for nexus screens.
 */
export function NexusSectionHeader({
  eyebrow,
  title,
  description,
  trailing,
}: NexusSectionHeaderProps) {
  const { themeMode, uiDensity } = useNexusShell();

  return (
    <View className="gap-3 lg:flex-row lg:items-end lg:justify-between">
      <View className="min-w-0 flex-1 gap-2">
        {eyebrow ? (
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            {eyebrow}
          </Text>
        ) : null}
        <Text
          className={joinClasses(
            uiDensity === 'large' ? 'text-4xl lg:text-5xl' : 'text-3xl lg:text-4xl',
            'font-bold',
            themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
          )}
        >
          {title}
        </Text>
        {description ? (
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-lg lg:text-xl' : 'text-base lg:text-lg',
              'leading-7',
              themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600',
            )}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {trailing ? <View className="shrink-0">{trailing}</View> : null}
    </View>
  );
}

/**
 * Inputs: a label string and an optional color tone.
 * Output: a small badge used for metadata, state, and policy cues.
 */
export function NexusBadge({
  label,
  tone = 'default',
  className,
  textClassName,
}: NexusBadgeProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);

  return (
    <View
      className={joinClasses(
        chrome.badgeFrameClass,
        getNexusBadgeWrapperClasses(themeMode, tone),
        className,
      )}
    >
      <Text
        className={joinClasses(
          'text-xs font-semibold uppercase tracking-[2px]',
          getNexusBadgeTextClasses(themeMode, tone),
          textClassName,
        )}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Inputs: whether the chevron is open plus optional wrapper classes.
 * Output: a small vertical chevron icon that matches the Nexus drawer language.
 */
export function NexusChevronIcon({
  isOpen,
  className,
}: NexusChevronIconProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const lineClass =
    themeMode === 'dark' ? 'bg-nexus-text' : 'bg-slate-900';
  const sizeClass = uiDensity === 'large' ? 'w-2.5' : 'w-2';

  return (
    <View
      className={joinClasses(
        'h-4 w-4 items-center justify-center',
        isOpen ? 'rotate-180' : '',
        className,
      )}
    >
      <View className="flex-row items-center justify-center gap-[1px]">
        <View
          className={joinClasses(
            sizeClass,
            'h-[2px] rotate-45 rounded-full',
            lineClass,
          )}
        />
        <View
          className={joinClasses(
            sizeClass,
            'h-[2px] -rotate-45 rounded-full',
            lineClass,
          )}
        />
      </View>
    </View>
  );
}

/**
 * Inputs: button label, optional press handler, disabled flag, and variant.
 * Output: a shared nexus action button.
 */
export function NexusActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'secondary',
  featureStatusId,
}: NexusActionButtonProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const featureStatus = useNexusFeatureStatus();
  const [isHovered, setIsHovered] = useState(false);
  const pressableRef = useRef<View | null>(null);
  const variantClasses =
    variant === 'primary'
      ? chrome.primaryActionSurfaceClass
      : variant === 'ghost'
        ? chrome.ghostActionSurfaceClass
        : chrome.secondaryActionSurfaceClass;

  const textClasses =
    variant === 'primary'
      ? 'text-nexus-canvas'
      : themeMode === 'dark'
        ? 'text-nexus-text'
        : 'text-slate-900';
  const markerWrapperClass =
    themeMode === 'dark'
      ? isHovered
        ? 'border-nexus-rose bg-nexus-rose/20'
        : 'border-nexus-rose/70 bg-nexus-rose/10'
      : isHovered
        ? 'border-rose-500 bg-rose-100'
        : 'border-rose-300 bg-rose-50';
  const markerTextClass =
    themeMode === 'dark'
      ? isHovered
        ? 'text-nexus-rose'
        : 'text-nexus-rose/90'
      : isHovered
        ? 'text-rose-600'
        : 'text-rose-500';
  const isExplainableDisabled = disabled && Boolean(featureStatusId) && Boolean(featureStatus);
  const isActuallyDisabled = disabled && !isExplainableDisabled;

  const handlePress = () => {
    if (
      isExplainableDisabled &&
      featureStatusId &&
      featureStatus &&
      pressableRef.current?.measureInWindow
    ) {
      pressableRef.current.measureInWindow((x, y, width, height) => {
        featureStatus.openFeatureStatus(featureStatusId, {
          x,
          y,
          width,
          height,
        });
      });
      return;
    }

    onPress?.();
  };

  return (
    <View ref={pressableRef} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={disabled ? { disabled: true } : undefined}
        className={joinClasses(
          chrome.actionButtonFrameClass,
          variantClasses,
          disabled ? 'opacity-45' : '',
        )}
        disabled={isActuallyDisabled}
        onHoverIn={
          isExplainableDisabled ? () => setIsHovered(true) : undefined
        }
        onHoverOut={
          isExplainableDisabled ? () => setIsHovered(false) : undefined
        }
        onPress={handlePress}
      >
        <View className="flex-row items-center gap-2">
          <Text className={joinClasses('text-sm font-semibold', textClasses)}>
            {label}
          </Text>
          {isExplainableDisabled ? (
            <View
              className={joinClasses(
                'h-4.5 w-4.5 items-center justify-center rounded-full border',
                markerWrapperClass
              )}
              style={{
                transform: [{ scale: isHovered ? 1.08 : 1 }],
              }}
            >
              <Text className={joinClasses('text-[10px] font-bold', markerTextClass)}>
                !
              </Text>
            </View>
          ) : null}
        </View>
        <NexusThemedBevelEdges themeMode={themeMode} subtle />
      </Pressable>
    </View>
  );
}

export function NexusSegmentedPill({
  options,
  activeId,
  onSelect,
  disabled = false,
  compact = false,
}: NexusSegmentedPillProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const activeSegmentClass = chrome.segmentedActiveClass;
  const activeTextClass =
    themeMode === 'dark' ? 'text-nexus-sky' : 'text-sky-700';
  const inactiveTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const segmentSizeClass =
    compact || uiDensity === 'small' ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <View
      className={joinClasses(
        chrome.segmentedContainerClass,
        disabled ? 'opacity-45' : '',
      )}
    >
      {options.map((option, optionIndex) => {
        const isActive = option.id === activeId;

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            className={joinClasses(
              segmentSizeClass,
              optionIndex > 0 ? 'border-l' : '',
              themeMode === 'dark' ? 'border-nexus-line/70' : 'border-slate-300',
              isActive ? activeSegmentClass : '',
            )}
            disabled={disabled}
            onPress={() => onSelect(option.id)}
          >
            <Text
              className={joinClasses(
                compact || uiDensity === 'small'
                  ? 'text-xs font-semibold uppercase tracking-[2px]'
                  : 'text-sm font-semibold uppercase tracking-[2px]',
                isActive ? activeTextClass : inactiveTextClass,
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <NexusThemedBevelEdges themeMode={themeMode} subtle />
    </View>
  );
}

export function NexusAttachedTabRail({
  tabs,
  activeId,
  onSelect,
  compact = false,
}: NexusAttachedTabRailProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const appearance = useNexusAppearance();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const inactiveTabClass = chrome.attachedTabClass;
  const activeTabClass = chrome.attachedTabActiveClass;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
    >
      <View className="flex-row items-end gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              className={`relative min-w-[140px] overflow-hidden border px-4 ${
                compact ? 'rounded-t-nexus py-2.5' : 'rounded-t-nexus py-3'
              } ${isActive ? `${activeTabClass} -mb-px` : inactiveTabClass}`}
              onPress={() => onSelect(tab.id)}
            >
              <Text className={appearance.itemTitleClass}>{tab.title}</Text>
              {tab.detail ? (
                <Text className={appearance.itemMetaClass}>{tab.detail}</Text>
              ) : null}
              <NexusThemedBevelEdges themeMode={themeMode} subtle />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function NexusInlineSelect({
  label,
  valueLabel,
  options,
  onSelect,
  disabled = false,
  menuLayerClassName,
}: NexusInlineSelectProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View | null>(null);
  const triggerClass = chrome.inlineSelectTriggerClass;
  const menuClass = chrome.inlineSelectMenuClass;
  const textClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const metaClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const menuWidth = Math.min(260, Math.max(220, viewportWidth - 32));
  const horizontalPadding = 16;
  const verticalPadding = 16;
  const overlayLeft = anchorRect
    ? Math.min(
        Math.max(anchorRect.x, horizontalPadding),
        viewportWidth - menuWidth - horizontalPadding
      )
    : horizontalPadding;
  const overlayTop = anchorRect
    ? Math.max(
        verticalPadding,
        Math.min(
          Math.max(anchorRect.y + anchorRect.height + 8, verticalPadding),
          viewportHeight - 240
        )
      )
    : verticalPadding;

  const handleToggleMenu = () => {
    if (disabled) {
      return;
    }

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (!triggerRef.current?.measureInWindow) {
      setIsOpen(true);
      return;
    }

    triggerRef.current.measureInWindow((x, y, width, height) => {
      setAnchorRect({ x, y, width, height });
      setIsOpen(true);
    });
  };

  return (
    <View className="gap-2">
      {label ? <Text className={`text-xs uppercase tracking-[3px] ${metaClass}`}>{label}</Text> : null}
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          className={joinClasses(
            triggerClass,
            disabled ? 'opacity-45' : ''
          )}
          disabled={disabled}
          onPress={handleToggleMenu}
        >
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-base' : 'text-sm',
              'font-semibold',
              textClass
            )}
          >
            {valueLabel}
          </Text>
          <NexusThemedBevelEdges themeMode={themeMode} subtle />
        </Pressable>
      </View>
      <Modal
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen && !disabled}
      >
        <View className="flex-1">
          <Pressable
            accessibilityRole="button"
            className="absolute inset-0"
            onPress={() => setIsOpen(false)}
          />
          <View
            className={joinClasses(
              'absolute overflow-hidden rounded-nexus border p-2 shadow-none',
              menuClass,
              menuLayerClassName
            )}
            style={{
              left: overlayLeft,
              top: overlayTop,
              width: menuWidth,
            }}
          >
            {options.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                className={chrome.inlineSelectOptionClass}
                onPress={() => {
                  setIsOpen(false);
                  onSelect(option.id);
                }}
              >
                <Text className={joinClasses('text-sm font-semibold', textClass)}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <NexusThemedBevelEdges themeMode={themeMode} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
