/**
 * File: public-section-image-panel.tsx
 * Description: Renders full-card homepage imagery with equal-edge transparency masks for public rail sections.
 */
import { Image, type ImageSource } from 'expo-image';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';

type PublicSectionImagePanelProps = {
  align: 'left' | 'right';
  focusProgress?: number | Animated.AnimatedInterpolation<number>;
  source: ImageSource;
};

function getImagePanelStyle() {
  return StyleSheet.absoluteFillObject;
}

function getHorizontalMaskStyle() {
  return styles.maskHorizontal;
}

function getFocusOpacity(focusProgress?: number | Animated.AnimatedInterpolation<number>) {
  const minOpacity = 0.48;
  const maxOpacity = 0.92;

  if (typeof focusProgress === 'number') {
    const clampedProgress = Math.max(0, Math.min(1, focusProgress));
    return minOpacity + (maxOpacity - minOpacity) * clampedProgress;
  }

  if (focusProgress && typeof focusProgress.interpolate === 'function') {
    return focusProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [minOpacity, maxOpacity],
      extrapolate: 'clamp',
    });
  }

  return undefined;
}

/**
 * Inputs: a bundled image source, section text alignment, and optional focus progress.
 * Output: a decorative image field that fades into the card and global background.
 */
export default function PublicSectionImagePanel({
  align,
  focusProgress,
  source,
}: PublicSectionImagePanelProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const imagePanelStyle = getImagePanelStyle();
  const horizontalMaskStyle = getHorizontalMaskStyle();
  const focusOpacity = getFocusOpacity(focusProgress);
  const staticOpacity = isDesktop ? 0.86 : 0.62;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.panel,
        imagePanelStyle,
        {
          opacity: focusOpacity ?? staticOpacity,
        },
      ]}
    >
      <View pointerEvents="none" style={[styles.maskLayer, horizontalMaskStyle]}>
        <View pointerEvents="none" style={[styles.maskLayer, styles.maskVertical]}>
          <Image
            pointerEvents="none"
            source={source}
            contentFit="cover"
            contentPosition={align === 'left' ? 'right' : 'left'}
            style={styles.image}
          />
        </View>
      </View>
      <View pointerEvents="none" style={styles.softVeil} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
  maskHorizontal: {
    maskImage:
      'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.3) 7%, black 15%, black 85%, rgba(0, 0, 0, 0.3) 93%, transparent 100%)',
    maskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskImage:
      'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.3) 7%, black 15%, black 85%, rgba(0, 0, 0, 0.3) 93%, transparent 100%)',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
  } as any,
  maskLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  maskVertical: {
    maskImage:
      'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.3) 7%, black 15%, black 85%, rgba(0, 0, 0, 0.3) 93%, transparent 100%)',
    maskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskImage:
      'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.3) 7%, black 15%, black 85%, rgba(0, 0, 0, 0.3) 93%, transparent 100%)',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: '100% 100%',
  } as any,
  panel: {
    overflow: 'hidden',
    position: 'absolute',
  },
  softVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 17, 28, 0.04)',
  },
});
