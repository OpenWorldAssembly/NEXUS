/**
 * File: nexus-feature-status-context.tsx
 * Description: Shell-scoped overlay host for compact Nexus disabled-feature explainers.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import {
  resolveNexusFeatureStatusEntry,
  type NexusFeatureStatusId,
} from '@app/components/nexus/nexus-feature-status-registry';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';

type NexusFeatureStatusAnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NexusFeatureStatusOverlayState = {
  featureStatusId: NexusFeatureStatusId;
  anchorRect: NexusFeatureStatusAnchorRect;
} | null;

type NexusFeatureStatusContextValue = {
  openFeatureStatus: (
    featureStatusId: NexusFeatureStatusId,
    anchorRect: NexusFeatureStatusAnchorRect
  ) => void;
  closeFeatureStatus: () => void;
  activeFeatureStatusId: NexusFeatureStatusId | null;
};

const NexusFeatureStatusContext = createContext<NexusFeatureStatusContextValue | null>(
  null
);

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getAnchoredCardPosition(input: {
  anchorRect: NexusFeatureStatusAnchorRect;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const narrowViewport = input.viewportWidth < 720;
  const horizontalPadding = 16;
  const estimatedCardWidth = Math.min(
    narrowViewport ? input.viewportWidth - horizontalPadding * 2 : 340,
    input.viewportWidth - horizontalPadding * 2
  );

  if (narrowViewport) {
    return {
      width: estimatedCardWidth,
      left: Math.max((input.viewportWidth - estimatedCardWidth) / 2, horizontalPadding),
      top: Math.max((input.viewportHeight - 240) / 2, horizontalPadding),
    };
  }

  const estimatedCardHeight = 220;
  const preferredLeft =
    input.anchorRect.x + input.anchorRect.width / 2 - estimatedCardWidth / 2;
  const left = Math.min(
    Math.max(preferredLeft, horizontalPadding),
    input.viewportWidth - estimatedCardWidth - horizontalPadding
  );
  const preferredTop = input.anchorRect.y + input.anchorRect.height + 10;
  const top = Math.min(
    Math.max(preferredTop, horizontalPadding),
    input.viewportHeight - estimatedCardHeight - horizontalPadding
  );

  return {
    width: estimatedCardWidth,
    left,
    top,
  };
}

function NexusFeatureStatusOverlay({
  overlayState,
  onClose,
}: {
  overlayState: NexusFeatureStatusOverlayState;
  onClose: () => void;
}) {
  const { themeMode, uiDensity } = useNexusShell();
  const { width, height } = useWindowDimensions();

  if (!overlayState) {
    return null;
  }

  const resolvedEntry = resolveNexusFeatureStatusEntry(overlayState.featureStatusId);
  const cardPosition = getAnchoredCardPosition({
    anchorRect: overlayState.anchorRect,
    viewportWidth: width,
    viewportHeight: height,
  });
  const cardClass =
    themeMode === 'dark'
      ? 'border-nexus-rose/40 bg-nexus-panel'
      : 'border-rose-300 bg-white';
  const bodyClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const headingClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const metaClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const badgeClass =
    themeMode === 'dark'
      ? 'border-nexus-rose/40 bg-nexus-rose/10'
      : 'border-rose-300 bg-rose-50';
  const badgeTextClass = themeMode === 'dark' ? 'text-nexus-rose' : 'text-rose-600';

  return (
    <View className="absolute inset-0 z-40">
      <Pressable
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={onClose}
      />
      <View
        className="absolute"
        style={{
          left: cardPosition.left,
          top: cardPosition.top,
          width: cardPosition.width,
        }}
      >
        <View
          className={joinClasses(
            'gap-3 rounded-[28px] border p-5 definition-nexus',
            cardClass
          )}
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-rose">
              Feature status
            </Text>
            <View
              className={joinClasses(
                uiDensity === 'large'
                  ? 'rounded-full border px-3.5 py-2'
                  : 'rounded-full border px-3 py-1.5',
                badgeClass
              )}
            >
              <Text
                className={joinClasses(
                  'text-xs font-semibold uppercase tracking-[2px]',
                  badgeTextClass
                )}
              >
                {resolvedEntry.short_label}
              </Text>
            </View>
          </View>
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-3xl' : 'text-2xl',
              'font-bold',
              headingClass
            )}
          >
            {resolvedEntry.title}
          </Text>
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-base leading-7' : 'text-sm leading-6',
              bodyClass
            )}
          >
            {resolvedEntry.summary}
          </Text>
          {resolvedEntry.details ? (
            <Text className={joinClasses('text-sm leading-6', metaClass)}>
              {resolvedEntry.details}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Inputs: nested shell content.
 * Output: a shell-scoped provider that keeps a single disabled-feature explainer open at a time.
 */
export function NexusFeatureStatusProvider({ children }: PropsWithChildren) {
  const [overlayState, setOverlayState] = useState<NexusFeatureStatusOverlayState>(
    null
  );

  const value = useMemo<NexusFeatureStatusContextValue>(
    () => ({
      openFeatureStatus: (featureStatusId, anchorRect) => {
        setOverlayState({
          featureStatusId,
          anchorRect,
        });
      },
      closeFeatureStatus: () => {
        setOverlayState(null);
      },
      activeFeatureStatusId: overlayState?.featureStatusId ?? null,
    }),
    [overlayState?.featureStatusId]
  );

  return (
    <NexusFeatureStatusContext.Provider value={value}>
      {children}
      <NexusFeatureStatusOverlay
        overlayState={overlayState}
        onClose={() => setOverlayState(null)}
      />
    </NexusFeatureStatusContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: the optional feature-status overlay context for Nexus surfaces.
 */
export function useNexusFeatureStatus() {
  return useContext(NexusFeatureStatusContext);
}
