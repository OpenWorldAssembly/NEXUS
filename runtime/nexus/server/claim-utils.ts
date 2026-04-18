/**
 * File: claim-utils.ts
 * Description: Shared runtime helpers for reading scoped association claims from preferred packets.
 */

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

export function filterClaimPackets(input: {
  claims: ClaimPacket[];
  claimKind?: ClaimPacket['body']['claim_kind'] | null;
  subjectPacketId?: string | null;
  targetPacketId?: string | null;
  scopePacketId?: string | null;
  activeOnly?: boolean;
}): ClaimPacket[] {
  return input.claims.filter((claimPacket) => {
    if (input.claimKind && claimPacket.body.claim_kind !== input.claimKind) {
      return false;
    }

    if (
      input.subjectPacketId &&
      claimPacket.body.subject_ref.packet_id !== input.subjectPacketId
    ) {
      return false;
    }

    if (
      input.targetPacketId &&
      claimPacket.body.target_ref.packet_id !== input.targetPacketId
    ) {
      return false;
    }

    if (
      input.scopePacketId &&
      claimPacket.body.scope_ref.packet_id !== input.scopePacketId
    ) {
      return false;
    }

    if (input.activeOnly && !isActiveClaimPacket(claimPacket)) {
      return false;
    }

    return true;
  });
}

