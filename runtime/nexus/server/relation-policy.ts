/**
 * File: relation-policy.ts
 * Description: Narrow runtime helpers for evaluating policy-driven Claim/Attestation support around Relation packets.
 */

import type { PacketEnvelopeByType, PacketRef } from '@core/schema/packet-schema';

import {
  filterClaimPackets,
  listRelationSupportingClaims,
  type ClaimPacket,
} from '@runtime/nexus/server/claim-utils';

export type RelationPolicyRule =
  NonNullable<PacketEnvelopeByType['Policy']['body']['relation_requirements']>['rules'][number];

export type RelationRequirementRuleEvaluation = {
  rule: RelationPolicyRule;
  satisfied: boolean;
  supporting_claim_packet_ids: string[];
  supporting_attestation_packet_ids: string[];
};

export type RelationPolicyEvaluation = {
  relation_packet_id: string;
  relation_subtype: string;
  governing_policy_packet_ids: string[];
  matched_rule_count: number;
  satisfied_rule_count: number;
  evaluation_state: 'not_applicable' | 'satisfied' | 'unsatisfied';
  is_satisfied: boolean;
  evaluations: RelationRequirementRuleEvaluation[];
};

type RelationPacket = PacketEnvelopeByType['Relation'];
type PolicyPacket = PacketEnvelopeByType['Policy'];
type AttestationPacket = PacketEnvelopeByType['Attestation'];
type PolicyAnchorPacket = PacketEnvelopeByType['Action'];

function matchesClaimTargetMode(input: {
  claimPacket: ClaimPacket;
  relationPacket: RelationPacket;
  mode: RelationPolicyRule['claim_target_mode'];
}): boolean {
  switch (input.mode) {
    case 'relation_packet':
      return input.claimPacket.body.target_ref.packet_id === input.relationPacket.header.packet_id;
    case 'relation_target':
      return (
        input.claimPacket.body.target_ref.packet_id ===
        input.relationPacket.body.target_ref.packet_id
      );
    case 'any':
      return true;
  }
}

function matchesSubjectMode(input: {
  claimPacket: ClaimPacket;
  relationPacket: RelationPacket;
  mode: RelationPolicyRule['subject_match_mode'];
}): boolean {
  switch (input.mode) {
    case 'any':
      return true;
    case 'relation_subject':
      return (
        input.claimPacket.body.subject_ref?.packet_id ===
          input.relationPacket.body.subject_ref.packet_id ||
        input.claimPacket.body.relation_assertion?.subject_ref.packet_id ===
          input.relationPacket.body.subject_ref.packet_id
      );
  }
}

export function listAttestationsTargetingClaim(input: {
  claimPacket: ClaimPacket;
  attestationPackets: AttestationPacket[];
  attestationSubtype?: string | null;
  activeOnly?: boolean;
}): AttestationPacket[] {
  return input.attestationPackets.filter((attestationPacket) => {
    if (input.activeOnly !== false && attestationPacket.body.status !== 'active') {
      return false;
    }

    if (attestationPacket.body.target_ref.packet_id !== input.claimPacket.header.packet_id) {
      return false;
    }

    if (
      input.attestationSubtype &&
      attestationPacket.body.subtype !== input.attestationSubtype &&
      attestationPacket.body.subtype !== input.attestationSubtype
    ) {
      return false;
    }

    return true;
  });
}

export function getPolicyAnchorRefs(anchorPacket: PolicyAnchorPacket): PacketRef[] {
  if (anchorPacket.header.type === 'Action') {
    return anchorPacket.body.policy_refs ?? [];
  }

  return [];
}

export function getActionPolicyRefs(anchorPacket: PolicyAnchorPacket): PacketRef[] {
  return getPolicyAnchorRefs(anchorPacket);
}

export function collectPoliciesForActionAnchor(input: {
  anchorPacket: PolicyAnchorPacket;
  policyPackets: PolicyPacket[];
}): PolicyPacket[] {
  const policyPacketIdSet = new Set(
    getPolicyAnchorRefs(input.anchorPacket).map((policyRef) => policyRef.packet_id)
  );

  return input.policyPackets.filter((policyPacket) =>
    policyPacketIdSet.has(policyPacket.header.packet_id)
  );
}

export function collectPoliciesForPolicyAnchor(input: {
  anchorPacket: PolicyAnchorPacket;
  policyPackets: PolicyPacket[];
}): PolicyPacket[] {
  return collectPoliciesForActionAnchor(input);
}

export function evaluateRelationPolicyRequirements(input: {
  relationPacket: RelationPacket;
  policyPackets: PolicyPacket[];
  claimPackets: ClaimPacket[];
  attestationPackets?: AttestationPacket[];
}): RelationPolicyEvaluation {
  const matchingRules = input.policyPackets.flatMap((policyPacket) =>
    (policyPacket.body.relation_requirements?.rules ?? []).filter(
      (rule) => rule.relation_subtype === input.relationPacket.body.subtype
    )
  );

  const evaluations = matchingRules.map((rule) => {
    const baseClaims =
      rule.claim_target_mode === 'relation_packet'
        ? listRelationSupportingClaims({
            claims: input.claimPackets,
            relationPacketId: input.relationPacket.header.packet_id,
            claimSubtype: null,
            activeOnly: true,
          })
        : filterClaimPackets({
            claims: input.claimPackets,
            activeOnly: true,
          });

    const candidateClaims = baseClaims.filter((claimPacket) => {
      if (
        rule.required_claim_subtypes.length > 0 &&
        !rule.required_claim_subtypes.includes(claimPacket.body.subtype)
      ) {
        return false;
      }

      if (
        !matchesClaimTargetMode({
          claimPacket,
          relationPacket: input.relationPacket,
          mode: rule.claim_target_mode,
        })
      ) {
        return false;
      }

      if (
        !matchesSubjectMode({
          claimPacket,
          relationPacket: input.relationPacket,
          mode: rule.subject_match_mode,
        })
      ) {
        return false;
      }

      return true;
    });

    const matchingAttestations =
      rule.required_attestation_subtypes.length === 0
        ? []
        : candidateClaims.flatMap((claimPacket) =>
            rule.required_attestation_subtypes.flatMap((requiredSubtype) =>
              listAttestationsTargetingClaim({
                claimPacket,
                attestationPackets: input.attestationPackets ?? [],
                attestationSubtype: requiredSubtype,
                activeOnly: true,
              })
            )
          );

    const satisfied =
      candidateClaims.length > 0 &&
      (rule.required_attestation_subtypes.length === 0 ||
        matchingAttestations.length > 0);

    return {
      rule,
      satisfied,
      supporting_claim_packet_ids: candidateClaims.map(
        (claimPacket) => claimPacket.header.packet_id
      ),
      supporting_attestation_packet_ids: matchingAttestations.map(
        (attestationPacket) => attestationPacket.header.packet_id
      ),
    } satisfies RelationRequirementRuleEvaluation;
  });

  const satisfiedRuleCount = evaluations.filter((evaluation) => evaluation.satisfied).length;
  const evaluationState: RelationPolicyEvaluation['evaluation_state'] =
    evaluations.length === 0
      ? 'not_applicable'
      : satisfiedRuleCount === evaluations.length
        ? 'satisfied'
        : 'unsatisfied';

  return {
    relation_packet_id: input.relationPacket.header.packet_id,
    relation_subtype: input.relationPacket.body.subtype,
    governing_policy_packet_ids: input.policyPackets.map(
      (policyPacket) => policyPacket.header.packet_id
    ),
    matched_rule_count: evaluations.length,
    satisfied_rule_count: satisfiedRuleCount,
    evaluation_state: evaluationState,
    is_satisfied: evaluationState === 'satisfied',
    evaluations,
  };
}
