/**
 * File: element-discussion-defaults.ts
 * Description: Shared packet recipe for default Element discussion spaces, forums, and starter posts.
 */

import {
  createDiscussionForumPacket,
  createDiscussionPostPacket,
  createDiscussionSpacePacket,
  createDiscussionThreadPacket,
  createPacketRef,
} from '@core/packets/builders';
import type {
  DiscussionActorClass,
  DiscussionSort,
  PacketEnvelopeByType,
  PacketRef,
} from '@core/schema/packet-schema';

export type ElementDiscussionDefaultProfile =
  | 'person'
  | 'assembly'
  | 'locality_assembly';

export type ElementDiscussionForumKind =
  | 'visitor_lobby'
  | 'general'
  | 'proposals'
  | 'reports'
  | `role_${string}`;

export type ElementDiscussionRoleForumInput = {
  roleSlug: string;
  roleTitle: string;
  roleRef?: PacketRef | null;
  summary?: string | null;
};

export type ElementDiscussionStarterThreadInput = {
  forumKind: ElementDiscussionForumKind;
  suffix: string;
  title: string;
  body: string;
  relatedRefs?: PacketRef[];
};

type ElementDiscussionForumPlan = {
  forumKind: ElementDiscussionForumKind;
  title: string;
  summary: string;
  defaultSort: DiscussionSort;
  participationRules: {
    top_level_actor_classes: DiscussionActorClass[];
    reply_actor_classes: DiscussionActorClass[];
    reaction_actor_classes: DiscussionActorClass[];
    top_level_post_cost: number;
  };
};

const GUEST_FORUM_ACTORS = [
  'anonymous_guest',
  'scope_member',
  'trusted_member',
  'steward',
] satisfies DiscussionActorClass[];

const MEMBER_FORUM_ACTORS = [
  'scope_member',
  'trusted_member',
  'steward',
] satisfies DiscussionActorClass[];

function createPacketSlug(packetId: string): string {
  return packetId.startsWith('nexus:element/')
    ? packetId.slice('nexus:element/'.length)
    : packetId.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function createForumSlug(forumKind: string): string {
  return forumKind.replace(/_/g, '-');
}

function createActorRules(actorClasses: DiscussionActorClass[]) {
  return {
    top_level_actor_classes: actorClasses,
    reply_actor_classes: actorClasses,
    reaction_actor_classes: actorClasses,
    top_level_post_cost: 0,
  };
}

function normalizeRoleSlug(roleSlug: string): string {
  const normalized = roleSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'role';
}

function createDefaultWelcomeThread(input: {
  elementName: string;
  profile: ElementDiscussionDefaultProfile;
  relatedRefs?: PacketRef[];
}): ElementDiscussionStarterThreadInput {
  if (input.profile === 'person') {
    return {
      forumKind: 'general',
      suffix: 'welcome',
      title: `${input.elementName} discussion space`,
      body: [
        `Welcome to ${input.elementName}'s packet-backed discussion space.`,
        '',
        'Use this space for public context, questions, updates, and coordination that should stay attached to this Element.',
      ].join('\n\n'),
      relatedRefs: input.relatedRefs ?? [],
    };
  }

  return {
    forumKind: 'visitor_lobby',
    suffix: 'welcome',
    title: `${input.elementName} newcomer thread`,
    body: [
      `This is the public newcomer thread for ${input.elementName}.`,
      '',
      'Reply here with your question, area, or intent and we can help route you to the right next step.',
    ].join('\n\n'),
    relatedRefs: input.relatedRefs ?? [],
  };
}

export function createElementDiscussionSpaceId(elementPacketId: string): string {
  return `nexus:discussion-space/${createPacketSlug(elementPacketId)}`;
}

export function createElementDiscussionForumId(
  elementPacketId: string,
  forumKind: string
): string {
  return `nexus:discussion-forum/${createPacketSlug(elementPacketId)}-${createForumSlug(
    forumKind
  )}`;
}

export function createElementDiscussionThreadId(input: {
  elementPacketId: string;
  forumKind: string;
  suffix: string;
}): string {
  return `nexus:discussion-thread/${createPacketSlug(input.elementPacketId)}-${createForumSlug(
    input.forumKind
  )}-${input.suffix}`;
}

export function createElementDiscussionPostId(input: {
  elementPacketId: string;
  forumKind: string;
  suffix: string;
}): string {
  return `nexus:discussion-post/${createPacketSlug(input.elementPacketId)}-${createForumSlug(
    input.forumKind
  )}-${input.suffix}`;
}

export function createElementDiscussionReplyId(input: {
  elementPacketId: string;
  forumKind: string;
  suffix: string;
}): string {
  return `nexus:discussion-reply/${createPacketSlug(input.elementPacketId)}-${createForumSlug(
    input.forumKind
  )}-${input.suffix}`;
}

export function buildElementDiscussionForumPlans(input: {
  elementName: string;
  profile: ElementDiscussionDefaultProfile;
  includeProposalsForum?: boolean;
  includeReportsForum?: boolean;
  roleForums?: ElementDiscussionRoleForumInput[];
}): ElementDiscussionForumPlan[] {
  const plans: ElementDiscussionForumPlan[] = [];

  if (input.profile !== 'person') {
    plans.push({
      forumKind: 'visitor_lobby',
      title: `${input.elementName} visitor lobby`,
      summary:
        'Public newcomer space for orientation, introductions, and locality routing.',
      defaultSort: 'new',
      participationRules: createActorRules(GUEST_FORUM_ACTORS),
    });
  }

  plans.push({
    forumKind: 'general',
    title: `${input.elementName} general`,
    summary:
      input.profile === 'person'
        ? 'Personal Element discussion for context, updates, and broad questions.'
        : 'Open assembly discussion for context, updates, and broad questions.',
    defaultSort: 'hot',
    participationRules:
      input.profile === 'person'
        ? createActorRules(GUEST_FORUM_ACTORS)
        : createActorRules(MEMBER_FORUM_ACTORS),
  });

  if (input.includeProposalsForum) {
    plans.push({
      forumKind: 'proposals',
      title: `${input.elementName} proposals`,
      summary:
        'Proposal review space for drafts, amendments, and governance context.',
      defaultSort: 'hot',
      participationRules: createActorRules(MEMBER_FORUM_ACTORS),
    });
  }

  if (input.profile !== 'person' && input.includeReportsForum !== false) {
    plans.push({
      forumKind: 'reports',
      title: `${input.elementName} reports and AARs`,
      summary: 'Record and after-action reporting space for outcomes and learning.',
      defaultSort: 'hot',
      participationRules: createActorRules(MEMBER_FORUM_ACTORS),
    });
  }

  for (const roleForum of input.roleForums ?? []) {
    const roleSlug = normalizeRoleSlug(roleForum.roleSlug);

    plans.push({
      forumKind: `role_${roleSlug}`,
      title: `${input.elementName} ${roleForum.roleTitle}`,
      summary:
        roleForum.summary ??
        `Role-specific discussion for ${roleForum.roleTitle} coordination.`,
      defaultSort: 'hot',
      participationRules: createActorRules(MEMBER_FORUM_ACTORS),
    });
  }

  return plans;
}

export function buildElementDefaultDiscussionPackets(input: {
  elementRef: PacketRef;
  elementName: string;
  profile: ElementDiscussionDefaultProfile;
  createdAt: string;
  applicableScopeRefs: PacketRef[];
  authorRef?: PacketRef | null;
  includeWelcomeThread?: boolean;
  welcomeThread?: ElementDiscussionStarterThreadInput | null;
  welcomeRelatedRefs?: PacketRef[];
  starterThreads?: ElementDiscussionStarterThreadInput[];
  includeProposalsForum?: boolean;
  includeReportsForum?: boolean;
  roleForums?: ElementDiscussionRoleForumInput[];
}): PacketEnvelopeByType['Discussion'][] {
  const discussionSpaceRef = createPacketRef(
    createElementDiscussionSpaceId(input.elementRef.packet_id)
  );
  const forumPlans = buildElementDiscussionForumPlans({
    elementName: input.elementName,
    profile: input.profile,
    includeProposalsForum: input.includeProposalsForum,
    includeReportsForum: input.includeReportsForum,
    roleForums: input.roleForums,
  });
  const forumKinds = new Set(forumPlans.map((forumPlan) => forumPlan.forumKind));
  const requestedStarterThreads = [
    ...(input.includeWelcomeThread === false
      ? []
      : [
          input.welcomeThread ??
            createDefaultWelcomeThread({
              elementName: input.elementName,
              profile: input.profile,
              relatedRefs: input.welcomeRelatedRefs,
            }),
        ]),
    ...(input.starterThreads ?? []),
  ].filter((starterThread) => forumKinds.has(starterThread.forumKind));

  return [
    createDiscussionSpacePacket({
      packet_id: discussionSpaceRef.packet_id,
      created_at: input.createdAt,
      authority_scope_ref: input.elementRef,
      applicable_scope_refs: input.applicableScopeRefs,
      title: `${input.elementName} discussions`,
      summary: `Packet-backed discussion surface for ${input.elementName}.`,
      scope_ref: input.elementRef,
      status: 'open',
      metadata_tags: ['discussion-space', 'scope-discussions'],
    }),
    ...forumPlans.map((forumPlan) =>
      createDiscussionForumPacket({
        packet_id: createElementDiscussionForumId(
          input.elementRef.packet_id,
          forumPlan.forumKind
        ),
        created_at: input.createdAt,
        authority_scope_ref: input.elementRef,
        applicable_scope_refs: input.applicableScopeRefs,
        title: forumPlan.title,
        summary: forumPlan.summary,
        discussion_space_ref: discussionSpaceRef,
        forum_kind: forumPlan.forumKind,
        status: 'open',
        participation_rules: forumPlan.participationRules,
        default_sort: forumPlan.defaultSort,
        metadata_tags: ['discussion-forum', createForumSlug(forumPlan.forumKind)],
      })
    ),
    ...requestedStarterThreads.flatMap((starterThread) => {
      const forumRef = createPacketRef(
        createElementDiscussionForumId(
          input.elementRef.packet_id,
          starterThread.forumKind
        )
      );
      const threadRef = createPacketRef(
        createElementDiscussionThreadId({
          elementPacketId: input.elementRef.packet_id,
          forumKind: starterThread.forumKind,
          suffix: starterThread.suffix,
        })
      );
      const rootPostRef = createPacketRef(
        createElementDiscussionPostId({
          elementPacketId: input.elementRef.packet_id,
          forumKind: starterThread.forumKind,
          suffix: starterThread.suffix,
        })
      );
      const relatedRefs = starterThread.relatedRefs ?? [];
      const forumPlan = forumPlans.find(
        (candidate) => candidate.forumKind === starterThread.forumKind
      );

      return [
        createDiscussionThreadPacket({
          packet_id: threadRef.packet_id,
          created_at: input.createdAt,
          authority_scope_ref: input.elementRef,
          applicable_scope_refs: input.applicableScopeRefs,
          forum_ref: forumRef,
          title: starterThread.title,
          summary: starterThread.title,
          thread_kind: starterThread.forumKind,
          status: 'open',
          related_refs: relatedRefs,
          participation_rules:
            forumPlan?.participationRules ?? createActorRules(MEMBER_FORUM_ACTORS),
          default_sort: forumPlan?.defaultSort ?? 'hot',
          metadata_tags: [
            'discussion-thread',
            createForumSlug(starterThread.forumKind),
          ],
        }),
        createDiscussionPostPacket({
          packet_id: rootPostRef.packet_id,
          created_at: input.createdAt,
          authority_scope_ref: input.elementRef,
          applicable_scope_refs: input.applicableScopeRefs,
          created_by: input.authorRef ?? null,
          thread_ref: threadRef,
          title: starterThread.title,
          content_markdown: starterThread.body,
          reference_refs: relatedRefs,
          metadata_tags: [
            'discussion-post',
            'thread-root',
            createForumSlug(starterThread.forumKind),
          ],
        }),
      ];
    }),
  ];
}
