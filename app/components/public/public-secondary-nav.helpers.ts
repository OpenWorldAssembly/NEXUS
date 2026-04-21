/**
 * File: public-secondary-nav.helpers.ts
 * Description: Shared resolver helpers for reusable public secondary navigation shells.
 */
import type {
  PublicSecondaryNavAnimatedState,
  PublicSecondaryNavAnimatedStateResolver,
  PublicSecondaryNavSubtitleVisibilityResolver,
} from './public-secondary-nav.types';

type ResolvePublicSecondaryNavItemStateArgs = {
  itemId: string;
  getItemAnimatedState?: PublicSecondaryNavAnimatedStateResolver;
  shouldShowItemSubtitle?: PublicSecondaryNavSubtitleVisibilityResolver;
};

type ResolvePublicSecondaryNavItemStateResult = {
  animatedState?: PublicSecondaryNavAnimatedState;
  shouldShowSubtitle: boolean;
};

/**
 * Inputs: optional animation and subtitle resolvers for a shared nav item.
 * Output: normalized render state for the requested nav item.
 */
export function resolvePublicSecondaryNavItemState({
  itemId,
  getItemAnimatedState,
  shouldShowItemSubtitle,
}: ResolvePublicSecondaryNavItemStateArgs): ResolvePublicSecondaryNavItemStateResult {
  return {
    animatedState: getItemAnimatedState?.(itemId),
    shouldShowSubtitle: shouldShowItemSubtitle ? shouldShowItemSubtitle(itemId) : true,
  };
}
