/**
 * File: public-secondary-nav.types.ts
 * Description: Shared types for reusable secondary public-page navigation shells.
 */
import { type ViewStyle } from 'react-native';

export type PublicSecondaryNavMode = 'rail' | 'topbar';

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

export type PublicSecondaryNavAnimatedStateResolver = (
  itemId: string,
) => PublicSecondaryNavAnimatedState | undefined;

export type PublicSecondaryNavSubtitleVisibilityResolver = (itemId: string) => boolean;

export type PublicSecondaryNavConfig = {
  items: PublicSecondaryNavItem[];
  title?: string;
  subtitle?: string;
};

export type PublicSecondaryNavRenderState = {
  activeId: string | null;
  onItemPress: (itemId: string) => void;
  getItemAnimatedState?: PublicSecondaryNavAnimatedStateResolver;
  shouldShowItemSubtitle?: PublicSecondaryNavSubtitleVisibilityResolver;
};

export type PublicSecondaryNavSharedProps = PublicSecondaryNavConfig & PublicSecondaryNavRenderState;

export type PublicSecondaryNavProps = PublicSecondaryNavSharedProps & {
  mode?: PublicSecondaryNavMode;
  railWidth?: number;
  railRightOffset?: number;
  topbarShellHeight?: number;
  railShellHeight?: number;
};

export type PublicSecondaryNavRailProps = PublicSecondaryNavSharedProps & {
  railRightOffset?: number;
  railShellHeight?: number;
  railWidth?: number;
  title: string;
};

export type PublicSecondaryNavTopbarProps = PublicSecondaryNavSharedProps & {
  topbarShellHeight?: number;
};
