/**
 * File: packet-defaults.test.ts
 * Description: Verifies default-definition parts and policy override projection.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createPolicyPacket } from '@core/packets/builders';
import {
  getDefinedPacketTypeDefinition,
  listDefinedPacketTypeDefinitions,
  listPacketDefinitionDefaults,
  resolvePacketDefaultProfile,
} from '@core/packets/packet-definition-manifest';

test('every packet definition exposes at least one default-definition part', () => {
  for (const definition of listDefinedPacketTypeDefinitions()) {
    assert.ok(
      listPacketDefinitionDefaults(definition).length > 0,
      definition.packet_type
    );
  }
});

test('relation subscription defaults carry inheritance posture', () => {
  const relationDefinition = getDefinedPacketTypeDefinition('Relation');
  assert.ok(relationDefinition);

  const profile = resolvePacketDefaultProfile({
    definition: relationDefinition,
    packet_subtype: 'subscription',
  });

  assert.equal(profile.resolved_values.subtype, 'subscription');
  assert.equal(
    (profile.resolved_values.subscription_options as Record<string, unknown>)
      .inherit_default_policies,
    true
  );
  assert.equal(
    (profile.resolved_values.subscription_options as Record<string, unknown>)
      .inherit_default_dependencies,
    true
  );
});

test('policy default sections can reference default definitions and override resolved values', () => {
  const relationDefinition = getDefinedPacketTypeDefinition('Relation');
  assert.ok(relationDefinition);

  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/default-definition-override-test',
    created_at: '2026-05-24T00:00:00.000Z',
    title: 'Default definition override test',
    subtype: 'default_inheritance',
    body_markdown: 'Test policy for packet-default projection.',
    status: 'active',
    default_policy: {
      policy_refs: [],
      template_refs: [],
      defaults_definition_refs: [
        { packet_id: 'nexus:definition/relation/relation-defaults-definition-subscription-v0' },
      ],
      default_packet_set_refs: [],
      preference_refs: [],
      overrides: [
        {
          path: 'subscription_options.local_behavior.require_local_ratification',
          value: true,
          reason: 'test override',
        },
      ],
    },
  });

  const profile = resolvePacketDefaultProfile({
    definition: relationDefinition,
    packet_subtype: 'subscription',
    policy_packets: [policy],
  });
  const subscriptionOptions = profile.resolved_values
    .subscription_options as Record<string, unknown>;
  const localBehavior = subscriptionOptions.local_behavior as Record<string, unknown>;

  assert.deepEqual(profile.policy_defaults_definition_refs, [
    { packet_id: 'nexus:definition/relation/relation-defaults-definition-subscription-v0' },
  ]);
  assert.equal(localBehavior.require_local_ratification, true);
});

test('OWA domain defaults are resolved for Action, Proposal, and Decision packet families', () => {
  const actionDefinition = getDefinedPacketTypeDefinition('Action');
  const proposalDefinition = getDefinedPacketTypeDefinition('Proposal');
  const decisionDefinition = getDefinedPacketTypeDefinition('Decision');
  assert.ok(actionDefinition);
  assert.ok(proposalDefinition);
  assert.ok(decisionDefinition);

  const actionProfile = resolvePacketDefaultProfile({
    definition: actionDefinition,
    packet_subtype: 'initiative',
  });
  const proposalProfile = resolvePacketDefaultProfile({
    definition: proposalDefinition,
    packet_subtype: 'proposal',
  });
  const decisionProfile = resolvePacketDefaultProfile({
    definition: decisionDefinition,
    packet_subtype: 'decision',
  });

  assert.equal(actionProfile.resolved_values.status, 'active');
  assert.equal(actionProfile.resolved_values.owa_default_role, 'initiative_anchor');
  assert.deepEqual(actionProfile.resolved_values.policy_refs, []);
  assert.equal(proposalProfile.resolved_values.status, 'draft');
  assert.equal(
    proposalProfile.resolved_values.default_vote_behavior,
    'reaction_or_governance_policy_defined'
  );
  assert.equal(decisionProfile.resolved_values.outcome, 'recorded');
  assert.equal(decisionProfile.resolved_values.proposal_ref, null);
});

test('discussion subtype defaults do not absorb workflow-only surface recipes', () => {
  const discussionDefinition = getDefinedPacketTypeDefinition('Discussion');
  assert.ok(discussionDefinition);

  const postProfile = resolvePacketDefaultProfile({
    definition: discussionDefinition,
    packet_subtype: 'post',
  });
  const allDiscussionDefaults = listPacketDefinitionDefaults(discussionDefinition);

  assert.equal(postProfile.resolved_values.subtype, 'post');
  assert.equal(postProfile.resolved_values.role, 'forum_post');
  assert.equal(postProfile.resolved_values.default_profiles, undefined);
  assert.ok(
    allDiscussionDefaults.some(
      (descriptor) =>
        descriptor.default_id === 'discussion.defaults_definition.element_surface_recipe.v0'
    )
  );
});
