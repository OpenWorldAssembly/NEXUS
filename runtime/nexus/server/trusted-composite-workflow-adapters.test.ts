import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTrustedCompositeWorkflowAdapters,
  getTrustedCompositeWorkflowAdapter,
  listTrustedCompositeWorkflowAdapters,
  resolveCompositeWorkflowDryRun,
} from './trusted-composite-workflow-adapters.ts';
import {
  auditLiveCompositeWorkflowEnrollments,
  listLiveCompositeWorkflowEnrollments,
  runTrustedCompositeWorkflowMutation,
} from './trusted-composite-workflow-runtime.ts';

test('trusted composite workflow adapter audit passes', () => {
  const report = auditTrustedCompositeWorkflowAdapters();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('locality graph apply resolves through the composite batch adapter', () => {
  const adapter = getTrustedCompositeWorkflowAdapter(
    'composite.locality_graph.apply.v0'
  );
  assert.ok(adapter);
  assert.equal(adapter.adapter_kind, 'composite.batch.packet_operations');
  assert.deepEqual(adapter.mutation_intents, ['locality.graph.apply']);

  const dryRun = resolveCompositeWorkflowDryRun({
    adapterId: adapter.adapter_id,
  });

  assert.equal(dryRun.ready_for_interpretation, true);
  assert.deepEqual(dryRun.findings, []);
  assert.deepEqual(dryRun.phase_order, adapter.phase_order);
  assert.ok(dryRun.operation_kinds.includes('single_packet.create'));
  assert.ok(dryRun.operation_kinds.includes('relation.set'));
  assert.ok(dryRun.operation_kinds.includes('projection.refresh'));
  assert.ok(dryRun.policy_action_ids.includes('locality.element.create'));
  assert.ok(dryRun.policy_action_ids.includes('relation.follow.add'));
  assert.ok(dryRun.dependency_ids.includes('runtime.planner.scoped_relation'));
});

test('discussion surfaces and assembly creation have reusable adapter descriptors', () => {
  const adaptersByIntent = new Map(
    listTrustedCompositeWorkflowAdapters().flatMap((adapter) =>
      adapter.mutation_intents.map((intent) => [intent, adapter])
    )
  );

  assert.equal(
    adaptersByIntent.get('discussion.surfaces.ensure')?.adapter_kind,
    'composite.default_packet_set.ensure'
  );
  assert.equal(
    adaptersByIntent.get('assembly.element.create')?.adapter_kind,
    'composite.entity_create.with_followups'
  );
  assert.equal(
    adaptersByIntent.get('locality.path.create')?.adapter_kind,
    'composite.path_create.with_directory_projection'
  );
  assert.equal(
    adaptersByIntent.get('discussion.thread_post.create')?.adapter_kind,
    'composite.discussion_message.create'
  );
  assert.equal(
    adaptersByIntent.get('discussion.reply.create')?.adapter_kind,
    'composite.discussion_message.create'
  );
  assert.equal(
    adaptersByIntent.get('role_association.attestation.set')?.adapter_kind,
    'composite.attestation_mutual_exclusion'
  );
  assert.equal(
    adaptersByIntent.get('actor.write_policy.update')?.adapter_kind,
    'composite.policy_self_update'
  );
});

test('discussion adapters point toward canonical Discussion message writes', () => {
  const adaptersById = new Map(
    listTrustedCompositeWorkflowAdapters().map((adapter) => [
      adapter.adapter_id,
      adapter,
    ])
  );

  for (const adapterId of [
    'composite.discussion_thread_post.create.v0',
    'composite.discussion_reply.create.v0',
  ]) {
    const adapter = adaptersById.get(adapterId);
    assert.ok(adapter, adapterId);
    assert.equal(adapter.adapter_kind, 'composite.discussion_message.create');
    assert.ok(adapter.operation_kinds.includes('single_packet.create'));
    assert.ok(adapter.operation_kinds.includes('projection.refresh'));
    assert.match(adapter.notes, /discussion-message/);
    assert.match(
      adapter.phases.map((phase) => phase.notes).join('\n'),
      /legacy/
    );
  }
});

test('unknown composite adapter requests fail closed', () => {
  const dryRun = resolveCompositeWorkflowDryRun({
    adapterId: 'composite.teleport.v0',
  });

  assert.equal(dryRun.ready_for_interpretation, false);
  assert.equal(dryRun.findings[0]?.code, 'unknown_adapter');
});

test('every trusted composite adapter has a live composite workflow enrollment', () => {
  const adapterIds = listTrustedCompositeWorkflowAdapters()
    .map((adapter) => adapter.adapter_id)
    .sort();
  const enrollmentAdapterIds = listLiveCompositeWorkflowEnrollments()
    .map((enrollment) => enrollment.adapter_id)
    .sort();
  const report = auditLiveCompositeWorkflowEnrollments();

  assert.deepEqual(enrollmentAdapterIds, adapterIds);
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('unsupported live composite workflow requests fail closed', async () => {
  await assert.rejects(
    () =>
      runTrustedCompositeWorkflowMutation({
        packetStore: {} as never,
        policyGate: {} as never,
        ticketService: {} as never,
        actorPacket: {} as never,
        intent: { kind: 'relation.follow.add' } as never,
      }),
    /Missing live composite workflow adapter/
  );
});
