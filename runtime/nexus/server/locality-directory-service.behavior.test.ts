import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createAssemblyPacket,
  createLocationPacket,
  createPacketEdge,
  createPacketRef,
} from '@core/packets/builders';
import { createScopedRelationPacket } from '@core/packets/relations';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import { createLocalityCanonicalNameKey } from '@runtime/nexus/location-search-normalization';
import {
  buildLocalityPathPreviewResult,
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
      canonical_name_key: createLocalityCanonicalNameKey(input.name),
      alias_keys: input.aliasKeys ?? [],
      display_aliases: [],
    },
    tags: ['assembly', 'locality', input.level],
    metadata_tags: ['assembly', 'locality', input.level],
  });
}

function createExistingLocalityDefinition(input: {
  scopePacketId: string;
  createdAt: string;
  name: string;
  level: 'nation' | 'region' | 'city' | 'district';
  hierarchySystem?: 'administrative' | 'electoral' | 'postal' | 'addressing' | 'building' | 'custom' | 'planetary';
  localTypeLabel?: string;
  localTypeKey?: string;
}): {
  locationPacket: PacketEnvelopeByType['Location'];
  locationRelationPacket: PacketEnvelopeByType['Relation'];
} {
  const locationPacketId = `nexus:location/region/${encodeURIComponent(input.scopePacketId)}`;
  const canonicalNameKey = createLocalityCanonicalNameKey(input.name);

  const locationPacket = createLocationPacket({
    packet_id: locationPacketId,
    created_at: input.createdAt,
    authority_scope_ref: createPacketRef(input.scopePacketId),
    applicable_scope_refs: [createPacketRef(input.scopePacketId)],
    subtype: 'region',
    title: input.name,
    summary: `Portable region definition for ${input.name}.`,
    status: 'provisional',
    location_label: input.name,
    spatial_payload: {
      display_name: input.name,
      canonical_name_key: canonicalNameKey,
      alias_keys: [canonicalNameKey],
      locality_level: input.level,
      scope_descriptor: {
        hierarchy_system: input.hierarchySystem ?? 'administrative',
        local_type_label: input.localTypeLabel ?? 'City / Town / Village',
        local_type_key: input.localTypeKey ?? input.level,
        legacy_level: input.level,
      },
      source: {
        kind: 'manual',
      },
    },
  });
  const locationRelationPacket = createScopedRelationPacket({
    subtype: 'defined_by_location',
    subjectPacketId: input.scopePacketId,
    targetPacketId: locationPacketId,
    scopePacketId: input.scopePacketId,
    applicableScopeRefs: [createPacketRef(input.scopePacketId)],
    createdByPacketId: 'nexus:element/actor',
  });

  return {
    locationPacket,
    locationRelationPacket,
  };
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
        elementPackets.every((packet) =>
          packet.header.edges.some((edge) => edge.edge_type === 'parent_scope')
        ),
        true
      );
      assert.equal(
        locationPackets.every(
          (packet) =>
            packet.body.spatial_payload.display_name === packet.body.location_label &&
            packet.body.spatial_payload.source?.kind === 'manual' &&
            packet.body.spatial_payload.scope_descriptor?.legacy_level ===
              packet.body.spatial_payload.locality_level
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
      assert.equal(planned.duplicate_warnings[0]?.existing_result.scope_id, region.header.packet_id);
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
      assert.equal(planned.duplicate_warnings[0]?.existing_result.scope_id, city.header.packet_id);
      assert.equal(elementPackets.length, 2);
      assert.equal(planned.created_location_packet_ids.length, 2);
      assert.equal(planned.created_relation_packet_ids.length, 4);
    },
  });
});

test('locality preview stays non-mutating and returns review entries plus suggested home scopes', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-12T00:00:00.000Z',
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
        path: [
          { level: 'nation', name: 'United States' },
          { level: 'region', name: 'California' },
          { level: 'city', name: 'Moreno Valley' },
        ],
        allowDuplicateWarnings: true,
      });
      const preview = buildLocalityPathPreviewResult(planned);
      const storedElements =
        (await packetStore.listPreferredPacketsByFamily('Element')) as PacketEnvelopeByType['Element'][];

      assert.equal(storedElements.length, 1);
      assert.equal(preview.review_entries.length, 3);
      assert.deepEqual(
        preview.review_entries.map((entry) => entry.disposition),
        ['create_new', 'create_new', 'create_new']
      );
      assert.deepEqual(
        preview.review_entries.map((entry) => entry.scope_descriptor?.legacy_level),
        ['nation', 'region', 'city']
      );
      assert.deepEqual(
        preview.suggested_home_scope_entries.map((entry) => entry.name),
        ['United States', 'California', 'Moreno Valley']
      );
      assert.deepEqual(
        preview.suggested_home_scope_entries.map((entry) => entry.path_label),
        [
          'United States',
          'United States / California',
          'United States / California / Moreno Valley',
        ]
      );
      assert.equal(
        preview.suggested_home_scope_entries.every((entry) => entry.checked_by_default),
        true
      );
      assert.equal(preview.final_result.name, 'Moreno Valley');
    },
  });
});

test('planCanonicalLocalityPath supports sparse broad-to-narrow paths without requiring every legacy level', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-13T00:00:00.000Z',
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
          { level: 'nation', name: 'Canada' },
          { level: 'city', name: 'Vancouver' },
        ],
      });
      const createdElements = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Element'] =>
          packet.header.family === 'Element'
      );
      const ancestryRelations = planned.created_packets.filter(
        (packet): packet is PacketEnvelopeByType['Relation'] =>
          packet.header.family === 'Relation' &&
          packet.body.subtype === 'default_ancestry_parent'
      );
      const vancouverPacket = createdElements.find(
        (packet) => packet.body.name === 'Vancouver'
      );
      const canadaPacket = createdElements.find((packet) => packet.body.name === 'Canada');
      const vancouverParentRelation = ancestryRelations.find(
        (packet) => packet.body.subject_ref.packet_id === vancouverPacket?.header.packet_id
      );

      assert.equal(createdElements.length, 2);
      assert.ok(canadaPacket);
      assert.ok(vancouverPacket);
      assert.equal(vancouverParentRelation?.body.target_ref.packet_id, canadaPacket.header.packet_id);
      assert.deepEqual(
        planned.resolved_path.map((entry) => entry.level),
        ['nation', 'city']
      );
    },
  });
});

test('planCanonicalLocalityPath tolerates existing scopes with missing parent relations when the chosen path is otherwise compatible', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-13T01:00:00.000Z',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
    tags: ['assembly', 'global'],
    metadata_tags: ['assembly', 'global'],
  });
  const orphanCity = createAssemblyPacket({
    packet_id: 'nexus:element/vancouver',
    created_at: '2026-05-13T01:01:00.000Z',
    authority_scope_ref: createPacketRef('nexus:element/vancouver'),
    applicable_scope_refs: [createPacketRef('nexus:element/vancouver')],
    name: 'Vancouver',
    subtype: 'city',
    locality_label: 'Vancouver',
    locality: {
      level: 'city',
      canonical_name_key: createLocalityCanonicalNameKey('Vancouver'),
      alias_keys: [],
      display_aliases: [],
    },
    tags: ['assembly', 'locality', 'city'],
    metadata_tags: ['assembly', 'locality', 'city'],
  });

  await withTemporaryNexusPacketServices({
    seedPackets: [globalAssembly, orphanCity],
    run: async ({ packetStore }) => {
      const planned = await planCanonicalLocalityPathWithPacketStore({
        packetStore,
        actorPacketId: 'nexus:element/actor',
        path: [
          { level: 'nation', name: 'Canada' },
          { level: 'city', name: '', existing_scope_id: orphanCity.header.packet_id },
        ],
      });

      assert.equal(planned.final_result.name, 'Vancouver');
      assert.deepEqual(
        planned.resolved_path.map((entry) => entry.disposition),
        ['create_new', 'reuse_existing']
      );
    },
  });
});

test('planCanonicalLocalityPath stores descriptor metadata and Unicode-safe aliases for newly created localities', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-13T02:00:00.000Z',
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
          {
            level: 'city',
            name: 'São Paulo',
            scope_descriptor: {
              hierarchy_system: 'administrative',
              local_type_label: 'City / Town / Village',
              local_type_key: 'city-town',
              legacy_level: 'city',
            },
          },
        ],
      });
      const createdElement = planned.created_packets.find(
        (packet): packet is PacketEnvelopeByType['Element'] =>
          packet.header.family === 'Element'
      );
      const createdLocation = planned.created_packets.find(
        (packet): packet is PacketEnvelopeByType['Location'] =>
          packet.header.family === 'Location'
      );

      assert.ok(createdElement);
      assert.ok(createdLocation);
      assert.equal(createdElement.body.scope_system, 'administrative');
      assert.equal(
        createdLocation.body.spatial_payload.canonical_name_key,
        'sao paulo'
      );
      assert.deepEqual(createdLocation.body.spatial_payload.scope_descriptor, {
        hierarchy_system: 'administrative',
        local_type_label: 'City / Town / Village',
        local_type_key: 'city-town',
        legacy_level: 'city',
      });
      assert.equal(createdLocation.body.spatial_payload.source?.kind, 'manual');
      assert.ok(createdLocation.body.spatial_payload.alias_keys.includes('sao paulo'));
    },
  });
});

test('preview and create surface descriptor-aware reuse metadata from linked Location packets when available', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-13T03:00:00.000Z',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
    tags: ['assembly', 'global'],
    metadata_tags: ['assembly', 'global'],
  });
  const canada = createExistingLocalityPacket({
    packetId: 'nexus:element/canada',
    createdAt: '2026-05-13T03:01:00.000Z',
    name: 'Canada',
    level: 'nation',
    parentPacketId: globalAssembly.header.packet_id,
  });
  const canadaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: canada.header.packet_id,
    targetPacketId: globalAssembly.header.packet_id,
    scopePacketId: canada.header.packet_id,
    applicableScopeRefs: canada.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });
  const canadaDefinition = createExistingLocalityDefinition({
    scopePacketId: canada.header.packet_id,
    createdAt: '2026-05-13T03:02:00.000Z',
    name: 'Canada',
    level: 'nation',
    localTypeLabel: 'Nation / Country',
    localTypeKey: 'nation',
  });

  await withTemporaryNexusPacketServices({
    seedPackets: [
      globalAssembly,
      canada,
      canadaParent,
      canadaDefinition.locationPacket,
      canadaDefinition.locationRelationPacket,
    ],
    run: async ({ packetStore }) => {
      const planned = await planCanonicalLocalityPathWithPacketStore({
        packetStore,
        actorPacketId: 'nexus:element/actor',
        path: [
          { level: 'nation', name: '', existing_scope_id: canada.header.packet_id },
          { level: 'city', name: 'Vancouver' },
        ],
      });
      const preview = buildLocalityPathPreviewResult(planned);

      assert.equal(
        preview.review_entries[0]?.scope_descriptor?.local_type_label,
        'Nation / Country'
      );
      assert.equal(
        planned.resolved_path[0]?.existing_result?.scope_type_label,
        'Nation / Country'
      );
      assert.equal(
        planned.resolved_path[0]?.existing_result?.manual_status,
        'manual'
      );
    },
  });
});

test('planCanonicalLocalityPath rejects decreasing legacy compatibility bucket order', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-13T04:00:00.000Z',
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
      await assert.rejects(
        () =>
          planCanonicalLocalityPathWithPacketStore({
            packetStore,
            actorPacketId: 'nexus:element/actor',
            path: [
              { level: 'city', name: 'Vancouver' },
              { level: 'nation', name: 'Canada' },
            ],
          }),
        /broad-to-narrow/
      );
    },
  });
});

test('planCanonicalLocalityPath does not auto-reuse same-name localities from a different parent branch', async () => {
  const globalAssembly = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-13T04:30:00.000Z',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
    tags: ['assembly', 'global'],
    metadata_tags: ['assembly', 'global'],
  });
  const unitedStates = createExistingLocalityPacket({
    packetId: 'nexus:element/united-states',
    createdAt: '2026-05-13T04:31:00.000Z',
    name: 'United States',
    level: 'nation',
    parentPacketId: globalAssembly.header.packet_id,
  });
  const california = createExistingLocalityPacket({
    packetId: 'nexus:element/california',
    createdAt: '2026-05-13T04:32:00.000Z',
    name: 'California',
    level: 'region',
    parentPacketId: unitedStates.header.packet_id,
  });
  const ontarioCalifornia = createExistingLocalityPacket({
    packetId: 'nexus:element/ontario-california',
    createdAt: '2026-05-13T04:33:00.000Z',
    name: 'Ontario',
    level: 'city',
    parentPacketId: california.header.packet_id,
  });
  const unitedStatesParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: unitedStates.header.packet_id,
    targetPacketId: globalAssembly.header.packet_id,
    scopePacketId: unitedStates.header.packet_id,
    applicableScopeRefs: unitedStates.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });
  const californiaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: california.header.packet_id,
    targetPacketId: unitedStates.header.packet_id,
    scopePacketId: california.header.packet_id,
    applicableScopeRefs: california.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });
  const ontarioCaliforniaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: ontarioCalifornia.header.packet_id,
    targetPacketId: california.header.packet_id,
    scopePacketId: ontarioCalifornia.header.packet_id,
    applicableScopeRefs: ontarioCalifornia.header.applicable_scope_refs,
    createdByPacketId: 'nexus:element/actor',
  });

  await withTemporaryNexusPacketServices({
    seedPackets: [
      globalAssembly,
      unitedStates,
      california,
      ontarioCalifornia,
      unitedStatesParent,
      californiaParent,
      ontarioCaliforniaParent,
    ],
    run: async ({ packetStore }) => {
      const planned = await planCanonicalLocalityPathWithPacketStore({
        packetStore,
        actorPacketId: 'nexus:element/actor',
        path: [
          { level: 'nation', name: 'Canada' },
          { level: 'city', name: 'Ontario' },
        ],
      });

      assert.equal(planned.final_result.name, 'Ontario');
      assert.notEqual(planned.final_result.scope_id, ontarioCalifornia.header.packet_id);
      assert.deepEqual(
        planned.resolved_path.map((entry) => entry.disposition),
        ['create_new', 'create_new']
      );
    },
  });
});
