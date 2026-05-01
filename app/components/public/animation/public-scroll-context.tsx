/**
 * File: public-scroll-context.tsx
 * Description: Provides shared scroll and layout-offset context for public position-based animations.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Animated } from 'react-native';

import { PUBLIC_POSITION_ANIMATION_THEME } from '@app/components/public/animation/public-position-motion';

export type PublicScrollAnimationContextValue = {
  scrollY: Animated.Value;
  viewportHeight: number;
  focusLineRatio: number;
};

type PublicScrollAnimationProviderProps = PublicScrollAnimationContextValue & {
  children: ReactNode;
};

type PublicLayoutOffsetProviderProps = {
  children: ReactNode;
  offsetY: number;
};

const PublicScrollAnimationContext = createContext<PublicScrollAnimationContextValue | undefined>(
  undefined,
);
const PublicLayoutOffsetContext = createContext(0);

/**
 * Inputs: scroll driver, viewport geometry, focus-line ratio, and children.
 * Output: public animation context consumed by animated surfaces.
 */
export function PublicScrollAnimationProvider({
  children,
  focusLineRatio,
  scrollY,
  viewportHeight,
}: PublicScrollAnimationProviderProps) {
  const value = useMemo(
    () => ({
      focusLineRatio,
      scrollY,
      viewportHeight,
    }),
    [focusLineRatio, scrollY, viewportHeight],
  );

  return (
    <PublicScrollAnimationContext.Provider value={value}>
      {children}
    </PublicScrollAnimationContext.Provider>
  );
}

/**
 * Inputs: an offset from the scroll-content origin and children.
 * Output: inherited layout offset for nested animated cards.
 */
export function PublicLayoutOffsetProvider({ children, offsetY }: PublicLayoutOffsetProviderProps) {
  return (
    <PublicLayoutOffsetContext.Provider value={offsetY}>
      {children}
    </PublicLayoutOffsetContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: optional public scroll animation context for position-based card animation.
 */
export function usePublicScrollAnimationContext() {
  return useContext(PublicScrollAnimationContext);
}

/**
 * Inputs: none.
 * Output: inherited layout offset for the current public layout scope.
 */
export function usePublicLayoutOffset() {
  return useContext(PublicLayoutOffsetContext);
}

export const PUBLIC_SCROLL_ANIMATION_DEFAULTS = {
  focusLineRatio: PUBLIC_POSITION_ANIMATION_THEME.defaultFocusLineRatio,
} as const;
