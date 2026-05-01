/**
 * File: use-secondary-nav-item-state.ts
 * Description: Shared animation and subtitle-state helpers for public secondary navigation items.
 */
import { Animated } from 'react-native';

import {
  PUBLIC_SECONDARY_NAV_MOTION_THEME,
  SECTION_RAIL_WIDTH,
} from '@app/components/public/public-secondary-nav.constants';
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
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.topbarPlateOpacityRange,
        extrapolate: 'clamp',
      });

      const plateBorderColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.plateBorderColorRange,
        extrapolate: 'clamp',
      });

      const plateBackgroundColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.plateBackgroundColorRange,
        extrapolate: 'clamp',
      });

      const plateTranslateY = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.topbarPlateTranslateYRange,
        extrapolate: 'clamp',
      });

      const plateScale = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.topbarPlateScaleRange,
        extrapolate: 'clamp',
      });

      const dotScale = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.dotScaleRange,
        extrapolate: 'clamp',
      });

      const dotColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.dotColorRange,
        extrapolate: 'clamp',
      });

      const titleColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.titleColorRange,
        extrapolate: 'clamp',
      });

      const subtitleOpacity = distanceProgress.interpolate({
        inputRange: [0, 0.65, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.topbarSubtitleOpacityRange,
        extrapolate: 'clamp',
      });

      const subtitleTranslateY = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.topbarSubtitleTranslateYRange,
        extrapolate: 'clamp',
      });

      const subtitleColor = distanceProgress.interpolate({
        inputRange: [0, 1],
        outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.subtitleColorRange,
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
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.railPlateOpacityRange,
      extrapolate: 'clamp',
    });

    const borderColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.plateBorderColorRange,
      extrapolate: 'clamp',
    });

    const backgroundColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.plateBackgroundColorRange,
      extrapolate: 'clamp',
    });

    const dotScale = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.dotScaleRange,
      extrapolate: 'clamp',
    });

    const dotColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.dotColorRange,
      extrapolate: 'clamp',
    });

    const titleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.titleColorRange,
      extrapolate: 'clamp',
    });

    const subtitleOpacity = distanceProgress.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.railSubtitleOpacityRange,
      extrapolate: 'clamp',
    });

    const subtitleTranslateY = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.railSubtitleTranslateYRange,
      extrapolate: 'clamp',
    });

    const subtitleColor = distanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: PUBLIC_SECONDARY_NAV_MOTION_THEME.subtitleColorRange,
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
