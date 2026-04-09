/**
 * File: nexus-ui.tsx
 * Description: Provides shared NativeWind UI primitives for the guest nexus screens.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { NexusCardTone } from '@/data/nexus/mock-nexus-data';

type NexusCardProps = PropsWithChildren<{
  className?: string;
  tone?: NexusCardTone | 'default';
}>;

type NexusSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: ReactNode;
};

type NexusBadgeProps = {
  label: string;
  tone?: NexusCardTone | 'default';
  className?: string;
  textClassName?: string;
};

type NexusActionButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

/**
 * Inputs: any number of class names.
 * Output: a single space-delimited className string.
 */
function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const nexusToneClasses: Record<NexusCardTone | 'default', string> = {
  default: 'border-nexus-line/70 bg-nexus-panel',
  sky: 'border-nexus-sky/30 bg-nexus-strong',
  mint: 'border-nexus-mint/30 bg-nexus-strong',
  gold: 'border-nexus-gold/30 bg-nexus-strong',
  rose: 'border-nexus-rose/30 bg-nexus-strong',
};

const nexusBadgeWrapperClasses: Record<NexusCardTone | 'default', string> = {
  default: 'border-nexus-line/70 bg-white/5',
  sky: 'border-nexus-sky/40 bg-nexus-sky/10',
  mint: 'border-nexus-mint/40 bg-nexus-mint/10',
  gold: 'border-nexus-gold/40 bg-nexus-gold/10',
  rose: 'border-nexus-rose/40 bg-nexus-rose/10',
};

const nexusBadgeTextClasses: Record<NexusCardTone | 'default', string> = {
  default: 'text-nexus-text',
  sky: 'text-nexus-sky',
  mint: 'text-nexus-mint',
  gold: 'text-nexus-gold',
  rose: 'text-nexus-rose',
};

/**
 * Inputs: children content plus optional layout and tone classes.
 * Output: a styled nexus card container.
 */
export function NexusCard({
  children,
  className,
  tone = 'default',
}: NexusCardProps) {
  return (
    <View
      className={joinClasses(
        'rounded-[28px] border p-5 shadow-nexus',
        nexusToneClasses[tone],
        className,
      )}
    >
      {children}
    </View>
  );
}

/**
 * Inputs: eyebrow, title, description, and optional trailing content.
 * Output: a standard section header block for nexus screens.
 */
export function NexusSectionHeader({
  eyebrow,
  title,
  description,
  trailing,
}: NexusSectionHeaderProps) {
  return (
    <View className="gap-4 lg:flex-row lg:items-end lg:justify-between">
      <View className="max-w-3xl gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          {eyebrow}
        </Text>
        <Text className="text-3xl font-bold text-nexus-text lg:text-5xl">
          {title}
        </Text>
        <Text className="text-base leading-7 text-nexus-muted lg:text-lg">
          {description}
        </Text>
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
  return (
    <View
      className={joinClasses(
        'rounded-full border px-3 py-1.5',
        nexusBadgeWrapperClasses[tone],
        className,
      )}
    >
      <Text
        className={joinClasses(
          'text-xs font-semibold uppercase tracking-[2px]',
          nexusBadgeTextClasses[tone],
          textClassName,
        )}
      >
        {label}
      </Text>
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
}: NexusActionButtonProps) {
  const variantClasses =
    variant === 'primary'
      ? 'border-nexus-sky bg-nexus-sky'
      : variant === 'ghost'
        ? 'border-transparent bg-transparent'
        : 'border-nexus-line bg-white/5';

  const textClasses =
    variant === 'primary'
      ? 'text-nexus-canvas'
      : 'text-nexus-text';

  return (
    <Pressable
      accessibilityRole="button"
      className={joinClasses(
        'rounded-full border px-4 py-3',
        variantClasses,
        disabled ? 'opacity-45' : '',
      )}
      disabled={disabled}
      onPress={onPress}
    >
      <Text className={joinClasses('text-sm font-semibold', textClasses)}>
        {label}
      </Text>
    </Pressable>
  );
}
