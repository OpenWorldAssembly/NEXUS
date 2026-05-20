/**
 * File: packet-runtime-modernization-audit.test.ts
 * Description: Verifies runtime modernization audits cover live mutation intents and connectors.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listMutationRuntimeModernizationCoverage,
  listPacketFamilyRuntimeModernizationCoverage,
  listPacketTypeRuntimeModernizationCoverage,
} from '@runtime/nexus/server/packet-runtime-modernization-audit';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';

test('runtime mutation modernization coverage includes every live intent', () => {
  const coveredIntents = listMutationRuntimeModernizationCoverage()
    .map((entry) => entry.mutation_intent)
    .sort();
  const registeredIntents = listMutationIntentDescriptors()
    .map((descriptor) => descriptor.kind)
    .sort();

  assert.deepEqual(coveredIntents, registeredIntents);
});

test('runtime mutation modernization coverage maps handlers, policy actions, and corridor status', () => {
  const coverage = listMutationRuntimeModernizationCoverage();

  for (const entry of coverage) {
    assert.ok(entry.prepare_handler.length > 0);
    assert.ok(entry.finalize_handler.length > 0);
    assert.ok(
      entry.policy_action_ids.length > 0,
      `${entry.mutation_intent} should report policy action ids`
    );
    assert.equal(entry.signed_corridor_status, 'enrolled');
    assert.equal(entry.master_handler_connector_status, 'planned_gap');
    assert.equal(entry.connector_ids.length, 0);
    assert.equal(entry.planned_gaps.length, 1);
    assert.equal(entry.planned_gaps[0].area, 'master_handler_connector');
    assert.ok(entry.planned_gaps[0].reason.length > 0);
  }
});

test('Preference.element direct master-handler connector is no longer live-enrolled', () => {
  const preferenceCoverage = listPacketFamilyRuntimeModernizationCoverage().find(
    (entry) => entry.family === 'Preference'
  );

  assert.ok(preferenceCoverage);
  assert.equal(
    preferenceCoverage.runtime_connector_status,
    'planned_gap'
  );
  assert.deepEqual(preferenceCoverage.runtime_connector_ids, []);
});

test('packet-type runtime coverage treats Definition and Bundle as canonical packet types', () => {
  const coverageByPacketType = new Map(
    listPacketTypeRuntimeModernizationCoverage().map((entry) => [
      entry.packet_type,
      entry,
    ])
  );

  for (const packetType of ['Definition', 'Bundle']) {
    const entry = coverageByPacketType.get(packetType);
    assert.ok(entry);
    assert.equal(entry.body_builder_status, 'supported');
    assert.equal(entry.shadow_mutation_plan_status, 'supported');
    assert.equal(entry.runtime_connector_status, 'planned_gap');
  }

  const preferenceEntry = coverageByPacketType.get('Preference');
  assert.ok(preferenceEntry);
  assert.equal(preferenceEntry.runtime_connector_status, 'planned_gap');
  assert.deepEqual(preferenceEntry.runtime_connector_ids, []);
});

test('non-enrolled runtime families explain connector modernization gaps', () => {
  const coverage = listPacketFamilyRuntimeModernizationCoverage();

  for (const entry of coverage) {
    if (entry.runtime_connector_status === 'master_handler_enrolled') {
      continue;
    }

    assert.ok(
      entry.planned_gaps.some((gap) => gap.area === 'runtime_connector'),
      `${entry.family} should classify runtime connector enrollment as planned work`
    );
  }
});
