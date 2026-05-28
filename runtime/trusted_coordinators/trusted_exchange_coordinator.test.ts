/**
 * File: trusted_exchange_coordinator.test.ts
 * Description: Smoke tests for the gated Trusted Exchange Coordinator public surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssemblyPacket } from '@core/packets/builders';
import type { PacketStore } from '@core/contracts';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketMergeStrategy,
  PacketRef,
  PacketRevisionRef,
  PacketType,
  PacketVersionedWritePreparation,
} from '@core/schema/packet-schema';
import { trustedExchangeCoordinator } from '@runtime/trusted_coordinators/trusted_exchange_coordinator/index.ts';

function createPacket(packetId: string, revisionId?: string): PacketEnvelope {
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
    } satisfies PacketEnvelope;
  }

  return packet;
}

function createMockStore(packets: PacketEnvelope[] = []): PacketStore {
  const packetMap = new Map<string, PacketEnvelope>();
  const revisionMap = new Map<string, PacketEnvelope>();

  for (const packet of packets) {
    packetMap.set(packet.header.packet_id, packet);
    revisionMap.set(packet.header.revision_id, packet);
  }

  return {
    validate(input: unknown) {
      return input as PacketEnvelope;
    },
    async writeRevision(packet: PacketEnvelope) {
      packetMap.set(packet.header.packet_id, packet);
      revisionMap.set(packet.header.revision_id, packet);
      return {
        packet_id: packet.header.packet_id,
        revision_id: packet.header.revision_id,
      };
    },
    async publishRevision() {},
    async fetchByPacket(packetRef: PacketRef) {
      return packetMap.get(packetRef.packet_id) ?? null;
    },
    async fetchByRevision(revisionRef: PacketRevisionRef) {
      return revisionMap.get(revisionRef.revision_id) ?? null;
    },
    async resolveRevisionRef(revisionId: string) {
      const packet = revisionMap.get(revisionId);
      return packet
        ? { packet_id: packet.header.packet_id, revision_id: packet.header.revision_id }
        : null;
    },
    async fetchPreferredRevision(packetRef: PacketRef) {
      const packet = packetMap.get(packetRef.packet_id);
      return packet
        ? { packet_id: packet.header.packet_id, revision_id: packet.header.revision_id }
        : null;
    },
    async fetchRevisionHeads(packetRef: PacketRef) {
      const packet = packetMap.get(packetRef.packet_id);
      const preferred = packet
        ? { packet_id: packet.header.packet_id, revision_id: packet.header.revision_id }
        : null;
      return {
        preferred_revision: preferred,
        head_revisions: preferred ? [preferred] : [],
        revision_state: 'linear' as const,
      };
    },
    async queryEdges() {
      return [];
    },
    async mergeRevisions(input: {
      packet: PacketRef;
      parent_revisions: PacketRevisionRef[];
      strategy: PacketMergeStrategy;
      merged_packet: PacketEnvelope;
    }) {
      return this.writeRevision(input.merged_packet);
    },
    readByPacket: (async (packetRef: PacketRef) => {
      return packetMap.get(packetRef.packet_id) ?? null;
    }) as PacketStore['readByPacket'],
    readByRevision: (async (revisionRef: PacketRevisionRef) => {
      return revisionMap.get(revisionRef.revision_id) ?? null;
    }) as PacketStore['readByRevision'],
    async prepareRevisionForAdaptedSave() {
      return null;
    },
    async prepareRevisionForVersionedSave() {
      return null;
    },
    async writePreparedRevision(preparation: PacketVersionedWritePreparation) {
      return this.writeRevision(preparation.prepared_packet ?? preparation.adapted_packet);
    },
    async importBundle() {
      return { packet_count: 0, revision_count: 0, edge_count: 0 };
    },
    async exportBundle(packetRefs: PacketRef[]) {
      const packets = packetRefs
        .map((packetRef) => packetMap.get(packetRef.packet_id))
        .filter((packet): packet is PacketEnvelope => Boolean(packet));
      return {
        bytes: new Uint8Array([1, 2, 3]),
        packet_count: packets.length,
        revision_count: packets.length,
      };
    },
    async listPreferredPacketsByType<TType extends PacketType>(type: TType) {
      return Array.from(packetMap.values()).filter((packet) =>
        packet.header.type === type
      ) as PacketEnvelopeByType[TType][];
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
  assert.equal(plan.process_chain?.operation_name, 'plan_import_commit');
  assert.equal(
    plan.process_chain?.stages.some((stage) => stage.stage_id === 'exchange.import.plan_commit'),
    true
  );
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
  assert.equal(result.process_chain?.operation_name, 'export_packet_set');
  assert.equal(
    result.process_chain?.child_chains.some((chain) => chain.coordinator_kind === 'archive'),
    true
  );
});

test('trusted exchange coordinator blocked import commit records blocked downstream work', async () => {
  const result = await trustedExchangeCoordinator.commitImport({
    preview: {
      result_kind: 'trusted.exchange_import_preview',
      source_label: null,
      source_shape: 'packets_object',
      packet_count: 1,
      readable_count: 0,
      verified_count: 0,
      new_packet_count: 0,
      new_revision_count: 0,
      duplicate_revision_count: 0,
      conflict_count: 0,
      blocked_count: 1,
      warnings: [],
      blockers: ['Blocked test preview.'],
      packet_previews: [{
        entry_index: 0,
        entry_id: 'entry:blocked',
        packet_ref: { packet_id: 'nexus:element/exchange-commit-blocked' },
        revision_ref: null,
        packet_type: 'Element',
        declared_schema_version: null,
        readable: false,
        verified: false,
        local_status: 'not_checked',
        recommended_action: 'block_invalid',
        warnings: [],
        blockers: ['Blocked test preview.'],
      }],
      verification_report: null,
      compatibility_report: [],
    },
    bundle: new Uint8Array(),
  });

  assert.equal(result.status, 'error');
  assert.equal(result.process_chain?.operation_name, 'commit_import');
  assert.equal(
    result.process_chain?.stages.some((stage) =>
      stage.blocked_work.some((work) => work.reason_code === 'exchange.import_commit_blocked')
    ),
    true
  );
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
