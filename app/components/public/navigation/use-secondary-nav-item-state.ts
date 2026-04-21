/**
 * File: use-secondary-nav-item-state.ts
 * Description: Shared animation and subtitle-state helpers for public secondary navigation items.
 */
import { Animated } from 'react-native';

import { SECTION_RAIL_WIDTH } from '@app/components/public/public-secondary-nav.constants';
import type {
  PublicSecondaryNavAnimatedState,
  PublicSecondaryNavAnimatedStateResolver,
  PublicSecondaryNavMode,
  PublicSecondaryNavSubtitleVisibilityResolver,
} from '@app/components/public/public-secondary-nav.types';
import type { PublicSectionWithId, SectionLayout } from '@app/components/public/sections/public-section.types';

type UseSecondaryNavItemStateArgs<TSection extends PublicSectionWithId> = {
  activeSectionId: string;
  activeSectionIndex: number;
  focusLineRatio: number;
  mode: PublicSecondaryNavMode;
  scrollY: Animated.Value;
  sectionLayouts: Record<string, SectionLayout>;
  sections: TSection[];
  viewportHeight: number;
};

type UseSecondaryNavItemStateResult = {
  getItemAnimatedState: PublicSecondaryNavAnimatedStateResolver;
  shouldShowItemSubtitle: PublicSecondaryNavSubtitleVisibilityResolver;
};

/**
 * Inputs: ordered sections, layout registry, scroll position, and current nav mode.
 * Output: item-level secondary-nav animation state plus subtitle visibility rules.
 */
export function useSecondaryNavItemState<TSection extends PublicSectionWithId>({
  activeSectionId,
  activeSectionIndex,
  focusLineRatio,
  mode,
  scrollY,
  sectionLayouts,
  sections,
  viewportHeight,
}: UseSecondaryNavItemStateArgs<TSection>): UseSecondaryNavItemStateResult {
  function getDistanceProgress(sectionId: string) {
    const layout = sectionLayouts[sectionId];

    if (!layout) {
      return undefined;
    }

    const focusY = layout.y + layout.height / 2 - viewportHeight * focusLineRatio;
    const itemRange = viewportHeight * 0.9;

    return scrollY.interpolate({
      inputRange: [focusY - itemRange, focusY, focusY + itemRange],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });
  }

  function getItemAnimatedState(sectionId: string): PublicSecondaryNavAnimatedState {
    const distanceProgress = getDistanceProgress(sectionId);

    if (!distanceProgress) {
      return {
        plateAnimatedStyle: undefined,
        dotAnimatedStyle: undefined,
        titleAnimatedStyle: undefined,
        subtitleAnimatedStyle: undefined,
      };
    }

    if (mode === 'topbar') {
      const plateOpacity = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.82, 1],
        extrapolate: 'clamp',
      });

      const plateBorderColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(137, 183, 255, 0.12)', 'rgba(198, 214, 112, 0.82)'],
        extrapolate: 'clamp',
      });

      const plateBackgroundColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.025)', 'rgba(198, 214, 112, 0.18)'],
        extrapolate: 'clamp',
      });

      const plateTranslateY = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -2],
        extrapolate: 'clamp',
      });

      const plateScale = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.01],
        extrapolate: 'clamp',
      });

      const dotScale = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
        extrapolate: 'clamp',
      });

      const dotColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(142, 202, 230, 0.38)', 'rgba(198, 214, 112, 0.85)'],
        extrapolate: 'clamp',
      });

      const titleColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(232, 238, 246, 0.72)', '#f7f4ea'],
        extrapolate: 'clamp',
      });

      const subtitleOpacity = distanceProgress.interpolate({
        inputRange: [0, 0.65, 1],
        outputRange: [0, 0.22, 1],
        extrapolate: 'clamp',
      });

      const subtitleTranslateY = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [3, 0],
        extrapolate: 'clamp',
      });

      const subtitleColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(142, 202, 230, 0.35)', 'rgba(243, 196, 92, 0.92)'],
        extrapolate: 'clamp',
      });

      return {
        plateAnimatedStyle: {
          opacity: plateOpacity,
          borderColor: plateBorderColor,
          backgroundColor: plateBackgroundColor,
          transform: [{ translateY: plateTranslateY }, { scale: plateScale }],
        },
        dotAnimatedStyle: {
          backgroundColor: dotColor,
          transform: [{ scale: dotScale }],
        },
        titleAnimatedStyle: {
          color: titleColor,
        },
        subtitleAnimatedStyle: {
          opacity: subtitleOpacity,
          transform: [{ translateY: subtitleTranslateY }],
          color: subtitleColor,
        },
      };
    }

    const plateWidth = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [SECTION_RAIL_WIDTH - 58, SECTION_RAIL_WIDTH - 12],
      extrapolate: 'clamp',
    });

    const opacity = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.78, 1],
      extrapolate: 'clamp',
    });

    const borderColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(137, 183, 255, 0.12)', 'rgba(198, 214, 112, 0.82)'],
      extrapolate: 'clamp',
    });

    const backgroundColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,255,255,0.025)', 'rgba(198, 214, 112, 0.18)'],
      extrapolate: 'clamp',
    });

    const dotScale = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.08],
      extrapolate: 'clamp',
    });

    const dotColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(142, 202, 230, 0.38)', 'rgba(198, 214, 112, 0.85)'],
      extrapolate: 'clamp',
    });

    const titleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(232, 238, 246, 0.72)', '#f7f4ea'],
      extrapolate: 'clamp',
    });

    const subtitleOpacity = distanceProgress.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0, 0.18, 1],
      extrapolate: 'clamp',
    });

    const subtitleTranslateY = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [4, 0],
      extrapolate: 'clamp',
    });

    const subtitleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(142, 202, 230, 0.35)', 'rgba(243, 196, 92, 0.92)'],
      extrapolate: 'clamp',
    });

    return {
      plateAnimatedStyle: {
        width: plateWidth,
        opacity,
        borderColor,
        backgroundColor,
      },
      dotAnimatedStyle: {
        backgroundColor: dotColor,
        transform: [{ scale: dotScale }],
      },
      titleAnimatedStyle: {
        color: titleColor,
      },
      subtitleAnimatedStyle: {
        opacity: subtitleOpacity,
        transform: [{ translateY: subtitleTranslateY }],
        color: subtitleColor,
      },
    };
  }

  function shouldShowItemSubtitle(sectionId: string) {
    if (mode === 'topbar') {
      return sectionId === activeSectionId;
    }

    const index = sections.findIndex((section) => section.id === sectionId);
    return Math.abs(index - activeSectionIndex) <= 1;
  }

  return {
    getItemAnimatedState,
    shouldShowItemSubtitle,
  };
}
