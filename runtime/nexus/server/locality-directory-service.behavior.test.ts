import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createAssemblyPacket,
  createPacketEdge,
  createPacketRef,
} from '@core/packets/builders';
import { createScopedRelationPacket } from '@core/packets/relations';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  LocalityDuplicateWarningError,
  planCanonicalLocalityPathWithPacketStore,
} from '@runtime/nexus/server/locality-directory-service';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

async function writePreferredPacket(
  packetStore: NodeSQLitePacketStore,
  packet: PacketEnvelope
) {
  await packetStore.writeRevision(packet);
  await packetStore.publishRevision({
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  });
}

async function withTemporaryNexusPacketServices<TResult>(input: {
  seedPackets?: PacketEnvelope[];
  run: (services: { packetStore: NodeSQLitePacketStore }) => Promise<TResult>;
}): Promise<TResult> {
  const directory = mkdtempSync(join(tmpdir(), 'owa-locality-plan-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-locality-plan.db'),
  });

  try {
    for (const packet of input.seedPackets ?? []) {
      await writePreferredPacket(packetStore, packet);
    }

    return await input.run({
      packetStore,
    });
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function createExistingLocalityPacket(input: {
  packetId: string;
  createdAt: string;
  name: string;
  level: 'nation' | 'region' | 'city' | 'district';
  parentPacketId: string;
  aliasKeys?: string[];
}): PacketEnvelopeByType['Element'] {
  return createAssemblyPacket({
    packet_id: input.packetId,
    created_at: input.createdAt,
    authority_scope_ref: createPacketRef(input.packetId),
    applicable_scope_refs: [
      createPacketRef(input.packetId),
      createPacketRef(input.parentPacketId),
    ],
    edges: [createPacketEdge('parent_scope', input.parentPacketId)],
    name: input.name,
    subtype: input.level,
    locality_label: input.name,
    locality: {
      level: input.level,
      canonical_name_key: input.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      alias_keys: input.aliasKeys ?? [],
      display_aliases: [],
    },
    tags: ['assembly', 'locality', input.level],
    metadata_tags: ['assembly', 'locality', input.level],
  });
}

test('planCanonicalLocalityPath emits locality, ancestry, location, and location-definition packets together', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-08T00:00:00.000Z',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
    tags: ['assembly', 'global'],
    metadata_tags: ['assembly', 'global'],
  });

  await withTemporaryNexusPacketServices({
    seedPackets: [globalAssembly],
    run: async ({ packetStore }) => {
      const planned = await planCanonicalLocalityPathWithPacketStore({
        packetStore,
        actorPacketId: 'nexus:element/actor',
        path: [
          { level: 'nation', name: 'United States' },
          { level: 'region', name: 'California' },
          { level: 'city', name: 'Moreno Valley' },
          { level: 'district', name: 'Sunnymead Ranch' },
        ],
      });

      const elementPackets = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Element'] =>
          packet.header.family === 'Element'
      );
      const relationPackets = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Relation'] =>
          packet.header.family === 'Relation'
      );
      const locationPackets = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Location'] =>
          packet.header.family === 'Location'
      );

      assert.equal(elementPackets.length, 4);
      assert.equal(locationPackets.length, 4);
      assert.equal(relationPackets.length, 8);
      assert.equal(planned.created_relation_packet_ids.length, 8);
      assert.equal(planned.created_location_packet_ids.length, 4);
      assert.deepEqual(planned.duplicate_warnings, []);
      assert.equal(
        relationPackets.filter((packet) => packet.body.subtype === 'default_ancestry_parent')
          .length,
        4
      );
      assert.equal(
        relationPackets.filter((packet) => packet.body.subtype === 'defined_by_location')
          .length,
        4
      );
      assert.equal(
        locationPackets.every((packet) => packet.body.subtype === 'region'),
        true
      );
      assert.equal(
        elementPackets.every((packet) =>
          packet.header.edges.some((edge) => edge.edge_type === 'parent_scope')
        ),
        true
      );
      assert.equal(
        planned.final_result.scope_id,
        elementPackets[elementPackets.length - 1]?.header.packet_id
      );
    },
  });
});

test('planCanonicalLocalityPath reuses existing path segments and alias collisions without recreating them', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-08T01:00:00.000Z',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
    tags: ['assembly', 'global'],
    metadata_tags: ['assembly', 'global'],
  });
  const nation = createExistingLocalityPacket({
    packetId: 'nexus:element/united-states',
    createdAt: '2026-05-08T01:01:00.000Z',
    name: 'United States',
    level: 'nation',
    parentPacketId: globalAssembly.header.packet_id,
  });
  const region = createExistingLocalityPacket({
    packetId: 'nexus:element/california',
    createdAt: '2026-05-08T01:02:00.000Z',
    name: 'California',
    level: 'region',
    parentPacketId: nation.header.packet_id,
    aliasKeys: ['ca'],
  });
  const nationParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: nation.header.packet_id,
    targetPacketId: globalAssembly.header.packet_id,
    scopePacketId: nation.header.packet_id,
    applicableScopeRefs: nation.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });
  const regionParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: region.header.packet_id,
    targetPacketId: nation.header.packet_id,
    scopePacketId: region.header.packet_id,
    applicableScopeRefs: region.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });

  await withTemporaryNexusPacketServices({
    seedPackets: [globalAssembly, nation, region, nationParent, regionParent],
    run: async ({ packetStore }) => {
      const planned = await planCanonicalLocalityPathWithPacketStore({
        packetStore,
        actorPacketId: 'nexus:element/actor',
        path: [
          { level: 'nation', name: '', existing_scope_id: nation.header.packet_id },
          { level: 'region', name: 'CA' },
          { level: 'city', name: 'Moreno Valley' },
          { level: 'district', name: 'Sunnymead Ranch' },
        ],
      });
      const elementPackets = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Element'] =>
          packet.header.family === 'Element'
      );

      assert.equal(elementPackets.length, 2);
      assert.equal(planned.created_location_packet_ids.length, 2);
      assert.equal(planned.created_relation_packet_ids.length, 4);
      assert.equal(planned.duplicate_warnings.length, 1);
      assert.equal(planned.duplicate_warnings[0]?.existing_scope_id, region.header.packet_id);
    },
  });
});

test('planCanonicalLocalityPath surfaces fuzzy duplicate warnings and still continues when createAnyway is enabled', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-08T02:00:00.000Z',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
    tags: ['assembly', 'global'],
    metadata_tags: ['assembly', 'global'],
  });
  const nation = createExistingLocalityPacket({
    packetId: 'nexus:element/united-states',
    createdAt: '2026-05-08T02:01:00.000Z',
    name: 'United States',
    level: 'nation',
    parentPacketId: globalAssembly.header.packet_id,
  });
  const region = createExistingLocalityPacket({
    packetId: 'nexus:element/california',
    createdAt: '2026-05-08T02:02:00.000Z',
    name: 'California',
    level: 'region',
    parentPacketId: nation.header.packet_id,
  });
  const city = createExistingLocalityPacket({
    packetId: 'nexus:element/moreno-valley',
    createdAt: '2026-05-08T02:03:00.000Z',
    name: 'Moreno Valley',
    level: 'city',
    parentPacketId: region.header.packet_id,
  });
  const nationParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: nation.header.packet_id,
    targetPacketId: globalAssembly.header.packet_id,
    scopePacketId: nation.header.packet_id,
    applicableScopeRefs: nation.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });
  const regionParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: region.header.packet_id,
    targetPacketId: nation.header.packet_id,
    scopePacketId: region.header.packet_id,
    applicableScopeRefs: region.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });
  const cityParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: city.header.packet_id,
    targetPacketId: region.header.packet_id,
    scopePacketId: city.header.packet_id,
    applicableScopeRefs: city.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });

  await withTemporaryNexusPacketServices({
    seedPackets: [
      globalAssembly,
      nation,
      region,
      city,
      nationParent,
      regionParent,
      cityParent,
    ],
    run: async ({ packetStore }) => {
      await assert.rejects(
        () =>
          planCanonicalLocalityPathWithPacketStore({
            packetStore,
            actorPacketId: 'nexus:element/actor',
            path: [
              { level: 'nation', name: '', existing_scope_id: nation.header.packet_id },
              { level: 'region', name: '', existing_scope_id: region.header.packet_id },
              { level: 'city', name: 'Moreno Velley' },
              { level: 'district', name: 'Sunnymead Ranch' },
            ],
          }),
        (error: unknown) => {
          assert.ok(error instanceof LocalityDuplicateWarningError);
          assert.equal(error.duplicateWarnings[0]?.existing_scope_id, city.header.packet_id);
          return true;
        }
      );

      const planned = await planCanonicalLocalityPathWithPacketStore({
        packetStore,
        actorPacketId: 'nexus:element/actor',
        path: [
          { level: 'nation', name: '', existing_scope_id: nation.header.packet_id },
          { level: 'region', name: '', existing_scope_id: region.header.packet_id },
          { level: 'city', name: 'Moreno Velley' },
          { level: 'district', name: 'Sunnymead Ranch' },
        ],
        createAnyway: true,
      });
      const elementPackets = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Element'] =>
          packet.header.family === 'Element'
      );

      assert.equal(planned.duplicate_warnings.length > 0, true);
      assert.equal(planned.duplicate_warnings[0]?.existing_scope_id, city.header.packet_id);
      assert.equal(elementPackets.length, 2);
      assert.equal(planned.created_location_packet_ids.length, 2);
      assert.equal(planned.created_relation_packet_ids.length, 4);
    },
  });
});
