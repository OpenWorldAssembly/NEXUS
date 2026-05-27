/**
 * File: trusted_dispatch_coordinator.test.ts
 * Description: Smoke tests for the Trusted Dispatch Coordinator compatibility bridge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { trustedDispatchCoordinator } from './trusted_dispatch_coordinator/trusted_dispatch_coordinator.ts';
import { trustedRequestCoordinator } from './trusted_request_coordinator/trusted_request_coordinator.ts';

test('trusted dispatch coordinator normalizes through the request bridge', () => {
  const result = trustedDispatchCoordinator.normalizeRequest({
    source_kind: 'interface_signal',
    source_route: '/api/nexus/mutations/prepare',
    operation_kind: 'mutation_prepare',
    client_intent_id: 'scope.association.set',
    mutation_intent: 'relation.association.add',
    request_id: 'interface.event.test',
  });

  assert.equal(result.coordinator_id, 'trusted_dispatch_coordinator.v0');
  assert.equal(result.coordinator_kind, 'dispatch');
  assert.equal(result.value?.request_id, 'interface.event.test');
  assert.equal(result.value?.mutation_intent, 'relation.association.add');
});

test('trusted dispatch coordinator preserves enrollment parity with request coordinator', () => {
  const dispatchResult = trustedDispatchCoordinator.listEnrollments();
  const requestResult = trustedRequestCoordinator.listEnrollments();

  assert.equal(dispatchResult.coordinator_kind, 'dispatch');
  assert.equal(
    dispatchResult.value?.enrollments.length,
    requestResult.value?.enrollments.length
  );
});
