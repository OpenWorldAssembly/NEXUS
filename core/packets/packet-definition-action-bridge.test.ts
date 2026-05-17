import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getExperimentalPacketTypeDefinition,
  resolvePacketDefinitionMutationActionPlan,
} from '@core/packets/packet-definition-manifest';

test('resolves Preference.scope_display set into a shadow-runtime action plan', () => {
  const definition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(definition);

  const plan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: 'preference.scope_display.set',
  });

  assert.equal(plan.ready_for_shadow_runtime, true);
  assert.equal(plan.packet_type, 'Preference');
  assert.equal(plan.planner?.planner_id, 'preference.scope_display.latest_active_revision.v0');
  assert.deepEqual(plan.policy_action_ids, ['preference.scope_display.write']);
  assert.deepEqual(plan.missing_descriptor_ids, []);
  assert.deepEqual(plan.unsupported_capabilities, []);
  assert.ok(plan.builders.some((builder) => builder.builder_id === 'preference.scope_display.body.v0'));
});

test('reports missing mutation descriptors without throwing during resolution', () => {
  const definition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(definition);

  const plan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: 'preference.scope_display.missing',
  });

  assert.equal(plan.ready_for_shadow_runtime, false);
  assert.deepEqual(plan.missing_descriptor_ids, ['preference.scope_display.missing']);
});
