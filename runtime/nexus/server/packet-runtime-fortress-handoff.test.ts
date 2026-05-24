import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditPacketRuntimeFortressHandoffs,
  listPacketRuntimeFortressHandoffCoverage,
  resolvePacketRuntimeFortressHandoff,
} from './packet-runtime-fortress-handoff.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';
import { listFortressHandlerGenericizationEntries } from './fortress-handler-genericization-audit.ts';

test('runtime fortress handoff coverage includes every live mutation intent', () => {
  const coveredIntents = listPacketRuntimeFortressHandoffCoverage()
    .map((coverage) => coverage.mutation_intent)
    .sort();
  const liveIntents = listMutationIntentDescriptors()
    .map((descriptor) => descriptor.kind)
    .sort();

  assert.deepEqual(coveredIntents, liveIntents);
});

test('runtime fortress handoff audit passes while remaining runtime-ready', () => {
  const report = auditPacketRuntimeFortressHandoffs();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('generic-ready intents resolve to definition-ready handoffs', () => {
  const genericReadyIntents = listFortressHandlerGenericizationEntries()
    .filter((entry) => entry.genericization_status === 'generic_ready')
    .map((entry) => entry.mutation_intent);

  assert.ok(genericReadyIntents.length > 0);

  for (const mutationIntent of genericReadyIntents) {
    const handoff = resolvePacketRuntimeFortressHandoff({ mutationIntent });

    assert.equal(handoff.status, 'definition_ready', mutationIntent);
    assert.equal(handoff.external_definition_execution_enabled, false);
    assert.ok(handoff.reason_codes.includes('workflow_alignment_ready'));
    assert.ok(handoff.reason_codes.includes('external_definition_execution_disabled'));
    assert.ok(handoff.workflow_plan_ids.length > 0, mutationIntent);
    assert.ok(handoff.operation_kinds.length > 0, mutationIntent);
    assert.ok(handoff.trusted_capability_ids.length > 0, mutationIntent);
    assert.ok(handoff.policy_action_ids.length > 0, mutationIntent);
    assert.ok(handoff.dependency_ids.length > 0, mutationIntent);
    assert.ok(handoff.fortress_prepare_handler, mutationIntent);
    assert.ok(handoff.fortress_finalize_handler, mutationIntent);
  }
});

test('workflow-aligned planner extraction intents produce definition handoffs but not external definition execution readiness', () => {
  for (const mutationIntent of [
    'relation.association.add',
    'relation.association.clear',
    'home_locality.relation.set',
    'discussion.reply.create',
  ] as const) {
    const handoff = resolvePacketRuntimeFortressHandoff({ mutationIntent });

    assert.equal(handoff.status, 'definition_ready', mutationIntent);
    assert.equal(handoff.external_definition_execution_enabled, false);
    assert.ok(handoff.workflow_plan_ids.length > 0, mutationIntent);
    assert.ok(handoff.trusted_capability_ids.length > 0, mutationIntent);
  }
});

test('runtime-owned workflow intents produce explicit non-ready handoffs', () => {
  const runtimeOwnedIntents = listFortressHandlerGenericizationEntries()
    .filter((entry) => entry.genericization_status === 'workflow_specific')
    .map((entry) => entry.mutation_intent);

  assert.ok(runtimeOwnedIntents.length > 0);

  for (const mutationIntent of runtimeOwnedIntents) {
    const handoff = resolvePacketRuntimeFortressHandoff({ mutationIntent });

    assert.equal(handoff.status, 'runtime_owned', mutationIntent);
    assert.equal(handoff.external_definition_execution_enabled, false);
    assert.ok(handoff.reason_codes.includes('runtime_owned_workflow'));
    assert.ok(handoff.reason_codes.includes('external_definition_execution_disabled'));
  }
});

test('retired legacy bridge intents fail closed before fortress handoff', () => {
  const legacyEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'legacy_bridge'
  );

  assert.deepEqual(legacyEntries, []);

  for (const mutationIntent of [
    'association.claim.set',
    'home_locality.claim.set',
  ]) {
    const handoff = resolvePacketRuntimeFortressHandoff({
      mutationIntent,
    });

    assert.equal(handoff.status, 'blocked');
    assert.deepEqual(handoff.reason_codes, ['unknown_mutation_intent']);
    assert.equal(handoff.normalized_prepare_intent_kind, null);
  }
});

test('unknown mutation intents fail closed before fortress handoff', () => {
  const handoff = resolvePacketRuntimeFortressHandoff({
    mutationIntent: 'relation.teleport',
  });

  assert.equal(handoff.status, 'blocked');
  assert.equal(handoff.external_definition_execution_enabled, false);
  assert.deepEqual(handoff.reason_codes, ['unknown_mutation_intent']);
  assert.equal(handoff.fortress_prepare_handler, null);
  assert.equal(handoff.fortress_finalize_handler, null);
});
