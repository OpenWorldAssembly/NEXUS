/**
 * File: default-discussion-surfaces.ts
 * Description: Ensures newly minted locality scopes get empty local discussion surfaces.
 */

import {
  createDiscussionPacket,
  createPacketRef,
} from '@core/packets/builders';
import type {
  DiscussionActorClass,
  PacketEnvelopeByType,
  PacketRef,
} from '@core/schema/packet-schema';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

function createDiscussionSpaceId(scopePacketId: string): string {
  return `nexus:discussion/space/${scopePacketId.slice('nexus:element/'.length)}`;
}

function createDiscussionForumId(scopePacketId: string, forumKind: string): string {
  return `nexus:discussion/forum/${scopePacketId.slice('nexus:element/'.length)}-${forumKind.replace(/_/g, '-')}`;
}

function createDefaultDiscussionSurfacePackets(input: {
  scopePacketId: string;
  scopeName: string;
  createdAt: string;
  applicableScopeRefs: PacketRef[];
}): PacketEnvelopeByType['Discussion'][] {
  const guestForumActors = [
    'anonymous_guest',
    'scope_member',
    'trusted_member',
    'steward',
  ] satisfies DiscussionActorClass[];
  const memberForumActors = [
    'scope_member',
    'trusted_member',
    'steward',
  ] satisfies DiscussionActorClass[];
  const discussionSpaceRef = createPacketRef(
    createDiscussionSpaceId(input.scopePacketId)
  );
  const forumKinds = [
    {
      forum_kind: 'visitor_lobby',
      title: `${input.scopeName} visitor lobby`,
      summary:
        'Public newcomer space for orientation, introductions, and locality routing.',
      default_sort: 'new' as const,
      participation_rules: {
        top_level_actor_classes: guestForumActors,
        reply_actor_classes: guestForumActors,
        reaction_actor_classes: guestForumActors,
        top_level_post_cost: 0,
      },
    },
    {
      forum_kind: 'general',
      title: `${input.scopeName} general`,
      summary: 'Open assembly discussion for context, updates, and broad questions.',
      default_sort: 'hot' as const,
      participation_rules: {
        top_level_actor_classes: memberForumActors,
        reply_actor_classes: memberForumActors,
        reaction_actor_classes: memberForumActors,
        top_level_post_cost: 0,
      },
    },
    {
      forum_kind: 'proposals',
      title: `${input.scopeName} proposals`,
      summary:
        'Proposal review space for drafts, amendments, and governance context.',
      default_sort: 'hot' as const,
      participation_rules: {
        top_level_actor_classes: memberForumActors,
        reply_actor_classes: memberForumActors,
        reaction_actor_classes: memberForumActors,
        top_level_post_cost: 0,
      },
    },
  ];

  return [
    createDiscussionPacket({
      packet_id: discussionSpaceRef.packet_id,
      created_at: input.createdAt,
      authority_scope_ref: { packet_id: input.scopePacketId },
      applicable_scope_refs: input.applicableScopeRefs,
      kind: 'space',
      role: 'space',
      title: `${input.scopeName} discussions`,
      summary: `Packet-backed discussion surface for ${input.scopeName}.`,
      scope_ref: { packet_id: input.scopePacketId },
      status: 'open',
      metadata_tags: ['discussion', 'space', 'scope-discussions'],
    }),
    ...forumKinds.map((forumKind) =>
      createDiscussionPacket({
        packet_id: createDiscussionForumId(input.scopePacketId, forumKind.forum_kind),
        created_at: input.createdAt,
        authority_scope_ref: { packet_id: input.scopePacketId },
        applicable_scope_refs: input.applicableScopeRefs,
        kind: 'forum',
        role: forumKind.forum_kind,
        title: forumKind.title,
        summary: forumKind.summary,
        parent_ref: discussionSpaceRef,
        status: 'open',
        participation_rules: forumKind.participation_rules,
        default_sort: forumKind.default_sort,
        metadata_tags: ['discussion', 'forum', forumKind.forum_kind.replace(/_/g, '-')],
      })
    ),
  ];
}

export async function planDefaultDiscussionSurfaces(input: {
  packetStore: NodeSQLitePacketStore;
  scopePacketId: string;
  scopeName: string;
  applicableScopeRefs: PacketRef[];
}): Promise<PacketEnvelopeByType['Discussion'][]> {
  const plannedPackets: PacketEnvelopeByType['Discussion'][] = [];
  const packets = createDefaultDiscussionSurfacePackets({
    scopePacketId: input.scopePacketId,
    scopeName: input.scopeName,
    createdAt: new Date().toISOString(),
    applicableScopeRefs: input.applicableScopeRefs,
  });

  for (const packet of packets) {
    const existingPacket = await input.packetStore.fetchPreferredRevision({
      packet_id: packet.header.packet_id,
    });

    if (!existingPacket) {
      plannedPackets.push(packet);
    }
  }

  return plannedPackets;
}

/**
 * Inputs: a scope packet id/name and packet store.
 * Output: creates missing empty default discussion surface packets only once.
 */
export async function ensureDefaultDiscussionSurfaces(input: {
  packetStore: NodeSQLitePacketStore;
  scopePacketId: string;
  scopeName: string;
  applicableScopeRefs: PacketRef[];
}): Promise<PacketEnvelopeByType['Discussion'][]> {
  const createdPackets: PacketEnvelopeByType['Discussion'][] = [];
  const packets = await planDefaultDiscussionSurfaces(input);

  for (const packet of packets) {
    await input.packetStore.writeRevision(packet);
    await input.packetStore.publishRevision({
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    });
    createdPackets.push(packet);
  }

  return createdPackets;
}
