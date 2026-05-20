import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createActionPacket,
  createAttestationPacket,
  createCausePacket,
  createClaimPacket,
  createPolicyPacket,
  createRelationPacket,
} from '@core/packets/builders';

import {
  collectPoliciesForCauseAnchor,
  evaluateRelationPolicyRequirements,
  listAttestationsTargetingClaim,
} from './relation-policy.ts';

test('relation policy evaluation recognizes a supporting home-locality claim from an OWA cause-linked policy', () => {
  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/owa-home-locality',
    created_at: '2026-05-07T00:00:00.000Z',
    title: 'OWA home locality policy',
    policy_kind: 'charter',
    body_markdown: 'Require a relation assertion claim for home locality relations.',
    status: 'active',
    relation_requirements: {
      rules: [
        {
          relation_subtype: 'home_locality',
          required_claim_subtypes: ['relation_assertion'],
          required_attestation_subtypes: [],
          claim_target_mode: 'relation_packet',
          subject_match_mode: 'relation_subject',
        },
      ],
    },
  });
  const owaCause = createCausePacket({
    packet_id: 'nexus:cause/owa',
    created_at: '2026-05-07T00:01:00.000Z',
    subtype: 'initiative',
    title: 'OWA',
    status: 'active',
    policy_refs: [{ packet_id: policy.header.packet_id }],
  });
  const relation = createRelationPacket({
    packet_id: 'nexus:relation/home-locality/alice',
    created_at: '2026-05-07T00:02:00.000Z',
    subtype: 'home_locality',
    subject_ref: { packet_id: 'nexus:element/person/alice' },
    target_ref: { packet_id: 'nexus:element/moreno-valley' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
  });
  const supportingClaim = createClaimPacket({
    packet_id: 'nexus:claim/home-locality/alice',
    created_at: '2026-05-07T00:03:00.000Z',
    subtype: 'relation_assertion',
    target_ref: { packet_id: relation.header.packet_id },
    subject_ref: { packet_id: 'nexus:element/person/alice' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    relation_assertion: {
      subtype: 'home_locality',
      subject_ref: { packet_id: 'nexus:element/person/alice' },
      target_ref: { packet_id: 'nexus:element/moreno-valley' },
      scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    },
    claim_kind: 'home_locality',
    claim_markdown: 'Alice asserts this home-locality relation.',
  });

  const policies = collectPoliciesForCauseAnchor({
    anchorPacket: owaCause,
    policyPackets: [policy],
  });
  const evaluation = evaluateRelationPolicyRequirements({
    relationPacket: relation,
    policyPackets: policies,
    claimPackets: [supportingClaim],
  });

  assert.equal(policies.length, 1);
  assert.equal(evaluation.matched_rule_count, 1);
  assert.equal(evaluation.satisfied_rule_count, 1);
  assert.equal(evaluation.evaluation_state, 'satisfied');
  assert.equal(evaluation.is_satisfied, true);
  assert.deepEqual(evaluation.evaluations[0]?.supporting_claim_packet_ids, [
    supportingClaim.header.packet_id,
  ]);
});

test('relation policy collection supports the forward Action initiative anchor', () => {
  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/owa-home-locality',
    created_at: '2026-05-07T00:05:00.000Z',
    title: 'OWA home locality policy',
    policy_kind: 'charter',
    body_markdown: 'Require a relation assertion claim for home locality relations.',
    status: 'active',
  });
  const owaAction = createActionPacket({
    packet_id: 'nexus:action/owa',
    created_at: '2026-05-07T00:06:00.000Z',
    subtype: 'initiative',
    title: 'OWA',
    status: 'active',
    policy_refs: [{ packet_id: policy.header.packet_id }],
  });

  const policies = collectPoliciesForCauseAnchor({
    anchorPacket: owaAction,
    policyPackets: [policy],
  });

  assert.deepEqual(
    policies.map((packet) => packet.header.packet_id),
    [policy.header.packet_id]
  );
});

test('relation policy evaluation fails when the supporting claim subject does not match the relation subject', () => {
  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/owa-home-locality',
    created_at: '2026-05-07T00:10:00.000Z',
    title: 'OWA home locality policy',
    policy_kind: 'charter',
    body_markdown: 'Require a matching relation assertion claim.',
    status: 'active',
    relation_requirements: {
      rules: [
        {
          relation_subtype: 'home_locality',
          required_claim_subtypes: ['relation_assertion'],
          required_attestation_subtypes: [],
          claim_target_mode: 'relation_packet',
          subject_match_mode: 'relation_subject',
        },
      ],
    },
  });
  const relation = createRelationPacket({
    packet_id: 'nexus:relation/home-locality/alice',
    created_at: '2026-05-07T00:11:00.000Z',
    subtype: 'home_locality',
    subject_ref: { packet_id: 'nexus:element/person/alice' },
    target_ref: { packet_id: 'nexus:element/moreno-valley' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
  });
  const mismatchedClaim = createClaimPacket({
    packet_id: 'nexus:claim/home-locality/bob',
    created_at: '2026-05-07T00:12:00.000Z',
    subtype: 'relation_assertion',
    target_ref: { packet_id: relation.header.packet_id },
    subject_ref: { packet_id: 'nexus:element/person/bob' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    relation_assertion: {
      subtype: 'home_locality',
      subject_ref: { packet_id: 'nexus:element/person/bob' },
      target_ref: { packet_id: 'nexus:element/moreno-valley' },
      scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    },
    claim_kind: 'home_locality',
  });

  const evaluation = evaluateRelationPolicyRequirements({
    relationPacket: relation,
    policyPackets: [policy],
    claimPackets: [mismatchedClaim],
  });

  assert.equal(evaluation.evaluation_state, 'unsatisfied');
  assert.equal(evaluation.is_satisfied, false);
  assert.deepEqual(evaluation.evaluations[0]?.supporting_claim_packet_ids, []);
});

test('relation policy evaluation distinguishes not-applicable relations from satisfied ones', () => {
  const relation = createRelationPacket({
    packet_id: 'nexus:relation/alice-follows-owa',
    created_at: '2026-05-07T00:15:00.000Z',
    subtype: 'follows',
    subject_ref: { packet_id: 'nexus:element/person/alice' },
    target_ref: { packet_id: 'nexus:cause/owa' },
  });

  const evaluation = evaluateRelationPolicyRequirements({
    relationPacket: relation,
    policyPackets: [],
    claimPackets: [],
  });

  assert.equal(evaluation.matched_rule_count, 0);
  assert.equal(evaluation.satisfied_rule_count, 0);
  assert.equal(evaluation.evaluation_state, 'not_applicable');
  assert.equal(evaluation.is_satisfied, false);
});

test('claim-targeting attestations can be discovered without changing the attestation service model', () => {
  const claim = createClaimPacket({
    packet_id: 'nexus:claim/home-locality/alice',
    created_at: '2026-05-07T00:20:00.000Z',
    subtype: 'relation_assertion',
    target_ref: { packet_id: 'nexus:relation/home-locality/alice' },
    subject_ref: { packet_id: 'nexus:element/person/alice' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    relation_assertion: {
      subtype: 'home_locality',
      subject_ref: { packet_id: 'nexus:element/person/alice' },
      target_ref: { packet_id: 'nexus:element/moreno-valley' },
      scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    },
    claim_kind: 'home_locality',
  });
  const attestation = createAttestationPacket({
    packet_id: 'nexus:attestation/claim-support/alice',
    created_at: '2026-05-07T00:21:00.000Z',
    subtype: 'claim_support',
    target_ref: { packet_id: claim.header.packet_id },
    value: 1,
    attestation_kind: 'claim_support',
  });

  const matchingAttestations = listAttestationsTargetingClaim({
    claimPacket: claim,
    attestationPackets: [attestation],
    attestationSubtype: 'claim_support',
  });

  assert.deepEqual(matchingAttestations.map((packet) => packet.header.packet_id), [
    attestation.header.packet_id,
  ]);
});
