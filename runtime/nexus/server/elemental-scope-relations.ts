/**
 * File: elemental-scope-relations.ts
 * Description: Centralizes actor-to-scope home, association, and follow relation reads across canonical packets and compatibility fallbacks.
 */

import { filterClaimPackets, listClaimPackets, listRelationSupportingClaims } from '@runtime/nexus/server/claim-utils';
import {
  filterRelationPackets,
  listRelationPackets,
} from '@runtime/nexus/server/relation-utils';
import {
  projectLegacyAssemblyAssociationScopeCompatibility,
  projectLegacyFollowedScopeCompatibility,
} from '@runtime/nexus/server/scope-graph-compatibility';
import { readFollowedScopeIdsCompatibility } from '@runtime/nexus/server/shell-preferences';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export async function resolveElementalScopeRelations(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId?: string | null;
  request?: Request | null;
  scopeRouteIds?: Set<string>;
  scopePacketIds?: Set<string>;
}) {
  const [relationPackets, claimPackets] = await Promise.all([
    listRelationPackets(input.packetStore),
    listClaimPackets(input.packetStore),
  ]);
  const activeHomeRelations = filterRelationPackets({
    relations: relationPackets,
    relationSubtype: 'home_locality',
    subjectPacketId: input.actorPacketId ?? null,
    activeOnly: true,
  });
  const activeHomeClaims = filterClaimPackets({
    claims: claimPackets,
    claimKind: 'home_locality',
    subjectPacketId: input.actorPacketId ?? null,
    activeOnly: true,
  });
  const canonicalFollowRelationPacketIdsByScopePacketId = new Map<string, string[]>();

  for (const relationPacket of filterRelationPackets({
    relations: relationPackets,
    relationSubtype: 'follows',
    subjectPacketId: input.actorPacketId ?? null,
    activeOnly: true,
  })) {
    const scopePacketId = relationPacket.body.target_ref.packet_id;

    if (input.scopePacketIds && !input.scopePacketIds.has(scopePacketId)) {
      continue;
    }

    canonicalFollowRelationPacketIdsByScopePacketId.set(scopePacketId, [
      ...(canonicalFollowRelationPacketIdsByScopePacketId.get(scopePacketId) ?? []),
      relationPacket.header.packet_id,
    ]);
  }

  const canonicalAssociationRelationPacketIdsByScopePacketId = new Map<string, string[]>();

  for (const relationPacket of filterRelationPackets({
    relations: relationPackets,
    relationSubtype: 'assembly_association',
    subjectPacketId: input.actorPacketId ?? null,
    activeOnly: true,
  })) {
    const scopePacketId = relationPacket.body.target_ref.packet_id;

    if (input.scopePacketIds && !input.scopePacketIds.has(scopePacketId)) {
      continue;
    }

    const supportingClaimPacketIds = [
      ...new Set(
        listRelationSupportingClaims({
          claims: claimPackets,
          relationPacketId: relationPacket.header.packet_id,
          claimSubtype: 'relation_assertion',
          activeOnly: true,
        })
          .filter((claimPacket) =>
            filterClaimPackets({
              claims: [claimPacket],
              claimKind: 'assembly_association',
              activeOnly: true,
            }).length > 0
          )
          .map((claimPacket) => claimPacket.header.packet_id)
      ),
    ];

    canonicalAssociationRelationPacketIdsByScopePacketId.set(scopePacketId, [
      ...(canonicalAssociationRelationPacketIdsByScopePacketId.get(scopePacketId) ?? []),
      relationPacket.header.packet_id,
      ...supportingClaimPacketIds,
    ]);
  }

  const compatibilityAssociatedScopeClaimIdsByPacketId =
    projectLegacyAssemblyAssociationScopeCompatibility({
      claimPackets,
      actorPacketId: input.actorPacketId ?? null,
      scopePacketIds: input.scopePacketIds ?? new Set<string>(),
    });
  const compatibilityFollowedRouteIds = projectLegacyFollowedScopeCompatibility({
    scopeMap: new Map(
      Array.from(input.scopeRouteIds ?? []).map((scopeRouteId) => [
        scopeRouteId,
        {
          routeId: scopeRouteId,
          packetId: scopeRouteId,
          level: 'district' as const,
          parentRouteId: null,
        },
      ])
    ),
    followedScopeIds: readFollowedScopeIdsCompatibility(
      input.request ?? null,
      input.actorPacketId ?? null
    ),
  });

  return {
    relationPackets,
    claimPackets,
    activeHomeRelations,
    activeHomeClaims,
    canonicalFollowRelationPacketIdsByScopePacketId,
    canonicalAssociationRelationPacketIdsByScopePacketId,
    compatibilityAssociatedScopeClaimIdsByPacketId,
    compatibilityFollowedRouteIds,
  };
}
