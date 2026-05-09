/**
 * File: nexus-tab-primitives.tsx
 * Description: Provides shared visual primitives for Nexus tab-like controls.
 */
import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';

export type NexusTabTruncateMode = 'middle' | 'end' | 'none';

export type NexusTabSizeConfig = {
  minWidth: number;
  inactiveMaxWidth: number;
  activeMaxWidth: number;
  inactiveMaxCharacters: number;
  activeMaxCharacters: number;
};

type NexusTabFrameProps = {
  active: boolean;
  children: ReactNode;
  accessibilityLabel?: string;
  className?: string;
  compact?: boolean;
  contentClassName?: string;
  depth?: number;
  disabled?: boolean;
  maxWidth?: number;
  minWidth?: number;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPress?: () => void;
  trailing?: ReactNode;
};

type NexusTabLabelProps = {
  active: boolean;
  label: string;
  className?: string;
  depth?: number;
  maxCharacters?: number;
  numberOfLines?: number;
  sizeConfig?: NexusTabSizeConfig;
  truncate?: NexusTabTruncateMode;
};

type NexusTabDetailProps = {
  active?: boolean;
  children: ReactNode;
  className?: string;
};

type NexusTabCloseButtonProps = {
  accessibilityLabel?: string;
  className?: string;
  onPress: () => void;
};

function joinClasses(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function NexusTabBevelEdges({ subtle = false }: { subtle?: boolean }) {
  const { themeMode } = useNexusShell();
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
      <View className={joinClasses('absolute inset-y-0 left-0 w-px', topEdgeClass)} />
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
 * Inputs: tab depth and current UI density.
 * Output: shared sizing guardrails for Nexus tab labels and frames.
 */
export function getNexusTabSizeConfig(
  depth: number,
  uiDensity: string,
): NexusTabSizeConfig {
  const depthIndex = Math.min(depth, 3);
  const densityOffset = uiDensity === 'large' ? 16 : 0;

  if (depthIndex === 0) {
    return {
      minWidth: 112 + densityOffset,
      inactiveMaxWidth: 320 + densityOffset,
      activeMaxWidth: 360 + densityOffset,
      inactiveMaxCharacters: 48,
      activeMaxCharacters: 64,
    };
  }

  if (depthIndex === 1) {
    return {
      minWidth: 88 + densityOffset,
      inactiveMaxWidth: 260 + densityOffset,
      activeMaxWidth: 300 + densityOffset,
      inactiveMaxCharacters: 38,
      activeMaxCharacters: 52,
    };
  }

  return {
    minWidth: 76 + densityOffset,
    inactiveMaxWidth: 220 + densityOffset,
    activeMaxWidth: 260 + densityOffset,
    inactiveMaxCharacters: 30,
    activeMaxCharacters: 42,
  };
}

/**
 * Inputs: source text and a maximum character count.
 * Output: middle-truncated text that preserves both ends of the label.
 */
export function middleTruncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength || maxLength <= 0) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  const visibleCharacterCount = Math.max(1, maxLength - 3);
  const leadingCount = Math.ceil(visibleCharacterCount / 2);
  const trailingCount = Math.floor(visibleCharacterCount / 2);

  return `${value.slice(0, leadingCount)}...${value.slice(value.length - trailingCount)}`;
}

/**
 * Inputs: a label and tab-display options.
 * Output: the rendered label after the selected truncation strategy is applied.
 */
export function getRenderedNexusTabLabel({
  label,
  active,
  truncate,
  sizeConfig,
  maxCharacters,
}: {
  label: string;
  active: boolean;
  truncate: NexusTabTruncateMode;
  sizeConfig: NexusTabSizeConfig;
  maxCharacters?: number;
}): string {
  if (truncate === 'none') {
    return label;
  }

  const resolvedMaxCharacters =
    maxCharacters ??
    (active
      ? sizeConfig.activeMaxCharacters
      : sizeConfig.inactiveMaxCharacters);

  if (truncate === 'middle') {
    return middleTruncateText(label, resolvedMaxCharacters);
  }

  return label.length > resolvedMaxCharacters
    ? `${label.slice(0, Math.max(1, resolvedMaxCharacters - 3))}...`
    : label;
}

/**
 * Inputs: visual tab state and content.
 * Output: a shared Nexus file-tab frame; behavior stays with the caller.
 */
export function NexusTabFrame({
  active,
  children,
  accessibilityLabel,
  className,
  compact = false,
  contentClassName,
  depth = 0,
  disabled = false,
  maxWidth,
  minWidth,
  onHoverIn,
  onHoverOut,
  onLayout,
  onPress,
  trailing,
}: NexusTabFrameProps) {
  const { themeMode } = useNexusShell();
  const isDark = themeMode === 'dark';
  const depthIndex = Math.min(depth, 3);
  const baseSizeClass =
    compact || depthIndex >= 2
      ? 'px-2.5 py-1.5'
      : depthIndex === 1
        ? 'px-3 py-2'
        : 'px-3.5 py-2.5';
  const inactiveSurfaceClass = isDark
    ? 'border-nexus-line/60 bg-white/5'
    : 'border-slate-300 bg-slate-100';
  const activeSurfaceClass = isDark
    ? 'border-nexus-sky bg-nexus-panel'
    : 'border-sky-400 bg-white';
  const frameClassName = joinClasses(
    'relative shrink-0 overflow-hidden rounded-t-nexus rounded-b-none border shadow-sm',
    baseSizeClass,
    active
      ? joinClasses(activeSurfaceClass, 'z-10 -mb-px border-b-transparent shadow-md')
      : joinClasses(inactiveSurfaceClass, 'opacity-90'),
    className,
  );
  const frameStyle = {
    ...(minWidth !== undefined ? { minWidth } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
  };
  const tabContent = (
    <>
      {active ? (
        <>
          <View
            pointerEvents="none"
            className={joinClasses(
              'absolute inset-x-0 top-0 h-1',
              isDark ? 'bg-nexus-sky' : 'bg-sky-500',
            )}
          />
          <View
            pointerEvents="none"
            className={joinClasses(
              'absolute inset-x-2 bottom-0 h-px',
              isDark ? 'bg-nexus-panel' : 'bg-white',
            )}
          />
        </>
      ) : null}
      {trailing ? (
        <View className="min-w-0 flex-row items-start justify-between gap-3">
          <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            className={joinClasses('min-w-0 flex-1', contentClassName)}
            disabled={disabled}
            onHoverIn={onHoverIn}
            onHoverOut={onHoverOut}
            onPress={onPress}
          >
            {children}
          </Pressable>
          {trailing}
        </View>
      ) : (
        <View className={joinClasses('min-w-0', contentClassName)}>{children}</View>
      )}
      <NexusTabBevelEdges subtle />
    </>
  );

  if (trailing || !onPress) {
    return (
      <View className={frameClassName} onLayout={onLayout} style={frameStyle}>
        {tabContent}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      className={frameClassName}
      disabled={disabled}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onLayout={onLayout}
      onPress={onPress}
      style={frameStyle}
    >
      {tabContent}
    </Pressable>
  );
}

/**
 * Inputs: a tab label and active/depth state.
 * Output: a consistently styled Nexus tab label.
 */
export function NexusTabLabel({
  active,
  label,
  className,
  depth = 0,
  maxCharacters,
  numberOfLines,
  sizeConfig,
  truncate = 'middle',
}: NexusTabLabelProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const isDark = themeMode === 'dark';
  const activeTextClass = isDark ? 'text-nexus-sky' : 'text-sky-700';
  const inactiveTextClass = isDark ? 'text-nexus-text' : 'text-slate-900';
  const resolvedSizeConfig = sizeConfig ?? getNexusTabSizeConfig(depth, uiDensity);
  const renderedLabel = getRenderedNexusTabLabel({
    label,
    active,
    truncate,
    sizeConfig: resolvedSizeConfig,
    maxCharacters,
  });
  const ellipsizeMode = truncate === 'middle' ? 'middle' : 'tail';
  const titleSizeClass =
    depth === 0
      ? uiDensity === 'large'
        ? 'text-base'
        : 'text-sm'
      : uiDensity === 'large'
        ? 'text-sm'
        : 'text-xs';

  return (
    <Text
      className={joinClasses(
        titleSizeClass,
        'min-w-0 shrink font-semibold',
        active ? activeTextClass : inactiveTextClass,
        className,
      )}
      ellipsizeMode={ellipsizeMode}
      numberOfLines={numberOfLines ?? (truncate === 'none' ? undefined : 1)}
    >
      {renderedLabel}
    </Text>
  );
}

/**
 * Inputs: small supporting tab text.
 * Output: a shared muted detail line for tab frames that need one.
 */
export function NexusTabDetail({
  active = false,
  children,
  className,
}: NexusTabDetailProps) {
  const { themeMode } = useNexusShell();
  const textClass = active
    ? themeMode === 'dark'
      ? 'text-nexus-sky/80'
      : 'text-sky-700'
    : themeMode === 'dark'
      ? 'text-nexus-muted'
      : 'text-slate-600';

  return (
    <Text
      className={joinClasses(
        'text-[10px] font-bold uppercase tracking-[2px]',
        textClass,
        className,
      )}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

/**
 * Inputs: close-tab callback.
 * Output: compact shared close control for closable document tabs.
 */
export function NexusTabCloseButton({
  accessibilityLabel = 'Close tab',
  className,
  onPress,
}: NexusTabCloseButtonProps) {
  const { themeMode } = useNexusShell();
  const textClass = themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-500';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className={joinClasses('shrink-0 px-1 py-0.5', className)}
      onPress={onPress}
    >
      <Text className={joinClasses('text-xs font-semibold', textClass)}>x</Text>
    </Pressable>
  );
}
