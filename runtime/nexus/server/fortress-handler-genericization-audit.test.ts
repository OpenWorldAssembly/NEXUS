import assert from 'node:assert/strict';
import test from 'node:test';

import { getPacketOperationDefinition } from '@core/packets/packet-operation-ontology';
import {
  auditFortressHandlerGenericization,
  listFortressHandlerGenericizationEntries,
} from './fortress-handler-genericization-audit.ts';
import {
  createMutationFinalizeHandlerMap,
  createMutationPrepareHandlerMap,
} from './fortress-handler-domains.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';
import type { MutationPrepareHandlers } from './mutation-prepare-handlers.ts';
import type { MutationFinalizeHandlers } from './mutation-finalize-handlers.ts';

function createPrepareHandlerProbe() {
  return new Proxy(
    {},
    {
      get: () => async () => ({}),
    }
  ) as MutationPrepareHandlers;
}

function createFinalizeHandlerProbe() {
  return new Proxy(
    {},
    {
      get: () => async () => ({ persist_effects: [], result: null }),
    }
  ) as MutationFinalizeHandlers;
}

test('composed fortress handler maps cover every live mutation intent', () => {
  const prepareMap = createMutationPrepareHandlerMap(createPrepareHandlerProbe());
  const finalizeMap = createMutationFinalizeHandlerMap(createFinalizeHandlerProbe());

  for (const descriptor of listMutationIntentDescriptors()) {
    assert.equal(typeof prepareMap[descriptor.prepare], 'function', descriptor.kind);
    assert.equal(typeof finalizeMap[descriptor.finalize], 'function', descriptor.kind);
  }
});

test('fortress genericization audit classifies every live mutation intent', () => {
  const report = auditFortressHandlerGenericization();

  assert.equal(report.status, 'pass');
  assert.deepEqual(
    report.checked_mutation_intents.sort(),
    listMutationIntentDescriptors().map((descriptor) => descriptor.kind).sort()
  );
  assert.deepEqual(report.findings, []);
});

test('legacy bridge intents identify canonical replacement direction', () => {
  const legacyEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'legacy_bridge'
  );

  assert.ok(legacyEntries.length > 0);
  for (const entry of legacyEntries) {
    assert.ok(entry.canonical_intent, entry.mutation_intent);
    assert.notEqual(entry.canonical_intent, entry.mutation_intent);
    assert.ok(entry.next_step.length > 0);
  }
});

test('every fortress genericization entry maps to known packet operations', () => {
  for (const entry of listFortressHandlerGenericizationEntries()) {
    assert.ok(entry.operation_kinds.length > 0, entry.mutation_intent);
    for (const operationKind of entry.operation_kinds) {
      assert.ok(getPacketOperationDefinition(operationKind), operationKind);
    }
  }
});

test('fortress operation mappings preserve next-step gap classification', () => {
  for (const entry of listFortressHandlerGenericizationEntries()) {
    if (entry.genericization_status === 'generic_ready') {
      assert.equal(entry.operation_mapping_status, 'directly_mapped', entry.mutation_intent);
    }

    if (entry.genericization_status === 'planner_extraction_needed') {
      assert.equal(
        entry.operation_mapping_status,
        'planner_extraction_gap',
        entry.mutation_intent
      );
    }

    if (entry.genericization_status === 'workflow_specific') {
      assert.equal(
        entry.operation_mapping_status,
        'runtime_workflow_gap',
        entry.mutation_intent
      );
    }

    if (entry.genericization_status === 'legacy_bridge') {
      assert.equal(
        entry.operation_mapping_status,
        'legacy_bridge_gap',
        entry.mutation_intent
      );
    }
  }
});

test('workflow-specific handlers document runtime-owned orchestration reason', () => {
  const workflowEntries = listFortressHandlerGenericizationEntries().filter(
    (entry) => entry.genericization_status === 'workflow_specific'
  );

  assert.ok(workflowEntries.length > 0);
  for (const entry of workflowEntries) {
    assert.ok(entry.notes.length >= 20, entry.mutation_intent);
    assert.ok(entry.next_step.length > 0, entry.mutation_intent);
  }
});
