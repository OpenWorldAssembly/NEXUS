import assert from 'node:assert/strict';
import test from 'node:test';

import { MUTATION_ACTION_IDS } from '@core/auth/write-policy';
import { PACKET_TYPES } from '@core/schema/packet-ontology';
import { createFinalPreReseedReadinessReport } from './final-pre-reseed-readiness.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';
import { listPacketClientIntentEnrollments } from './packet-client-intent-enrollment.ts';
import { listPacketRuntimeDispatchHandoffCoverage } from './packet-runtime-dispatch-handoff.ts';

const RETIRED_LEGACY_MUTATION_INTENTS = [
  'association.claim.set',
  'residence.claim.set',
] as const;

const finalReadinessReport = createFinalPreReseedReadinessReport();

test('final pre-reseed readiness report passes with no open in-scope work', () => {
  const report = finalReadinessReport;

  assert.equal(report.status, 'pass', JSON.stringify(report.blockers, null, 2));
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.findings, []);
  assert.ok(report.canonical_write_intents.includes('relation.residence.add'));
  assert.ok(report.canonical_write_intents.includes('relation.association.add'));
  assert.ok(report.canonical_write_intents.includes('relation.association.clear'));
});

test('final readiness handoff keeps accepted transitions visible but non-blocking', () => {
  const report = finalReadinessReport;

  assert.ok(report.accepted_transition_notes.length > 0);
  assert.ok(
    report.accepted_transition_notes.some((note) =>
      note.includes('TypeScript bootstrap definitions and generated Definition seed packets')
    )
  );
  assert.ok(
    report.accepted_transition_notes.some((note) =>
      note.includes('canonical metadata but not runtime-ready')
    )
  );
  assert.equal(report.blockers.length, 0);
});

test('final readiness handoff has no parent_scope seed cleanup candidates', () => {
  const report = finalReadinessReport;

  assert.equal(
    report.cleanup_candidates.some((candidate) =>
      candidate.includes('parent_scope')
    ),
    false
  );
});

test('retired legacy mutation intents are absent from live registries', () => {
  const registeredIntentKinds = new Set(
    listMutationIntentDescriptors().map((descriptor) => descriptor.kind)
  );
  const enrolledIntentKinds = new Set<string>(
    listPacketClientIntentEnrollments().map(
      (enrollment) => enrollment.mutation_intent
    )
  );
  const handoffIntentKinds = new Set<string>(
    listPacketRuntimeDispatchHandoffCoverage().map(
      (coverage) => coverage.mutation_intent
    )
  );

  for (const mutationIntent of RETIRED_LEGACY_MUTATION_INTENTS) {
    assert.equal(registeredIntentKinds.has(mutationIntent as never), false);
    assert.equal(enrolledIntentKinds.has(mutationIntent), false);
    assert.equal(handoffIntentKinds.has(mutationIntent as never), false);
    assert.equal(
      (MUTATION_ACTION_IDS as readonly string[]).includes(mutationIntent),
      false
    );
  }
});

test('final readiness handoff records compatibility-only legacy surfaces', () => {
  const report = finalReadinessReport;

  for (const legacySurface of [
    'association.claim.set',
    'residence.claim.set',
    'archived alpha packet types only',
    'legacy parent_scope ancestry archive records',
  ]) {
    assert.ok(report.compatibility_only_legacy_surfaces.includes(legacySurface));
  }

  assert.ok(report.pruned_packet_types.includes('Cause'));
  assert.ok(report.pruned_packet_types.includes('DiscussionThread'));
  assert.equal(report.pruned_packet_types.includes('Discussion'), false);
});

test('final readiness handoff records seed/default anchors and discussion defaults', () => {
  const report = finalReadinessReport;

  assert.ok(report.seed_default_anchor_packet_ids.includes('nexus:action/owa'));
  assert.ok(
    report.required_default_policy_packet_ids.includes(
      'nexus:policy/owa-default-inheritance'
    )
  );
  assert.ok(
    report.required_default_policy_packet_ids.includes(
      'nexus:policy/owa-governance-baseline'
    )
  );
  assert.ok(report.discussion_default_packet_ids.length > 0);
});

test('final readiness handoff records canonical Definition and Bundle seed material', () => {
  const report = finalReadinessReport;

  assert.ok(report.seeded_definition_packet_count > 0);
  assert.ok(
    report.canonical_definition_seed_packet_ids.some((packetId) =>
      packetId.startsWith('nexus:definition/')
    )
  );
  assert.ok(
    report.canonical_definition_seed_packet_ids.includes(
      report.seeded_definition_bundle_packet_id
    )
  );
});


test('pruned packet types do not overlap the active packet ontology', () => {
  const report = finalReadinessReport;
  const activeTypes = new Set<string>(PACKET_TYPES);

  for (const packetType of report.pruned_packet_types) {
    assert.equal(activeTypes.has(packetType), false, packetType);
  }
});
