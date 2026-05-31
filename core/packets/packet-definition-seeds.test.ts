/**
 * File: packet-definition-seeds.test.ts
 * Description: Verifies packet-shaped Definition/Bundle seed material for the active manifest profile.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditSeededPacketDefinitionProfile,
  buildDefinitionBundlePacketSetCandidate,
  buildDefinitionBundleSeedEnvelope,
  buildDefinitionPacketSeedCandidates,
  buildDefinitionPacketSeedEnvelopes,
  listDefinedPacketTypeDefinitions,
  listPacketDefinitionParts,
  resolveSeededPacketDefinitionProfile,
} from '@core/packets/packet-definition-manifest';
import { CANONICAL_SEED_PACKETS } from '@core/packets/seeds';

test('every active manifest definition part produces a Definition seed candidate', () => {
  const definitions = listDefinedPacketTypeDefinitions();
  const expectedParts = definitions.flatMap((definition) =>
    listPacketDefinitionParts(definition)
  );
  const candidates = buildDefinitionPacketSeedCandidates({ definitions });

  assert.equal(candidates.length, expectedParts.length);
  assert.equal(
    new Set(candidates.map((candidate) => candidate.part_id)).size,
    expectedParts.length
  );

  for (const candidate of candidates) {
    assert.equal(candidate.seed_kind, 'packet_definition.seed_candidate');
    assert.equal(candidate.body_candidate.packet_type, 'Definition');
    assert.equal(candidate.packet.header.type, 'Definition');
    assert.equal(candidate.packet.header.packet_id, candidate.packet_ref.packet_id);
    assert.equal(candidate.body_candidate.body.subtype, candidate.body_candidate.packet_subtype);
    assert.equal(candidate.packet.body.subtype, candidate.body_candidate.packet_subtype);
    assert.equal(
      candidate.body_candidate.body.defines_packet_type,
      candidate.defines_packet_type
    );
    assert.match(candidate.body_digest, /^sha256:[a-f0-9]{64}$/);
  }
});

test('definition bundle includes every Definition seed candidate exactly once', () => {
  const definitionPackets = buildDefinitionPacketSeedCandidates();
  const bundle = buildDefinitionBundlePacketSetCandidate({ definitionPackets });
  const bundledRevisionIds = bundle.body_candidate.body.items.map(
    (item) => item.revision_ref?.revision_id
  );

  assert.equal(bundle.body_candidate.packet_type, 'Bundle');
  assert.equal(bundle.body_candidate.packet_subtype, 'packet_set');
  assert.equal(bundle.packet.header.type, 'Bundle');
  assert.equal(bundle.packet.body.subtype, 'packet_set');
  assert.equal(bundle.body_candidate.body.items.length, definitionPackets.length);
  assert.equal(new Set(bundledRevisionIds).size, definitionPackets.length);

  for (const candidate of definitionPackets) {
    assert.ok(
      bundledRevisionIds.includes(candidate.revision_ref.revision_id),
      candidate.part_id
    );
  }
});

test('definition seed helpers expose canonical packet envelopes in bootstrap seeds', () => {
  const definitionEnvelopes = buildDefinitionPacketSeedEnvelopes();
  const bundleEnvelope = buildDefinitionBundleSeedEnvelope();
  const seedPacketIds = new Set(
    CANONICAL_SEED_PACKETS.map((packet) => packet.header.packet_id)
  );

  assert.ok(definitionEnvelopes.length > 0);
  assert.equal(
    definitionEnvelopes.every((packet) => packet.header.type === 'Definition'),
    true
  );
  assert.equal(bundleEnvelope.header.type, 'Bundle');
  assert.equal(bundleEnvelope.body.items.length, definitionEnvelopes.length);
  assert.equal(
    definitionEnvelopes.every((packet) => seedPacketIds.has(packet.header.packet_id)),
    true
  );
  assert.equal(seedPacketIds.has(bundleEnvelope.header.packet_id), true);
});

test('seeded definition profile audit passes and fails closed on drift', () => {
  const profile = resolveSeededPacketDefinitionProfile();
  const report = auditSeededPacketDefinitionProfile({ profile });

  assert.equal(report.status, 'pass');
  assert.equal(report.findings.length, 0);
  assert.equal(report.checked_part_count, report.bundled_part_count);

  const driftedProfile = {
    ...profile,
    definition_packets: profile.definition_packets.slice(1),
  };
  const driftReport = auditSeededPacketDefinitionProfile({
    profile: driftedProfile,
  });

  assert.equal(driftReport.status, 'fail');
  assert.ok(
    driftReport.findings.some((finding) =>
      finding.includes('Missing seeded Definition candidate')
    )
  );
});

test('discussion definition seed carries aggregate projection descriptors', () => {
  const candidates = buildDefinitionPacketSeedCandidates();
  const discussionProjectionPart = candidates.find(
    (candidate) =>
      candidate.defines_packet_type === 'Discussion' &&
      candidate.part_id === 'discussion.packet_projection_descriptor.aggregate_surfaces.v0'
  );

  assert.ok(discussionProjectionPart);
  assert.equal(discussionProjectionPart.body_candidate.body.subtype, 'packet_projection_descriptor');
  assert.ok(
    discussionProjectionPart.body_candidate.body.projection_keys.includes(
      'discussion.workspace.aggregate.v0'
    )
  );
  assert.ok(
    discussionProjectionPart.body_candidate.body.projection_keys.includes(
      'discussion.post.thread.aggregate.v0'
    )
  );
  assert.ok(
    discussionProjectionPart.body_candidate.body.projection_keys.includes(
      'discussion.composer.surface.v0'
    )
  );
});

test('discussion definition seed carries default surface recipe descriptors', () => {
  const candidates = buildDefinitionPacketSeedCandidates();
  const discussionDefaultsPart = candidates.find(
    (candidate) =>
      candidate.defines_packet_type === 'Discussion' &&
      candidate.part_id === 'discussion.defaults_definition.element_surface_recipe.v0'
  );

  assert.ok(discussionDefaultsPart);
  assert.equal(discussionDefaultsPart.body_candidate.body.subtype, 'defaults_definition');
  assert.equal(
    discussionDefaultsPart.body_candidate.body.applies_to?.workflow_id,
    'element.default_discussion_surface.v0'
  );
  const defaultValues = discussionDefaultsPart.body_candidate.body.default_values as Record<
    string,
    unknown
  >;
  const defaultProfiles = defaultValues.default_profiles as Record<string, unknown>;

  assert.ok(defaultProfiles.locality_assembly);
  assert.equal(defaultValues.default_builder, 'buildElementDefaultDiscussionPackets');
});
