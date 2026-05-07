/**
 * File: public-page-actions.tsx
 * Description: Renders a reusable action row for public-site content pages.
 */
import { Link, type Href } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import type { PublicLinkTarget, PublicPageAction } from '@/app/public/content-types';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';

type PublicPageActionsProps = {
  actions: PublicPageAction[];
  className?: string;
};

function normalizeVariant(action: PublicPageAction): 'solid' | 'outline' {
  if (action.variant === 'primary' || action.variant === 'solid') {
    return 'solid';
  }

  return 'outline';
}

function resolveActionTarget(action: PublicPageAction): PublicLinkTarget | undefined {
  if (action.disabled) {
    return undefined;
  }

  if (action.target?.kind === 'external' && !action.target.url) {
    return undefined;
  }

  if (action.target) {
    return action.target;
  }

  if (action.href) {
    return { kind: 'route', href: action.href };
  }

  return undefined;
}

function getActionKey(action: PublicPageAction) {
  const target = resolveActionTarget(action);
  const targetKey = target
    ? target.kind === 'route'
      ? target.href
      : target.kind === 'external'
        ? target.url
        : target.href
    : 'disabled';

  return `${targetKey}:${action.label}`;
}

function getExternalTargetUri(target: Extract<PublicLinkTarget, { kind: 'external' | 'download' }>) {
  return target.kind === 'external' ? target.url : target.href;
}

export function PublicPageActions({ actions, className }: PublicPageActionsProps) {
  return (
    <View className={`mt-10 flex-row flex-wrap gap-3 ${className ?? ''}`.trim()}>
      {actions.map((action) => {
        const variant = normalizeVariant(action);
        const target = resolveActionTarget(action);
        const disabled = !target;

        const wrapperClassName =
          variant === 'solid'
            ? PUBLIC_SURFACE_CLASSES.action.solidRootClassName
            : PUBLIC_SURFACE_CLASSES.action.outlineRootClassName;

        const textClassName =
          variant === 'solid'
            ? PUBLIC_SURFACE_CLASSES.action.solidTextClassName
            : PUBLIC_SURFACE_CLASSES.action.outlineTextClassName;

        const content = (
          <Pressable
            className={wrapperClassName}
            disabled={disabled}
            onPress={
              target?.kind === 'external' || target?.kind === 'download'
                ? () => {
                    void Linking.openURL(getExternalTargetUri(target));
                  }
                : undefined
            }
          >
            <Text className={`${textClassName} ${disabled ? 'opacity-50' : ''}`.trim()}>
              {action.label}
            </Text>
          </Pressable>
        );

        if (!target) {
          return <View key={getActionKey(action)}>{content}</View>;
        }

        if (target.kind === 'route') {
          return (
            <Link key={getActionKey(action)} href={target.href as Href} asChild>
              {content}
            </Link>
          );
        }

        return <View key={getActionKey(action)}>{content}</View>;
      })}
    </View>
  );
}

export default PublicPageActions;
