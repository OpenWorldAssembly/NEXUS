/**
 * File: trusted_verification_coordinator.test.ts
 * Description: Smoke tests for the gated Trusted Verification Coordinator public surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAssemblyPacket,
  createPacketEdge,
} from '@core/packets/builders';
import {
  trustedVerificationCoordinator,
} from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';

function createPacket(packetId: string) {
  return createAssemblyPacket({
    packet_id: packetId,
    created_at: '2026-05-27T00:00:00.000Z',
    name: packetId,
    subtype: 'assembly',
    locality_label: packetId,
  });
}

test('trusted verification coordinator reports unsigned packet as advisory warning', async () => {
  const packet = createPacket('nexus:element/verification-smoke');
  const result = await trustedVerificationCoordinator.verifyPacket({
    packet,
    verification_mode: 'advisory',
  });

  assert.equal(result.coordinator_id, 'trusted_verification_coordinator.v0');
  assert.equal(result.status, 'partial');
  assert.equal(result.value?.packet_ref?.packet_id, packet.header.packet_id);
  assert.equal(result.value?.structural_status, 'passed');
  assert.equal(result.value?.signature_status, 'missing');
  assert.equal(result.value?.overall_status, 'warning');
});

test('trusted verification coordinator blocks unsigned packet in strict mode', async () => {
  const packet = createPacket('nexus:element/verification-strict');
  const result = await trustedVerificationCoordinator.verifyPacket({
    packet,
    verification_mode: 'strict',
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.value?.signature_status, 'missing');
  assert.equal(result.value?.overall_status, 'blocked');
  assert.equal(result.value?.blockers.length, 1);
});

test('trusted verification coordinator verifies bundle packet material through batch path', async () => {
  const packet = createPacket('nexus:element/verification-bundle');
  const result = await trustedVerificationCoordinator.verifyBundle({
    bundle: {
      bundle_version: 1,
      packets: [packet],
    },
    verification_mode: 'advisory',
  });

  assert.equal(result.value?.target_kind, 'bundle');
  assert.equal(result.value?.packet_count, 1);
  assert.equal(result.value?.packet_results[0]?.packet_ref?.packet_id, packet.header.packet_id);
});

test('trusted verification coordinator marks missing refs in ref verification mode', async () => {
  const packet = createAssemblyPacket({
    packet_id: 'nexus:element/verification-ref-source',
    created_at: '2026-05-27T00:00:00.000Z',
    name: 'Ref Source',
    subtype: 'assembly',
    locality_label: 'Ref Source',
    edges: [
      createPacketEdge('test.ref', { packet_id: 'nexus:element/missing-target' }),
    ],
  });
  const result = await trustedVerificationCoordinator.verifyPacketRefs({
    packets: [{ packet }],
    verification_mode: 'advisory',
  });

  assert.equal(result.value?.target_kind, 'packet_refs');
  assert.equal(result.value?.packet_results[0]?.ref_status, 'warning');
  assert.equal(result.value?.packet_results[0]?.overall_status, 'warning');
});

test('trusted verification coordinator readiness audit is scaffold-visible', () => {
  const result = trustedVerificationCoordinator.auditReadiness();

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.ready, true);
  assert.equal(result.value?.archive_backed_path_available, true);
});
