import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareSecurityModes,
  createWritePolicyForSecurityMode,
  inferSecurityModeFromWritePolicy,
  isSecurityModeLowering,
} from './write-security-mode.ts';

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
