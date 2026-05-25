/**
 * File: nexus-chrome.tsx
 * Description: Shared Nexus chrome, theme, bevel, and appearance helpers.
 */
import { View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import type { NexusThemeMode, NexusUiDensity } from '@runtime/nexus/nexus-shell';

export type NexusAppearance = {
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

export type NexusChromeClasses = {
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
export function joinClasses(...classes: (string | undefined)[]): string {
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
    cardFrameClass: 'relative overflow-hidden rounded-nexus border definition-none',
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
export function getNexusToneClasses(
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
export function getNexusBadgeWrapperClasses(
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
export function getNexusBadgeTextClasses(
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
export function getNexusCardPaddingClass(uiDensity: NexusUiDensity): string {
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
