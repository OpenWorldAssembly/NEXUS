/**
 * File: packet-definition-seeds.test.ts
 * Description: Verifies packet-shaped Definition/Bundle seed material for the active manifest profile.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditSeededPacketDefinitionProfile,
  buildDefinitionBundlePacketSetCandidate,
  buildDefinitionPacketSeedCandidates,
  listExperimentalPacketTypeDefinitions,
  listPacketDefinitionParts,
  resolveSeededPacketDefinitionProfile,
} from '@core/packets/packet-definition-manifest';

test('every active manifest definition part produces a Definition seed candidate', () => {
  const definitions = listExperimentalPacketTypeDefinitions();
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
    assert.equal(candidate.body_candidate.body.type, 'definition');
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
  assert.equal(bundle.body_candidate.body.items.length, definitionPackets.length);
  assert.equal(new Set(bundledRevisionIds).size, definitionPackets.length);

  for (const candidate of definitionPackets) {
    assert.ok(
      bundledRevisionIds.includes(candidate.revision_ref.revision_id),
      candidate.part_id
    );
  }
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
