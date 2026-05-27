/**
 * File: trusted_exchange_coordinator.test.ts
 * Description: Smoke tests for the gated Trusted Exchange Coordinator public surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssemblyPacket } from '@core/packets/builders';
import { trustedExchangeCoordinator } from '@runtime/trusted_coordinators/trusted_exchange_coordinator/index.ts';

function createPacket(packetId: string, revisionId?: string) {
  const packet = createAssemblyPacket({
    packet_id: packetId,
    created_at: '2026-05-27T00:00:00.000Z',
    name: packetId,
    subtype: 'assembly',
    locality_label: packetId,
  });

  if (revisionId) {
    return {
      ...packet,
      header: {
        ...packet.header,
        revision_id: revisionId,
      },
    };
  }

  return packet;
}

function createMockStore(packets = []) {
  const packetMap = new Map();
  const revisionMap = new Map();

  for (const packet of packets) {
    packetMap.set(packet.header.packet_id, packet);
    revisionMap.set(packet.header.revision_id, packet);
  }

  return {
    validate(input) {
      return input;
    },
    async writeRevision(packet) {
      packetMap.set(packet.header.packet_id, packet);
      revisionMap.set(packet.header.revision_id, packet);
      return {
        packet_id: packet.header.packet_id,
        revision_id: packet.header.revision_id,
      };
    },
    async publishRevision() {},
    async fetchByPacket(packetRef) {
      return packetMap.get(packetRef.packet_id) ?? null;
    },
    async fetchByRevision(revisionRef) {
      return revisionMap.get(revisionRef.revision_id) ?? null;
    },
    async resolveRevisionRef(revisionId) {
      const packet = revisionMap.get(revisionId);
      return packet
        ? { packet_id: packet.header.packet_id, revision_id: packet.header.revision_id }
        : null;
    },
    async fetchPreferredRevision(packetRef) {
      const packet = packetMap.get(packetRef.packet_id);
      return packet
        ? { packet_id: packet.header.packet_id, revision_id: packet.header.revision_id }
        : null;
    },
    async fetchRevisionHeads(packetRef) {
      const preferred = await this.fetchPreferredRevision(packetRef);
      return {
        preferred_revision: preferred,
        head_revisions: preferred ? [preferred] : [],
        revision_state: 'linear',
      };
    },
    async queryEdges() {
      return [];
    },
    async mergeRevisions(input) {
      return this.writeRevision(input.merged_packet);
    },
    async readByPacket(packetRef) {
      return packetMap.get(packetRef.packet_id) ?? null;
    },
    async readByRevision(revisionRef) {
      return revisionMap.get(revisionRef.revision_id) ?? null;
    },
    async prepareRevisionForAdaptedSave() {
      return null;
    },
    async prepareRevisionForVersionedSave() {
      return null;
    },
    async writePreparedRevision(preparation) {
      return this.writeRevision(preparation.prepared_packet ?? preparation.packet);
    },
    async importBundle() {
      return { packet_count: 0, revision_count: 0, edge_count: 0 };
    },
    async exportBundle(packetRefs) {
      const packets = packetRefs
        .map((packetRef) => packetMap.get(packetRef.packet_id))
        .filter(Boolean);
      return {
        bytes: new Uint8Array([1, 2, 3]),
        packet_count: packets.length,
        revision_count: packets.length,
      };
    },
    async listPreferredPacketsByType(type) {
      return Array.from(packetMap.values()).filter((packet) => packet.header.type === type);
    },
    async listPreferredPackets() {
      return Array.from(packetMap.values());
    },
    async getPacketVerificationSummary() {
      return null;
    },
    async listPacketVerificationSummaries() {
      return [];
    },
    async writePacketVerificationSummary() {},
  };
}

test('trusted exchange coordinator previews incoming bundle material', async () => {
  const packet = createPacket('nexus:element/exchange-preview');
  const result = await trustedExchangeCoordinator.previewImport({
    bundle: { packets: [packet] },
  });

  assert.equal(result.coordinator_id, 'trusted_exchange_coordinator.v0');
  assert.equal(result.value?.packet_count, 1);
  assert.equal(result.value?.readable_count, 1);
  assert.equal(result.value?.packet_previews[0]?.packet_ref?.packet_id, packet.header.packet_id);
  assert.equal(result.value?.packet_previews[0]?.local_status, 'not_checked');
});

test('trusted exchange coordinator plans import commit from preview without writing', async () => {
  const packet = createPacket('nexus:element/exchange-plan');
  const preview = await trustedExchangeCoordinator.previewImport({
    bundle: { packets: [packet] },
  });
  const plan = await trustedExchangeCoordinator.planImportCommit({
    preview: preview.value,
  });

  assert.equal(plan.value?.packet_count, 1);
  assert.equal(plan.value?.items[0]?.revision_ref?.revision_id, packet.header.revision_id);
  assert.equal(plan.value?.items[0]?.action, 'needs_verification_acknowledgement');
});

test('trusted exchange coordinator exports packet set through archive seam', async () => {
  const packet = createPacket('nexus:element/exchange-export');
  const packetStore = createMockStore([packet]);
  const result = await trustedExchangeCoordinator.exportPacketSet({
    packet_store: packetStore,
    root_refs: [{ packet_id: packet.header.packet_id }],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.packet_count, 1);
  assert.equal(result.value?.revision_count, 1);
  assert.equal(result.value?.manifest.bundle_byte_count, 3);
});

test('trusted exchange coordinator classifies duplicate revisions in merge plan', async () => {
  const packet = createPacket('nexus:element/exchange-duplicate', 'rev-duplicate');
  const packetStore = createMockStore([packet]);
  const result = await trustedExchangeCoordinator.planMerge({
    packet_store: packetStore,
    bundle: { packets: [packet] },
  });

  assert.equal(result.value?.packet_count, 1);
  assert.equal(result.value?.skip_duplicate_count, 1);
  assert.equal(result.value?.items[0]?.action, 'skip_duplicate');
});

test('trusted exchange coordinator previews rebundle without mutating storage', async () => {
  const packet = createPacket('nexus:element/exchange-rebundle');
  const result = await trustedExchangeCoordinator.previewRebundle({
    bundle: { packets: [packet] },
    purpose: 'test.rebundle',
  });

  assert.equal(result.value?.packet_count, 1);
  assert.equal(result.value?.normalized_bundle.purpose, 'test.rebundle');
  assert.equal(result.value?.manifest.readable_count, 1);
});

test('trusted exchange coordinator readiness audit is scaffold-visible', async () => {
  const packetStore = createMockStore();
  const result = await trustedExchangeCoordinator.auditReadiness({ packet_store: packetStore });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.ready, true);
  assert.equal(result.value?.compatibility_ready, true);
  assert.equal(result.value?.verification_ready, true);
  assert.equal(result.value?.archive_ready, true);
});
