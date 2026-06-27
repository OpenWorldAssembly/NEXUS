/**
 * File: identity-sign-in-state.test.ts
 * Description: Regression coverage for selected identity sign-in action state.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getIdentityResultSelectionState,
  getSelectedIdentityActionState,
  localIdentityMatchesQuery,
} from './identity-sign-in-state.ts';

const savedIdentity = {
  actor_packet_id: 'nexus:element/testy',
  display_alias: 'Testy McGee',
  saved_on_device: true,
} as const;

test('saved current identity enables bundle sign-in with valid passphrase', () => {
  const state = getSelectedIdentityActionState({
    selectedIdentity: savedIdentity,
    visibleIdentityCount: 1,
    selectedIdentityIsCurrentActor: false,
    currentMode: 'persistent_guest',
    hasActiveClaimedSession: false,
    isCurrentIdentityUnlocked: false,
    isBusy: false,
    passphraseError: null,
  });

  assert.equal(state.bundle_action_label, 'Sign in');
  assert.equal(state.can_submit_bundle, true);
  assert.equal(state.bundle_disabled_reason, null);
});

test('saved current identity hides disabled reason while sign-in is running', () => {
  const state = getSelectedIdentityActionState({
    selectedIdentity: savedIdentity,
    visibleIdentityCount: 1,
    selectedIdentityIsCurrentActor: false,
    currentMode: 'persistent_guest',
    hasActiveClaimedSession: false,
    isCurrentIdentityUnlocked: false,
    isBusy: true,
    passphraseError: null,
  });

  assert.equal(state.bundle_action_label, 'Signing in...');
  assert.equal(state.can_submit_bundle, false);
  assert.equal(state.bundle_disabled_reason, null);
});

test('saved migration-required identity enables migration review with valid passphrase', () => {
  const state = getSelectedIdentityActionState({
    selectedIdentity: {
      ...savedIdentity,
      migration_readiness: 'migration_required',
    },
    visibleIdentityCount: 1,
    selectedIdentityIsCurrentActor: false,
    currentMode: 'persistent_guest',
    hasActiveClaimedSession: false,
    isCurrentIdentityUnlocked: false,
    isBusy: false,
    passphraseError: null,
  });

  assert.equal(state.bundle_action_label, 'Unlock and review migration');
  assert.equal(state.can_prepare_migration, true);
  assert.equal(state.can_submit_bundle, true);
});

test('saved migration-required identity hides disabled reason while preparing', () => {
  const state = getSelectedIdentityActionState({
    selectedIdentity: {
      ...savedIdentity,
      migration_readiness: 'migration_required',
    },
    visibleIdentityCount: 1,
    selectedIdentityIsCurrentActor: false,
    currentMode: 'persistent_guest',
    hasActiveClaimedSession: false,
    isCurrentIdentityUnlocked: false,
    isBusy: true,
    passphraseError: null,
  });

  assert.equal(state.bundle_action_label, 'Preparing...');
  assert.equal(state.can_prepare_migration, false);
  assert.equal(state.bundle_disabled_reason, null);
});

test('nexus-only identity disables bundle sign-in with explicit reason', () => {
  const state = getSelectedIdentityActionState({
    selectedIdentity: {
      ...savedIdentity,
      saved_on_device: false,
    },
    visibleIdentityCount: 1,
    selectedIdentityIsCurrentActor: false,
    currentMode: 'persistent_guest',
    hasActiveClaimedSession: false,
    isCurrentIdentityUnlocked: false,
    isBusy: false,
    passphraseError: null,
  });

  assert.equal(state.can_submit_bundle, false);
  assert.match(state.bundle_disabled_reason ?? '', /encrypted identity bundle/i);
  assert.equal(state.should_offer_passkey, true);
  assert.equal(state.should_offer_import, true);
});

test('identity result selection does not rewrite the search query', () => {
  const state = getIdentityResultSelectionState({
    actorPacketId: 'nexus:element/testy-mcgee',
  });

  assert.equal(state.selected_identity_id, 'nexus:element/testy-mcgee');
  assert.equal(state.selected_identity_locked, true);
  assert.equal(state.next_identity_query, null);
  assert.equal(state.should_clear_prepared_migration, true);
});

test('local identity query matching covers aliases and packet ids', () => {
  assert.equal(localIdentityMatchesQuery(savedIdentity, 'testy'), true);
  assert.equal(localIdentityMatchesQuery(savedIdentity, 'nexus:element/test'), true);
  assert.equal(localIdentityMatchesQuery(savedIdentity, 'not-testy'), false);
});
