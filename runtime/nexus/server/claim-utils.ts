/**
 * File: claim-utils.ts
 * Description: Shared runtime helpers for reading scoped association claims from preferred packets.
 */

import {
  projectClaimAsRelationAssertion,
  type ClaimRelationAssertionProjection,
} from '@core/projections/forward-ontology';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type ClaimPacket = PacketEnvelopeByType['Claim'];

export async function listClaimPackets(
  packetStore: NodeSQLitePacketStore
): Promise<ClaimPacket[]> {
  return (await packetStore.listPreferredPacketsByFamily('Claim')) as ClaimPacket[];
}

export function isActiveClaimPacket(claimPacket: ClaimPacket): boolean {
  return claimPacket.body.status === 'active';
}

function getClaimRelationSubtype(claimPacket: ClaimPacket): string | null {
  return (
    claimPacket.body.relation_assertion?.subtype ??
    claimPacket.body.claim_kind ??
    null
  );
}

function getClaimRelationSubjectPacketId(claimPacket: ClaimPacket): string | null {
  return (
    claimPacket.body.relation_assertion?.subject_ref.packet_id ??
    claimPacket.body.subject_ref?.packet_id ??
    null
  );
}

function getClaimRelationTargetPacketId(claimPacket: ClaimPacket): string | null {
  return (
    claimPacket.body.relation_assertion?.target_ref.packet_id ??
    claimPacket.body.target_ref.packet_id
  );
}

function getClaimRelationScopePacketId(claimPacket: ClaimPacket): string | null {
  return (
    claimPacket.body.relation_assertion?.scope_ref?.packet_id ??
    claimPacket.body.scope_ref?.packet_id ??
    null
  );
}

export function filterClaimPackets(input: {
  claims: ClaimPacket[];
  claimKind?: string | null;
  claimSubtype?: string | null;
  subjectPacketId?: string | null;
  targetPacketId?: string | null;
  scopePacketId?: string | null;
  relationTargetPacketId?: string | null;
  activeOnly?: boolean;
}): ClaimPacket[] {
  return input.claims.filter((claimPacket) => {
    if (input.claimSubtype && claimPacket.body.subtype !== input.claimSubtype) {
      return false;
    }

    if (input.claimKind && getClaimRelationSubtype(claimPacket) !== input.claimKind) {
      return false;
    }

    if (input.subjectPacketId && getClaimRelationSubjectPacketId(claimPacket) !== input.subjectPacketId) {
      return false;
    }

    if (input.targetPacketId && claimPacket.body.target_ref.packet_id !== input.targetPacketId) {
      return false;
    }

    if (
      input.relationTargetPacketId &&
      getClaimRelationTargetPacketId(claimPacket) !== input.relationTargetPacketId
    ) {
      return false;
    }

    if (input.scopePacketId && getClaimRelationScopePacketId(claimPacket) !== input.scopePacketId) {
      return false;
    }

    if (input.activeOnly && !isActiveClaimPacket(claimPacket)) {
      return false;
    }

    return true;
  });
}

export function projectClaimPacketAsRelationAssertion(
  claimPacket: ClaimPacket
): ClaimRelationAssertionProjection {
  return projectClaimAsRelationAssertion(claimPacket);
}

export function projectClaimPacketsAsRelationAssertions(
  claims: ClaimPacket[]
): ClaimRelationAssertionProjection[] {
  return claims.map(projectClaimPacketAsRelationAssertion);
}

export function listRelationSupportingClaims(input: {
  claims: ClaimPacket[];
  relationPacketId: string;
  claimSubtype?: string | null;
  activeOnly?: boolean;
}): ClaimPacket[] {
  return filterClaimPackets({
    claims: input.claims,
    targetPacketId: input.relationPacketId,
    claimSubtype: input.claimSubtype ?? null,
    activeOnly: input.activeOnly ?? true,
  });
}
