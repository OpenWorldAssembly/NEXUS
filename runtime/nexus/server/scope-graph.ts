/**
 * File: scope-graph.ts
 * Description: Packet-native scope graph projection with explicit legacy compatibility adapters.
 */

import {
  getElementSubtypeLeaf,
  type PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  readLocalityManualStatus,
  readLocalityScopeDescriptor,
  type LocalityManualStatus,
  type LocalityScopeDescriptor,
} from '@runtime/nexus/location-search';
import type {
  NexusScopeMountReason,
  NexusScopeSummary,
} from '@runtime/nexus/nexus-shell';
import { evaluateRelationPolicyRequirements } from '@runtime/nexus/server/relation-policy';
import {
  type ClaimPacket,
} from '@runtime/nexus/server/claim-utils';
import {
  filterRelationPackets,
  type RelationPacket,
} from '@runtime/nexus/server/relation-utils';
import { resolveElementalScopeRelations } from '@runtime/nexus/server/elemental-scope-relations';
import {
  getLegacyParentScopePacketIdCompatibility,
  projectLegacyHomeLocalityCompatibility,
} from '@runtime/nexus/server/scope-graph-compatibility';
import { getOwaRelationPolicyPackets } from '@runtime/nexus/server/scope-graph-owa';
import {
  resolveScopeParentResolutions,
  type ScopeStructuralState,
} from '@runtime/nexus/server/scope-parent-resolution';
import { listClaimPackets } from '@runtime/nexus/server/claim-utils';
import { listRelationPackets } from '@runtime/nexus/server/relation-utils';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type ScopeGraphNode = {
  routeId: string;
  packetId: string;
  name: string;
  shortLabel: string;
  level: NexusScopeSummary['level'];
  scopeSubtype: string | null;
  scopeSystem: string | null;
  scopeTypeLabel: string | null;
  scopeTypeKey: string | null;
  scopeHierarchySystem: string | null;
  manualStatus: LocalityManualStatus | null;
  summary: string | null;
  localityLabel: string | null;
  parentRouteId: string | null;
  structuralState: ScopeStructuralState;
  structuralRelationPacketIds: string[];
  locationPacketIds: string[];
};

export type EffectiveHomeLocalityProjection = {
  source: 'canonical_relation' | 'legacy_home_locality_claim_compatibility';
  relationPacketId: string | null;
  supportingClaimPacketIds: string[];
  compatibilityClaimPacketId: string | null;
  scopeRouteId: string;
  scopePacketId: string;
  ancestorRouteIds: string[];
  justificationPacketIds: string[];
  policyEvaluationState: 'not_applicable' | 'satisfied' | 'unsatisfied' | null;
};

export type ScopeGraphProjection = {
  nodes: ScopeGraphNode[];
  defaultScopeId: string;
  personalParentScopeId: string | null;
  mountedScopeIds: Set<string>;
  mountReasonsByScopeId: Map<string, NexusScopeMountReason[]>;
  homeScopeId: string | null;
  effectiveHomeLocality: EffectiveHomeLocalityProjection | null;
  followedScopeIds: Set<string>;
  followKindByRouteId: Map<string, string>;
  associatedScopeIds: Set<string>;
  associationKindByRouteId: Map<string, string>;
  associatedScopeJustificationPacketIdsByRouteId: Map<string, string[]>;
  knownScopeIds: Set<string>;
  discoverableScopeIds: Set<string>;
  geographicMountedScopeIds: string[];
  knownUnmountedScopeIds: string[];
  justificationPacketIdsByScopeId: Map<string, string[]>;
  structuralRelationPacketIdsByScopeId: Map<string, string[]>;
  locationPacketIdsByScopeId: Map<string, string[]>;
};

function toRouteScopeId(packetId: string): string {
  if (packetId.startsWith('nexus:element/')) {
    return packetId.slice('nexus:element/'.length);
  }

  return packetId.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function toScopeLevel(scopeSubtype: string | null): NexusScopeSummary['level'] {
  if (scopeSubtype === 'global') {
    return 'global';
  }

  if (scopeSubtype === 'nation') {
    return 'nation';
  }

  if (scopeSubtype === 'state' || scopeSubtype === 'region') {
    return 'region';
  }

  if (scopeSubtype === 'city') {
    return 'city';
  }

  return 'district';
}

function isHomeLocalityLevel(level: NexusScopeSummary['level']): boolean {
  return (
    level === 'nation' ||
    level === 'region' ||
    level === 'city' ||
    level === 'district'
  );
}

function toScopeShortLabel(name: string, subtype: string | null): string {
  const subtypeLeaf = getElementSubtypeLeaf(subtype);

  if (subtypeLeaf === 'global') {
    return 'Global';
  }

  if (name === 'United States') {
    return 'U.S.';
  }

  if (name === 'California') {
    return 'CA';
  }

  const words = name.split(' ').filter((word) => word.length > 0);

  if (words.length === 1) {
    return words[0];
  }

  return words[0];
}

function addMountReason(
  mountReasonsByScopeId: Map<string, NexusScopeMountReason[]>,
  scopeId: string,
  mountReason: NexusScopeMountReason
): void {
  const currentReasons = mountReasonsByScopeId.get(scopeId) ?? [];

  if (!currentReasons.includes(mountReason)) {
    mountReasonsByScopeId.set(scopeId, [...currentReasons, mountReason]);
  }
}

function appendPacketIds(
  target: Map<string, string[]>,
  scopeId: string,
  packetIds: readonly string[]
): void {
  if (packetIds.length === 0) {
    return;
  }

  target.set(scopeId, [...new Set([...(target.get(scopeId) ?? []), ...packetIds])]);
}

function getAncestorRouteIds(
  scopeMap: Map<string, ScopeGraphNode>,
  scopeRouteId: string
): string[] {
  const ancestorRouteIds: string[] = [];
  const visitedRouteIds = new Set<string>([scopeRouteId]);
  let currentParentRouteId = scopeMap.get(scopeRouteId)?.parentRouteId ?? null;

  while (currentParentRouteId && !visitedRouteIds.has(currentParentRouteId)) {
    ancestorRouteIds.unshift(currentParentRouteId);
    visitedRouteIds.add(currentParentRouteId);
    currentParentRouteId = scopeMap.get(currentParentRouteId)?.parentRouteId ?? null;
  }

  return ancestorRouteIds;
}

function isScopeElementPacket(
  packet: PacketEnvelopeByType['Element']
): boolean {
  const subtype = packet.body.subtype ?? null;
  const subtypeLeaf = getElementSubtypeLeaf(subtype);

  return (
    packet.body.kind === 'assembly' ||
    subtype?.startsWith('assembly.') === true ||
    packet.body.scope_kind === 'assembly' ||
    packet.body.scope_kind === 'locality' ||
    subtypeLeaf === 'locality'
  );
}

function buildLocationPacketIdsByScopePacketId(input: {
  relations: RelationPacket[];
  scopePacketIds: Set<string>;
}): {
  locationPacketIdsByScopePacketId: Map<string, string[]>;
  locationRelationPacketIdsByScopePacketId: Map<string, string[]>;
} {
  const locationPacketIdsByScopePacketId = new Map<string, string[]>();
  const locationRelationPacketIdsByScopePacketId = new Map<string, string[]>();
  const locationRelations = filterRelationPackets({
    relations: input.relations,
    relationSubtype: 'defined_by_location',
    activeOnly: true,
  });

  for (const relationPacket of locationRelations) {
    const scopePacketId = relationPacket.body.subject_ref.packet_id;

    if (!input.scopePacketIds.has(scopePacketId)) {
      continue;
    }

    locationPacketIdsByScopePacketId.set(scopePacketId, [
      ...(locationPacketIdsByScopePacketId.get(scopePacketId) ?? []),
      relationPacket.body.target_ref.packet_id,
    ]);
    locationRelationPacketIdsByScopePacketId.set(scopePacketId, [
      ...(locationRelationPacketIdsByScopePacketId.get(scopePacketId) ?? []),
      relationPacket.header.packet_id,
    ]);
  }

  return {
    locationPacketIdsByScopePacketId,
    locationRelationPacketIdsByScopePacketId,
  };
}

type ScopeLocationMetadata = {
  scopeDescriptor: LocalityScopeDescriptor | null;
  manualStatus: LocalityManualStatus | null;
};

function buildScopeLocationMetadataByScopePacketId(input: {
  locationPackets: PacketEnvelopeByType['Location'][];
  relationPackets: RelationPacket[];
}): Map<string, ScopeLocationMetadata> {
  const locationPacketById = new Map(
    input.locationPackets.map((packet) => [packet.header.packet_id, packet])
  );
  const metadataByScopePacketId = new Map<string, ScopeLocationMetadata>();

  for (const relationPacket of input.relationPackets) {
    if (
      relationPacket.body.subtype !== 'defined_by_location' ||
      relationPacket.body.status !== 'active'
    ) {
      continue;
    }

    const locationPacket = locationPacketById.get(
      relationPacket.body.target_ref.packet_id
    );

    if (!locationPacket) {
      continue;
    }

    const spatialPayload = locationPacket.body.spatial_payload;
    const fallbackLevel =
      spatialPayload.locality_level === 'nation' ||
      spatialPayload.locality_level === 'region' ||
      spatialPayload.locality_level === 'city' ||
      spatialPayload.locality_level === 'district'
        ? spatialPayload.locality_level
        : null;

    metadataByScopePacketId.set(relationPacket.body.subject_ref.packet_id, {
      scopeDescriptor: readLocalityScopeDescriptor(
        spatialPayload.scope_descriptor,
        fallbackLevel
      ),
      manualStatus: readLocalityManualStatus({
        spatialPayload,
        status: locationPacket.body.status,
      }),
    });
  }

  return metadataByScopePacketId;
}

async function resolveCanonicalHomeLocality(input: {
  packetStore: NodeSQLitePacketStore;
  relationPackets: RelationPacket[];
  claimPackets: ClaimPacket[];
  actorPacketId?: string | null;
  scopeMap: Map<string, ScopeGraphNode>;
}): Promise<EffectiveHomeLocalityProjection | null> {
  if (!input.actorPacketId) {
    return null;
  }

  const activeHomeRelations = filterRelationPackets({
    relations: input.relationPackets,
    relationSubtype: 'home_locality',
    subjectPacketId: input.actorPacketId,
    activeOnly: true,
  });

  if (activeHomeRelations.length === 0) {
    return null;
  }

  const policyPackets = await getOwaRelationPolicyPackets(input.packetStore);
  const rankedRelations = activeHomeRelations
    .map((relationPacket) => {
      const scopeRouteId = Array.from(input.scopeMap.values()).find(
        (scopeNode) =>
          scopeNode.packetId === relationPacket.body.target_ref.packet_id &&
          isHomeLocalityLevel(scopeNode.level)
      )?.routeId;

      if (!scopeRouteId) {
        return null;
      }

      const evaluation = evaluateRelationPolicyRequirements({
        relationPacket,
        policyPackets,
        claimPackets: input.claimPackets,
      });

      if (evaluation.evaluation_state === 'unsatisfied') {
        return null;
      }

      const ancestorRouteIds = getAncestorRouteIds(input.scopeMap, scopeRouteId);
      const supportingClaimPacketIds = [
        ...new Set(
          evaluation.evaluations.flatMap(
            (ruleEvaluation) => ruleEvaluation.supporting_claim_packet_ids
          )
        ),
      ];

      return {
        source: 'canonical_relation' as const,
        relationPacketId: relationPacket.header.packet_id,
        supportingClaimPacketIds,
        compatibilityClaimPacketId: null,
        scopeRouteId,
        scopePacketId: relationPacket.body.target_ref.packet_id,
        ancestorRouteIds,
        justificationPacketIds: [
          relationPacket.header.packet_id,
          ...supportingClaimPacketIds,
        ],
        policyEvaluationState: evaluation.evaluation_state,
        depth: ancestorRouteIds.length,
      };
    })
    .filter(
      (
        value
      ): value is EffectiveHomeLocalityProjection & {
        depth: number;
      } => value !== null
    )
    .sort((leftRelation, rightRelation) => rightRelation.depth - leftRelation.depth);

  if (rankedRelations.length === 0) {
    return null;
  }

  const { depth: _depth, ...homeRelation } = rankedRelations[0];

  return homeRelation;
}

export async function buildNexusScopeGraphProjection(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId?: string | null;
  request?: Request | null;
  followedScopeIds: string[];
}): Promise<ScopeGraphProjection> {
  const [elementPackets, relationPackets, claimPackets, locationPackets] = await Promise.all([
    input.packetStore.listPreferredPacketsByFamily('Element'),
    listRelationPackets(input.packetStore),
    listClaimPackets(input.packetStore),
    input.packetStore.listPreferredPacketsByFamily('Location'),
  ]);
  const scopeElementPackets = (elementPackets as PacketEnvelopeByType['Element'][]).filter(
    isScopeElementPacket
  );
  const scopePacketIds = new Set(
    scopeElementPackets.map((packet) => packet.header.packet_id)
  );
  const parentResolutionsByPacketId = resolveScopeParentResolutions({
    scopePackets: scopeElementPackets,
    relationPackets,
    getCompatibilityParentPacketId: getLegacyParentScopePacketIdCompatibility,
  });
  const {
    locationPacketIdsByScopePacketId,
    locationRelationPacketIdsByScopePacketId,
  } = buildLocationPacketIdsByScopePacketId({
    relations: relationPackets,
    scopePacketIds,
  });
  const scopeLocationMetadataByScopePacketId = buildScopeLocationMetadataByScopePacketId({
    locationPackets: locationPackets as PacketEnvelopeByType['Location'][],
    relationPackets,
  });
  const parentRouteIdByPacketId = new Map<string, string | null>();

  for (const packet of scopeElementPackets) {
    const resolvedParentPacketId =
      parentResolutionsByPacketId.get(packet.header.packet_id)?.parentPacketId ?? null;
    parentRouteIdByPacketId.set(
      packet.header.packet_id,
      resolvedParentPacketId ? toRouteScopeId(resolvedParentPacketId) : null
    );
  }

  const nodes = scopeElementPackets.map((packet) => {
    const scopeSubtype = packet.body.subtype ?? null;
    const scopeSystem =
      packet.body.scope_system ??
        (packet.body.locality ? 'geographic' : null);
    const scopeLocationMetadata =
      scopeLocationMetadataByScopePacketId.get(packet.header.packet_id) ?? null;

    return {
      routeId: toRouteScopeId(packet.header.packet_id),
      packetId: packet.header.packet_id,
      name: packet.body.name,
      shortLabel: toScopeShortLabel(packet.body.name, getElementSubtypeLeaf(scopeSubtype)),
      level: toScopeLevel(getElementSubtypeLeaf(scopeSubtype)),
      scopeSubtype,
      scopeSystem,
      scopeTypeLabel:
        scopeLocationMetadata?.scopeDescriptor?.local_type_label ??
        null,
      scopeTypeKey:
        scopeLocationMetadata?.scopeDescriptor?.local_type_key ??
        null,
      scopeHierarchySystem:
        scopeLocationMetadata?.scopeDescriptor?.hierarchy_system ??
        null,
      manualStatus: scopeLocationMetadata?.manualStatus ?? null,
      summary: packet.body.summary ?? null,
      localityLabel: packet.body.locality_label ?? null,
      parentRouteId: parentRouteIdByPacketId.get(packet.header.packet_id) ?? null,
      structuralState:
        parentResolutionsByPacketId.get(packet.header.packet_id)?.structuralState ??
        'canonical',
      structuralRelationPacketIds: [
        ...(
          parentResolutionsByPacketId.get(packet.header.packet_id)
            ?.structuralRelationPacketIds ?? []
        ),
        ...(locationRelationPacketIdsByScopePacketId.get(packet.header.packet_id) ?? []),
      ],
      locationPacketIds: locationPacketIdsByScopePacketId.get(packet.header.packet_id) ?? [],
    } satisfies ScopeGraphNode;
  });
  const scopeMap = new Map(nodes.map((scopeNode) => [scopeNode.routeId, scopeNode]));
  const hasCanonicalHomeLocalityRelation =
    Boolean(input.actorPacketId) &&
    filterRelationPackets({
      relations: relationPackets,
      relationSubtype: 'home_locality',
      subjectPacketId: input.actorPacketId ?? null,
      activeOnly: true,
    }).length > 0;
  const canonicalHomeLocality = await resolveCanonicalHomeLocality({
      packetStore: input.packetStore,
      relationPackets,
      claimPackets,
      actorPacketId: input.actorPacketId ?? null,
      scopeMap,
    });
  const effectiveHomeLocality =
    canonicalHomeLocality ??
    (!hasCanonicalHomeLocalityRelation
      ? (() => {
      const compatibilityProjection = projectLegacyHomeLocalityCompatibility({
        claimPackets,
        actorPacketId: input.actorPacketId ?? null,
        scopeMap,
      });

      if (!compatibilityProjection) {
        return null;
      }

      return {
        source: 'legacy_home_locality_claim_compatibility' as const,
        relationPacketId: null,
        supportingClaimPacketIds: [],
        compatibilityClaimPacketId: compatibilityProjection.claimPacket.header.packet_id,
        scopeRouteId: compatibilityProjection.scopeRouteId,
        scopePacketId: compatibilityProjection.scopePacketId,
        ancestorRouteIds: compatibilityProjection.ancestorRouteIds,
        justificationPacketIds: compatibilityProjection.justificationPacketIds,
        policyEvaluationState: null,
      } satisfies EffectiveHomeLocalityProjection;
      })()
      : null);

  const mountedScopeIds = new Set<string>();
  const mountReasonsByScopeId = new Map<string, NexusScopeMountReason[]>();
  const justificationPacketIdsByScopeId = new Map<string, string[]>();
  const structuralRelationPacketIdsByScopeId = new Map<string, string[]>(
    nodes.map((scopeNode) => [scopeNode.routeId, [...scopeNode.structuralRelationPacketIds]])
  );
  const locationPacketIdsByScopeId = new Map<string, string[]>(
    nodes.map((scopeNode) => [scopeNode.routeId, [...scopeNode.locationPacketIds]])
  );
  const elementalScopeRelations = await resolveElementalScopeRelations({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId ?? null,
    request: input.request ?? null,
    scopeRouteIds: new Set(nodes.map((scopeNode) => scopeNode.routeId)),
    scopePacketIds,
  });
  const followedScopeIds = new Set<string>();
  const followKindByRouteId = new Map<string, string>();
  const globalScopeId =
    nodes.find((scopeNode) => getElementSubtypeLeaf(scopeNode.scopeSubtype) === 'global')
      ?.routeId ??
    nodes[0]?.routeId ??
    '';

  if (globalScopeId) {
    mountedScopeIds.add(globalScopeId);
    addMountReason(mountReasonsByScopeId, globalScopeId, 'global_default');
  }

  if (effectiveHomeLocality) {
    mountedScopeIds.add(effectiveHomeLocality.scopeRouteId);
    addMountReason(
      mountReasonsByScopeId,
      effectiveHomeLocality.scopeRouteId,
      'home_locality'
    );
    appendPacketIds(
      justificationPacketIdsByScopeId,
      effectiveHomeLocality.scopeRouteId,
      effectiveHomeLocality.justificationPacketIds
    );

    for (const ancestorRouteId of effectiveHomeLocality.ancestorRouteIds) {
      mountedScopeIds.add(ancestorRouteId);
      addMountReason(mountReasonsByScopeId, ancestorRouteId, 'home_ancestor');
      appendPacketIds(
        justificationPacketIdsByScopeId,
        ancestorRouteId,
        effectiveHomeLocality.justificationPacketIds
      );
    }
  }

  for (const [
    scopePacketId,
    relationPacketIds,
  ] of elementalScopeRelations.canonicalFollowRelationPacketIdsByScopePacketId.entries()) {
    const routeId = toRouteScopeId(scopePacketId);

    if (!scopeMap.has(routeId)) {
      continue;
    }

    followedScopeIds.add(routeId);
    followKindByRouteId.set(routeId, 'canonical_relation');
    appendPacketIds(justificationPacketIdsByScopeId, routeId, relationPacketIds);
  }

  for (const routeId of input.followedScopeIds) {
    if (followedScopeIds.has(routeId) || !scopeMap.has(routeId)) {
      continue;
    }

    followedScopeIds.add(routeId);
    followKindByRouteId.set(routeId, 'caller_followed_compatibility');
  }

  for (const routeId of elementalScopeRelations.compatibilityFollowedRouteIds) {
    if (followedScopeIds.has(routeId)) {
      continue;
    }

    followedScopeIds.add(routeId);
    followKindByRouteId.set(routeId, 'shell_preference_compatibility');
  }

  for (const followedScopeId of followedScopeIds) {
    mountedScopeIds.add(followedScopeId);
    addMountReason(mountReasonsByScopeId, followedScopeId, 'followed');
  }

  const associatedScopeIds = new Set<string>();
  const associationKindByRouteId = new Map<string, string>();
  const associatedScopeJustificationPacketIdsByRouteId = new Map<string, string[]>();

  for (const [
    scopePacketId,
    relationPacketIds,
  ] of elementalScopeRelations.canonicalAssociationRelationPacketIdsByScopePacketId.entries()) {
    const routeId = toRouteScopeId(scopePacketId);

    if (!scopeMap.has(routeId)) {
      continue;
    }

    associatedScopeIds.add(routeId);
    mountedScopeIds.add(routeId);
    addMountReason(mountReasonsByScopeId, routeId, 'associated');
    associationKindByRouteId.set(routeId, 'canonical_relation_assertion');
    associatedScopeJustificationPacketIdsByRouteId.set(routeId, relationPacketIds);
    appendPacketIds(justificationPacketIdsByScopeId, routeId, relationPacketIds);
  }

  for (const [
    scopePacketId,
    claimPacketIds,
  ] of elementalScopeRelations.compatibilityAssociatedScopeClaimIdsByPacketId.entries()) {
    const routeId = toRouteScopeId(scopePacketId);

    if (!scopeMap.has(routeId) || associatedScopeIds.has(routeId)) {
      continue;
    }

    associatedScopeIds.add(routeId);
    mountedScopeIds.add(routeId);
    addMountReason(mountReasonsByScopeId, routeId, 'associated');
    associationKindByRouteId.set(routeId, 'assembly_association_claim_compatibility');
    associatedScopeJustificationPacketIdsByRouteId.set(routeId, claimPacketIds);
    appendPacketIds(justificationPacketIdsByScopeId, routeId, claimPacketIds);
  }

  const knownScopeIds = new Set(nodes.map((scopeNode) => scopeNode.routeId));
  const discoverableScopeIds = new Set(knownScopeIds);
  const geographicMountedScopeIds = nodes
    .map((scopeNode) => scopeNode.routeId)
    .filter((scopeId) => {
      const reasons = mountReasonsByScopeId.get(scopeId) ?? [];

      return reasons.some((reason) =>
        reason === 'global_default' ||
        reason === 'home_locality' ||
        reason === 'home_ancestor'
      );
    });
  const knownUnmountedScopeIds = nodes
    .map((scopeNode) => scopeNode.routeId)
    .filter((scopeId) => !mountedScopeIds.has(scopeId));

  return {
    nodes,
    defaultScopeId: effectiveHomeLocality?.scopeRouteId ?? globalScopeId,
    personalParentScopeId: effectiveHomeLocality?.scopeRouteId ?? globalScopeId,
    mountedScopeIds,
    mountReasonsByScopeId,
    homeScopeId: effectiveHomeLocality?.scopeRouteId ?? null,
    effectiveHomeLocality,
    followedScopeIds,
    followKindByRouteId,
    associatedScopeIds,
    associationKindByRouteId,
    associatedScopeJustificationPacketIdsByRouteId,
    knownScopeIds,
    discoverableScopeIds,
    geographicMountedScopeIds,
    knownUnmountedScopeIds,
    justificationPacketIdsByScopeId,
    structuralRelationPacketIdsByScopeId,
    locationPacketIdsByScopeId,
  };
}

export function buildPersonalScopeSummary(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  parentScopeId?: string | null;
}): NexusScopeSummary {
  return {
    id: 'you',
    packetId: input.actorPacket.header.packet_id,
    name: 'You',
    shortLabel: 'You',
    level: 'personal',
    scopeSubtype: input.actorPacket.body.subtype ?? null,
    scopeSystem: input.actorPacket.body.scope_system ?? null,
    description:
      'Packet-backed personal scope lens anchored to the current actor element.',
    localityLabel: input.actorPacket.body.locality_label ?? input.actorPacket.body.name,
    badge:
      input.actorPacket.body.identity?.claim_status === 'claimed'
        ? 'Claimed actor'
        : 'Guest actor',
    relationshipLabel: 'Current actor scope',
    parentId: input.parentScopeId ?? undefined,
    childIds: [],
    followedScopeIds: [],
    isKnown: true,
    isMounted: true,
    isDiscoverable: false,
    isFollowed: false,
    isAssociated: false,
    isHomeAncestor: false,
    structuralState: 'canonical',
    associationKind: null,
    mountReasons: ['personal_default'],
    justificationPacketIds: [],
    structuralRelationPacketIds: [],
    locationPacketIds: [],
    publicLobbyLabel: 'Personal trust lens',
    stats: {
      members: 1,
      activeVotes: 0,
      hotDiscussions: 0,
      missions: 0,
      guestLobbyOpen: false,
    },
  };
}

export function buildScopeSummaryFromGraph(input: {
  node: ScopeGraphNode;
  childIds: string[];
  followedScopeIds: string[];
  isMounted: boolean;
  isKnown: boolean;
  isDiscoverable: boolean;
  isFollowed: boolean;
  isAssociated: boolean;
  isHomeAncestor: boolean;
  associationKind?: string | null;
  mountReasons: NexusScopeMountReason[];
  justificationPacketIds: string[];
  stats: NexusScopeSummary['stats'];
  parentName: string | null;
}): NexusScopeSummary {
  return {
    id: input.node.routeId,
    packetId: input.node.packetId,
    name: input.node.name,
    shortLabel: input.node.shortLabel,
    level: input.node.level,
    scopeSubtype: input.node.scopeSubtype,
    scopeSystem: input.node.scopeSystem,
    scopeTypeLabel: input.node.scopeTypeLabel,
    scopeTypeKey: input.node.scopeTypeKey,
    scopeHierarchySystem: input.node.scopeHierarchySystem,
    manualStatus: input.node.manualStatus,
    description:
      input.node.summary ?? `Packet-backed assembly scope for ${input.node.name}.`,
    localityLabel:
      input.node.localityLabel ?? `${input.node.name} assembly locality`,
    badge:
      getElementSubtypeLeaf(input.node.scopeSubtype) === 'global'
        ? 'Guest default'
        : 'Assembly scope',
    relationshipLabel:
      input.node.parentRouteId === null
        ? 'Root assembly scope'
        : `Child of ${input.parentName ?? 'parent scope'}`,
    parentId: input.node.parentRouteId ?? undefined,
    childIds: input.childIds,
    followedScopeIds: input.followedScopeIds,
    isKnown: input.isKnown,
    isMounted: input.isMounted,
    isDiscoverable: input.isDiscoverable,
    isFollowed: input.isFollowed,
    isAssociated: input.isAssociated,
    isHomeAncestor: input.isHomeAncestor,
    structuralState: input.node.structuralState,
    associationKind: input.associationKind ?? null,
    mountReasons: input.mountReasons,
    justificationPacketIds: input.justificationPacketIds,
    structuralRelationPacketIds: input.node.structuralRelationPacketIds,
    locationPacketIds: input.node.locationPacketIds,
    publicLobbyLabel: `${input.node.name} visitor lobby`,
    stats: input.stats,
  };
}
