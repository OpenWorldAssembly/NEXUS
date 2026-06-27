/**
 * File: identity-sign-in-state.ts
 * Description: Computes selected-identity sign-in actions and disabled reasons for the Nexus identity sign-in page.
 */

import type { NexusLocalIdentityPreview } from '@runtime/nexus/nexus-api-types';

export type SignInIdentityOption = {
  actor_packet_id: string;
  display_alias: string;
  saved_on_device: boolean;
  migration_readiness?: NexusLocalIdentityPreview['migration_readiness'];
};

export type SelectedIdentityActionState = {
  status_label: string;
  detail: string;
  bundle_action_label: string;
  bundle_disabled_reason: string | null;
  can_submit_bundle: boolean;
  can_prepare_migration: boolean;
  should_offer_passkey: boolean;
  should_offer_import: boolean;
};

export type IdentityResultSelectionState = {
  selected_identity_id: string;
  selected_identity_locked: boolean;
  next_identity_query: string | null;
  should_clear_prepared_migration: boolean;
};

export function getIdentityResultSelectionState(input: {
  actorPacketId: string;
}): IdentityResultSelectionState {
  return {
    selected_identity_id: input.actorPacketId,
    selected_identity_locked: true,
    next_identity_query: null,
    should_clear_prepared_migration: true,
  };
}

export function localIdentityMatchesQuery(
  identity: SignInIdentityOption,
  normalizedQuery: string
): boolean {
  return (
    identity.display_alias.toLowerCase().includes(normalizedQuery) ||
    identity.actor_packet_id.toLowerCase().includes(normalizedQuery)
  );
}

export function getSelectedIdentityActionState(input: {
  selectedIdentity: SignInIdentityOption | null;
  visibleIdentityCount: number;
  selectedIdentityIsCurrentActor: boolean;
  currentMode: 'ephemeral_guest' | 'persistent_guest' | 'claimed' | null;
  hasActiveClaimedSession: boolean;
  isCurrentIdentityUnlocked: boolean;
  isBusy: boolean;
  passphraseError: string | null;
}): SelectedIdentityActionState {
  if (!input.selectedIdentity || input.visibleIdentityCount === 0) {
    return {
      status_label: 'No identity selected',
      detail: 'Select a saved identity, search Nexus, use passkey sign-in, or import an encrypted bundle.',
      bundle_action_label: 'Sign in',
      bundle_disabled_reason: 'Select an identity first.',
      can_submit_bundle: false,
      can_prepare_migration: false,
      should_offer_passkey: true,
      should_offer_import: true,
    };
  }

  if (!input.selectedIdentity.saved_on_device) {
    return {
      status_label: 'Known in Nexus only',
      detail: 'This identity is visible in the Nexus packet graph, but its encrypted local signing bundle is not saved on this device.',
      bundle_action_label: 'Bundle unavailable',
      bundle_disabled_reason: 'Bundle passphrase sign-in needs the encrypted identity bundle saved on this device.',
      can_submit_bundle: false,
      can_prepare_migration: false,
      should_offer_passkey: true,
      should_offer_import: true,
    };
  }

  if (input.selectedIdentity.migration_readiness === 'migration_required') {
    const disabledReason = input.passphraseError
      ? 'Enter the saved bundle passphrase to prepare migration.'
      : null;

    return {
      status_label: 'Saved legacy identity',
      detail: 'This saved identity needs a consent review before it is minted as a current claimed identity.',
      bundle_action_label: input.isBusy ? 'Preparing...' : 'Unlock and review migration',
      bundle_disabled_reason: disabledReason,
      can_submit_bundle: !disabledReason && !input.isBusy,
      can_prepare_migration: !disabledReason && !input.isBusy,
      should_offer_passkey: true,
      should_offer_import: false,
    };
  }

  const baseDisabledReason = input.passphraseError
    ? 'Enter the saved bundle passphrase.'
    : null;
  const bundleActionLabel =
    input.isBusy
      ? 'Signing in...'
      : input.selectedIdentityIsCurrentActor &&
          input.currentMode === 'claimed' &&
          !input.hasActiveClaimedSession
        ? 'Resume this identity'
        : input.selectedIdentityIsCurrentActor &&
            input.currentMode === 'claimed' &&
            input.hasActiveClaimedSession &&
            !input.isCurrentIdentityUnlocked
          ? 'Unlock this identity'
          : 'Sign in';

  return {
    status_label: 'Saved on this device',
    detail: 'This identity has an encrypted local signing bundle on this device.',
    bundle_action_label: bundleActionLabel,
    bundle_disabled_reason: baseDisabledReason,
    can_submit_bundle: !baseDisabledReason && !input.isBusy,
    can_prepare_migration: false,
    should_offer_passkey: true,
    should_offer_import: false,
  };
}
