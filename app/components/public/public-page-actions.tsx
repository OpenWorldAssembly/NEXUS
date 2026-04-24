/**
 * File: public-page-actions.tsx
 * Description: Renders a reusable action row for public-site content pages.
 */
import { Link, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { PublicPageActionItem } from '@/app/public/content-types';

type LegacyPublicPageAction = {
  href: Href;
  label: string;
  variant: 'primary' | 'secondary';
};

type PublicPageActionsProps = {
  actions: Array<LegacyPublicPageAction | PublicPageActionItem>;
  className?: string;
};

function normalizeVariant(action: LegacyPublicPageAction | PublicPageActionItem): 'solid' | 'outline' {
  if ('variant' in action && action.variant === 'primary') {
    return 'solid';
  }

  if ('variant' in action && action.variant === 'secondary') {
    return 'outline';
  }

  return action.variant === 'solid' ? 'solid' : 'outline';
}

function getActionKey(action: LegacyPublicPageAction | PublicPageActionItem) {
  const href = 'href' in action ? action.href : undefined;
  return `${href ?? 'disabled'}:${action.label}`;
}

export function PublicPageActions({ actions, className }: PublicPageActionsProps) {
  return (
    <View className={`mt-10 flex-row flex-wrap gap-3 ${className ?? ''}`.trim()}>
      {actions.map((action) => {
        const variant = normalizeVariant(action);
        const disabled = 'disabled' in action ? !!action.disabled : false;
        const href = 'href' in action ? action.href : undefined;

        const wrapperClassName =
          variant === 'solid'
            ? 'rounded-full bg-public-accent px-6 py-3'
            : 'rounded-full border border-public-line bg-public-panel/70 px-6 py-3';

        const textClassName =
          variant === 'solid'
            ? 'text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas'
            : 'text-sm font-bold uppercase tracking-[0.18em] text-public-text';

        const content = (
          <Pressable className={wrapperClassName} disabled={disabled || !href}>
            <Text className={`${textClassName} ${disabled || !href ? 'opacity-50' : ''}`.trim()}>
              {action.label}
            </Text>
          </Pressable>
        );

        if (disabled || !href) {
          return <View key={getActionKey(action)}>{content}</View>;
        }

        return (
          <Link key={getActionKey(action)} href={href as Href} asChild>
            {content}
          </Link>
        );
      })}
    </View>
  );
}

export default PublicPageActions;
