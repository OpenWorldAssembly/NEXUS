import assert from 'node:assert/strict';
import test from 'node:test';

import { PACKET_TYPES } from '@core/schema/packet-schema';
import {
  createPreReseedModernizationClosureReport,
  type PreReseedClosureLedgerEntry,
} from './pre-reseed-modernization-closure.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';

const preReseedClosureReport = createPreReseedModernizationClosureReport();

function allEntries(): PreReseedClosureLedgerEntry[] {
  const report = preReseedClosureReport;

  return [
    ...report.live_mutation_intents,
    ...report.runtime_connector_paths,
    ...report.workflow_plans,
    ...report.policy_requirements,
    ...report.dependency_requirements,
    ...report.client_ingress_enrollments,
    ...report.dispatch_handoffs,
    ...report.composite_workflow_adapters,
    ...report.packet_types,
    ...report.follow_on_pass_queue,
  ];
}

test('pre-reseed closure report passes without vague gap language', () => {
  const report = preReseedClosureReport;

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
  assert.equal(JSON.stringify(report).includes('missing_coverage'), false);
});

test('every live mutation intent has a strict pre-reseed closure status', () => {
  const report = preReseedClosureReport;
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
  const report = preReseedClosureReport;
  const closureByIntent = new Map(
    report.live_mutation_intents.map((entry) => [entry.subject_id, entry])
  );

  for (const mutationIntent of [
    'relation.follow.add',
    'relation.follow.clear',
  ] as const) {
    const entry = closureByIntent.get(mutationIntent);

    assert.ok(entry);
    assert.equal(entry.status, 'closed');
    assert.equal(entry.queue, 'first_generic_promotion');
  }
});

test('remaining direct relation and attestation operation paths are closed', () => {
  const report = preReseedClosureReport;
  const closureByIntent = new Map(
    report.live_mutation_intents.map((entry) => [entry.subject_id, entry])
  );

  for (const mutationIntent of [
    'relation.association.add',
    'relation.association.clear',
    'relation.residence.add',
    'relation.participation.add',
    'relation.participation.clear',
    'reaction.attestation.set',
  ] as const) {
    const entry = closureByIntent.get(mutationIntent);

    assert.ok(entry, mutationIntent);
    assert.equal(entry.status, 'closed', mutationIntent);
    assert.equal(entry.queue, 'first_generic_promotion', mutationIntent);
  }
});

test('legacy bridge mutation intents are retired before reseed readiness', () => {
  const report = preReseedClosureReport;
  const mutationIntentIds = new Set(
    report.live_mutation_intents.map((entry) => entry.subject_id)
  );

  assert.equal(mutationIntentIds.has('association.claim.set'), false);
  assert.equal(mutationIntentIds.has('residence.claim.set'), false);
  assert.deepEqual(report.follow_on_pass_queue, []);
});

test('node preference workflow remains closed as descriptor-only pre-reseed coverage', () => {
  const report = preReseedClosureReport;
  const workflowEntry = report.workflow_plans.find(
    (entry) => entry.subject_id === 'preference.node.set.workflow.v0'
  );

  assert.ok(workflowEntry);
  assert.equal(workflowEntry.status, 'closed');
  assert.equal(workflowEntry.reason.includes('descriptor-only'), true);
});

test('composite workflow mutation intents are closed as live generic-composite work', () => {
  const report = preReseedClosureReport;
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
    'reaction.attestation.set',
    'actor.write_policy.update',
  ] as const) {
    const entry = closureByIntent.get(mutationIntent);

    assert.ok(entry, mutationIntent);
    assert.equal(entry.status, 'closed', mutationIntent);
    assert.equal(entry.queue, 'first_generic_promotion', mutationIntent);
  }
});

test('composite workflow adapters are tracked as closed definition extraction work', () => {
  const report = preReseedClosureReport;
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

test('active packet types are the only packet type closure subjects', () => {
  const report = preReseedClosureReport;
  const typeStatus = new Map(
    report.packet_types.map((entry) => [entry.subject_id, entry.status])
  );

  for (const type of PACKET_TYPES) {
    assert.ok(typeStatus.has(type), type);
  }

  for (const type of [
    'Cause',
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
    assert.equal(typeStatus.has(type), false, type);
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
