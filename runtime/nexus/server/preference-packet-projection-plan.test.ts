import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElementPreferenceDefinitionSetPlan } from '@runtime/nexus/server/preference-packet-definition';

test('creates a definition Dispatch-compatible plan for Preference.element', () => {
  const plan = createElementPreferenceDefinitionSetPlan({
    actorPacketId: 'nexus:element/person-alice',
    preferences: {
      main_visible_scope_packet_ids: ['nexus:element/locality-city', 'nexus:element/locality-city'],
      show_associated_parent_chains: true,
      show_followed_parent_chains: false,
    },
    context: {
      namespace: 'nexus',
      surface_key: 'shell',
    },
  });

  assert.equal(plan.packet_type, 'Preference');
  assert.equal(plan.packet_subtype, 'element');
  assert.equal(plan.mutation_intent, 'preference.element.set');
  assert.equal(plan.external_definition_execution_enabled, false);
  assert.equal(plan.action_plan.ready_for_runtime, true);
  assert.deepEqual(plan.action_plan.policy_action_ids, ['preference.element.write']);
  assert.deepEqual(plan.projected_runtime_preferences, {
    main_visible_scope_packet_ids: ['nexus:element/locality-city'],
    show_associated_parent_chains: true,
    show_followed_parent_chains: false,
  });
  assert.match(plan.packet_id, /^nexus:preference\/element\//);
});
