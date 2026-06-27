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

export type ElementDiscussionForumPlan = {
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

export type ElementDiscussionForumSummaryOverrides = Partial<
  Record<ElementDiscussionForumKind, string>
>;

const DEFAULT_MEMBER_PARTICIPATION_RULES = {
  top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
  reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
  reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
  top_level_post_cost: 0,
} as const;


export const ELEMENT_DISCUSSION_DEFAULT_PROFILES = {
  person: {
    profile: 'person',
    description:
      'Personal Element discussion surface with a public general forum and optional starter thread.',
    default_forum_kinds: ['general'],
    default_welcome_forum_kind: 'general',
    include_proposals_by_default: false,
    include_reports_by_default: false,
    guest_access: 'general forum allows anonymous guest replies/reactions by default.',
  },
  assembly: {
    profile: 'assembly',
    description:
      'Assembly discussion surface with visitor lobby, general discussion, and reports/AARs by default.',
    default_forum_kinds: ['visitor_lobby', 'general', 'reports'],
    default_welcome_forum_kind: 'visitor_lobby',
    include_proposals_by_default: false,
    include_reports_by_default: true,
    guest_access: 'visitor lobby allows anonymous guest orientation by default; member forums are trust-gated.',
  },
  locality_assembly: {
    profile: 'locality_assembly',
    description:
      'Locality assembly discussion surface with visitor lobby, general, proposals, and reports/AAR forums by default.',
    default_forum_kinds: ['visitor_lobby', 'general', 'proposals', 'reports'],
    default_welcome_forum_kind: 'visitor_lobby',
    include_proposals_by_default: true,
    include_reports_by_default: true,
    guest_access: 'visitor lobby allows anonymous guest orientation by default; proposal/report forums are member-gated.',
  },
} as const;

export const ELEMENT_DISCUSSION_DEFAULT_ID_STRATEGY = {
  space_packet_id: 'nexus:discussion-space/{element_slug}',
  forum_packet_id: 'nexus:discussion-forum/{element_slug}-{forum_slug}',
  thread_packet_id: 'nexus:discussion-thread/{element_slug}-{forum_slug}-{suffix}',
  root_post_packet_id: 'nexus:discussion-post/{element_slug}-{forum_slug}-{suffix}',
  reply_packet_id: 'nexus:discussion-reply/{element_slug}-{forum_slug}-{suffix}',
} as const;

export const DISCUSSION_SUBTYPE_DEFAULT_VALUES = {
  space: {
    subtype: 'space',
    role: 'space',
    status: 'open',
  },
  forum: {
    subtype: 'forum',
    role: 'general',
    status: 'open',
    participation_rules: DEFAULT_MEMBER_PARTICIPATION_RULES,
    default_sort: 'hot',
  },
  topic: {
    subtype: 'topic',
    role: 'general',
    status: 'open',
    related_refs: [],
    participation_rules: DEFAULT_MEMBER_PARTICIPATION_RULES,
    default_sort: 'hot',
  },
  post: {
    subtype: 'post',
    role: 'forum_post',
    status: 'open',
    related_refs: [],
    participation_rules: DEFAULT_MEMBER_PARTICIPATION_RULES,
    default_sort: 'hot',
    content_markdown: null,
    attachment_refs: [],
  },
  message: {
    subtype: 'message',
    role: 'reply',
    status: 'open',
    root_message_ref: null,
  },
} as const;

export function createDiscussionSubtypeDefaultValues(
  subtype: string
): Record<string, unknown> {
  return {
    ...(DISCUSSION_SUBTYPE_DEFAULT_VALUES[
      subtype as keyof typeof DISCUSSION_SUBTYPE_DEFAULT_VALUES
    ] ?? {
      subtype,
      status: 'open',
    }),
  };
}

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
    title: `${input.elementName} welcome`,
    body: [
      `This is the public welcome thread for ${input.elementName}.`,
      '',
      'Use it for introductions, public context, and coordination that should stay attached to this Element.',
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
  forumSummaryOverrides?: ElementDiscussionForumSummaryOverrides;
}): ElementDiscussionForumPlan[] {
  const plans: ElementDiscussionForumPlan[] = [];

  if (input.profile !== 'person') {
    plans.push({
      forumKind: 'visitor_lobby',
      title: `${input.elementName} visitor lobby`,
      summary:
        input.forumSummaryOverrides?.visitor_lobby ??
        'Public welcome space for introductions, orientation, and scope discovery.',
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

  const includeProposalsForum =
    input.includeProposalsForum ?? input.profile === 'locality_assembly';
  const includeReportsForum =
    input.includeReportsForum ?? input.profile !== 'person';

  if (includeProposalsForum) {
    plans.push({
      forumKind: 'proposals',
      title: `${input.elementName} proposals`,
      summary:
        'Proposal review space for drafts, amendments, and governance context.',
      defaultSort: 'hot',
      participationRules: createActorRules(MEMBER_FORUM_ACTORS),
    });
  }

  if (includeReportsForum) {
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
  forumSummaryOverrides?: ElementDiscussionForumSummaryOverrides;
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
    forumSummaryOverrides: input.forumSummaryOverrides,
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
