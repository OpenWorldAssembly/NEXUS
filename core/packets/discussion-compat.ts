/**
 * File: discussion-compat.ts
 * Description: Bidirectional compatibility helpers for legacy discussion families and canonical Discussion packets.
 */

import {
  createDiscussionForumPacket,
  createDiscussionPacket,
  createDiscussionPostPacket,
  createDiscussionReplyPacket,
  createDiscussionSpacePacket,
  createDiscussionThreadPacket,
  createPacketEdge,
  createPacketRef,
} from '@core/packets/builders';
import type { PacketHeadStatus } from '@core/contracts';
import type {
  PacketTargetMigrationPlan,
  PacketTargetResolution,
} from '@core/packets/packet-target-resolver';
import type {
  DiscussionKind,
  PacketAdaptationChange,
  PacketAdaptationLoss,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketFamily,
  PacketRef,
} from '@core/schema/packet-schema';

export const DISCUSSION_LEGACY_FAMILIES = [
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
] as const;

export type DiscussionLegacyFamily =
  (typeof DISCUSSION_LEGACY_FAMILIES)[number];

export type DiscussionLegacyPacket =
  | PacketEnvelopeByType['DiscussionSpace']
  | PacketEnvelopeByType['DiscussionForum']
  | PacketEnvelopeByType['DiscussionThread']
  | PacketEnvelopeByType['DiscussionPost']
  | PacketEnvelopeByType['DiscussionReply'];

export type DiscussionSourcePacket =
  | PacketEnvelopeByType['Discussion']
  | DiscussionLegacyPacket;

export type DiscussionAdaptationReport = {
  source_family: PacketFamily;
  source_schema_version: string;
  target_family: PacketFamily;
  target_schema_version: string;
  direction: 'legacy_to_canonical' | 'canonical_to_legacy' | 'same_family';
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  is_lossy: boolean;
  is_exact: boolean;
  requires_loss_acknowledgement: boolean;
};

export type InterpretedDiscussionNode = {
  packet_ref: PacketRef;
  revision_ref: PacketRef & { revision_id: string };
  source_family: PacketFamily;
  canonical_packet_ref: PacketRef | null;
  kind: DiscussionKind;
  role: string;
  parent_packet_id: string | null;
  topic_packet_id: string | null;
  root_message_packet_id: string | null;
  title: string;
  summary: string | null;
  content_markdown: string | null;
  status: string;
  authority_scope_packet_id: string | null;
  applicable_scope_packet_ids: string[];
  created_at: string;
  adaptation: DiscussionAdaptationReport;
};

function createCompatibilityChange(input: {
  sourceFamily: PacketFamily;
  targetFamily: PacketFamily;
  path: string;
  message: string;
}): PacketAdaptationChange {
  return {
    kind: 'moved_field',
    path: input.path,
    from_schema_version: input.sourceFamily,
    to_schema_version: input.targetFamily,
    message: input.message,
  };
}

function createReport(input: {
  sourceFamily: PacketFamily;
  sourceSchemaVersion: string;
  targetFamily: PacketFamily;
  targetSchemaVersion?: string;
  direction: DiscussionAdaptationReport['direction'];
  changes?: PacketAdaptationChange[];
  losses?: PacketAdaptationLoss[];
}): DiscussionAdaptationReport {
  const changes = input.changes ?? [];
  const losses = input.losses ?? [];

  return {
    source_family: input.sourceFamily,
    source_schema_version: input.sourceSchemaVersion,
    target_family: input.targetFamily,
    target_schema_version: input.targetSchemaVersion ?? '1.0.0',
    direction: input.direction,
    changes,
    losses,
    is_lossy: losses.length > 0,
    is_exact: changes.length === 0 && losses.length === 0,
    requires_loss_acknowledgement: losses.length > 0,
  };
}

function hashPacketId(input: string): string {
  let hashA = 2166136261;
  let hashB = 3335557771;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 16777619) >>> 0;
    hashB ^= code;
    hashB = Math.imul(hashB, 2246822519) >>> 0;
  }

  return `${hashA.toString(16).padStart(8, '0')}${hashB
    .toString(16)
    .padStart(8, '0')}`;
}

function slugPacketId(input: string): string {
  const slug = input
    .replace(/^nexus:/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 56)
    .replace(/-+$/g, '');

  return `${slug || 'packet'}-${hashPacketId(input).slice(0, 12)}`;
}

export function createCanonicalDiscussionPacketId(sourcePacketId: string): string {
  if (sourcePacketId.startsWith('nexus:discussion/')) {
    return sourcePacketId;
  }

  return `nexus:discussion/compat/${slugPacketId(sourcePacketId)}`;
}

export function toDiscussionOperationalPacketId(packetId: string): string {
  return createCanonicalDiscussionPacketId(packetId);
}

export function isCanonicalDiscussionPacketId(packetId: string): boolean {
  return packetId === toDiscussionOperationalPacketId(packetId);
}

export function areDiscussionPacketIdsEquivalent(
  leftPacketId: string,
  rightPacketId: string
): boolean {
  return (
    toDiscussionOperationalPacketId(leftPacketId) ===
    toDiscussionOperationalPacketId(rightPacketId)
  );
}

export function resolvePreferredDiscussionPacketId(input: {
  candidate_packet_ids: Iterable<string>;
  requested_packet_id: string;
}): string | null {
  const requestedOperationalPacketId = toDiscussionOperationalPacketId(
    input.requested_packet_id
  );
  const equivalentPacketIds = [...input.candidate_packet_ids].filter((packetId) =>
    areDiscussionPacketIdsEquivalent(packetId, input.requested_packet_id)
  );

  if (equivalentPacketIds.length === 0) {
    return null;
  }

  equivalentPacketIds.sort((leftPacketId, rightPacketId) => {
    if (leftPacketId === requestedOperationalPacketId) {
      return -1;
    }

    if (rightPacketId === requestedOperationalPacketId) {
      return 1;
    }

    const leftIsCanonical = isCanonicalDiscussionPacketId(leftPacketId);
    const rightIsCanonical = isCanonicalDiscussionPacketId(rightPacketId);

    if (leftIsCanonical !== rightIsCanonical) {
      return leftIsCanonical ? -1 : 1;
    }

    return leftPacketId.localeCompare(rightPacketId);
  });

  return equivalentPacketIds[0] ?? null;
}

export function getDiscussionPacketAliases(packet: DiscussionSourcePacket): {
  canonical_packet_id: string;
  legacy_source_packet_ids: string[];
} {
  if (packet.header.family !== 'Discussion') {
    return {
      canonical_packet_id: createCanonicalDiscussionPacketId(packet.header.packet_id),
      legacy_source_packet_ids: [packet.header.packet_id],
    };
  }

  const legacySourcePacketIds = packet.header.edges
    .filter((edge) => edge.edge_type === 'derived_from')
    .map((edge) => edge.target.packet_id);

  return {
    canonical_packet_id: packet.header.packet_id,
    legacy_source_packet_ids: legacySourcePacketIds,
  };
}

function createMirrorRevisionId(packetId: string, sourceRevisionId: string): string {
  return `${packetId}@compat-${hashPacketId(sourceRevisionId).slice(0, 12)}`;
}

function canonicalRef(sourcePacketId: string): PacketRef {
  return createPacketRef(createCanonicalDiscussionPacketId(sourcePacketId));
}

function getLegacyDiscussionDependencyPacketIds(packet: DiscussionLegacyPacket): string[] {
  if (packet.header.family === 'DiscussionSpace') {
    return [];
  }

  if (packet.header.family === 'DiscussionForum') {
    return [
      (packet as PacketEnvelopeByType['DiscussionForum']).body.discussion_space_ref
        .packet_id,
    ];
  }

  if (packet.header.family === 'DiscussionThread') {
    return [(packet as PacketEnvelopeByType['DiscussionThread']).body.forum_ref.packet_id];
  }

  if (packet.header.family === 'DiscussionPost') {
    const discussionPostPacket = packet as PacketEnvelopeByType['DiscussionPost'];

    return [
      discussionPostPacket.body.thread_ref.packet_id,
      ...(discussionPostPacket.body.reply_to_ref
        ? [discussionPostPacket.body.reply_to_ref.packet_id]
        : []),
    ];
  }

  const discussionReplyPacket = packet as PacketEnvelopeByType['DiscussionReply'];

  return [
    discussionReplyPacket.body.thread_ref.packet_id,
    discussionReplyPacket.body.root_post_ref.packet_id,
    discussionReplyPacket.body.reply_to_ref.packet_id,
  ];
}

export function isDiscussionLegacyFamily(
  family: PacketFamily | string
): family is DiscussionLegacyFamily {
  return DISCUSSION_LEGACY_FAMILIES.includes(family as DiscussionLegacyFamily);
}

export interface CanonicalDiscussionTargetResolution {
  requested_packet_id: string;
  resolved_packet_id: string;
  canonical_packet_id: string;
  source_packet: DiscussionSourcePacket | null;
  canonical_packet: PacketEnvelopeByType['Discussion'] | null;
  should_create_mirror: boolean;
}

function toPreferredRevision(packet: PacketEnvelope) {
  return {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  };
}

function createFamilyHistory(packet: PacketEnvelope) {
  return [
    {
      family: packet.header.family,
      schema_version: packet.header.schema_version,
      adapter_profile: 'discussion-family-unification',
    },
  ];
}

function createCompatibilityMetadata(packet: PacketEnvelope) {
  return {
    family_history: createFamilyHistory(packet),
    compatible_targets: [
      {
        family: packet.header.family,
        schema_version: packet.header.schema_version,
        mode: 'exact' as const,
        required_features: [],
        omitted_features: [],
      },
    ],
    migration_policy: {
      allow_virtual_downcast: true,
      allow_guarded_shadow_write: false,
      requires_loss_acknowledgement: false,
    },
  };
}

export function isDiscussionSourcePacket(
  packet: PacketEnvelope | null | undefined
): packet is DiscussionSourcePacket {
  return (
    packet?.header.family === 'Discussion' ||
    packet?.header.family === 'DiscussionSpace' ||
    packet?.header.family === 'DiscussionForum' ||
    packet?.header.family === 'DiscussionThread' ||
    packet?.header.family === 'DiscussionPost' ||
    packet?.header.family === 'DiscussionReply'
  );
}

export function isDiscussionMessagePacket(
  packet: PacketEnvelope | null | undefined
): packet is PacketEnvelopeByType['Discussion'] {
  return (
    packet?.header.family === 'Discussion' &&
    (packet as PacketEnvelopeByType['Discussion']).body.kind === 'message'
  );
}

export function interpretDiscussionPacket(
  packet: DiscussionSourcePacket
): InterpretedDiscussionNode {
  const base = {
    packet_ref: { packet_id: packet.header.packet_id },
    revision_ref: {
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    },
    source_family: packet.header.family,
    canonical_packet_ref:
      packet.header.family === 'Discussion'
        ? { packet_id: packet.header.packet_id }
        : canonicalRef(packet.header.packet_id),
    authority_scope_packet_id: packet.header.authority_scope_ref?.packet_id ?? null,
    applicable_scope_packet_ids: packet.header.applicable_scope_refs.map(
      (scopeRef) => scopeRef.packet_id
    ),
    created_at: packet.header.created_at,
  };

  if (packet.header.family === 'Discussion') {
    const discussionPacket = packet as PacketEnvelopeByType['Discussion'];
    const body = discussionPacket.body;
    const parentPacketId =
      body.kind === 'space' ? null : body.parent_ref.packet_id;

    return {
      ...base,
      kind: body.kind,
      role: body.role,
      parent_packet_id: parentPacketId,
      topic_packet_id: body.kind === 'message' ? body.topic_ref.packet_id : null,
      root_message_packet_id:
        body.kind === 'message' ? body.root_message_ref?.packet_id ?? null : null,
      title: body.title,
      summary: body.summary ?? null,
      content_markdown:
        body.kind === 'message' || body.kind === 'post'
          ? body.content_markdown
          : null,
      status: body.status,
      adaptation: createReport({
        sourceFamily: 'Discussion',
        sourceSchemaVersion: packet.header.schema_version,
        targetFamily: 'Discussion',
        direction: 'same_family',
      }),
    };
  }

  const changes = [
    createCompatibilityChange({
      sourceFamily: packet.header.family,
      targetFamily: 'Discussion',
      path: 'header.family',
      message: `Interpreted legacy ${packet.header.family} packet as canonical Discussion node.`,
    }),
  ];
  const adaptation = createReport({
    sourceFamily: packet.header.family,
    sourceSchemaVersion: packet.header.schema_version,
    targetFamily: 'Discussion',
    direction: 'legacy_to_canonical',
    changes,
  });

  if (packet.header.family === 'DiscussionSpace') {
    const discussionSpacePacket = packet as PacketEnvelopeByType['DiscussionSpace'];
    return {
      ...base,
      kind: 'space',
      role: 'space',
      parent_packet_id: null,
      topic_packet_id: null,
      root_message_packet_id: null,
      title: discussionSpacePacket.body.title,
      summary: discussionSpacePacket.body.summary ?? null,
      content_markdown: null,
      status: discussionSpacePacket.body.status,
      adaptation,
    };
  }

  if (packet.header.family === 'DiscussionForum') {
    const discussionForumPacket = packet as PacketEnvelopeByType['DiscussionForum'];
    return {
      ...base,
      kind: 'forum',
      role: discussionForumPacket.body.forum_kind,
      parent_packet_id: createCanonicalDiscussionPacketId(
        discussionForumPacket.body.discussion_space_ref.packet_id
      ),
      topic_packet_id: null,
      root_message_packet_id: null,
      title: discussionForumPacket.body.title,
      summary: discussionForumPacket.body.summary ?? null,
      content_markdown: null,
      status: discussionForumPacket.body.status,
      adaptation,
    };
  }

  if (packet.header.family === 'DiscussionThread') {
    const discussionThreadPacket = packet as PacketEnvelopeByType['DiscussionThread'];
    return {
      ...base,
      kind: 'topic',
      role: discussionThreadPacket.body.thread_kind,
      parent_packet_id: createCanonicalDiscussionPacketId(
        discussionThreadPacket.body.forum_ref.packet_id
      ),
      topic_packet_id: null,
      root_message_packet_id: null,
      title: discussionThreadPacket.body.title,
      summary: discussionThreadPacket.body.summary ?? null,
      content_markdown: null,
      status: discussionThreadPacket.body.status,
      adaptation,
    };
  }

  if (packet.header.family === 'DiscussionPost') {
    const discussionPostPacket = packet as PacketEnvelopeByType['DiscussionPost'];
    return {
      ...base,
      kind: 'post',
      role: discussionPostPacket.body.post_kind,
      parent_packet_id: createCanonicalDiscussionPacketId(
        discussionPostPacket.body.thread_ref.packet_id
      ),
      topic_packet_id: null,
      root_message_packet_id: null,
      title: discussionPostPacket.body.title,
      summary: null,
      content_markdown: discussionPostPacket.body.content_markdown,
      status: 'open',
      adaptation,
    };
  }

  const discussionReplyPacket = packet as PacketEnvelopeByType['DiscussionReply'];

  return {
    ...base,
    kind: 'message',
    role: 'reply',
    parent_packet_id: createCanonicalDiscussionPacketId(
      discussionReplyPacket.body.reply_to_ref.packet_id
    ),
    topic_packet_id: createCanonicalDiscussionPacketId(
      discussionReplyPacket.body.thread_ref.packet_id
    ),
    root_message_packet_id: createCanonicalDiscussionPacketId(
      discussionReplyPacket.body.root_post_ref.packet_id
    ),
    title: discussionReplyPacket.body.title,
    summary: null,
    content_markdown: discussionReplyPacket.body.content_markdown,
    status: 'open',
    adaptation,
  };
}

export function createCanonicalDiscussionMirrorPacket(
  packet: DiscussionLegacyPacket
): PacketEnvelopeByType['Discussion'] {
  const packetId = createCanonicalDiscussionPacketId(packet.header.packet_id);
  const common = {
    packet_id: packetId,
    revision_id: createMirrorRevisionId(packetId, packet.header.revision_id),
    created_at: packet.header.created_at,
    authority_scope_ref: packet.header.authority_scope_ref,
    applicable_scope_refs: packet.header.applicable_scope_refs,
    created_by: packet.header.provenance.created_by,
    submitted_by: packet.header.provenance.submitted_by,
    adapter: 'nexus-compat',
    metadata_compatibility: createCompatibilityMetadata(packet),
    edges: [
      createPacketEdge('derived_from', packet.header.packet_id, {
        adapter_profile: 'discussion-family-unification',
      }),
    ],
  };

  if (packet.header.family === 'DiscussionSpace') {
    const discussionSpacePacket = packet as PacketEnvelopeByType['DiscussionSpace'];
    return createDiscussionPacket({
      ...common,
      metadata_tags: ['discussion', 'space', 'compat'],
      kind: 'space',
      role: 'space',
      title: discussionSpacePacket.body.title,
      summary: discussionSpacePacket.body.summary ?? null,
      status: discussionSpacePacket.body.status,
      scope_ref: discussionSpacePacket.body.scope_ref,
    });
  }

  if (packet.header.family === 'DiscussionForum') {
    const discussionForumPacket = packet as PacketEnvelopeByType['DiscussionForum'];
    return createDiscussionPacket({
      ...common,
      metadata_tags: ['discussion', 'forum', discussionForumPacket.body.forum_kind, 'compat'],
      kind: 'forum',
      role: discussionForumPacket.body.forum_kind,
      title: discussionForumPacket.body.title,
      summary: discussionForumPacket.body.summary ?? null,
      status: discussionForumPacket.body.status,
      parent_ref: canonicalRef(discussionForumPacket.body.discussion_space_ref.packet_id),
      participation_rules: discussionForumPacket.body.participation_rules,
      default_sort: discussionForumPacket.body.default_sort,
    });
  }

  if (packet.header.family === 'DiscussionThread') {
    const discussionThreadPacket = packet as PacketEnvelopeByType['DiscussionThread'];
    return createDiscussionPacket({
      ...common,
      metadata_tags: ['discussion', 'topic', discussionThreadPacket.body.thread_kind, 'compat'],
      kind: 'topic',
      role: discussionThreadPacket.body.thread_kind,
      title: discussionThreadPacket.body.title,
      summary: discussionThreadPacket.body.summary ?? null,
      status: discussionThreadPacket.body.status,
      parent_ref: canonicalRef(discussionThreadPacket.body.forum_ref.packet_id),
      related_refs: discussionThreadPacket.body.related_refs,
      participation_rules: discussionThreadPacket.body.participation_rules,
      default_sort: discussionThreadPacket.body.default_sort,
    });
  }

  if (packet.header.family === 'DiscussionPost') {
    const discussionPostPacket = packet as PacketEnvelopeByType['DiscussionPost'];
    return createDiscussionPacket({
      ...common,
      metadata_tags: ['discussion', 'post', discussionPostPacket.body.post_kind, 'compat'],
      kind: 'post',
      role: discussionPostPacket.body.post_kind,
      title: discussionPostPacket.body.title,
      status: 'open',
      parent_ref: canonicalRef(discussionPostPacket.body.thread_ref.packet_id),
      related_refs: discussionPostPacket.body.reply_to_ref
        ? [discussionPostPacket.body.reply_to_ref]
        : [],
      content_markdown: discussionPostPacket.body.content_markdown,
    });
  }

  const discussionReplyPacket = packet as PacketEnvelopeByType['DiscussionReply'];

  return createDiscussionPacket({
    ...common,
    metadata_tags: ['discussion', 'message', 'reply', 'compat'],
    kind: 'message',
    role: 'reply',
    title: discussionReplyPacket.body.title,
    status: 'open',
    parent_ref: canonicalRef(discussionReplyPacket.body.reply_to_ref.packet_id),
    topic_ref: canonicalRef(discussionReplyPacket.body.thread_ref.packet_id),
    root_message_ref: canonicalRef(discussionReplyPacket.body.root_post_ref.packet_id),
    content_markdown: discussionReplyPacket.body.content_markdown,
  });
}

export async function resolveDiscussionPacketTarget(input: {
  packet_id: string;
  fetchPacket: (packetId: string) => Promise<PacketEnvelope | null>;
  fetchRevisionHeads?: (packetId: string) => Promise<PacketHeadStatus | null>;
}): Promise<PacketTargetResolution> {
  const sourcePacket = await input.fetchPacket(input.packet_id);

  if (!sourcePacket) {
    return {
      requested_packet_id: input.packet_id,
      resolved_packet_id: null,
      canonical_packet_id: createCanonicalDiscussionPacketId(input.packet_id),
      source_packet: null,
      resolved_packet: null,
      preferred_revision: null,
      basis: 'deterministic_mirror',
      currentness_status: 'missing',
      warnings: [`Discussion packet ${input.packet_id} was not found.`],
    };
  }

  if (!isDiscussionSourcePacket(sourcePacket)) {
    throw new Error(`Packet ${input.packet_id} is not a discussion packet.`);
  }

  if (sourcePacket.header.family === 'Discussion') {
    const heads = input.fetchRevisionHeads
      ? await input.fetchRevisionHeads(sourcePacket.header.packet_id)
      : null;

    if (heads && heads.head_revisions.length > 1 && heads.preferred_revision === null) {
      return {
        requested_packet_id: input.packet_id,
        resolved_packet_id: null,
        canonical_packet_id: sourcePacket.header.packet_id,
        source_packet: sourcePacket,
        resolved_packet: null,
        preferred_revision: null,
        basis: 'same_id_preferred_revision',
        currentness_status: 'ambiguous',
        warnings: [
          `Discussion packet ${sourcePacket.header.packet_id} has multiple head revisions without a preferred revision.`,
        ],
      };
    }

    return {
      requested_packet_id: input.packet_id,
      resolved_packet_id: sourcePacket.header.packet_id,
      canonical_packet_id: sourcePacket.header.packet_id,
      source_packet: sourcePacket,
      resolved_packet: sourcePacket,
      preferred_revision: heads?.preferred_revision ?? toPreferredRevision(sourcePacket),
      basis: 'native',
      currentness_status: 'current',
      warnings: [],
    };
  }

  const canonicalPacketId = createCanonicalDiscussionPacketId(
    sourcePacket.header.packet_id
  );
  const canonicalPacket = await input.fetchPacket(canonicalPacketId);

  if (canonicalPacket?.header.family !== 'Discussion') {
    return {
      requested_packet_id: input.packet_id,
      resolved_packet_id: null,
      canonical_packet_id: canonicalPacketId,
      source_packet: sourcePacket,
      resolved_packet: null,
      preferred_revision: null,
      basis: 'deterministic_mirror',
      currentness_status: 'missing',
      warnings: [],
    };
  }

  const heads = input.fetchRevisionHeads
    ? await input.fetchRevisionHeads(canonicalPacket.header.packet_id)
    : null;

  if (heads && heads.head_revisions.length > 1 && heads.preferred_revision === null) {
    return {
      requested_packet_id: input.packet_id,
      resolved_packet_id: null,
      canonical_packet_id: canonicalPacket.header.packet_id,
      source_packet: sourcePacket,
      resolved_packet: null,
      preferred_revision: null,
      basis: 'deterministic_mirror',
      currentness_status: 'ambiguous',
      warnings: [
        `Canonical discussion target ${canonicalPacket.header.packet_id} has multiple head revisions without a preferred revision.`,
      ],
    };
  }

  const preferredRevision =
    heads?.preferred_revision ?? toPreferredRevision(canonicalPacket);
  const warnings: string[] = [];
  const expectedMirrorRevisionId = createMirrorRevisionId(
    canonicalPacketId,
    sourcePacket.header.revision_id
  );

  if (preferredRevision.revision_id !== expectedMirrorRevisionId) {
    warnings.push(
      `Canonical discussion target ${canonicalPacket.header.packet_id} has moved beyond legacy source revision ${sourcePacket.header.revision_id}; using canonical preferred revision ${preferredRevision.revision_id}.`
    );
  }

  return {
    requested_packet_id: input.packet_id,
    resolved_packet_id: canonicalPacket.header.packet_id,
    canonical_packet_id: canonicalPacket.header.packet_id,
    source_packet: sourcePacket,
    resolved_packet: canonicalPacket,
    preferred_revision: preferredRevision,
    basis: 'deterministic_mirror',
    currentness_status: 'canonicalized',
    warnings,
  };
}

export async function planDiscussionPacketTargetMigration(input: {
  packet_id: string;
  fetchPacket: (packetId: string) => Promise<PacketEnvelope | null>;
  fetchRevisionHeads?: (packetId: string) => Promise<PacketHeadStatus | null>;
  resolution?: PacketTargetResolution;
  planned?: Map<string, PacketEnvelopeByType['Discussion']>;
  visiting?: Set<string>;
}): Promise<PacketTargetMigrationPlan> {
  const resolution =
    input.resolution ??
    (await resolveDiscussionPacketTarget({
      packet_id: input.packet_id,
      fetchPacket: input.fetchPacket,
      fetchRevisionHeads: input.fetchRevisionHeads,
    }));
  const sourcePacket = resolution.source_packet;
  const planned = input.planned ?? new Map<string, PacketEnvelopeByType['Discussion']>();
  const visiting = input.visiting ?? new Set<string>();

  if (!sourcePacket) {
    return {
      requested_packet_id: input.packet_id,
      canonical_packet_id: resolution.canonical_packet_id,
      packets: [...planned.values()],
      warnings: resolution.warnings,
      blocked_reason: null,
      requires_mutation_corridor: true,
    };
  }

  if (!isDiscussionSourcePacket(sourcePacket)) {
    throw new Error(`Packet ${input.packet_id} is not a discussion packet.`);
  }

  if (resolution.currentness_status === 'ambiguous') {
    return {
      requested_packet_id: input.packet_id,
      canonical_packet_id: resolution.canonical_packet_id,
      packets: [...planned.values()],
      warnings: resolution.warnings,
      blocked_reason: `Discussion packet ${input.packet_id} does not have one defensible operational target.`,
      requires_mutation_corridor: true,
    };
  }

  if (sourcePacket.header.family === 'Discussion') {
    return {
      requested_packet_id: input.packet_id,
      canonical_packet_id: sourcePacket.header.packet_id,
      packets: [...planned.values()],
      warnings: resolution.warnings,
      blocked_reason: null,
      requires_mutation_corridor: true,
    };
  }

  if (!resolution.canonical_packet_id) {
    return {
      requested_packet_id: input.packet_id,
      canonical_packet_id: null,
      packets: [...planned.values()],
      warnings: resolution.warnings,
      blocked_reason: `Discussion packet ${input.packet_id} does not have a canonical target id.`,
      requires_mutation_corridor: true,
    };
  }

  if (planned.has(resolution.canonical_packet_id) || resolution.resolved_packet) {
    return {
      requested_packet_id: input.packet_id,
      canonical_packet_id: resolution.canonical_packet_id,
      packets: [...planned.values()],
      warnings: resolution.warnings,
      blocked_reason: null,
      requires_mutation_corridor: true,
    };
  }

  if (visiting.has(sourcePacket.header.packet_id)) {
    return {
      requested_packet_id: input.packet_id,
      canonical_packet_id: resolution.canonical_packet_id,
      packets: [...planned.values()],
      warnings: [
        ...resolution.warnings,
        `Cyclic discussion compatibility chain at ${sourcePacket.header.packet_id}.`,
      ],
      blocked_reason: `Cyclic discussion compatibility chain at ${sourcePacket.header.packet_id}.`,
      requires_mutation_corridor: true,
    };
  }

  visiting.add(sourcePacket.header.packet_id);

  for (const dependencyId of getLegacyDiscussionDependencyPacketIds(
    sourcePacket as DiscussionLegacyPacket
  )) {
    const dependencyPlan = await planDiscussionPacketTargetMigration({
      packet_id: dependencyId,
      fetchPacket: input.fetchPacket,
      fetchRevisionHeads: input.fetchRevisionHeads,
      planned,
      visiting,
    });

    if (dependencyPlan.blocked_reason) {
      return dependencyPlan;
    }
  }

  planned.set(
    resolution.canonical_packet_id,
    createCanonicalDiscussionMirrorPacket(sourcePacket as DiscussionLegacyPacket)
  );
  visiting.delete(sourcePacket.header.packet_id);

  return {
    requested_packet_id: input.packet_id,
    canonical_packet_id: resolution.canonical_packet_id,
    packets: [...planned.values()],
    warnings: resolution.warnings,
    blocked_reason: null,
    requires_mutation_corridor: true,
  };
}

export async function resolveCanonicalDiscussionTarget(input: {
  packet_id: string;
  fetchPacket: (packetId: string) => Promise<PacketEnvelope | null>;
}): Promise<CanonicalDiscussionTargetResolution> {
  const resolution = await resolveDiscussionPacketTarget({
    packet_id: input.packet_id,
    fetchPacket: input.fetchPacket,
  });
  const sourcePacket = resolution.source_packet;
  const canonicalPacket =
    resolution.resolved_packet?.header.family === 'Discussion'
      ? (resolution.resolved_packet as PacketEnvelopeByType['Discussion'])
      : null;

  if (!sourcePacket) {
    return {
      requested_packet_id: input.packet_id,
      resolved_packet_id: input.packet_id,
      canonical_packet_id:
        resolution.canonical_packet_id ?? createCanonicalDiscussionPacketId(input.packet_id),
      source_packet: null,
      canonical_packet: null,
      should_create_mirror: false,
    };
  }

  if (!isDiscussionSourcePacket(sourcePacket)) {
    throw new Error(`Packet ${input.packet_id} is not a discussion packet.`);
  }

  return {
    requested_packet_id: input.packet_id,
    resolved_packet_id: resolution.resolved_packet_id ?? sourcePacket.header.packet_id,
    canonical_packet_id:
      resolution.canonical_packet_id ?? createCanonicalDiscussionPacketId(input.packet_id),
    source_packet: sourcePacket as DiscussionSourcePacket,
    canonical_packet: canonicalPacket,
    should_create_mirror:
      sourcePacket.header.family !== 'Discussion' &&
      canonicalPacket === null &&
      resolution.currentness_status === 'missing',
  };
}

export function projectDiscussionPacketToLegacy(
  packet: PacketEnvelopeByType['Discussion'],
  targetFamily: DiscussionLegacyFamily
): PacketEnvelopeByType[DiscussionLegacyFamily] | null {
  const body = packet.body;
  const common = {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
    created_at: packet.header.created_at,
    authority_scope_ref: packet.header.authority_scope_ref,
    applicable_scope_refs: packet.header.applicable_scope_refs,
    created_by: packet.header.provenance.created_by,
    adapter: packet.header.provenance.adapter,
    metadata_tags: packet.header.metadata.tags,
    metadata_summary: packet.header.metadata.summary,
  };

  if (targetFamily === 'DiscussionSpace' && body.kind === 'space') {
    return createDiscussionSpacePacket({
      ...common,
      title: body.title,
      summary: body.summary ?? null,
      scope_ref: body.scope_ref,
      status: body.status,
    }) as PacketEnvelopeByType[DiscussionLegacyFamily];
  }

  if (targetFamily === 'DiscussionForum' && body.kind === 'forum') {
    return createDiscussionForumPacket({
      ...common,
      title: body.title,
      summary: body.summary ?? null,
      discussion_space_ref: body.parent_ref,
      forum_kind: body.role,
      status: body.status,
      participation_rules: body.participation_rules,
      default_sort: body.default_sort,
    }) as PacketEnvelopeByType[DiscussionLegacyFamily];
  }

  if (targetFamily === 'DiscussionThread' && body.kind === 'topic') {
    return createDiscussionThreadPacket({
      ...common,
      title: body.title,
      summary: body.summary ?? null,
      forum_ref: body.parent_ref,
      thread_kind: body.role,
      status: body.status,
      related_refs: body.related_refs,
      participation_rules: body.participation_rules,
      default_sort: body.default_sort,
    }) as PacketEnvelopeByType[DiscussionLegacyFamily];
  }

  if (targetFamily === 'DiscussionPost' && body.kind === 'post') {
    return createDiscussionPostPacket({
      ...common,
      title: body.title,
      thread_ref: body.parent_ref,
      post_kind: body.role,
      content_markdown: body.content_markdown ?? body.summary ?? body.title,
      reply_to_ref: null,
    }) as PacketEnvelopeByType[DiscussionLegacyFamily];
  }

  if (targetFamily === 'DiscussionPost' && body.kind === 'message') {
    if (body.root_message_ref) {
      return null;
    }

    return createDiscussionPostPacket({
      ...common,
      title: body.title,
      thread_ref: body.topic_ref,
      post_kind: body.role,
      content_markdown: body.content_markdown,
      reply_to_ref:
        body.parent_ref.packet_id === body.topic_ref.packet_id
          ? null
          : body.parent_ref,
    }) as PacketEnvelopeByType[DiscussionLegacyFamily];
  }

  if (targetFamily === 'DiscussionReply' && body.kind === 'message') {
    if (!body.root_message_ref) {
      return null;
    }

    return createDiscussionReplyPacket({
      ...common,
      title: body.title,
      thread_ref: body.topic_ref,
      root_post_ref: body.root_message_ref,
      reply_to_ref: body.parent_ref,
      content_markdown: body.content_markdown,
    }) as PacketEnvelopeByType[DiscussionLegacyFamily];
  }

  return null;
}
