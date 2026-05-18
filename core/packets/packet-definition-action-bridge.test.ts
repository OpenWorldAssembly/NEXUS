import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getExperimentalPacketTypeDefinition,
  resolvePacketDefinitionMutationActionPlan,
} from '@core/packets/packet-definition-manifest';

test('resolves Preference.element set into a shadow-runtime action plan', () => {
  const definition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(definition);

  const plan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: 'preference.element.set',
  });

  assert.equal(plan.ready_for_shadow_runtime, true);
  assert.equal(plan.packet_type, 'Preference');
  assert.equal(plan.planner?.planner_id, 'preference.element.latest_active_revision.v0');
  assert.deepEqual(plan.policy_action_ids, ['preference.element.write']);
  assert.deepEqual(plan.missing_descriptor_ids, []);
  assert.deepEqual(plan.unsupported_capabilities, []);
  assert.ok(plan.builders.some((builder) => builder.builder_id === 'preference.element.body.v0'));
});

test('reports missing mutation descriptors without throwing during resolution', () => {
  const definition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(definition);

  const plan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: 'preference.element.missing',
  });

  assert.equal(plan.ready_for_shadow_runtime, false);
  assert.deepEqual(plan.missing_descriptor_ids, ['preference.element.missing']);
});
