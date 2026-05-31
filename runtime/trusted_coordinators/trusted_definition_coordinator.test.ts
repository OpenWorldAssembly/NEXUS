/**
 * File: trusted_definition_coordinator.test.ts
 * Description: Smoke tests for the gated Trusted Definition Coordinator public surface.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import { resolveSeededPacketDefinitionProfile } from '@core/packets/packet-definition-seeds.ts';

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

test('trusted definition coordinator can prefer seeded definitions from packet-backed profile preferences', () => {
  const packetBackedPreferenceCarrier = {
    header: {
      packet_id: 'nexus:test/definition-profile-preferences',
      revision_id: 'nexus:test/definition-profile-preferences@r-001',
      type: 'Bundle',
      schema_version: '0.1.0',
      created_at: '2026-05-30T00:00:00.000Z',
      adapter: 'test',
      metadata_tags: ['definition-profile-preferences'],
      metadata_summary: 'Definition profile preference carrier.',
      edges: [],
      body_hash: null,
      signature: null,
    },
    body: {
      subtype: 'packet_set',
      title: 'Definition profile preference test carrier',
      summary: 'Packet-backed definition profile preference descriptors.',
      status: 'active',
      bundle_version: '0.1.0',
      purpose: 'Carries node/scope trusted definition source preferences.',
      root_refs: [],
      items: [],
      manifest_digest: null,
      bundle_data: {
        definition_profile_preferences: [
          {
            preference_id: 'test.packet_backed.prefer.seeded.definition.bundle',
            target_node_element_id: 'node:test',
            source_id: 'nexus:definition-profile/pre-reseed-active-manifest',
            packet_type: 'Preference',
            packet_subtype: null,
            part_subtype: 'packet_type_definition',
            trust_mode: 'prefer',
            priority: 1000,
            notes: 'Packet-backed smoke-test preference for the seeded definition bundle source.',
          },
        ],
      },
    },
  } as const;

  const result = trustedDefinitionCoordinator.resolveContext({
    node_element_id: 'node:test',
    packet_type_filters: ['Preference'],
    definition_profile_preference_packets: [packetBackedPreferenceCarrier],
  });

  assert.notEqual(result.status, 'error');
  assert.equal(
    result.value?.preferences_used.some((preference) =>
      preference.preference_id.startsWith('test.packet_backed.prefer.seeded.definition.bundle')
    ),
    true
  );

  const activeDefinitionCandidate = result.value?.active_candidates.find(
    (candidate) =>
      candidate.defines_packet_type === 'Preference' &&
      candidate.part_subtype === 'packet_type_definition'
  );

  assert.equal(activeDefinitionCandidate?.source.source_kind, 'seeded_bundle');
});

test('trusted definition coordinator can discover archived definition profile preference carriers through Trusted Archive', async () => {
  const archivedPreferenceCarrier = {
    header: {
      packet_id: 'nexus:test/archived-definition-profile-preferences',
      revision_id: 'nexus:test/archived-definition-profile-preferences@r-001',
      type: 'Bundle',
      schema_version: '0.1.0',
      created_at: '2026-05-30T00:00:00.000Z',
      adapter: 'test',
      metadata_tags: ['definition-profile-preferences'],
      metadata_summary: 'Archived definition profile preference carrier.',
      edges: [],
      body_hash: null,
      signature: null,
    },
    body: {
      subtype: 'packet_set',
      title: 'Archived definition profile preference carrier',
      summary: 'Packet-backed definition profile preference descriptors loaded through Trusted Archive.',
      status: 'active',
      bundle_version: '0.1.0',
      purpose: 'Carries node/scope trusted definition source preferences.',
      root_refs: [],
      items: [],
      manifest_digest: null,
      bundle_data: {
        definition_profile_preferences: [
          {
            preference_id: 'test.archived.prefer.seeded.definition.bundle',
            target_node_element_id: 'node:archive-test',
            source_id: 'nexus:definition-profile/pre-reseed-active-manifest',
            packet_type: 'Preference',
            packet_subtype: null,
            part_subtype: 'packet_type_definition',
            trust_mode: 'prefer',
            priority: 1000,
            notes: 'Archived smoke-test preference for the seeded definition bundle source.',
          },
        ],
      },
    },
  } as const;

  const packetStore = {
    listSearchRows: async () => [
      {
        packet_id: archivedPreferenceCarrier.header.packet_id,
        revision_id: archivedPreferenceCarrier.header.revision_id,
        type: 'Bundle',
        label: 'Bundle',
        title: 'Archived definition profile preference carrier',
        summary: 'Archived definition profile preference carrier.',
        status: 'active',
        authority_scope_packet_id: null,
        applicable_scope_ids_json: '[]',
        tags_json: '["definition-profile-preferences"]',
        created_at: archivedPreferenceCarrier.header.created_at,
      },
    ],
    readByPacket: async () => archivedPreferenceCarrier,
    readByRevision: async () => archivedPreferenceCarrier,
  } as any;

  const result = await trustedDefinitionCoordinator.resolveContextWithArchiveProfilePreferences({
    node_element_id: 'node:archive-test',
    packet_type_filters: ['Preference'],
    packet_store: packetStore,
  });

  assert.notEqual(result.status, 'error');
  assert.equal(
    result.value?.preferences_used.some((preference) =>
      preference.preference_id.startsWith('test.archived.prefer.seeded.definition.bundle')
    ),
    true
  );

  const activeDefinitionCandidate = result.value?.active_candidates.find(
    (candidate) =>
      candidate.defines_packet_type === 'Preference' &&
      candidate.part_subtype === 'packet_type_definition'
  );

  assert.equal(activeDefinitionCandidate?.source.source_kind, 'seeded_bundle');
});


test('trusted definition coordinator can load pinned stored definition bundle candidates through Trusted Archive', async () => {
  const profile = resolveSeededPacketDefinitionProfile();
  const packetsById = new Map<string, any>([
    [profile.bundle_packet.packet_ref.packet_id, profile.bundle_packet.packet],
    ...profile.definition_packets.map((candidate) => [
      candidate.packet_ref.packet_id,
      candidate.packet,
    ] as const),
  ]);

  const packetStore = {
    fetchPreferredRevision: async (packetRef: { packet_id: string }) => {
      const packet = packetsById.get(packetRef.packet_id);
      return packet
        ? {
            packet_id: packet.header.packet_id,
            revision_id: packet.header.revision_id,
          }
        : null;
    },
    readByPacket: async (packetRef: { packet_id: string }) => packetsById.get(packetRef.packet_id) ?? null,
    readByRevision: async (revisionRef: { packet_id: string }) => packetsById.get(revisionRef.packet_id) ?? null,
    listSearchRows: async () => [],
  } as any;

  const result = await trustedDefinitionCoordinator.resolveContextWithArchiveProfilePreferences({
    node_element_id: 'node:stored-profile-test',
    packet_type_filters: ['Preference'],
    packet_store: packetStore,
    preferences: [
      {
        preference_id: 'test.pin.stored.definition.bundle',
        node_element_id: 'node:stored-profile-test',
        source_id: profile.bundle_packet.packet_ref.packet_id,
        packet_type: 'Preference',
        packet_subtype: null,
        part_subtype: 'packet_type_definition',
        trust_mode: 'pin',
        priority: 2000,
        notes: 'Pinned stored definition profile bundle should win over bootstrap fallback.',
      },
    ],
  });

  assert.notEqual(result.status, 'error');
  assert.equal(
    result.value?.active_candidates.some(
      (candidate) =>
        candidate.defines_packet_type === 'Preference' &&
        candidate.part_subtype === 'packet_type_definition' &&
        candidate.source.source_kind === 'pinned_bundle'
    ),
    true
  );
  assert.equal(
    result.value?.active_candidates.find(
      (candidate) =>
        candidate.defines_packet_type === 'Preference' &&
        candidate.part_subtype === 'packet_type_definition'
    )?.source.source_kind,
    'pinned_bundle'
  );
});

test('trusted definition coordinator ignores invalid pinned stored bundles without outranking bootstrap fallback', async () => {
  const profile = resolveSeededPacketDefinitionProfile();
  const invalidBundle = {
    ...profile.bundle_packet.packet,
    header: {
      ...profile.bundle_packet.packet.header,
      packet_id: 'nexus:test/invalid-stored-definition-bundle',
      revision_id: 'nexus:test/invalid-stored-definition-bundle@r-001',
    },
    body: {
      ...profile.bundle_packet.packet.body,
      items: [
        {
          item_role: 'definition_part',
          packet_ref: { packet_id: 'nexus:test/missing-definition-part' },
          revision_ref: null,
          packet_type: 'Definition',
          packet_subtype: 'packet_definition',
          schema_version: '0.1.0',
          digest: null,
          required: true,
          notes: 'Missing Definition part for invalid pinned bundle test.',
        },
      ],
    },
  } as const;
  const packetsById = new Map<string, any>([[invalidBundle.header.packet_id, invalidBundle]]);

  const packetStore = {
    fetchPreferredRevision: async (packetRef: { packet_id: string }) => {
      const packet = packetsById.get(packetRef.packet_id);
      return packet
        ? {
            packet_id: packet.header.packet_id,
            revision_id: packet.header.revision_id,
          }
        : null;
    },
    readByPacket: async (packetRef: { packet_id: string }) => packetsById.get(packetRef.packet_id) ?? null,
    readByRevision: async (revisionRef: { packet_id: string }) => packetsById.get(revisionRef.packet_id) ?? null,
    listSearchRows: async () => [],
  } as any;

  const result = await trustedDefinitionCoordinator.resolveContextWithArchiveProfilePreferences({
    node_element_id: 'node:invalid-stored-profile-test',
    packet_type_filters: ['Preference'],
    packet_store: packetStore,
    preferences: [
      {
        preference_id: 'test.pin.invalid.stored.definition.bundle',
        node_element_id: 'node:invalid-stored-profile-test',
        source_id: invalidBundle.header.packet_id,
        packet_type: 'Preference',
        packet_subtype: null,
        part_subtype: 'packet_type_definition',
        trust_mode: 'pin',
        priority: 2000,
        notes: 'Invalid pinned stored definition profile bundle should not beat bootstrap fallback.',
      },
    ],
  });

  assert.equal(result.status, 'partial');
  assert.equal(
    result.issues.some((issue) => issue.code === 'definition.stored_profile_invalid'),
    true
  );
  assert.equal(
    result.value?.active_candidates.find(
      (candidate) =>
        candidate.defines_packet_type === 'Preference' &&
        candidate.part_subtype === 'packet_type_definition'
    )?.source.source_kind,
    'bootstrap_manifest'
  );
});
