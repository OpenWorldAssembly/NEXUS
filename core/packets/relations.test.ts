import test from 'node:test';
import assert from 'node:assert/strict';

import { CanonicalRelationSubtypeSchema } from '@core/schema/packet-schema';
import {
  createRelationPacketId,
  createScopedRelationPacket,
  getRelationSemanticProfile,
  resolveSubscriptionAlignment,
} from './relations.ts';

test('relation packet ids are deterministic by subtype, subject, target, and scope', () => {
  const firstId = createRelationPacketId({
    subtype: 'residence',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
  });
  const secondId = createRelationPacketId({
    subtype: 'residence',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
  });

  assert.equal(firstId, secondId);
});

test('scoped relation packets keep the relation scope as the authority scope', () => {
  const packet = createScopedRelationPacket({
    subtype: 'residence',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/moreno-valley',
    scopePacketId: 'nexus:element/moreno-valley',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/person-a',
    note: 'Canonical home locality relation.',
  });

  assert.equal(packet.header.type, 'Relation');
  assert.equal(
    packet.header.authority_scope_ref?.packet_id,
    'nexus:element/moreno-valley'
  );
  assert.equal(packet.body.subtype, 'residence');
  assert.equal(packet.body.target_ref.packet_id, 'nexus:element/moreno-valley');
  assert.equal(packet.body.note, 'Canonical home locality relation.');
});

test('relation revisions preserve compact parent revision refs', () => {
  const packet = createScopedRelationPacket({
    subtype: 'residence',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/moreno-valley',
    scopePacketId: 'nexus:element/moreno-valley',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/person-a',
    status: 'withdrawn',
    packetId: 'nexus:relation/home-locality-test',
    parentRevisionRefs: [
      {
        packet_id: 'nexus:relation/home-locality-test',
        revision_id: 'nexus:relation/home-locality-test@r1',
      },
    ],
  });

  assert.deepEqual(packet.header.parent_revision_refs, [
    {
      packet_id: 'nexus:relation/home-locality-test',
      revision_id: 'nexus:relation/home-locality-test@r1',
    },
  ]);
  assert.equal(packet.header.revision_id, 'nexus:relation/home-locality-test@r2');
});

test('stale policy-adoption and dependency relation subtypes are not canonical relation subtypes', () => {
  assert.equal(CanonicalRelationSubtypeSchema.safeParse('adopts_policy').success, false);
  assert.equal(CanonicalRelationSubtypeSchema.safeParse('depends_on').success, false);
  assert.equal(CanonicalRelationSubtypeSchema.safeParse('subscription').success, true);
});

test('subscription options are preserved on subscription relation packets', () => {
  const policyRef = { packet_id: 'nexus:policy/nonviolence' };
  const packet = createScopedRelationPacket({
    subtype: 'subscription',
    subjectPacketId: 'nexus:element/moreno-valley',
    targetPacketId: 'nexus:action/owa',
    scopePacketId: 'nexus:action/owa',
    createdByPacketId: 'nexus:element/moreno-valley',
    subscriptionOptions: {
      included_policy_refs: [policyRef],
      included_defaults_definition_refs: [{ packet_id: 'nexus:definition/relation.defaults_definition.subscription.v0' }],
      excluded_dependencies_definition_refs: [{ packet_id: 'nexus:definition/relation.dependencies_definition.v0' }],
    },
  });

  assert.equal(packet.body.subtype, 'subscription');
  assert.equal(packet.body.subscription_options?.update_mode, 'manual_review');
  assert.deepEqual(packet.body.subscription_options?.included_policy_refs, [policyRef]);
  assert.equal(
    packet.header.edges.some(
      (edge) =>
        edge.edge_type === 'references' && edge.target.packet_id === policyRef.packet_id
    ),
    true
  );
});

test('relation semantic profiles avoid global civic rank while preserving effective involvement', () => {
  assert.deepEqual(
    {
      follow: getRelationSemanticProfile('follow').effectiveFollow,
      subscribe: getRelationSemanticProfile('subscription').effectiveSubscribe,
      participate: getRelationSemanticProfile('participation').effectiveParticipate,
      associationStanding: getRelationSemanticProfile('association').standingKind,
      associationFollow: getRelationSemanticProfile('association').effectiveFollow,
      residenceStanding: getRelationSemanticProfile('residence').standingKind,
      residenceParticipate: getRelationSemanticProfile('residence').effectiveParticipate,
    },
    {
      follow: true,
      subscribe: true,
      participate: true,
      associationStanding: 'association',
      associationFollow: true,
      residenceStanding: 'residency',
      residenceParticipate: true,
    }
  );
  assert.equal(getRelationSemanticProfile('association').effectiveParticipate, false);
  assert.equal(getRelationSemanticProfile('residence').effectiveSubscribe, true);
});

test('subscription alignment inherits defaults and reports deselected required refs', () => {
  const requiredPolicyRef = { packet_id: 'nexus:policy/nonviolence' };
  const requiredDefaultsDefinitionRef = { packet_id: 'nexus:definition/relation.defaults_definition.subscription.v0' };
  const requiredDependencyRef = { packet_id: 'nexus:definition/relation.dependencies_definition.v0' };
  const aligned = resolveSubscriptionAlignment({
    relationSubtype: 'subscription',
    requiredPolicyRefs: [requiredPolicyRef],
    requiredDefaultsDefinitionRefs: [requiredDefaultsDefinitionRef],
    requiredDependenciesDefinitionRefs: [requiredDependencyRef],
  });

  assert.equal(aligned.alignmentState, 'aligned');
  assert.deepEqual(aligned.inheritedRefs.policy_refs, [requiredPolicyRef]);
  assert.deepEqual(aligned.inheritedRefs.defaults_definition_refs, [requiredDefaultsDefinitionRef]);
  assert.deepEqual(aligned.inheritedRefs.dependencies_definition_refs, [requiredDependencyRef]);

  const partial = resolveSubscriptionAlignment({
    relationSubtype: 'subscription',
    requiredPolicyRefs: [requiredPolicyRef],
    requiredDefaultsDefinitionRefs: [requiredDefaultsDefinitionRef],
    requiredDependenciesDefinitionRefs: [requiredDependencyRef],
    subscriptionOptions: {
      excluded_policy_refs: [requiredPolicyRef],
      excluded_defaults_definition_refs: [requiredDefaultsDefinitionRef],
      excluded_dependencies_definition_refs: [requiredDependencyRef],
    },
  });

  assert.equal(partial.alignmentState, 'partially_aligned');
  assert.equal(partial.warnings.length, 3);
});
