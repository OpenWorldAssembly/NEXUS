/**
 * File: public-secondary-nav-topbar.tsx
 * Description: Reusable topbar secondary navigation shell for public pages.
 */
import React, { useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { resolvePublicSecondaryNavItemState } from '@app/components/public/public-secondary-nav.helpers';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
import {
  SECTION_TOPBAR_COMPACT_BREAKPOINT,
  SECTION_TOPBAR_PILL_GAP,
  SECTION_TOPBAR_PILL_HEIGHT,
  SECTION_TOPBAR_PILL_ROW_GAP,
  SECTION_TOPBAR_PILL_WIDTH,
} from './public-secondary-nav.constants';
import type { PublicSecondaryNavTopbarProps } from './public-secondary-nav.types';

const TOPBAR_HIGHLIGHT_Z_INDEX = 3;
const TOPBAR_TITLE_FONT_SIZE = 10;
const TOPBAR_SUBTITLE_FONT_SIZE = 6;

export function PublicSecondaryNavTopbar({
  items,
  activeId,
  onItemPress,
  title,
  subtitle,
  topbarShellHeight,
  getItemAnimatedState,
  shouldShowItemSubtitle,
}: PublicSecondaryNavTopbarProps) {
  const { width } = useWindowDimensions();
  const isCompactTopbar = width < SECTION_TOPBAR_COMPACT_BREAKPOINT;

  const itemStyles = useMemo(() => buildTopbarItemStyles(isCompactTopbar), [isCompactTopbar]);
  const textStyles = useMemo(() => buildTopbarTextStyles(isCompactTopbar), [isCompactTopbar]);

  return (
    <View
      className={PUBLIC_SURFACE_CLASSES.navigation.topbarShellClassName}
      style={[
        styles.container,
        isCompactTopbar ? styles.containerCompact : null,
        topbarShellHeight ? { minHeight: topbarShellHeight } : null,
      ]}
    >
      <View style={[styles.titleWrap, isCompactTopbar ? styles.titleWrapCompact : null]}>
        <Text style={styles.title}>{title ?? 'Sections'}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.navList, isCompactTopbar ? styles.navListCompact : null]}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          const { animatedState, shouldShowSubtitle } = resolvePublicSecondaryNavItemState({
            itemId: item.id,
            getItemAnimatedState,
            shouldShowItemSubtitle,
          });

          return (
            <View key={item.id} style={itemStyles.shell}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => onItemPress(item.id)}
                style={({ pressed }) => [styles.pressable, pressed ? styles.pressablePressed : null]}
              >
                <Animated.View
                  className={PUBLIC_SURFACE_CLASSES.navigation.itemPlateClassName}
                  style={[itemStyles.plate, animatedState?.plateAnimatedStyle]}
                >
                  <View pointerEvents="none" style={styles.itemContent}>
                    <Animated.Text
                      numberOfLines={1}
                      style={[textStyles.title, animatedState?.titleAnimatedStyle]}
                    >
                      {item.title}
                    </Animated.Text>
                    <View style={styles.subtitleSlot}>
                      <Animated.Text
                        numberOfLines={1}
                        style={[
                          textStyles.subtitle,
                          animatedState?.subtitleAnimatedStyle,
                          !shouldShowSubtitle && styles.itemSubtitleHidden,
                        ]}
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

function buildTopbarItemStyles(isCompactTopbar: boolean) {
  return StyleSheet.create({
    shell: {
      width: SECTION_TOPBAR_PILL_WIDTH,
      height: isCompactTopbar ? 32 : SECTION_TOPBAR_PILL_HEIGHT,
      flexShrink: 0,
      marginHorizontal: (isCompactTopbar ? 6 : SECTION_TOPBAR_PILL_GAP) / 2,
      marginVertical: (isCompactTopbar ? 4 : SECTION_TOPBAR_PILL_ROW_GAP) / 2,
      zIndex: TOPBAR_HIGHLIGHT_Z_INDEX,
    },
    plate: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
    },
  });
}

function buildTopbarTextStyles(isCompactTopbar: boolean) {
  return StyleSheet.create({
    title: {
      color: '#f4f7fb',
      fontSize: TOPBAR_TITLE_FONT_SIZE,
      fontWeight: '800',
      letterSpacing: 0.45,
      lineHeight: isCompactTopbar ? 10 : 12,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    subtitle: {
      color: '#d8f08a',
      fontSize: TOPBAR_SUBTITLE_FONT_SIZE,
      fontWeight: '700',
      letterSpacing: 0.5,
      lineHeight: isCompactTopbar ? 5 : 7,
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
  },
  containerCompact: {
    paddingTop: 6,
    paddingBottom: 2,
  },
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 36,
  },
  titleWrapCompact: {
    marginBottom: 4,
    minHeight: 24,
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
    marginHorizontal: -(SECTION_TOPBAR_PILL_GAP / 2),
    marginVertical: -(SECTION_TOPBAR_PILL_ROW_GAP / 2),
  },
  navListCompact: {
    marginHorizontal: -3,
    marginVertical: -2,
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
    paddingTop: 4,
    paddingBottom: 2,
  },
  subtitleSlot: {
    minHeight: 5,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemSubtitleHidden: {
    opacity: 0,
  },
});
