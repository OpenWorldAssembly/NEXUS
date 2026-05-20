/**
 * File: write-policy.ts
 * Description: Resolves typed write-lock policies and required proof levels for canonical mutation actions.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';

import {
  describeWriteProofLevel,
  doesProofBundleSatisfyRequirement,
  getAcceptedProofMethodsForLevel,
  maxWriteProofLevel,
  normalizeProofMethods,
  type MutationProofMethod,
  type MutationProofBundle,
  type WriteProofLevel,
} from '@core/auth/proof-types';

export type MutationActionId =
  | 'discussion.thread.create'
  | 'discussion.post.create'
  | 'discussion.reply.create'
  | 'attestation.packet_signal.set'
  | 'attestation.packet_signal.clear'
  | 'role_association.claim.set'
  | 'role_association.claim.withdraw'
  | 'role_association.attestation.support'
  | 'role_association.attestation.dispute'
  | 'role_association.attestation.clear'
  | 'assembly_association.relation.set'
  | 'assembly_association.relation.clear'
  | 'home_locality.relation.set'
  | 'home_locality.relation.clear'
  | 'follows.relation.set'
  | 'follows.relation.clear'
  | 'locality.element.create'
  | 'assembly.element.create'
  | 'discussion.surfaces.ensure'
  | 'actor.write_policy.update';

export const DEFAULT_MUTATION_PROOF_LEVEL: WriteProofLevel = 'session';
export const WRITE_LOCK_POLICY_KIND = 'write_lock';
export const MUTATION_ACTION_IDS = [
  'discussion.thread.create',
  'discussion.post.create',
  'discussion.reply.create',
  'attestation.packet_signal.set',
  'attestation.packet_signal.clear',
  'role_association.claim.set',
  'role_association.claim.withdraw',
  'role_association.attestation.support',
  'role_association.attestation.dispute',
  'role_association.attestation.clear',
  'assembly_association.relation.set',
  'assembly_association.relation.clear',
  'home_locality.relation.set',
  'home_locality.relation.clear',
  'follows.relation.set',
  'follows.relation.clear',
  'locality.element.create',
  'assembly.element.create',
  'discussion.surfaces.ensure',
  'actor.write_policy.update',
] as const satisfies readonly MutationActionId[];

export interface ResolvedWritePolicyDecision {
  action_ids: MutationActionId[];
  required_proof_level: WriteProofLevel;
  accepted_proof_methods: MutationProofMethod[];
  source_policy_packet_ids: string[];
}

function isMutationActionId(value: string): value is MutationActionId {
  return (MUTATION_ACTION_IDS as readonly string[]).includes(value);
}

function resolvePolicyRequiredProofLevel(input: {
  policyPacket: PacketEnvelopeByType['Policy'];
  actionIds: MutationActionId[];
}): WriteProofLevel | null {
  if (
    input.policyPacket.body.policy_kind !== WRITE_LOCK_POLICY_KIND ||
    !input.policyPacket.body.write_policy
  ) {
    return null;
  }

  let requiredLevel = input.policyPacket.body.write_policy.default_proof_level;

  for (const [actionId, proofLevel] of Object.entries(
    input.policyPacket.body.write_policy.action_overrides
  )) {
    if (!isMutationActionId(actionId)) {
      continue;
    }

    if (input.actionIds.includes(actionId)) {
      requiredLevel = maxWriteProofLevel(requiredLevel, proofLevel);
    }
  }

  return requiredLevel;
}

export function resolveWritePolicyForActions(input: {
  governingScopePacket: PacketEnvelopeByType['Element'] | null;
  policyPackets: PacketEnvelopeByType['Policy'][];
  actionIds: MutationActionId[];
}): ResolvedWritePolicyDecision {
  const referencedPolicyIds = new Set(
    input.governingScopePacket?.header.moderation.policy_refs.map(
      (policyRef) => policyRef.packet_id
    ) ?? []
  );
  let requiredProofLevel = DEFAULT_MUTATION_PROOF_LEVEL;
  const sourcePolicyPacketIds: string[] = [];

  for (const policyPacket of input.policyPackets) {
    if (!referencedPolicyIds.has(policyPacket.header.packet_id)) {
      continue;
    }

    const policyLevel = resolvePolicyRequiredProofLevel({
      policyPacket,
      actionIds: input.actionIds,
    });

    if (!policyLevel) {
      continue;
    }

    sourcePolicyPacketIds.push(policyPacket.header.packet_id);
    requiredProofLevel = maxWriteProofLevel(requiredProofLevel, policyLevel);
  }

  return {
    action_ids: input.actionIds,
    required_proof_level: requiredProofLevel,
    accepted_proof_methods: getAcceptedProofMethodsForLevel(requiredProofLevel),
    source_policy_packet_ids: sourcePolicyPacketIds,
  };
}

function intersectProofMethods(
  left: readonly MutationProofMethod[],
  right: readonly MutationProofMethod[]
): MutationProofMethod[] {
  const rightSet = new Set(right);

  return normalizeProofMethods(left).filter((method) => rightSet.has(method));
}

export function mergeWritePolicyDecisions(input: {
  actionIds: MutationActionId[];
  decisions: ResolvedWritePolicyDecision[];
}): ResolvedWritePolicyDecision {
  if (input.decisions.length === 0) {
    return {
      action_ids: input.actionIds,
      required_proof_level: DEFAULT_MUTATION_PROOF_LEVEL,
      accepted_proof_methods: getAcceptedProofMethodsForLevel(
        DEFAULT_MUTATION_PROOF_LEVEL
      ),
      source_policy_packet_ids: [],
    };
  }

  let requiredProofLevel = DEFAULT_MUTATION_PROOF_LEVEL;

  for (const decision of input.decisions) {
    requiredProofLevel = maxWriteProofLevel(
      requiredProofLevel,
      decision.required_proof_level
    );
  }

  const highestDecisions = input.decisions.filter(
    (decision) => decision.required_proof_level === requiredProofLevel
  );
  const acceptedProofMethods = highestDecisions.reduce<MutationProofMethod[]>(
    (methods, decision, index) =>
      index === 0
        ? normalizeProofMethods(decision.accepted_proof_methods)
        : intersectProofMethods(methods, decision.accepted_proof_methods),
    []
  );

  return {
    action_ids: input.actionIds,
    required_proof_level: requiredProofLevel,
    accepted_proof_methods:
      acceptedProofMethods.length > 0
        ? acceptedProofMethods
        : getAcceptedProofMethodsForLevel(requiredProofLevel),
    source_policy_packet_ids: [...new Set(
      input.decisions.flatMap((decision) => decision.source_policy_packet_ids)
    )],
  };
}

export function assertProofBundleSatisfiesPolicy(input: {
  proofs: MutationProofBundle;
  decision: ResolvedWritePolicyDecision;
}): void {
  if (
    doesProofBundleSatisfyRequirement({
      proofs: input.proofs,
      requiredLevel: input.decision.required_proof_level,
      acceptedMethods: input.decision.accepted_proof_methods,
    })
  ) {
    return;
  }

  throw new Error(
    `This action requires ${describeWriteProofLevel(
      input.decision.required_proof_level
    )} under the current write policy.`
  );
}
