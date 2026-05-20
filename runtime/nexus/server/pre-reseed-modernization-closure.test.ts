import assert from 'node:assert/strict';
import test from 'node:test';

import { PACKET_FAMILIES } from '@core/schema/packet-schema';
import {
  createPreReseedModernizationClosureReport,
  type PreReseedClosureLedgerEntry,
} from './pre-reseed-modernization-closure.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';

function allEntries(): PreReseedClosureLedgerEntry[] {
  const report = createPreReseedModernizationClosureReport();

  return [
    ...report.live_mutation_intents,
    ...report.runtime_connector_paths,
    ...report.workflow_plans,
    ...report.policy_requirements,
    ...report.dependency_requirements,
    ...report.client_ingress_enrollments,
    ...report.fortress_handoffs,
    ...report.composite_workflow_adapters,
    ...report.packet_families,
    ...report.follow_on_pass_queue,
  ];
}

test('pre-reseed closure report passes without vague gap language', () => {
  const report = createPreReseedModernizationClosureReport();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
  assert.equal(JSON.stringify(report).includes('planned_gap'), false);
});

test('every live mutation intent has a strict pre-reseed closure status', () => {
  const report = createPreReseedModernizationClosureReport();
  const closureByIntent = new Map(
    report.live_mutation_intents.map((entry) => [entry.subject_id, entry])
  );

  for (const descriptor of listMutationIntentDescriptors()) {
    const entry = closureByIntent.get(descriptor.kind);

    assert.ok(entry, descriptor.kind);
    assert.ok(
      ['closed', 'closing_now', 'queued_pre_reseed', 'blocked'].includes(
        entry.status
      ),
      descriptor.kind
    );
    assert.ok(entry.next_step.length > 0, descriptor.kind);
  }
});

test('follow set and clear are closed as the first live generic workflow promotion', () => {
  const report = createPreReseedModernizationClosureReport();
  const closureByIntent = new Map(
    report.live_mutation_intents.map((entry) => [entry.subject_id, entry])
  );

  for (const mutationIntent of [
    'follows.relation.set',
    'follows.relation.clear',
  ] as const) {
    const entry = closureByIntent.get(mutationIntent);

    assert.ok(entry);
    assert.equal(entry.status, 'closed');
    assert.equal(entry.queue, 'first_generic_promotion');
  }
});

test('remaining direct relation claim and attestation operation paths are closed', () => {
  const report = createPreReseedModernizationClosureReport();
  const closureByIntent = new Map(
    report.live_mutation_intents.map((entry) => [entry.subject_id, entry])
  );

  for (const mutationIntent of [
    'assembly_association.relation.set',
    'assembly_association.relation.clear',
    'home_locality.relation.set',
    'role_association.claim.set',
    'attestation.packet_signal.set',
  ] as const) {
    const entry = closureByIntent.get(mutationIntent);

    assert.ok(entry, mutationIntent);
    assert.equal(entry.status, 'closed', mutationIntent);
    assert.equal(entry.queue, 'first_generic_promotion', mutationIntent);
  }
});

test('legacy bridge retirement remains sequenced before reseed', () => {
  const report = createPreReseedModernizationClosureReport();
  const queued = report.live_mutation_intents.filter(
    (entry) => entry.status === 'queued_pre_reseed'
  );

  assert.ok(queued.length > 0);
  assert.deepEqual(
    queued.map((entry) => entry.queue).sort(),
    ['legacy_bridge_retirement', 'legacy_bridge_retirement']
  );
  assert.ok(
    report.follow_on_pass_queue.some(
      (entry) => entry.subject_id === 'legacy_bridge_retirement'
    )
  );
});

test('composite workflow mutation intents are closed as live generic-composite work', () => {
  const report = createPreReseedModernizationClosureReport();
  const closureByIntent = new Map(
    report.live_mutation_intents.map((entry) => [entry.subject_id, entry])
  );

  for (const mutationIntent of [
    'locality.path.create',
    'locality.graph.apply',
    'discussion.surfaces.ensure',
    'assembly.element.create',
    'discussion.thread_post.create',
    'discussion.reply.create',
    'role_association.attestation.set',
    'actor.write_policy.update',
  ] as const) {
    const entry = closureByIntent.get(mutationIntent);

    assert.ok(entry, mutationIntent);
    assert.equal(entry.status, 'closed', mutationIntent);
    assert.equal(entry.queue, 'first_generic_promotion', mutationIntent);
  }
});

test('composite workflow adapters are tracked as closed shadow extraction work', () => {
  const report = createPreReseedModernizationClosureReport();
  const adapterStatus = new Map(
    report.composite_workflow_adapters.map((entry) => [
      entry.subject_id,
      entry.status,
    ])
  );

  assert.equal(
    adapterStatus.get('composite.locality_graph.apply.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.discussion_surfaces.ensure.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.assembly_element.create.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.locality_path.create.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.discussion_thread_post.create.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.discussion_reply.create.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.role_attestation.set.v0'),
    'closed'
  );
  assert.equal(
    adapterStatus.get('composite.actor_write_policy.update.v0'),
    'closed'
  );
});

test('unused never-live packet families are explicit out of chapter scope', () => {
  const report = createPreReseedModernizationClosureReport();
  const familyStatus = new Map(
    report.packet_families.map((entry) => [entry.subject_id, entry.status])
  );

  for (const family of PACKET_FAMILIES) {
    assert.ok(familyStatus.has(family), family);
  }

  for (const family of [
    'Signal',
    'Initiative',
    'Program',
    'Campaign',
    'MissionTemplate',
    'MissionPlan',
    'MissionReport',
    'Module',
    'DiscussionSpace',
    'DiscussionForum',
    'DiscussionThread',
    'DiscussionPost',
    'DiscussionReply',
    'Minutes',
    'Artifact',
  ]) {
    assert.equal(familyStatus.get(family), 'out_of_chapter_scope', family);
  }
});

test('client ingress remains interface-neutral and packet policy dependencies are tracked', () => {
  const entries = allEntries();
  const clientEntries = entries.filter(
    (entry) => entry.subject_kind === 'client_ingress_enrollment'
  );
  const dependencyEntries = entries.filter(
    (entry) => entry.subject_kind === 'dependency_requirement'
  );

  assert.ok(clientEntries.length > 0);
  assert.ok(dependencyEntries.length > 0);

  for (const entry of clientEntries) {
    assert.equal(entry.subject_id.includes('gui'), false);
    assert.equal(entry.subject_id.includes('shell'), false);
  }
});
