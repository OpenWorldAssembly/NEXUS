import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareSecurityModes,
  createWritePolicyForSecurityMode,
  inferSecurityModeFromWritePolicy,
  isSecurityModeLowering,
  resolveSecurityModePolicyDecision,
} from './write-security-mode.ts';
import { assertProofBundleSatisfiesPolicy } from '@core/auth/write-policy';

test('standard security mode maps to plain session write policy', () => {
  const writePolicy = createWritePolicyForSecurityMode('standard');

  assert.equal(writePolicy.default_proof_level, 'session');
  assert.deepEqual(writePolicy.action_overrides, {});
  assert.equal(inferSecurityModeFromWritePolicy(writePolicy), 'standard');
});

test('guarded security mode raises higher-impact action proofs', () => {
  const writePolicy = createWritePolicyForSecurityMode('guarded');

  assert.equal(writePolicy.default_proof_level, 'session');
  assert.equal(writePolicy.action_overrides['discussion.thread.create'], 'reauth');
  assert.equal(writePolicy.action_overrides['locality.element.create'], 'reauth');
  assert.equal(inferSecurityModeFromWritePolicy(writePolicy), 'guarded');
});

test('every_write security mode maps to a reauth default', () => {
  const writePolicy = createWritePolicyForSecurityMode('every_write');

  assert.equal(writePolicy.default_proof_level, 'reauth');
  assert.deepEqual(writePolicy.action_overrides, {});
  assert.equal(inferSecurityModeFromWritePolicy(writePolicy), 'every_write');
});

test('security mode comparison preserves the hardening order', () => {
  assert.equal(compareSecurityModes('standard', 'guarded'), -1);
  assert.equal(compareSecurityModes('guarded', 'guarded'), 0);
  assert.equal(compareSecurityModes('every_write', 'guarded'), 1);
});

test('lowering security mode is detected directionally', () => {
  assert.equal(
    isSecurityModeLowering({
      current: 'every_write',
      next: 'guarded',
    }),
    true
  );
  assert.equal(
    isSecurityModeLowering({
      current: 'guarded',
      next: 'every_write',
    }),
    false
  );
});

test('current every-write policy blocks lowering write approval without fresh proof', () => {
  const currentPolicyDecision = resolveSecurityModePolicyDecision({
    securityMode: 'every_write',
    actionIds: ['actor.write_policy.update'],
    sourcePolicyPacketIds: ['nexus:policy/write-lock/test-actor'],
  });

  assert.equal(currentPolicyDecision.required_proof_level, 'reauth');
  assert.deepEqual(currentPolicyDecision.accepted_proof_methods, [
    'bundle_passphrase_unlock',
    'passkey_confirmation',
  ]);
  assert.throws(() =>
    assertProofBundleSatisfiesPolicy({
      decision: currentPolicyDecision,
      proofs: {
        actor_packet_id: 'nexus:element/test-actor',
        is_claimed_identity: true,
        has_actor_assertion: true,
        has_claimed_session: true,
        has_unlocked_identity: true,
        has_recent_reauth: false,
        has_passkey_confirmation: false,
        proof_methods: ['claimed_session', 'bundle_unlocked'],
      },
    })
  );
});

test('bootstrap actor write-policy creation uses the standard session baseline', () => {
  const bootstrapDecision = resolveSecurityModePolicyDecision({
    securityMode: 'standard',
    actionIds: ['actor.write_policy.update'],
    sourcePolicyPacketIds: [],
  });

  assert.equal(bootstrapDecision.required_proof_level, 'session');
  assert.deepEqual(bootstrapDecision.accepted_proof_methods, ['claimed_session']);
  assert.deepEqual(bootstrapDecision.source_policy_packet_ids, []);
});
