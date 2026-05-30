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


test('trusted definition coordinator lists kernel-validated seeded bundle candidates alongside bootstrap fallback', () => {
  const result = trustedDefinitionCoordinator.listCandidates({
    packet_type_filters: ['Preference'],
  });

  assert.notEqual(result.status, 'error');
  assert.equal(
    result.value?.some(
      (candidate) =>
        candidate.defines_packet_type === 'Preference' &&
        candidate.source.source_kind === 'seeded_bundle'
    ),
    true
  );
  assert.equal(
    result.value?.some(
      (candidate) =>
        candidate.defines_packet_type === 'Preference' &&
        candidate.source.source_kind === 'bootstrap_manifest'
    ),
    true
  );
});

test('trusted definition coordinator can prefer the seeded bundle source without replacing the coordinator path', () => {
  const result = trustedDefinitionCoordinator.resolveContext({
    packet_type_filters: ['Preference'],
    preferences: [
      {
        preference_id: 'test.prefer.seeded.definition.bundle',
        source_id: 'nexus:definition-profile/pre-reseed-active-manifest',
        packet_type: 'Preference',
        packet_subtype: null,
        part_subtype: 'packet_type_definition',
        trust_mode: 'prefer',
        priority: 1000,
        notes: 'Smoke-test preference for the seeded Bundle.packet_set candidate source.',
      },
    ],
  });

  assert.notEqual(result.status, 'error');
  const activeDefinitionCandidate = result.value?.active_candidates.find(
    (candidate) =>
      candidate.defines_packet_type === 'Preference' &&
      candidate.part_subtype === 'packet_type_definition'
  );

  assert.equal(activeDefinitionCandidate?.source.source_kind, 'seeded_bundle');
});
