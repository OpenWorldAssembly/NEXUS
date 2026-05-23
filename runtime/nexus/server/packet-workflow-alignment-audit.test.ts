import assert from 'node:assert/strict';
import test from 'node:test';

import { PACKET_TYPES } from '@core/schema/packet-schema';
import {
  auditPacketTypeDefinition,
  getDefinedPacketTypeDefinition,
  listPacketWorkflowPlanDescriptors,
} from '@core/packets/packet-definition-manifest';
import {
  auditPacketWorkflowAlignmentCoverage,
  getPacketWorkflowAlignmentCoverage,
  listPacketWorkflowAlignmentCoverage,
} from './packet-workflow-alignment-audit.ts';
import { listFortressHandlerGenericizationEntries } from './fortress-handler-genericization-audit.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';

test('workflow alignment coverage includes every live mutation intent', () => {
  const coveredIntents = listPacketWorkflowAlignmentCoverage()
    .map((coverage) => coverage.mutation_intent)
    .sort();
  const liveIntents = listMutationIntentDescriptors()
    .map((descriptor) => descriptor.kind)
    .sort();

  assert.deepEqual(coveredIntents, liveIntents);
});

test('workflow alignment audit passes with explicit gaps', () => {
  const report = auditPacketWorkflowAlignmentCoverage();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('generic-ready intents have clean workflow and capability coverage', () => {
  const genericReadyIntents = listFortressHandlerGenericizationEntries()
    .filter((entry) => entry.genericization_status === 'generic_ready')
    .map((entry) => entry.mutation_intent);

  assert.ok(genericReadyIntents.length > 0);

  for (const mutationIntent of genericReadyIntents) {
    const coverage = getPacketWorkflowAlignmentCoverage(mutationIntent);

    assert.ok(coverage, mutationIntent);
    assert.equal(coverage.workflow_alignment_status, 'workflow_aligned');
    assert.equal(coverage.dry_run_ready, true, mutationIntent);
    assert.ok(coverage.workflow_plan_ids.length > 0, mutationIntent);
    assert.ok(coverage.trusted_capability_ids.length > 0, mutationIntent);
    assert.equal(
      coverage.missing_coverage_items.some((gap) => gap.area === 'workflow_plan'),
      false,
      mutationIntent
    );
  }
});

test('planner-extraction candidates are definition-planned or explicitly gapped', () => {
  const plannerEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'planner_extraction_needed'
  );

  assert.ok(plannerEntries.length > 0);

  for (const entry of plannerEntries) {
    const coverage = getPacketWorkflowAlignmentCoverage(entry.mutation_intent);
    assert.ok(coverage, entry.mutation_intent);

    assert.ok(
      coverage.workflow_plan_ids.length > 0 || coverage.missing_coverage_items.length > 0,
      entry.mutation_intent
    );
  }

  for (const mutationIntent of [
    'assembly_association.relation.set',
    'assembly_association.relation.clear',
    'home_locality.relation.set',
    'discussion.reply.create',
  ] as const) {
    const coverage = getPacketWorkflowAlignmentCoverage(mutationIntent);
    assert.ok(coverage);
    assert.equal(coverage.workflow_alignment_status, 'workflow_aligned');
    assert.equal(coverage.dry_run_ready, true);
  }
});

test('workflow-specific intents remain runtime-owned with orchestration reasons', () => {
  const runtimeOwned = listPacketWorkflowAlignmentCoverage().filter(
    (coverage) => coverage.genericization_status === 'workflow_specific'
  );

  assert.ok(runtimeOwned.length > 0);

  for (const coverage of runtimeOwned) {
    assert.equal(coverage.workflow_alignment_status, 'runtime_owned');
    assert.ok(
      coverage.missing_coverage_items.some((gap) => gap.area === 'runtime_orchestration'),
      coverage.mutation_intent
    );
    assert.ok(
      coverage.remaining_packet_specific_assumptions.every(
        (assumption) => assumption.length > 0
      ),
      coverage.mutation_intent
    );
  }
});

test('complex graph workflow intents name reusable composite adapters', () => {
  const adapterIdsByIntent = new Map(
    listPacketWorkflowAlignmentCoverage().map((coverage) => [
      coverage.mutation_intent,
      coverage.composition_adapter_ids,
    ])
  );

  assert.deepEqual(adapterIdsByIntent.get('locality.graph.apply'), [
    'composite.locality_graph.apply.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('discussion.surfaces.ensure'), [
    'composite.discussion_surfaces.ensure.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('assembly.element.create'), [
    'composite.assembly_element.create.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('locality.path.create'), [
    'composite.locality_path.create.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('discussion.thread_post.create'), [
    'composite.discussion_thread_post.create.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('discussion.reply.create'), [
    'composite.discussion_reply.create.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('role_association.attestation.set'), [
    'composite.role_attestation.set.v0',
  ]);
  assert.deepEqual(adapterIdsByIntent.get('actor.write_policy.update'), [
    'composite.actor_write_policy.update.v0',
  ]);
});

test('legacy bridge intents are absent from live workflow alignment coverage', () => {
  const legacyEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'legacy_bridge'
  );

  assert.deepEqual(legacyEntries, []);
  assert.equal(getPacketWorkflowAlignmentCoverage('home_locality.claim.set' as never), null);
  assert.equal(
    getPacketWorkflowAlignmentCoverage('assembly_association.claim.set' as never),
    null
  );
});

test('unused removed packet types do not block workflow alignment', () => {
  const workflowPacketTypes = new Set(
    listPacketWorkflowPlanDescriptors().map((plan) => plan.packet_type)
  );

  assert.equal((PACKET_TYPES as readonly string[]).includes('Signal'), false);
  assert.equal(workflowPacketTypes.has('Signal'), false);
  assert.equal(auditPacketWorkflowAlignmentCoverage().status, 'pass');
});

test('workflow-covered packet definitions audit cleanly', () => {
  for (const packetType of ['Relation', 'Claim', 'Attestation', 'Discussion']) {
    const definition = getDefinedPacketTypeDefinition(packetType);
    assert.ok(definition, packetType);
    assert.ok((definition.workflow_plans ?? []).length > 0, packetType);

    const report = auditPacketTypeDefinition({
      definition,
      requireDefinitionRuntimeReady: false,
    });

    assert.equal(report.finding_counts.error, 0, packetType);
  }
});
