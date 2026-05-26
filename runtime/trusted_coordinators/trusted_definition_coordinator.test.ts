/**
 * File: trusted_definition_coordinator.test.ts
 * Description: Smoke tests for the gated Trusted Definition Coordinator public surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';

test('trusted definition coordinator resolves a manifest-backed packet definition', () => {
  const result = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: 'Definition',
  });

  assert.notEqual(result.status, 'error');
  assert.equal(result.value?.packet_type, 'Definition');
});

test('trusted definition coordinator resolves active definition context through the coordinator gate', () => {
  const result = trustedDefinitionCoordinator.resolveContext({
    packet_type_filters: ['Definition'],
  });

  assert.notEqual(result.status, 'error');
  assert.equal(result.value?.active_candidates.some((candidate) => candidate.defines_packet_type === 'Definition'), true);
});

test('trusted definition coordinator keeps compatibility definitions available without normal promotion', () => {
  const result = trustedDefinitionCoordinator.resolveCompatibilityDefinition({
    packet_type: 'Definition',
  });

  assert.notEqual(result.status, 'error');
  assert.equal(result.value?.part_subtype, 'packet_compatibility');
});
