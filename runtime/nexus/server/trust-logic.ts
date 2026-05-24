/**
 * File: trust-logic.ts
 * Description: Pure trust-stage and threshold helpers shared by Nexus trust projections.
 */

export type NexusTrustStageId =
  | 'self_claimed'
  | 'emerging'
  | 'recognized'
  | 'role_eligible';

export type NexusTrustPolicySnapshot = {
  association_support_threshold: number;
  role_support_threshold: number;
  posting_gate: NexusTrustStageId;
  voting_gate: NexusTrustStageId;
  review_gate: NexusTrustStageId;
};

export const DEFAULT_TRUST_POLICY_SNAPSHOT: NexusTrustPolicySnapshot = {
  association_support_threshold: 1,
  role_support_threshold: 2,
  posting_gate: 'emerging',
  voting_gate: 'recognized',
  review_gate: 'role_eligible',
};

const TRUST_STAGE_ORDER: NexusTrustStageId[] = [
  'self_claimed',
  'emerging',
  'recognized',
  'role_eligible',
];

export function getTrustStageRank(stage: NexusTrustStageId): number {
  return TRUST_STAGE_ORDER.indexOf(stage);
}

export function meetsTrustGate(
  stage: NexusTrustStageId,
  requiredStage: NexusTrustStageId
): boolean {
  return getTrustStageRank(stage) >= getTrustStageRank(requiredStage);
}

export function deriveTrustStage(input: {
  has_association_relation: boolean;
  association_support_count: number;
  claimed_role_count: number;
  supported_role_count: number;
  thresholds: NexusTrustPolicySnapshot;
}): NexusTrustStageId {
  if (!input.has_association_relation) {
    return 'self_claimed';
  }

  if (input.supported_role_count >= 1) {
    return 'role_eligible';
  }

  if (
    input.association_support_count >=
    input.thresholds.association_support_threshold
  ) {
    return 'recognized';
  }

  if (
    input.claimed_role_count > 0 ||
    input.association_support_count > 0 ||
    input.has_association_relation
  ) {
    return 'emerging';
  }

  return 'self_claimed';
}
