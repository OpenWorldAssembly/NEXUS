import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssemblyPacket } from '@core/packets/builders';
import { storeTrustedCertifiedPacketSet } from './trusted_archive_coordinator/functions/store_certified_packet_set.ts';

function createPacket(packetId: string) {
  return createAssemblyPacket({
    packet_id: packetId,
    created_at: '2026-05-27T00:00:00.000Z',
    name: packetId,
    subtype: 'assembly',
    locality_label: packetId,
  });
}

function createCandidateNode(packet: ReturnType<typeof createPacket>) {
  return {
    candidate_id: packet.header.packet_id,
    candidate_kind: 'trusted.packet_candidate_node' as const,
    source_plan_id: 'plan:test',
    packet_type: packet.header.type,
    packet_subtype: null,
    builder_id: null,
    body_candidate: {
      candidate_kind: 'trusted.generic_body_candidate' as const,
      builder_id: null,
      packet_type: packet.header.type,
      packet_subtype: null,
      schema_version: packet.header.schema_version,
      storage_class: null,
      revision_behavior: null,
      body: {
        packet_envelope: packet,
      },
      source_plan_id: 'plan:test',
      materialization_status: 'candidate' as const,
      notes: [],
    },
    parent_candidate_id: null,
    child_candidate_ids: [],
    blockers: [],
    warnings: [],
    issues: [],
    trace: [],
  };
}

test('trusted archive records partial write progress without claiming rollback', async () => {
  const first = createPacket('nexus:element/archive-first');
  const second = createPacket('nexus:element/archive-second');
  const written: string[] = [];
  const packetStore = {
    async writeRevision(packet: ReturnType<typeof createPacket>) {
      if (packet.header.packet_id === second.header.packet_id) {
        throw new Error('simulated write failure');
      }
      written.push(packet.header.packet_id);
      return {
        packet_id: packet.header.packet_id,
        revision_id: packet.header.revision_id,
      };
    },
    async publishRevision() {},
  };

  const result = await storeTrustedCertifiedPacketSet({
    packet_store: packetStore as never,
    certified_packet_set: {
      certified_kind: 'trusted.certified_packet_set',
      certification_id: 'cert:test',
      ticket_id: 'ticket:test',
      certified_at: '2026-05-27T00:00:00.000Z',
      signer_ref: 'signer:test',
      source_plan_id: 'plan:test',
      hashes: {
        hash_kind: 'trusted.certification_hash_bundle',
        plan_hash: 'plan',
        build_result_hash: 'build',
        inspection_report_hash: 'inspection',
        candidate_graph_hash: 'graph',
        payload_hash: 'payload',
      },
      certified_packet_keys: [`${first.header.packet_id}:${first.header.revision_id}`, `${second.header.packet_id}:${second.header.revision_id}`],
      candidate_graph: {
        graph_kind: 'trusted.packet_candidate_graph',
        source_plan_id: 'plan:test',
        root_candidate_id: first.header.packet_id,
        candidate_nodes: [createCandidateNode(first), createCandidateNode(second)],
        body_candidate_count: 2,
        blocked_candidate_count: 0,
        warnings: [],
        blockers: [],
      },
      archive_ready: true,
      blockers: [],
      warnings: [],
      issues: [],
      trace: [],
    },
  });

  assert.equal(result.status, 'error');
  assert.deepEqual(written, [first.header.packet_id]);
  assert.equal(result.value?.written_packet_count, 1);
  assert.equal(
    result.process_chain?.stages.some((stage) =>
      stage.completed_work.length === 1 && stage.failed_work.length === 1
    ),
    true
  );
});
