import assert from 'node:assert/strict';
import test from 'node:test';

import { MUTATION_ACTION_IDS } from '@core/auth/write-policy';
import { createFinalPreReseedReadinessReport } from './final-pre-reseed-readiness.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';
import { listPacketClientIntentEnrollments } from './packet-client-intent-enrollment.ts';
import { listPacketRuntimeFortressHandoffCoverage } from './packet-runtime-fortress-handoff.ts';

const RETIRED_LEGACY_MUTATION_INTENTS = [
  'assembly_association.claim.set',
  'home_locality.claim.set',
] as const;

test('final pre-reseed readiness report passes with no open in-scope work', () => {
  const report = createFinalPreReseedReadinessReport();

  assert.equal(report.status, 'pass', JSON.stringify(report.findings, null, 2));
  assert.deepEqual(report.findings, []);
  assert.ok(report.canonical_write_intents.includes('home_locality.relation.set'));
  assert.ok(report.canonical_write_intents.includes('assembly_association.relation.set'));
  assert.ok(report.canonical_write_intents.includes('assembly_association.relation.clear'));
});

test('retired legacy mutation intents are absent from live registries', () => {
  const registeredIntentKinds = new Set(
    listMutationIntentDescriptors().map((descriptor) => descriptor.kind)
  );
  const enrolledIntentKinds = new Set(
    listPacketClientIntentEnrollments().map(
      (enrollment) => enrollment.mutation_intent
    )
  );
  const handoffIntentKinds = new Set(
    listPacketRuntimeFortressHandoffCoverage().map(
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
  const report = createFinalPreReseedReadinessReport();

  for (const legacySurface of [
    'assembly_association.claim.set',
    'home_locality.claim.set',
    'Claim(home_locality)',
    'DiscussionThread/DiscussionPost/DiscussionReply projections',
    'Cause(subtype: initiative)',
  ]) {
    assert.ok(report.compatibility_only_legacy_surfaces.includes(legacySurface));
  }
});

test('final readiness handoff records seed/default anchors and discussion defaults', () => {
  const report = createFinalPreReseedReadinessReport();

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
