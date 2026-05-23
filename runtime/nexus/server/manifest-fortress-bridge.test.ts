import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createPreferenceElementManifestDefinitionFortressPlan,
  resolveManifestDefinitionFortressActionPlan,
} from '@runtime/nexus/server/manifest-fortress-bridge';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';

test('resolves a Preference.element manifest action into a definition fortress plan', () => {
  const plan = createPreferenceElementManifestDefinitionFortressPlan({
    actorPacketId: 'nexus:element/person-alice',
    preferences: {
      main_visible_scope_packet_ids: ['scope-b', 'scope-a', 'scope-a'],
      show_associated_parent_chains: true,
      show_followed_parent_chains: false,
    },
    context: {
      namespace: 'nexus',
      surface_key: 'shell',
    },
  });

  assert.equal(plan.bridge_kind, 'preference.element.fortress_prepare');
  assert.equal(plan.ready_for_definition_prepare, true);
  assert.equal(plan.external_definition_execution_enabled, false);
  assert.equal(plan.action_plan.supported, true);
  assert.equal(plan.action_plan.planner_id, 'preference.element.latest_active_revision.v0');
  assert.deepEqual(plan.action_plan.builder_ids, ['preference.element.body.v0']);
  assert.deepEqual(plan.action_plan.policy_action_ids, ['preference.element.write']);
  assert.equal(plan.packet_candidate.current_packet_envelope_supported, true);
  assert.equal(plan.packet_candidate.live_signed_corridor_enrolled, false);
  assert.match(plan.packet_candidate.unsigned_digest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(plan.projected_runtime_preferences, {
    main_visible_scope_packet_ids: ['scope-a', 'scope-b'],
    show_associated_parent_chains: true,
    show_followed_parent_chains: false,
  });
  assert.equal(plan.prepare_shape.live_ticket_ready, false);
});

test('reports unsupported manifest planner capabilities without throwing', () => {
  const plan = resolveManifestDefinitionFortressActionPlan({
    packet_type: 'Preference',
    packet_subtype: 'element',
    mutation_intent: 'preference.element.set',
    capabilities: {
      action_kinds: ['create', 'revise'],
      builder_kinds: ['single_packet_body'],
      planner_kinds: ['projection_only'],
    },
  });

  assert.equal(plan.definition_found, true);
  assert.equal(plan.subtype_supported, true);
  assert.equal(plan.supported, false);
  assert.ok(plan.reason_codes.includes('unsupported:planner_kind:single_packet_revision'));
});

test('refuses unknown packet types, subtypes, and mutation descriptors cleanly', () => {
  const unknownPacketType = resolveManifestDefinitionFortressActionPlan({
    packet_type: 'Signal',
    packet_subtype: 'signal',
    mutation_intent: 'signal.generic.write',
  });
  const unknownSubtype = resolveManifestDefinitionFortressActionPlan({
    packet_type: 'Preference',
    packet_subtype: 'unknown_subtype',
    mutation_intent: 'preference.element.set',
  });
  const unknownMutation = resolveManifestDefinitionFortressActionPlan({
    packet_type: 'Preference',
    packet_subtype: 'element',
    mutation_intent: 'preference.unknown.set',
  });

  assert.equal(unknownPacketType.supported, false);
  assert.deepEqual(unknownPacketType.reason_codes, ['unknown_packet_type']);
  assert.equal(unknownSubtype.supported, false);
  assert.ok(unknownSubtype.reason_codes.includes('unknown_packet_subtype'));
  assert.equal(unknownMutation.supported, false);
  assert.ok(unknownMutation.reason_codes.includes('missing_descriptor:preference.unknown.set'));
});

test('enrolls Preference set but keeps withdraw out of the external definition execution intent registry', () => {
  const liveKinds = listMutationIntentDescriptors().map((descriptor) => descriptor.kind as string);

  assert.equal(liveKinds.includes('preference.element.set'), true);
  assert.equal(liveKinds.includes('preference.element.withdraw'), false);
});
