/**
 * File: public-secondary-nav-rail.tsx
 * Description: Reusable right-side secondary navigation rail for public pages.
 */
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  PublicSecondaryNavAnimatedState,
  PublicSecondaryNavItem,
} from '@app/components/public/public-secondary-nav.types';
import { SECTION_RAIL_WIDTH } from './public-secondary-nav.constants';

type PublicSecondaryNavRailProps = {
  activeId?: string | null;
  items: PublicSecondaryNavItem[];
  railRightOffset?: number;
  railShellHeight?: number;
  railWidth?: number;
  subtitle?: string;
  title: string;
  getItemAnimatedState?: (itemId: string) => PublicSecondaryNavAnimatedState | undefined;
  onItemPress: (itemId: string) => void;
  shouldShowSubtitle?: (itemId: string) => boolean;
};

/**
 * Inputs: shared nav item metadata, current active state, and animation helpers.
 * Output: a reusable fixed secondary navigation rail for public pages.
 */
export default function PublicSecondaryNavRail({
  activeId,
  items,
  railRightOffset,
  railShellHeight,
  railWidth,
  subtitle,
  title,
  getItemAnimatedState,
  onItemPress,
  shouldShowSubtitle,
}: PublicSecondaryNavRailProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.railViewportOverlay, { right: railRightOffset ?? 0 }]}
    >
      <View
        style={[
          styles.railShell,
          {
            height: railShellHeight ?? 540,
            width: railWidth ?? SECTION_RAIL_WIDTH,
          },
        ]}
      >
        <View style={styles.railHeader}>
          <Text style={styles.railEyebrow}>{title}</Text>
          {subtitle ? <Text style={styles.railEyebrowSubtext}>{subtitle}</Text> : null}
        </View>

        <View style={styles.railStack}>
          {items.map((item) => {
            const animatedState = getItemAnimatedState?.(item.id);
            const showItemSubtitle = shouldShowSubtitle ? shouldShowSubtitle(item.id) : true;

            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: item.id === activeId }}
                onPress={() => onItemPress(item.id)}
                style={styles.railItemPressable}
              >
                <View style={styles.railItemBase}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.railItemPlate, animatedState?.plateAnimatedStyle]}
                  />

                  <View style={styles.railItemContent}>
                    <View style={styles.railTextWrap}>
                      <Animated.Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.railTitleBase, animatedState?.titleAnimatedStyle]}
                      >
                        {item.title}
                      </Animated.Text>

                      {item.subtitle ? (
                        <Animated.Text
                          numberOfLines={2}
                          style={[
                            styles.railSubtitleBase,
                            animatedState?.subtitleAnimatedStyle,
                            !showItemSubtitle && styles.railSubtitleHidden,
                          ]}
                        >
                          {item.subtitle}
                        </Animated.Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  railShell: {
    backgroundColor: 'rgba(10, 18, 30, 0.72)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
  },
  railHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    marginBottom: 4,
  },
  railEyebrow: {
    color: '#8ecae6',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  railEyebrowSubtext: {
    marginTop: 3,
    color: 'rgba(232, 238, 246, 0.62)',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: 144,
  },
  railStack: {
    flex: 1,
    justifyContent: 'space-between',
  },
  railItemPressable: {
    width: SECTION_RAIL_WIDTH - 16,
    alignSelf: 'center',
  },
  railItemBase: {
    minHeight: 54,
    width: SECTION_RAIL_WIDTH - 24,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  railItemPlate: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 0,
  },
  railItemContent: {
    minHeight: 50,
    width: SECTION_RAIL_WIDTH - 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  railTextWrap: {
    width: '100%',
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  railTitleBase: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
    textAlign: 'center',
    width: '100%',
  },
  railSubtitleBase: {
    marginTop: 1,
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  railSubtitleHidden: {
    opacity: 0,
  },
  railViewportOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
});
