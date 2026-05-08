/**
 * File: relation-utils.ts
 * Description: Shared runtime helpers for reading canonical Relation packets from preferred packet heads.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type RelationPacket = PacketEnvelopeByType['Relation'];

export async function listRelationPackets(
  packetStore: NodeSQLitePacketStore
): Promise<RelationPacket[]> {
  return (await packetStore.listPreferredPacketsByFamily('Relation')) as RelationPacket[];
}

export function isActiveRelationPacket(relationPacket: RelationPacket): boolean {
  return relationPacket.body.status === 'active';
}

export function filterRelationPackets(input: {
  relations: RelationPacket[];
  relationSubtype?: string | null;
  subjectPacketId?: string | null;
  targetPacketId?: string | null;
  scopePacketId?: string | null;
  activeOnly?: boolean;
}): RelationPacket[] {
  return input.relations.filter((relationPacket) => {
    if (input.relationSubtype && relationPacket.body.subtype !== input.relationSubtype) {
      return false;
    }

    if (
      input.subjectPacketId &&
      relationPacket.body.subject_ref.packet_id !== input.subjectPacketId
    ) {
      return false;
    }

    if (
      input.targetPacketId &&
      relationPacket.body.target_ref.packet_id !== input.targetPacketId
    ) {
      return false;
    }

    if (
      input.scopePacketId &&
      relationPacket.body.scope_ref?.packet_id !== input.scopePacketId
    ) {
      return false;
    }

    if (input.activeOnly && !isActiveRelationPacket(relationPacket)) {
      return false;
    }

    return true;
  });
}
