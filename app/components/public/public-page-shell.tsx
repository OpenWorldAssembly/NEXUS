/**
 * File: public-page-shell.tsx
 * Description: Provides the shared outer scroll container and width constraints for public-site content pages.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import {
  PUBLIC_SCROLL_ANIMATION_DEFAULTS,
  PublicScrollAnimationProvider,
} from '@app/components/public/animation/public-scroll-context';

type PublicPageShellProps = {
  children: ReactNode;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  constrainWidth?: boolean;
  innerClassName?: string;
  enablePositionAnimation?: boolean;
  focusLineRatio?: number;
};

/**
 * Inputs: child page sections plus optional scroll, animation, and width-constraint settings.
 * Output: a consistent scrollable shell for public-site destination pages.
 */
export default function PublicPageShell({
  children,
  contentContainerClassName = 'pb-16',
  contentContainerStyle,
  showsVerticalScrollIndicator,
  constrainWidth = true,
  innerClassName = 'mx-auto w-full max-w-6xl px-5 py-8',
  enablePositionAnimation = false,
  focusLineRatio = PUBLIC_SCROLL_ANIMATION_DEFAULTS.focusLineRatio,
}: PublicPageShellProps) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [viewportHeight, setViewportHeight] = useState(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!enablePositionAnimation) {
        return;
      }

      setViewportHeight(event.nativeEvent.layout.height);
    },
    [enablePositionAnimation],
  );

  const handleScroll = useMemo(() => {
    if (!enablePositionAnimation) {
      return undefined;
    }

    return Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: false,
    });
  }, [enablePositionAnimation, scrollY]);

  const content = constrainWidth ? <View className={innerClassName}>{children}</View> : children;
  const resolvedContent = enablePositionAnimation ? (
    <PublicScrollAnimationProvider
      focusLineRatio={focusLineRatio}
      scrollY={scrollY}
      viewportHeight={viewportHeight}
    >
      {content}
    </PublicScrollAnimationProvider>
  ) : (
    content
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName={contentContainerClassName}
      contentContainerStyle={contentContainerStyle}
      onLayout={handleLayout}
      onScroll={handleScroll}
      scrollEventThrottle={enablePositionAnimation ? 16 : undefined}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {resolvedContent}
    </ScrollView>
  );
}
