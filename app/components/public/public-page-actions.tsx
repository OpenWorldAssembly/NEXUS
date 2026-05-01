/**
 * File: public-page-actions.tsx
 * Description: Renders a reusable action row for public-site content pages.
 */
import { Link, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { PublicPageActionItem } from '@/app/public/content-types';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';

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
            ? PUBLIC_SURFACE_CLASSES.action.solidRootClassName
            : PUBLIC_SURFACE_CLASSES.action.outlineRootClassName;

        const textClassName =
          variant === 'solid'
            ? PUBLIC_SURFACE_CLASSES.action.solidTextClassName
            : PUBLIC_SURFACE_CLASSES.action.outlineTextClassName;

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
