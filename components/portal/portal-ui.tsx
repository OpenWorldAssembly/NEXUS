/**
 * File: portal-ui.tsx
 * Description: Provides shared NativeWind UI primitives for the guest portal screens.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PortalCardTone } from '@/data/portal/mock-portal-data';

type PortalCardProps = PropsWithChildren<{
  className?: string;
  tone?: PortalCardTone | 'default';
}>;

type PortalSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: ReactNode;
};

type PortalBadgeProps = {
  label: string;
  tone?: PortalCardTone | 'default';
};

type PortalActionButtonProps = {
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

const portalToneClasses: Record<PortalCardTone | 'default', string> = {
  default: 'border-portal-line/70 bg-portal-panel',
  sky: 'border-portal-sky/30 bg-portal-strong',
  mint: 'border-portal-mint/30 bg-portal-strong',
  gold: 'border-portal-gold/30 bg-portal-strong',
  rose: 'border-portal-rose/30 bg-portal-strong',
};

const portalBadgeWrapperClasses: Record<PortalCardTone | 'default', string> = {
  default: 'border-portal-line/70 bg-white/5',
  sky: 'border-portal-sky/40 bg-portal-sky/10',
  mint: 'border-portal-mint/40 bg-portal-mint/10',
  gold: 'border-portal-gold/40 bg-portal-gold/10',
  rose: 'border-portal-rose/40 bg-portal-rose/10',
};

const portalBadgeTextClasses: Record<PortalCardTone | 'default', string> = {
  default: 'text-portal-text',
  sky: 'text-portal-sky',
  mint: 'text-portal-mint',
  gold: 'text-portal-gold',
  rose: 'text-portal-rose',
};

/**
 * Inputs: children content plus optional layout and tone classes.
 * Output: a styled portal card container.
 */
export function PortalCard({
  children,
  className,
  tone = 'default',
}: PortalCardProps) {
  return (
    <View
      className={joinClasses(
        'rounded-[28px] border p-5 shadow-portal',
        portalToneClasses[tone],
        className,
      )}
    >
      {children}
    </View>
  );
}

/**
 * Inputs: eyebrow, title, description, and optional trailing content.
 * Output: a standard section header block for portal screens.
 */
export function PortalSectionHeader({
  eyebrow,
  title,
  description,
  trailing,
}: PortalSectionHeaderProps) {
  return (
    <View className="gap-4 lg:flex-row lg:items-end lg:justify-between">
      <View className="max-w-3xl gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
          {eyebrow}
        </Text>
        <Text className="text-3xl font-bold text-portal-text lg:text-5xl">
          {title}
        </Text>
        <Text className="text-base leading-7 text-portal-muted lg:text-lg">
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
export function PortalBadge({ label, tone = 'default' }: PortalBadgeProps) {
  return (
    <View
      className={joinClasses(
        'rounded-full border px-3 py-1.5',
        portalBadgeWrapperClasses[tone],
      )}
    >
      <Text
        className={joinClasses(
          'text-xs font-semibold uppercase tracking-[2px]',
          portalBadgeTextClasses[tone],
        )}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Inputs: button label, optional press handler, disabled flag, and variant.
 * Output: a shared portal action button.
 */
export function PortalActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'secondary',
}: PortalActionButtonProps) {
  const variantClasses =
    variant === 'primary'
      ? 'border-portal-sky bg-portal-sky'
      : variant === 'ghost'
        ? 'border-transparent bg-transparent'
        : 'border-portal-line bg-white/5';

  const textClasses =
    variant === 'primary'
      ? 'text-portal-canvas'
      : 'text-portal-text';

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
