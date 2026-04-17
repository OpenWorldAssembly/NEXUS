/**
 * File: public-secondary-nav.types.ts
 * Description: Shared types for reusable secondary public-page navigation shells.
 */
import { type ViewStyle } from 'react-native';

export type PublicSecondaryNavItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export type PublicSecondaryNavAnimatedState = {
  plateAnimatedStyle?: ViewStyle | Record<string, unknown>;
  dotAnimatedStyle?: ViewStyle | Record<string, unknown>;
  titleAnimatedStyle?: Record<string, unknown>;
  subtitleAnimatedStyle?: Record<string, unknown>;
};
