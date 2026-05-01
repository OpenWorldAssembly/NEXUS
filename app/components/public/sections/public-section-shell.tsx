/**
 * File: public-section-shell.tsx
 * Description: Shared shell for public-page sections with background media, accent overlay, and slotted content.
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type { PublicAnimationPresetName } from '@app/components/public/animation/public-animation-presets';
import PublicCardFrame from '@app/components/public/public-card-frame';
import {
  PUBLIC_SURFACE_CLASSES,
  PUBLIC_SURFACE_STYLE_VALUES,
} from '@app/components/public/public-surface';

type PublicSectionShellProps = {
  backgroundImageUri: string;
  backgroundMirrored?: boolean;
  contentClassName?: string;
  details?: ReactNode;
  enableDecorativeAccents?: boolean;
  header?: ReactNode;
  isActive: boolean;
  isMobile?: boolean;
  onPress?: () => void;
  summary?: ReactNode;
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
  focusLineRatio?: number;
  layoutOffsetY?: number;
  scrollY?: Animated.Value;
  viewportHeight?: number;
};

/**
 * Inputs: section media, optional animation settings, and slotted content blocks.
 * Output: a reusable public-page section shell that preserves page-owned content layout.
 */
export default function PublicSectionShell({
  backgroundImageUri,
  backgroundMirrored = false,
  contentClassName = 'flex-1 px-7 py-8 md:px-9 md:py-9',
  details,
  enableDecorativeAccents = true,
  header,
  isActive,
  isMobile = false,
  onPress,
  summary,
  animationEnabled,
  animationPreset,
  focusLineRatio,
  layoutOffsetY,
  scrollY,
  viewportHeight,
}: PublicSectionShellProps) {
  const content = onPress ? (
    <Pressable className={contentClassName} onPress={onPress}>
      {header ?? null}
      {summary ?? null}
      {details ? <View style={styles.detailsArea}>{details}</View> : null}
    </Pressable>
  ) : (
    <View className={contentClassName}>
      {header ?? null}
      {summary ?? null}
      {details ? <View style={styles.detailsArea}>{details}</View> : null}
    </View>
  );

  return (
    <View style={[styles.chapter, isMobile ? styles.chapterMobile : null]}>
      <PublicCardFrame
        animationEnabled={animationEnabled}
        animationPreset={animationPreset}
        background={
          <>
            <View pointerEvents="none" style={styles.parallaxLayer}>
              <Image
                source={{ uri: backgroundImageUri }}
                contentFit="cover"
                style={[styles.parallaxImage, backgroundMirrored ? styles.parallaxImageMirrored : null]}
              />
            </View>

            <View
              pointerEvents="none"
              className={PUBLIC_SURFACE_CLASSES.section.accentOverlayClassName}
              style={styles.accentOverlay}
            />
          </>
        }
        backgroundPreset="none"
        className={isActive ? 'shadow-public' : ''}
        enableDecorativeAccents={enableDecorativeAccents}
        focusLineRatio={focusLineRatio}
        layoutOffsetY={layoutOffsetY}
        scrollY={scrollY}
        style={styles.shell}
        surfaceAnimated
        variant="background"
        viewportHeight={viewportHeight}
      >
        {content}
      </PublicCardFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  chapter: {
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  chapterMobile: {
    justifyContent: 'flex-start',
    paddingVertical: 0,
  },
  detailsArea: {
    marginTop: 30,
  },
  parallaxImage: {
    height: '112%',
    width: '100%',
  },
  parallaxImageMirrored: {
    transform: [{ scaleX: -1 }],
  },
  accentOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
    top: -8,
    bottom: -8,
  },
  shell: {
    shadowColor: PUBLIC_SURFACE_STYLE_VALUES.sectionShadowColor,
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
});
