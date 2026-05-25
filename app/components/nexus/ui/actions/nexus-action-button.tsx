/**
 * File: nexus-action-button.tsx
 * Description: Shared Nexus action button primitive.
 */
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useNexusFeatureStatus } from '@app/components/nexus/nexus-feature-status-context';
import type { NexusFeatureStatusId } from '@app/components/nexus/nexus-feature-status-registry';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  useOptionalNexusLoading,
  type NexusLoadingOptions,
  type NexusLoadingScope,
} from '../feedback/loading';
import {
  NexusThemedBevelEdges,
  getNexusChromeClasses,
  joinClasses,
} from '../layout/nexus-chrome';

export type NexusActionButtonProps = {
  label: string;
  onPress?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  featureStatusId?: NexusFeatureStatusId;
  loadingOptions?: NexusLoadingOptions;
  loadingScope?: NexusLoadingScope;
};

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
  loadingOptions,
  loadingScope,
}: NexusActionButtonProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const loading = useOptionalNexusLoading();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const featureStatus = useNexusFeatureStatus();
  const [isHovered, setIsHovered] = useState(false);
  const pressableRef = useRef<View | null>(null);
  const isLoadingScopeActive = Boolean(
    loadingScope && loading?.isLoading(loadingScope)
  );
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
  const isExplainableDisabled =
    disabled &&
    !isLoadingScopeActive &&
    Boolean(featureStatusId) &&
    Boolean(featureStatus);
  const isActuallyDisabled =
    isLoadingScopeActive || (disabled && !isExplainableDisabled);

  const handlePress = () => {
    if (isLoadingScopeActive) {
      return;
    }

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

    if (!onPress) {
      return;
    }

    if (loadingScope && loading) {
      void loading.runWithLoading(loadingScope, onPress, loadingOptions);
      return;
    }

    void Promise.resolve(onPress());
  };

  return (
    <View ref={pressableRef} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={
          disabled || isLoadingScopeActive ? { disabled: true } : undefined
        }
        className={joinClasses(
          chrome.actionButtonFrameClass,
          variantClasses,
          disabled || isLoadingScopeActive ? 'opacity-45' : '',
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
