import test from 'node:test';
import assert from 'node:assert/strict';

import type { PacketSearchIndexRecord } from './sqlite-records.ts';
import { PacketStoreNexusQueryService } from './query-services.ts';

const SEARCH_ROWS: PacketSearchIndexRecord[] = [
  {
    packet_id: 'nexus:packet/local-a',
    revision_id: 'nexus:packet/local-a@r1',
    family: 'Proposal',
    label: 'Local proposal',
    title: 'Local proposal',
    summary: null,
    status: 'open',
    authority_scope_packet_id: 'nexus:element/moreno-valley',
    applicable_scope_ids_json: JSON.stringify([
      'nexus:element/moreno-valley',
      'nexus:element/global-commons',
    ]),
    tags_json: '[]',
    created_at: '2026-04-17T00:00:00.000Z',
  },
  {
    packet_id: 'nexus:packet/child-b',
    revision_id: 'nexus:packet/child-b@r1',
    family: 'Proposal',
    label: 'Child proposal',
    title: 'Child proposal',
    summary: null,
    status: 'open',
    authority_scope_packet_id: 'nexus:element/sunnymead-ranch',
    applicable_scope_ids_json: JSON.stringify([
      'nexus:element/sunnymead-ranch',
      'nexus:element/moreno-valley',
      'nexus:element/global-commons',
    ]),
    tags_json: '[]',
    created_at: '2026-04-17T01:00:00.000Z',
  },
];

test('library local scope mode returns only packets native to the active authority scope', async () => {
  const service = new PacketStoreNexusQueryService({
    async listSearchRows() {
      return SEARCH_ROWS;
    },
  });

  const lens = {
    authority_scope_ref: {
      packet_id: 'nexus:element/moreno-valley',
    },
    applicable_scope_refs: [
      {
        packet_id: 'nexus:element/moreno-valley',
      },
      {
        packet_id: 'nexus:element/global-commons',
      },
    ],
  };

  const localPackets = await service.listLibraryPackets(lens, undefined, {
    scope_mode: 'local',
  });
  const inheritedPackets = await service.listLibraryPackets(lens);

  assert.deepEqual(
    localPackets.map((packet) => packet.packet.packet_id),
    ['nexus:packet/local-a']
  );
  assert.deepEqual(
    inheritedPackets.map((packet) => packet.packet.packet_id),
    ['nexus:packet/child-b', 'nexus:packet/local-a']
  );
});
