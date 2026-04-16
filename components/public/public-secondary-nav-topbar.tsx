import React, { useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  PublicSecondaryNavAnimatedState,
  PublicSecondaryNavItem,
} from './public-secondary-nav.types';

const TOPBAR_HIGHLIGHT_Z_INDEX = 3;
const TOPBAR_PILL_WIDTH = 104;
const TOPBAR_PILL_HEIGHT = 40;
const TOPBAR_PILL_GAP = 10;
const TOPBAR_PILL_ROW_GAP = 10;
const TOPBAR_TITLE_FONT_SIZE = 10;
const TOPBAR_SUBTITLE_FONT_SIZE = 6;

type PublicSecondaryNavTopbarProps = {
  items?: PublicSecondaryNavItem[];
  sections?: PublicSecondaryNavItem[];
  activeId?: string | null;
  activeItemId?: string | null;
  onItemPress?: (id: string) => void;
  onSectionPress?: (id: string) => void;
  title?: string;
  subtitle?: string;
  topbarShellHeight?: number;
  getItemAnimatedState?: (itemId: string) => PublicSecondaryNavAnimatedState | undefined;
  getItemAnimatedStyle?: (itemId: string) => PublicSecondaryNavAnimatedState | undefined;
  shouldShowSubtitle?: (itemId: string) => boolean;
};

export function PublicSecondaryNavTopbar({
  items,
  sections,
  activeId,
  activeItemId,
  onItemPress,
  onSectionPress,
  title,
  subtitle,
  topbarShellHeight,
  getItemAnimatedState,
  getItemAnimatedStyle,
}: PublicSecondaryNavTopbarProps) {
  const resolvedItems = items ?? sections ?? [];
  const resolvedActiveId = activeId ?? activeItemId ?? null;
  const resolvedOnPress = onItemPress ?? onSectionPress ?? (() => undefined);
  const resolvedAnimatedState = getItemAnimatedState ?? getItemAnimatedStyle;

  const itemStyles = useMemo(() => buildTopbarItemStyles(), []);
  const textStyles = useMemo(() => buildTopbarTextStyles(), []);

  return (
    <View style={[styles.container, topbarShellHeight ? { minHeight: topbarShellHeight } : null]}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title ?? 'Sections'}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.navList}>
        {resolvedItems.map((item) => {
          const isActive = item.id === resolvedActiveId;
          const animatedState = resolvedAnimatedState?.(item.id);

          return (
            <View key={item.id} style={itemStyles.shell}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => resolvedOnPress(item.id)}
                style={({ pressed }) => [styles.pressable, pressed ? styles.pressablePressed : null]}
              >
                  <Animated.View style={[itemStyles.plate, animatedState?.plateAnimatedStyle]}>                  <View pointerEvents="none" style={styles.itemContent}>
                    <Animated.Text
                      numberOfLines={1}
                        style={[textStyles.title, animatedState?.titleAnimatedStyle]}
                    >
                      {item.title}
                    </Animated.Text>
                    <View style={styles.subtitleSlot}>
                      <Animated.Text
                        numberOfLines={1}
                          style={[textStyles.subtitle, animatedState?.subtitleAnimatedStyle]}
                      >
                        {item.subtitle}
                      </Animated.Text>
                    </View>
                  </View>
                </Animated.View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function buildTopbarItemStyles() {
  return StyleSheet.create({
    shell: {
      width: TOPBAR_PILL_WIDTH,
      height: TOPBAR_PILL_HEIGHT,
      flexShrink: 0,
      marginHorizontal: TOPBAR_PILL_GAP / 2,
      marginVertical: TOPBAR_PILL_ROW_GAP / 2,
      zIndex: TOPBAR_HIGHLIGHT_Z_INDEX,
    },
    plate: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
      borderWidth: 0,
      backgroundColor: 'rgba(10, 18, 30, 0.88)',
      overflow: 'hidden',
    },
  });
}

function buildTopbarTextStyles() {
  return StyleSheet.create({
    title: {
      color: '#f4f7fb',
      fontSize: TOPBAR_TITLE_FONT_SIZE,
      fontWeight: '800',
      letterSpacing: 0.45,
      lineHeight: 12,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    subtitle: {
      color: '#d8f08a',
      fontSize: TOPBAR_SUBTITLE_FONT_SIZE,
      fontWeight: '700',
      letterSpacing: 0.5,
      lineHeight: 7,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
  });
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: 'rgba(2, 13, 38, 0.96)',
  },
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 36,
  },
  title: {
    color: '#8ec5ff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 2,
    color: '#f4f7fb',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.88,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  navList: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginHorizontal: -(TOPBAR_PILL_GAP / 2),
    marginVertical: -(TOPBAR_PILL_ROW_GAP / 2),
  },
  pressable: {
    width: '100%',
    height: '100%',
  },
  pressablePressed: {
    opacity: 0.96,
  },
  itemContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 5,
  },
  subtitleSlot: {
    minHeight: 8,
    marginTop: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
