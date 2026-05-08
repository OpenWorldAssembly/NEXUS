/**
 * File: write-security-mode.ts
 * Description: Maps Nexus security preference modes onto typed packet-backed write-lock policy shapes.
 */

import {
  getAcceptedProofMethodsForLevel,
  maxWriteProofLevel,
  STRONG_REAUTH_PROOF_METHODS,
} from '@core/auth/proof-types';
import type {
  MutationActionId,
  ResolvedWritePolicyDecision,
} from '@core/auth/write-policy';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusSecurityMode } from '@runtime/nexus/nexus-api-types';

const GUARDED_ACTION_IDS: MutationActionId[] = [
  'discussion.thread.create',
  'discussion.post.create',
  'locality.element.create',
  'assembly.element.create',
  'home_locality.relation.set',
  'home_locality.relation.clear',
  'assembly_association.relation.set',
  'assembly_association.relation.clear',
  'actor.write_policy.update',
];

const SECURITY_MODE_RANK: Record<NexusSecurityMode, number> = {
  standard: 0,
  guarded: 1,
  every_write: 2,
};

export function createActorWritePolicyPacketId(actorPacketId: string): string {
  return `nexus:policy/write-lock/${encodeURIComponent(actorPacketId)}`;
}

export function buildWritePolicyBodyMarkdown(
  securityMode: NexusSecurityMode
): string {
  switch (securityMode) {
    case 'standard':
      return 'Standard write approval. Claimed-session writes proceed without fresh re-approval.';
    case 'guarded':
      return 'Guarded write approval. Higher-impact actions require fresh re-approval.';
    case 'every_write':
      return 'Maximum write approval. Every interactive write requires fresh re-approval.';
    default:
      return 'Write approval policy.';
  }
}

export function createWritePolicyForSecurityMode(
  securityMode: NexusSecurityMode
): NonNullable<PacketEnvelopeByType['Policy']['body']['write_policy']> {
  switch (securityMode) {
    case 'standard':
      return {
        default_proof_level: 'session',
        action_overrides: {},
      };
    case 'guarded':
      return {
        default_proof_level: 'session',
        action_overrides: Object.fromEntries(
          GUARDED_ACTION_IDS.map((actionId) => [actionId, 'reauth' as const])
        ),
      };
    case 'every_write':
      return {
        default_proof_level: 'reauth',
        action_overrides: {},
      };
    default:
      return {
        default_proof_level: 'session',
        action_overrides: {},
      };
  }
}

export function inferSecurityModeFromWritePolicy(
  writePolicy: PacketEnvelopeByType['Policy']['body']['write_policy'] | null | undefined
): NexusSecurityMode {
  if (!writePolicy) {
    return 'guarded';
  }

  if (writePolicy.default_proof_level === 'reauth' || writePolicy.default_proof_level === 'passkey') {
    return 'every_write';
  }

  const hasRaisedOverrides = Object.values(writePolicy.action_overrides ?? {}).some(
    (proofLevel) => proofLevel !== 'session'
  );

  return hasRaisedOverrides ? 'guarded' : 'standard';
}

export function compareSecurityModes(
  left: NexusSecurityMode,
  right: NexusSecurityMode
): number {
  return SECURITY_MODE_RANK[left] - SECURITY_MODE_RANK[right];
}

export function isSecurityModeLowering(input: {
  current: NexusSecurityMode;
  next: NexusSecurityMode;
}): boolean {
  return compareSecurityModes(input.next, input.current) < 0;
}

export function resolveSecurityModePolicyDecision(input: {
  securityMode: NexusSecurityMode;
  actionIds: MutationActionId[];
  sourcePolicyPacketIds?: string[];
}): ResolvedWritePolicyDecision {
  const writePolicy = createWritePolicyForSecurityMode(input.securityMode);
  let requiredProofLevel = writePolicy.default_proof_level;

  for (const actionId of input.actionIds) {
    const overrideLevel = writePolicy.action_overrides[actionId];

    if (overrideLevel) {
      requiredProofLevel = maxWriteProofLevel(
        requiredProofLevel,
        overrideLevel
      );
    }
  }

  return {
    action_ids: input.actionIds,
    required_proof_level: requiredProofLevel,
    accepted_proof_methods:
      input.securityMode === 'every_write'
        ? [...STRONG_REAUTH_PROOF_METHODS]
        : getAcceptedProofMethodsForLevel(requiredProofLevel),
    source_policy_packet_ids: input.sourcePolicyPacketIds ?? [],
  };
}
