import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TRUST_POLICY_SNAPSHOT,
  deriveTrustStage,
  meetsTrustGate,
} from './trust-logic.ts';

test('deriveTrustStage walks from self-claimed to role-eligible using thresholds', () => {
  assert.equal(
    deriveTrustStage({
      has_association_relation: false,
      association_support_count: 0,
      claimed_role_count: 0,
      supported_role_count: 0,
      thresholds: DEFAULT_TRUST_POLICY_SNAPSHOT,
    }),
    'self_claimed'
  );

  assert.equal(
    deriveTrustStage({
      has_association_relation: true,
      association_support_count: 0,
      claimed_role_count: 0,
      supported_role_count: 0,
      thresholds: DEFAULT_TRUST_POLICY_SNAPSHOT,
    }),
    'emerging'
  );

  assert.equal(
    deriveTrustStage({
      has_association_relation: true,
      association_support_count: 1,
      claimed_role_count: 0,
      supported_role_count: 0,
      thresholds: DEFAULT_TRUST_POLICY_SNAPSHOT,
    }),
    'recognized'
  );

  assert.equal(
    deriveTrustStage({
      has_association_relation: true,
      association_support_count: 1,
      claimed_role_count: 1,
      supported_role_count: 1,
      thresholds: DEFAULT_TRUST_POLICY_SNAPSHOT,
    }),
    'role_eligible'
  );
});

test('meetsTrustGate compares trust stages in order', () => {
  assert.equal(meetsTrustGate('recognized', 'emerging'), true);
  assert.equal(meetsTrustGate('emerging', 'recognized'), false);
  assert.equal(meetsTrustGate('role_eligible', 'role_eligible'), true);
});
