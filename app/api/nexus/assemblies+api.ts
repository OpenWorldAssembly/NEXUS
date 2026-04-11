/**
 * File: assemblies+api.ts
 * Description: Creates lightweight assembly packets and optional starter discussion surfaces for local Nexus growth.
 */

import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import {
  createAssemblyPacket,
  createDiscussionForumPacket,
  createDiscussionSpacePacket,
  createPacketEdge,
  createPacketRef,
} from '@/domain/packets/builders';
import type {
  DiscussionActorClass,
  PacketEnvelopeByType,
  PacketRef,
} from '@/domain/schema/packet-schema';
import { getNexusPacketServices } from '@/lib/nexus/server/nexus-packet-services';

const ActorAssertionSchema = z
  .object({
    actor_packet_id: z.string().min(1),
    kid: z.string().min(1),
    method: z.string().min(1),
    path: z.string().min(1),
    body_digest: z.string().min(1),
    issued_at: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

const CreateAssemblySchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    name: z.string().min(1),
    subtype: z.string().min(1).optional().nullable().default(null),
    summary: z.string().min(1).optional().nullable().default(null),
    locality_label: z.string().min(1).optional().nullable().default(null),
    parent_scope_packet_id: z.string().min(1),
    seed_discussions: z.boolean().optional().default(true),
    claim_association: z.boolean().optional().default(true),
    claim_note: z.string().min(1).optional().nullable().default(null),
  })
  .strict();

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function createSlug(value: string, maxLength = 36): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) {
    return slug;
  }

  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

function createAssemblyPacketId(name: string): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);

  return `nexus:element/${createSlug(name, 28)}-${suffix}`;
}

function createDiscussionSpaceId(scopePacketId: string): string {
  return `nexus:discussion-space/${scopePacketId.slice('nexus:element/'.length)}`;
}

function createDiscussionForumId(scopePacketId: string, forumKind: string): string {
  return `${createDiscussionSpaceId(scopePacketId)}-${forumKind.replace(/_/g, '-')}`;
}

function createApplicableScopeRefs(input: {
  scopePacketId: string;
  parentPacketId: string;
  parentByPacketId: Map<string, string | null>;
}): PacketRef[] {
  const scopeRefs: PacketRef[] = [{ packet_id: input.scopePacketId }];
  let currentParentPacketId: string | null = input.parentPacketId;

  while (currentParentPacketId) {
    scopeRefs.push({ packet_id: currentParentPacketId });
    currentParentPacketId = input.parentByPacketId.get(currentParentPacketId) ?? null;
  }

  return scopeRefs;
}

function createStarterDiscussionPackets(input: {
  scopePacketId: string;
  scopeName: string;
  createdAt: string;
  applicableScopeRefs: PacketRef[];
}): PacketEnvelopeByType['DiscussionSpace' | 'DiscussionForum'][] {
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
    {
      forum_kind: 'reports',
      title: `${input.scopeName} reports and AARs`,
      summary: 'Record and after-action reporting space for outcomes and learning.',
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
    createDiscussionSpacePacket({
      packet_id: discussionSpaceRef.packet_id,
      created_at: input.createdAt,
      authority_scope_ref: { packet_id: input.scopePacketId },
      applicable_scope_refs: input.applicableScopeRefs,
      title: `${input.scopeName} discussions`,
      summary: `Packet-backed discussion surface for ${input.scopeName}.`,
      scope_ref: { packet_id: input.scopePacketId },
      status: 'open',
      metadata_tags: ['discussion-space', 'scope-discussions'],
    }),
    ...forumKinds.map((forumKind) =>
      createDiscussionForumPacket({
        packet_id: createDiscussionForumId(input.scopePacketId, forumKind.forum_kind),
        created_at: input.createdAt,
        authority_scope_ref: { packet_id: input.scopePacketId },
        applicable_scope_refs: input.applicableScopeRefs,
        title: forumKind.title,
        summary: forumKind.summary,
        discussion_space_ref: discussionSpaceRef,
        forum_kind: forumKind.forum_kind,
        status: 'open',
        participation_rules: forumKind.participation_rules,
        default_sort: forumKind.default_sort,
        metadata_tags: ['discussion-forum', forumKind.forum_kind.replace(/_/g, '-')],
      })
    ),
  ];
}

export const POST: RequestHandler = async (request) => {
  try {
    const parsedBody = CreateAssemblySchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'POST',
      path: '/api/nexus/assemblies',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        name: parsedBody.name,
        subtype: parsedBody.subtype,
        summary: parsedBody.summary,
        locality_label: parsedBody.locality_label,
        parent_scope_packet_id: parsedBody.parent_scope_packet_id,
        seed_discussions: parsedBody.seed_discussions,
        claim_association: parsedBody.claim_association,
        claim_note: parsedBody.claim_note,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
    });
    const parentScopePacket = await services.packetStore.fetchByPacket({
      packet_id: parsedBody.parent_scope_packet_id,
    });

    if (!parentScopePacket || parentScopePacket.header.family !== 'Element') {
      throw new Error(`Unknown parent scope: ${parsedBody.parent_scope_packet_id}`);
    }

    const elementPackets =
      await services.packetStore.listPreferredPacketsByFamily('Element');
    const parentByPacketId = new Map(
      elementPackets
        .filter((packet) => packet.body.kind === 'assembly')
        .map((packet) => [
          packet.header.packet_id,
          packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')?.target
            .packet_id ?? null,
        ])
    );
    const createdAt = new Date().toISOString();
    const assemblyPacketId = createAssemblyPacketId(parsedBody.name);
    const applicableScopeRefs = createApplicableScopeRefs({
      scopePacketId: assemblyPacketId,
      parentPacketId: parsedBody.parent_scope_packet_id,
      parentByPacketId,
    });
    const assemblyPacket = createAssemblyPacket({
      packet_id: assemblyPacketId,
      created_at: createdAt,
      authority_scope_ref: { packet_id: assemblyPacketId },
      applicable_scope_refs: applicableScopeRefs,
      created_by: {
        packet_id: actorContext.actorPacket.header.packet_id,
      },
      edges: [
        createPacketEdge('parent_scope', {
          packet_id: parsedBody.parent_scope_packet_id,
        }),
      ],
      name: parsedBody.name.trim(),
      subtype: parsedBody.subtype?.trim() ?? 'local',
      summary: parsedBody.summary?.trim() ?? null,
      locality_label: parsedBody.locality_label?.trim() ?? parsedBody.name.trim(),
      tags: ['assembly', 'local'],
      metadata_tags: ['assembly', 'local'],
    });

    await services.packetStore.writeRevision(assemblyPacket);
    await services.packetStore.publishRevision({
      packet_id: assemblyPacket.header.packet_id,
      revision_id: assemblyPacket.header.revision_id,
    });

    if (parsedBody.seed_discussions) {
      const discussionPackets = createStarterDiscussionPackets({
        scopePacketId: assemblyPacket.header.packet_id,
        scopeName: assemblyPacket.body.name,
        createdAt,
        applicableScopeRefs,
      });

      for (const discussionPacket of discussionPackets) {
        await services.packetStore.writeRevision(discussionPacket);
        await services.packetStore.publishRevision({
          packet_id: discussionPacket.header.packet_id,
          revision_id: discussionPacket.header.revision_id,
        });
      }
    }

    if (parsedBody.claim_association) {
      await services.attestationService.setAttestation({
        target_packet_id: assemblyPacket.header.packet_id,
        actor_key: actorContext.actorKey,
        actor_class: actorContext.actorClass,
        authority_scope_id: assemblyPacket.header.packet_id,
        value: 1,
        attestation_kind: 'assembly_association_claim',
        note: parsedBody.claim_note ?? null,
      });
    } else {
      await services.attestationService.syncDerivedState();
    }

    await services.discussionService.syncDerivedState();
    const claims =
      await services.attestationService.listAssemblyAssociationClaimsForActor(
        actorContext.actorPacket.header.packet_id
      );

    return createJsonResponse({
      assembly_packet: assemblyPacket,
      claims,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create the assembly.';
    const status = message.includes('Unknown') ? 404 : 500;

    return createJsonResponse({ error: message }, status);
  }
};
