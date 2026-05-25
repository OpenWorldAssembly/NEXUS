/**
 * File: nexus-action-menu.tsx
 * Description: Renders a compact floating action menu for Nexus action cards.
 */
import { Pressable, Text, View } from 'react-native';

import { useOptionalNexusLoading } from '@app/components/nexus/ui/feedback/loading';
import { NexusThemedBevelEdges, getNexusChromeClasses } from '@app/components/nexus/nexus-ui';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import type { NexusActionMenuItem, NexusActionMenuTone } from './nexus-card-types';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getActionToneClass(tone: NexusActionMenuTone, themeMode: 'dark' | 'light'): string {
  if (tone === 'danger') {
    return themeMode === 'dark' ? 'text-nexus-rose' : 'text-rose-700';
  }

  if (tone === 'warning') {
    return themeMode === 'dark' ? 'text-nexus-gold' : 'text-amber-700';
  }

  if (tone === 'accent') {
    return themeMode === 'dark' ? 'text-nexus-sky' : 'text-sky-700';
  }

  if (tone === 'muted') {
    return themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-500';
  }

  return themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
}

export type NexusActionMenuProps = {
  actions?: NexusActionMenuItem[];
  align?: 'top' | 'bottom';
  className?: string;
  isFloating?: boolean;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Inputs: action descriptors and menu state.
 * Output: a floating card action menu.
 */
export function NexusActionMenu({
  actions = [],
  align = 'top',
  className,
  isFloating = false,
  isOpen,
  onClose,
}: NexusActionMenuProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const loading = useOptionalNexusLoading();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const visibleActions = actions.filter((action) => !action.hidden);

  const handleActionPress = (action: NexusActionMenuItem) => {
    const runAction = () => action.onSelect?.();

    onClose();

    if (action.loadingScope && loading) {
      void loading.runWithLoading(
        action.loadingScope,
        runAction,
        action.loadingOptions
      );
      return;
    }

    void Promise.resolve(runAction());
  };

  if (!isOpen || visibleActions.length === 0) {
    return null;
  }

  return (
    <View
      className={joinClasses(
        'min-w-[190px] gap-1 overflow-hidden rounded-2xl border p-2 definition-lg',
        isFloating ? undefined : 'absolute right-0 z-50',
        isFloating ? undefined : align === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2',
        chrome.inlineSelectMenuClass,
        className,
      )}
      style={{
        elevation: 60,
        backgroundColor: themeMode === 'dark' ? '#102133' : '#ffffff',
      }}
    >
      {visibleActions.map((action) => {
        const isActionLoading = Boolean(
          action.loadingScope && loading?.isLoading(action.loadingScope)
        );
        const isDisabled = Boolean(action.disabled || isActionLoading);

        return (
          <Pressable
            key={action.id}
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            accessibilityRole="button"
            accessibilityState={isDisabled ? { disabled: true } : undefined}
            className={joinClasses(
              chrome.compactButtonClass,
              uiDensity === 'large' ? 'px-3 py-2.5' : 'px-2.5 py-2',
              isDisabled ? 'opacity-50' : undefined,
            )}
            disabled={isDisabled}
            onPress={(event) => {
              event.stopPropagation();
              if (isDisabled) {
                return;
              }

              handleActionPress(action);
            }}
          >
            <Text
              className={joinClasses(
                uiDensity === 'large' ? 'text-sm font-semibold' : 'text-xs font-semibold',
                getActionToneClass(action.tone ?? 'default', themeMode),
              )}
            >
              {action.label}
            </Text>
            <NexusThemedBevelEdges themeMode={themeMode} subtle />
          </Pressable>
        );
      })}
    </View>
  );
}
