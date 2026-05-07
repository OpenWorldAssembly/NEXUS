/**
 * File: public-page-actions.tsx
 * Description: Renders a reusable action row for public-site content pages.
 */
import { Link, type Href } from 'expo-router';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import type { PublicLinkTarget, PublicPageAction } from '@/app/public/content-types';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';

type PublicPageActionsProps = {
  actions: PublicPageAction[];
  className?: string;
  layout?: 'row' | 'column';
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

function getDownloadFileName(href: `/downloads/${string}`) {
  return href.split('/').pop() ?? 'download.md';
}

/**
 * Inputs: a public static download target.
 * Output: browser download on web, URL open fallback elsewhere.
 */
function handleExternalOrDownloadTarget(target: Extract<PublicLinkTarget, { kind: 'external' | 'download' }>) {
  if (target.kind === 'download' && Platform.OS === 'web' && typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = target.href;
    anchor.download = getDownloadFileName(target.href);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  void Linking.openURL(getExternalTargetUri(target));
}

export function PublicPageActions({ actions, className, layout = 'row' }: PublicPageActionsProps) {
  const layoutClassName = layout === 'column' ? 'gap-3' : 'flex-row flex-wrap gap-3';

  return (
    <View className={`mt-10 ${layoutClassName} ${className ?? ''}`.trim()}>
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
                ? () => handleExternalOrDownloadTarget(target)
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
