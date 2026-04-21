/**
 * File: public-section-shell.tsx
 * Description: Shared shell for public-page sections with background media, accent overlay, and animated content slots.
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type AnimatedSectionStyle = Animated.WithAnimatedValue<ViewStyle> | StyleProp<ViewStyle>;

type PublicSectionShellProps = {
  backgroundImageUri: string;
  contentClassName?: string;
  details: ReactNode;
  detailsAnimatedStyle?: AnimatedSectionStyle;
  header: ReactNode;
  isActive: boolean;
  isMobile?: boolean;
  onPress: () => void;
  shellAnimatedStyle?: AnimatedSectionStyle;
  summary: ReactNode;
  backgroundAnimatedStyle?: AnimatedSectionStyle;
  accentAnimatedStyle?: AnimatedSectionStyle;
};

/**
 * Inputs: animated shell styles, section media, and slotted content blocks.
 * Output: a reusable public-page section shell that preserves the existing visual structure.
 */
export default function PublicSectionShell({
  backgroundImageUri,
  contentClassName = 'flex-1 px-7 py-8 md:px-9 md:py-9',
  details,
  detailsAnimatedStyle,
  header,
  isActive,
  isMobile = false,
  onPress,
  shellAnimatedStyle,
  summary,
  backgroundAnimatedStyle,
  accentAnimatedStyle,
}: PublicSectionShellProps) {
  return (
    <View style={[styles.chapter, isMobile ? styles.chapterMobile : null]}>
      <Animated.View
        style={[styles.shell, shellAnimatedStyle]}
        className={['overflow-hidden border', isActive ? 'shadow-public' : ''].join(' ')}
      >
        <Animated.View pointerEvents="none" style={[styles.parallaxLayer, backgroundAnimatedStyle]}>
          <Image
            source={{ uri: backgroundImageUri }}
            contentFit="cover"
            style={styles.parallaxImage}
          />
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.accentOverlay, accentAnimatedStyle]} />

        <Pressable className={contentClassName} onPress={onPress}>
          {header}
          {summary}
          <Animated.View style={[styles.detailsArea, detailsAnimatedStyle]}>{details}</Animated.View>
        </Pressable>
      </Animated.View>
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
  accentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6dd3ff',
  },
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
    top: -8,
    bottom: -8,
  },
  shell: {
    shadowColor: '#07121d',
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
