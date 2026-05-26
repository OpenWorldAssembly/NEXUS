/**
 * File: trusted_definition_internal.ts
 * Description: Internal helpers for Trusted Definition Coordinator function modules.
 */

import type { PacketDefinitionPartSubtype } from '@core/packets/definitions/packet-definition-types.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type TrustedDefinitionCandidate,
  type TrustedDefinitionContextMode,
  type TrustedDefinitionRuntimePreference,
  type TrustedDefinitionTrustMode,
  type TrustedDefinitionTrustTier,
} from './trusted_definition_types.ts';

export function definitionTrace(input: {
  step_id: string;
  status: 'ok' | 'partial' | 'blocked' | 'error';
  notes: string;
  preset_ids?: readonly string[];
}): TrustedRuntimeCoordinatorTraceEntry {
  return {
    step_id: input.step_id,
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    preset_ids: [...(input.preset_ids ?? ['resolution.definition_selection.v0'])],
    status: input.status,
    notes: input.notes,
  };
}

export function candidatePreferenceMatches(input: {
  candidate: TrustedDefinitionCandidate;
  preference: TrustedDefinitionRuntimePreference;
}): boolean {
  const { candidate, preference } = input;

  if (preference.source_id && preference.source_id !== candidate.source.source_id) {
    return false;
  }
  if (preference.packet_type && preference.packet_type !== candidate.defines_packet_type) {
    return false;
  }
  if (
    preference.packet_subtype !== undefined &&
    preference.packet_subtype !== null &&
    preference.packet_subtype !== candidate.defines_packet_subtype
  ) {
    return false;
  }
  if (
    preference.part_subtype !== undefined &&
    preference.part_subtype !== null &&
    preference.part_subtype !== candidate.part_subtype
  ) {
    return false;
  }

  return true;
}

export function trustTierForMode(mode: TrustedDefinitionTrustMode): TrustedDefinitionTrustTier {
  switch (mode) {
    case 'pin':
      return 'node_pinned';
    case 'prefer':
      return 'node_preferred';
    case 'allow':
      return 'trusted_import';
    case 'compatibility_only':
      return 'compatibility_only';
    case 'quarantine':
      return 'quarantined';
    case 'ignore':
      return 'ignored';
  }
}

export function trustWeight(tier: TrustedDefinitionTrustTier): number {
  switch (tier) {
    case 'node_pinned':
      return 700;
    case 'node_preferred':
      return 600;
    case 'core_seed':
      return 500;
    case 'trusted_import':
      return 400;
    case 'compatibility_only':
      return 250;
    case 'quarantined':
      return 50;
    case 'ignored':
      return -1000;
  }
}

export function candidateSort(a: TrustedDefinitionCandidate, b: TrustedDefinitionCandidate): number {
  const trustDelta = trustWeight(b.trust_status) - trustWeight(a.trust_status);
  if (trustDelta !== 0) {
    return trustDelta;
  }

  const priorityDelta = b.priority - a.priority;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return a.candidate_id.localeCompare(b.candidate_id);
}

export function uniqueKeyForCandidate(candidate: TrustedDefinitionCandidate): string {
  return [
    candidate.defines_packet_type,
    candidate.defines_packet_subtype ?? '*',
    candidate.part_subtype,
  ].join('::');
}

export function requiredPartCount(candidates: readonly TrustedDefinitionCandidate[], packetType: string): number {
  const definitionCandidate = candidates.find(
    (candidate) =>
      candidate.defines_packet_type === packetType &&
      candidate.part_subtype === 'packet_type_definition' &&
      candidate.payload.definition
  );

  return (
    definitionCandidate?.payload.definition?.packet_definition_parts ?? []
  ).filter((part) => part.required).length;
}

export function missingRequiredPartIds(input: {
  candidates: readonly TrustedDefinitionCandidate[];
  packetType: string;
  includeCompatibility?: boolean;
}): string[] {
  const definitionCandidate = input.candidates.find(
    (candidate) =>
      candidate.defines_packet_type === input.packetType &&
      candidate.part_subtype === 'packet_type_definition' &&
      candidate.payload.definition
  );

  const requiredParts = definitionCandidate?.payload.definition?.packet_definition_parts?.filter((part) => part.required) ?? [];
  const presentPartSubtypes = new Set(
    input.candidates
      .filter((candidate) => candidate.defines_packet_type === input.packetType)
      .filter((candidate) => input.includeCompatibility || candidate.trust_status !== 'compatibility_only')
      .map((candidate) => candidate.part_subtype)
  );

  return requiredParts
    .filter((part) => !presentPartSubtypes.has(part.part_subtype))
    .map((part) => part.part_id);
}

export function issueForUnknownPacketType(packetType: string): TrustedRuntimeCoordinatorIssue {
  return trustedIssue({
    severity: 'error',
    code: 'unknown_definition_packet_type',
    path: 'packet_type',
    message: `No trusted definition candidate is available for ${packetType}.`,
  });
}

export function partSubtypeMatches(
  candidatePartSubtype: TrustedDefinitionCandidate['part_subtype'],
  requestedPartSubtype: PacketDefinitionPartSubtype
): boolean {
  return candidatePartSubtype === requestedPartSubtype;
}

export function normalizeContextMode(mode?: TrustedDefinitionContextMode): TrustedDefinitionContextMode {
  return mode ?? 'normal_runtime';
}
