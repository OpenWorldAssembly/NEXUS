import assert from 'node:assert/strict';
import test from 'node:test';

import { PACKET_FAMILIES } from '@core/schema/packet-schema';
import {
  auditPacketTypeDefinition,
  getExperimentalPacketTypeDefinition,
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
      coverage.planned_gaps.some((gap) => gap.area === 'workflow_plan'),
      false,
      mutationIntent
    );
  }
});

test('planner-extraction candidates are shadow-planned or explicitly gapped', () => {
  const plannerEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'planner_extraction_needed'
  );

  assert.ok(plannerEntries.length > 0);

  for (const entry of plannerEntries) {
    const coverage = getPacketWorkflowAlignmentCoverage(entry.mutation_intent);
    assert.ok(coverage, entry.mutation_intent);

    assert.ok(
      coverage.workflow_plan_ids.length > 0 || coverage.planned_gaps.length > 0,
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
      coverage.planned_gaps.some((gap) => gap.area === 'runtime_orchestration'),
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

test('legacy bridge intents point at canonical workflow directions', () => {
  const legacyEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'legacy_bridge'
  );

  assert.ok(legacyEntries.length > 0);

  for (const entry of legacyEntries) {
    const coverage = getPacketWorkflowAlignmentCoverage(entry.mutation_intent);
    assert.ok(coverage, entry.mutation_intent);
    assert.equal(coverage.workflow_alignment_status, 'legacy_bridge');
    assert.equal(coverage.canonical_intent, entry.canonical_intent);
    assert.ok(coverage.workflow_plan_ids.length > 0, entry.mutation_intent);
    assert.ok(
      coverage.planned_gaps.some((gap) => gap.area === 'legacy_bridge'),
      entry.mutation_intent
    );
  }
});

test('unused deferred packet families do not block workflow alignment', () => {
  const workflowPacketTypes = new Set(
    listPacketWorkflowPlanDescriptors().map((plan) => plan.packet_type)
  );

  assert.equal((PACKET_FAMILIES as readonly string[]).includes('Signal'), true);
  assert.equal(workflowPacketTypes.has('Signal'), false);
  assert.equal(auditPacketWorkflowAlignmentCoverage().status, 'pass');
});

test('workflow-covered packet definitions audit cleanly', () => {
  for (const packetType of ['Relation', 'Claim', 'Attestation', 'Discussion']) {
    const definition = getExperimentalPacketTypeDefinition(packetType);
    assert.ok(definition, packetType);
    assert.ok((definition.workflow_plans ?? []).length > 0, packetType);

    const report = auditPacketTypeDefinition({
      definition,
      requireShadowRuntimeReady: false,
    });

    assert.equal(report.finding_counts.error, 0, packetType);
  }
});
