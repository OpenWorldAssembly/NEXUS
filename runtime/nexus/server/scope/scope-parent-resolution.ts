/**
 * File: scope-parent-resolution.ts
 * Description: Resolves canonical and compatibility scope ancestry into deterministic parent states.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';

import {
  filterRelationPackets,
  type RelationPacket,
} from '@runtime/nexus/server/relation-utils';

export type ScopeStructuralState =
  | 'canonical'
  | 'compatibility_parent'
  | 'conflicting_parents'
  | 'cyclic_ancestry'
  | 'missing_parent';

export type ScopeParentResolution = {
  parentPacketId: string | null;
  structuralState: ScopeStructuralState;
  structuralRelationPacketIds: string[];
  conflictParentPacketIds: string[];
};

function uniquePacketIds(packetIds: string[]): string[] {
  return [...new Set(packetIds)];
}

function detectCyclicScopeIds(
  resolutionsByPacketId: Map<string, ScopeParentResolution>
): Set<string> {
  const visitState = new Map<string, 0 | 1 | 2>();
  const cyclePacketIds = new Set<string>();
  const stack: string[] = [];

  const visit = (packetId: string) => {
    const currentState = visitState.get(packetId) ?? 0;

    if (currentState === 2) {
      return;
    }

    if (currentState === 1) {
      const cycleStartIndex = stack.indexOf(packetId);
      const cyclicPath =
        cycleStartIndex >= 0 ? stack.slice(cycleStartIndex) : [packetId];

      for (const cyclicPacketId of cyclicPath) {
        cyclePacketIds.add(cyclicPacketId);
      }

      return;
    }

    visitState.set(packetId, 1);
    stack.push(packetId);

    const parentPacketId = resolutionsByPacketId.get(packetId)?.parentPacketId ?? null;

    if (parentPacketId && resolutionsByPacketId.has(parentPacketId)) {
      visit(parentPacketId);
    }

    stack.pop();
    visitState.set(packetId, 2);
  };

  for (const packetId of resolutionsByPacketId.keys()) {
    visit(packetId);
  }

  return cyclePacketIds;
}

export function resolveScopeParentResolutions(input: {
  scopePackets: PacketEnvelopeByType['Element'][];
  relationPackets: RelationPacket[];
  getCompatibilityParentPacketId?: (
    packet: PacketEnvelopeByType['Element']
  ) => string | null;
}): Map<string, ScopeParentResolution> {
  const scopePacketIds = new Set(
    input.scopePackets.map((packet) => packet.header.packet_id)
  );
  const activeParentRelations = filterRelationPackets({
    relations: input.relationPackets,
    relationSubtype: 'default_ancestry_parent',
    activeOnly: true,
  });
  const relationsByChildPacketId = new Map<string, RelationPacket[]>();

  for (const relationPacket of activeParentRelations) {
    const childPacketId = relationPacket.body.subject_ref.packet_id;

    if (!scopePacketIds.has(childPacketId)) {
      continue;
    }

    relationsByChildPacketId.set(childPacketId, [
      ...(relationsByChildPacketId.get(childPacketId) ?? []),
      relationPacket,
    ]);
  }

  const resolutionsByPacketId = new Map<string, ScopeParentResolution>();

  for (const scopePacket of input.scopePackets) {
    const packetId = scopePacket.header.packet_id;
    const childRelations = relationsByChildPacketId.get(packetId) ?? [];
    const canonicalParentPacketIds = uniquePacketIds(
      childRelations.map((relationPacket) => relationPacket.body.target_ref.packet_id)
    );
    const structuralRelationPacketIds = childRelations.map(
      (relationPacket) => relationPacket.header.packet_id
    );

    if (canonicalParentPacketIds.length > 1) {
      resolutionsByPacketId.set(packetId, {
        parentPacketId: null,
        structuralState: 'conflicting_parents',
        structuralRelationPacketIds,
        conflictParentPacketIds: canonicalParentPacketIds,
      });
      continue;
    }

    if (canonicalParentPacketIds.length === 1) {
      const canonicalParentPacketId = canonicalParentPacketIds[0];

      if (!scopePacketIds.has(canonicalParentPacketId)) {
        resolutionsByPacketId.set(packetId, {
          parentPacketId: null,
          structuralState: 'missing_parent',
          structuralRelationPacketIds,
          conflictParentPacketIds: [canonicalParentPacketId],
        });
        continue;
      }

      resolutionsByPacketId.set(packetId, {
        parentPacketId: canonicalParentPacketId,
        structuralState: 'canonical',
        structuralRelationPacketIds,
        conflictParentPacketIds: [],
      });
      continue;
    }

    const compatibilityParentPacketId =
      input.getCompatibilityParentPacketId?.(scopePacket) ?? null;

    if (!compatibilityParentPacketId) {
      resolutionsByPacketId.set(packetId, {
        parentPacketId: null,
        structuralState: 'canonical',
        structuralRelationPacketIds: [],
        conflictParentPacketIds: [],
      });
      continue;
    }

    if (!scopePacketIds.has(compatibilityParentPacketId)) {
      resolutionsByPacketId.set(packetId, {
        parentPacketId: null,
        structuralState: 'missing_parent',
        structuralRelationPacketIds: [],
        conflictParentPacketIds: [compatibilityParentPacketId],
      });
      continue;
    }

    resolutionsByPacketId.set(packetId, {
      parentPacketId: compatibilityParentPacketId,
      structuralState: 'compatibility_parent',
      structuralRelationPacketIds: [],
      conflictParentPacketIds: [],
    });
  }

  const cyclicPacketIds = detectCyclicScopeIds(resolutionsByPacketId);

  for (const cyclicPacketId of cyclicPacketIds) {
    const currentResolution = resolutionsByPacketId.get(cyclicPacketId);

    if (!currentResolution) {
      continue;
    }

    resolutionsByPacketId.set(cyclicPacketId, {
      ...currentResolution,
      parentPacketId: null,
      structuralState: 'cyclic_ancestry',
    });
  }

  return resolutionsByPacketId;
}
