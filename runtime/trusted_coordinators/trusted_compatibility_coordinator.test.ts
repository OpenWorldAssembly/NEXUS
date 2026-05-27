/**
 * File: trusted_compatibility_coordinator.test.ts
 * Description: Smoke tests for the gated Trusted Compatibility Coordinator public surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssemblyPacket } from '@core/packets/builders';
import { trustedCompatibilityCoordinator } from '@runtime/trusted_coordinators/trusted_compatibility_coordinator/index.ts';

function createPacket(packetId: string) {
  return createAssemblyPacket({
    packet_id: packetId,
    created_at: '2026-05-27T00:00:00.000Z',
    name: packetId,
    subtype: 'assembly',
    locality_label: packetId,
  });
}

test('trusted compatibility coordinator resolves current packet compatibility', () => {
  const packet = createPacket('nexus:element/compatibility-smoke');
  const result = trustedCompatibilityCoordinator.resolvePacketCompatibility({ packet });

  assert.equal(result.coordinator_id, 'trusted_compatibility_coordinator.v0');
  assert.equal(result.status, 'ok');
  assert.equal(result.value?.packet_ref?.packet_id, packet.header.packet_id);
  assert.equal(result.value?.packet_type, 'Element');
  assert.equal(result.value?.is_supported, true);
  assert.equal(result.value?.is_exact, true);
});

test('trusted compatibility coordinator adapts current packet for read', () => {
  const packet = createPacket('nexus:element/compatibility-read');
  const result = trustedCompatibilityCoordinator.adaptPacketForRead({ packet });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.adapted_packet?.header.packet_id, packet.header.packet_id);
  assert.equal(result.value?.compatibility.writable_as_is, true);
});

test('trusted compatibility coordinator prepares current packet for write', () => {
  const packet = createPacket('nexus:element/compatibility-write');
  const result = trustedCompatibilityCoordinator.preparePacketForWrite({ packet });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.write_allowed, true);
  assert.equal(result.value?.prepared_packet?.header.packet_id, packet.header.packet_id);
  assert.deepEqual(result.value?.write_blockers, []);
});

test('trusted compatibility coordinator resolves same-version adapter path metadata', () => {
  const result = trustedCompatibilityCoordinator.resolveAdapterPath({
    packet_type: 'Element',
    source_schema_version: '1.0.0',
    target_schema_version: '1.0.0',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.path_found, true);
  assert.equal(result.value?.same_version, true);
  assert.equal(result.value?.step_count, 0);
});

test('trusted compatibility coordinator reports missing adapter path as trusted issue', () => {
  const result = trustedCompatibilityCoordinator.resolveAdapterPath({
    packet_type: 'Element',
    source_schema_version: '0.0.0-missing',
    target_schema_version: '1.0.0',
  });

  assert.equal(result.status, 'partial');
  assert.equal(result.value?.path_found, false);
  assert.equal(result.issues.length > 0, true);
});

test('trusted compatibility coordinator resolves compatibility profile for a known packet type', () => {
  const result = trustedCompatibilityCoordinator.resolveCompatibilityProfile({
    packet_type: 'Definition',
  });

  assert.notEqual(result.status, 'error');
  assert.equal(result.value?.packet_type, 'Definition');
  assert.equal(result.value?.definition_part_present, true);
  assert.equal(Boolean(result.value?.current_schema_version), true);
});

test('trusted compatibility coordinator audits coverage without coordinator errors', () => {
  const result = trustedCompatibilityCoordinator.auditCompatibilityCoverage({
    packet_type_filters: ['Definition', 'Element'],
  });

  assert.notEqual(result.status, 'error');
  assert.equal(result.value?.checked_packet_type_count, 2);
  assert.equal(result.issues.some((issue) => issue.severity === 'error'), false);
});

test('trusted compatibility coordinator readiness audit is scaffold-visible', () => {
  const result = trustedCompatibilityCoordinator.auditReadiness();

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.ready, true);
  assert.equal(result.value?.core_registry_available, true);
  assert.equal(result.value?.definition_lookup_available, true);
});
