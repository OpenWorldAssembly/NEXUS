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
    subtype: 'home_locality',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
  });
  const secondId = createRelationPacketId({
    subtype: 'home_locality',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
  });

  assert.equal(firstId, secondId);
});

test('scoped relation packets keep the relation scope as the authority scope', () => {
  const packet = createScopedRelationPacket({
    subtype: 'home_locality',
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
  assert.equal(packet.body.subtype, 'home_locality');
  assert.equal(packet.body.target_ref.packet_id, 'nexus:element/moreno-valley');
  assert.equal(packet.body.note, 'Canonical home locality relation.');
});

test('relation revisions preserve compact parent revision refs', () => {
  const packet = createScopedRelationPacket({
    subtype: 'home_locality',
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
  assert.equal(CanonicalRelationSubtypeSchema.safeParse('subscribes_to').success, true);
});

test('subscription options are preserved on subscribes_to relation packets', () => {
  const policyRef = { packet_id: 'nexus:policy/nonviolence' };
  const packet = createScopedRelationPacket({
    subtype: 'subscribes_to',
    subjectPacketId: 'nexus:element/moreno-valley',
    targetPacketId: 'nexus:action/owa',
    scopePacketId: 'nexus:action/owa',
    createdByPacketId: 'nexus:element/moreno-valley',
    subscriptionOptions: {
      included_policy_refs: [policyRef],
      excluded_dependency_refs: [{ packet_id: 'nexus:bundle/legacy-defaults' }],
    },
  });

  assert.equal(packet.body.subtype, 'subscribes_to');
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
      follow: getRelationSemanticProfile('follows').effectiveFollow,
      subscribe: getRelationSemanticProfile('subscribes_to').effectiveSubscribe,
      participate: getRelationSemanticProfile('participates_in').effectiveParticipate,
      associationStanding: getRelationSemanticProfile('association').standingKind,
      residenceStanding: getRelationSemanticProfile('home_locality').standingKind,
    },
    {
      follow: true,
      subscribe: true,
      participate: true,
      associationStanding: 'association',
      residenceStanding: 'residency',
    }
  );
  assert.equal(getRelationSemanticProfile('association').effectiveParticipate, false);
  assert.equal(getRelationSemanticProfile('home_locality').effectiveSubscribe, false);
});

test('subscription alignment inherits defaults and reports deselected required refs', () => {
  const requiredPolicyRef = { packet_id: 'nexus:policy/nonviolence' };
  const requiredDependencyRef = { packet_id: 'nexus:bundle/owa-baseline' };
  const aligned = resolveSubscriptionAlignment({
    relationSubtype: 'subscribes_to',
    requiredPolicyRefs: [requiredPolicyRef],
    requiredDependencyRefs: [requiredDependencyRef],
  });

  assert.equal(aligned.alignmentState, 'aligned');
  assert.deepEqual(aligned.inheritedRefs.policy_refs, [requiredPolicyRef]);
  assert.deepEqual(aligned.inheritedRefs.dependency_refs, [requiredDependencyRef]);

  const partial = resolveSubscriptionAlignment({
    relationSubtype: 'subscribes_to',
    requiredPolicyRefs: [requiredPolicyRef],
    requiredDependencyRefs: [requiredDependencyRef],
    subscriptionOptions: {
      excluded_policy_refs: [requiredPolicyRef],
      excluded_dependency_refs: [requiredDependencyRef],
    },
  });

  assert.equal(partial.alignmentState, 'partially_aligned');
  assert.equal(partial.warnings.length, 2);
});
