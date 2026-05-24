/**
 * File: scope-graph-compatibility.ts
 * Description: Explicit compatibility projections for legacy scope ancestry and claim-backed scope semantics.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';

import {
  filterClaimPackets,
  type ClaimPacket,
} from '@runtime/nexus/server/claim-utils';

type ScopeNodeLike = {
  routeId: string;
  packetId: string;
  level: 'personal' | 'global' | 'nation' | 'region' | 'city' | 'district';
  parentRouteId: string | null;
};

export type LegacyHomeLocalityCompatibilityCandidate = {
  source: 'legacy_residence_claim_compatibility';
  claimPacket: ClaimPacket;
  scopeRouteId: string;
  scopePacketId: string;
  ancestorRouteIds: string[];
  justificationPacketIds: string[];
};

function isHomeLocalityLevel(level: ScopeNodeLike['level']): boolean {
  return (
    level === 'nation' ||
    level === 'region' ||
    level === 'city' ||
    level === 'district'
  );
}

function getAncestorRouteIds(
  scopeMap: Map<string, ScopeNodeLike>,
  scopeRouteId: string
): string[] {
  const ancestorRouteIds: string[] = [];
  let currentParentRouteId = scopeMap.get(scopeRouteId)?.parentRouteId ?? null;

  while (currentParentRouteId) {
    ancestorRouteIds.unshift(currentParentRouteId);
    currentParentRouteId = scopeMap.get(currentParentRouteId)?.parentRouteId ?? null;
  }

  return ancestorRouteIds;
}

export function getLegacyParentScopePacketIdCompatibility(
  packet: PacketEnvelopeByType['Element']
): string | null {
  return (
    packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')?.target
      .packet_id ?? null
  );
}

export function projectLegacyHomeLocalityCompatibility(input: {
  claimPackets: ClaimPacket[];
  actorPacketId?: string | null;
  scopeMap: Map<string, ScopeNodeLike>;
}): LegacyHomeLocalityCompatibilityCandidate | null {
  if (!input.actorPacketId) {
    return null;
  }

  const activeHomeClaims = filterClaimPackets({
    claims: input.claimPackets,
    claimKind: 'residence',
    subjectPacketId: input.actorPacketId,
    activeOnly: true,
  });
  const rankedHomeClaims = activeHomeClaims
    .map((claimPacket) => {
      const targetPacketId =
        claimPacket.body.relation_assertion?.target_ref.packet_id ??
        claimPacket.body.target_ref.packet_id;
      const scopeRouteId = Array.from(input.scopeMap.values()).find(
        (scopeNode) =>
          scopeNode.packetId === targetPacketId && isHomeLocalityLevel(scopeNode.level)
      )?.routeId;

      if (!scopeRouteId) {
        return null;
      }

      const ancestorRouteIds = getAncestorRouteIds(input.scopeMap, scopeRouteId);

      return {
        source: 'legacy_residence_claim_compatibility' as const,
        claimPacket,
        scopeRouteId,
        scopePacketId: targetPacketId,
        ancestorRouteIds,
        justificationPacketIds: [claimPacket.header.packet_id],
        depth: ancestorRouteIds.length,
      };
    })
    .filter(
      (
        value
      ): value is LegacyHomeLocalityCompatibilityCandidate & {
        depth: number;
      } => value !== null
    )
    .sort((leftClaim, rightClaim) => rightClaim.depth - leftClaim.depth);

  if (rankedHomeClaims.length === 0) {
    return null;
  }

  const { depth: _depth, ...homeContext } = rankedHomeClaims[0];

  return homeContext;
}

export function projectLegacyAssociationScopeCompatibility(input: {
  claimPackets: ClaimPacket[];
  actorPacketId?: string | null;
  scopePacketIds: Set<string>;
}): Map<string, string[]> {
  const associatedScopeIds = new Map<string, string[]>();

  if (!input.actorPacketId) {
    return associatedScopeIds;
  }

  const associationClaims = filterClaimPackets({
    claims: input.claimPackets,
    claimKind: 'association',
    subjectPacketId: input.actorPacketId,
    activeOnly: true,
  });

  for (const claimPacket of associationClaims) {
    const scopePacketId =
      claimPacket.body.relation_assertion?.target_ref.packet_id ??
      claimPacket.body.target_ref.packet_id;

    if (!input.scopePacketIds.has(scopePacketId)) {
      continue;
    }

    associatedScopeIds.set(scopePacketId, [
      ...(associatedScopeIds.get(scopePacketId) ?? []),
      claimPacket.header.packet_id,
    ]);
  }

  return associatedScopeIds;
}

export function projectLegacyFollowedScopeCompatibility(input: {
  scopeMap: Map<string, ScopeNodeLike>;
  followedScopeIds: string[];
}): string[] {
  return [...new Set(input.followedScopeIds)].filter((scopeId) =>
    input.scopeMap.has(scopeId)
  );
}
