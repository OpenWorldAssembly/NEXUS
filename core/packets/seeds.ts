/**
 * File: seeds.ts
 * Description: Defines the reusable OWA packet seed dataset for scope trees, discussion spaces, forums, threads, root posts, and replies.
 */

import type {
  DiscussionActorClass,
  PacketEnvelope,
  PacketRef,
} from '@core/schema/packet-schema';

import {
  createActionPacket,
  createAssemblyPacket,
  createCausePacket,
  createClaimPacket,
  createDiscussionForumPacket,
  createDiscussionPostPacket,
  createDiscussionReplyPacket,
  createDiscussionSpacePacket,
  createDiscussionThreadPacket,
  createPacketEdge,
  createPacketRef,
  createPersonPacket,
  createPolicyPacket,
  createProposalPacket,
  createRelationPacket,
  createRolePacket,
  createVotePacket,
} from '@core/packets/builders';

export const SEED_CREATED_AT = '2026-04-08T00:00:00.000Z';
export const DISCUSSION_SEED_VERSION = '2026-04-11-discussions-membership-v1';

export const PERSONAL_TREE_PACKET_IDS = {
  global_commons: 'nexus:element/global-commons',
  united_states: 'nexus:element/united-states',
  california: 'nexus:element/california',
  moreno_valley: 'nexus:element/moreno-valley',
  sunnymead_ranch: 'nexus:element/sunnymead-ranch',
  aaron: 'nexus:element/aaron',
  owa_cause: 'nexus:cause/owa',
  owa_action: 'nexus:action/owa',
  owa_home_locality_policy: 'nexus:policy/owa-home-locality',
  owa_default_inheritance_policy: 'nexus:policy/owa-default-inheritance',
  owa_governance_baseline_policy: 'nexus:policy/owa-governance-baseline',
  visitor_lobby_policy: 'nexus:policy/visitor-lobby-baseline',
  trust_baseline_policy: 'nexus:policy/global-trust-baseline',
  facilitator_role: 'nexus:role/facilitator',
  coordinator_role: 'nexus:role/coordinator',
  councilor_role: 'nexus:role/councilor',
  sunnymead_onboarding_proposal:
    'nexus:proposal/sunnymead-ranch-onboarding',
  global_onboarding_vote: 'nexus:vote/sunnymead-ranch-onboarding',
} as const;

export const PERSONAL_TREE_REFS = {
  global_commons: createPacketRef(PERSONAL_TREE_PACKET_IDS.global_commons),
  united_states: createPacketRef(PERSONAL_TREE_PACKET_IDS.united_states),
  california: createPacketRef(PERSONAL_TREE_PACKET_IDS.california),
  moreno_valley: createPacketRef(PERSONAL_TREE_PACKET_IDS.moreno_valley),
  sunnymead_ranch: createPacketRef(PERSONAL_TREE_PACKET_IDS.sunnymead_ranch),
  aaron: createPacketRef(PERSONAL_TREE_PACKET_IDS.aaron),
  owa_cause: createPacketRef(PERSONAL_TREE_PACKET_IDS.owa_cause),
  owa_action: createPacketRef(PERSONAL_TREE_PACKET_IDS.owa_action),
  owa_home_locality_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.owa_home_locality_policy
  ),
  owa_default_inheritance_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.owa_default_inheritance_policy
  ),
  owa_governance_baseline_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.owa_governance_baseline_policy
  ),
  visitor_lobby_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.visitor_lobby_policy
  ),
  trust_baseline_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.trust_baseline_policy
  ),
  facilitator_role: createPacketRef(PERSONAL_TREE_PACKET_IDS.facilitator_role),
  coordinator_role: createPacketRef(PERSONAL_TREE_PACKET_IDS.coordinator_role),
  councilor_role: createPacketRef(PERSONAL_TREE_PACKET_IDS.councilor_role),
  sunnymead_onboarding_proposal: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.sunnymead_onboarding_proposal
  ),
  global_onboarding_vote: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.global_onboarding_vote
  ),
} as const;

type ScopeSeedConfig = {
  packetRef: PacketRef;
  applicableScopeRefs: PacketRef[];
  scopeName: string;
  authorRef: PacketRef;
};

type StarterThreadConfig = {
  forumKind: 'visitor_lobby' | 'general' | 'proposals' | 'reports';
  suffix: string;
  title: string;
  body: string;
  relatedRefs?: PacketRef[];
};

function createApplicableScopeRefs(scopeChain: PacketRef[]): PacketRef[] {
  return [...scopeChain];
}

function getScopeSlug(scopePacketId: string): string {
  return scopePacketId.startsWith('nexus:element/')
    ? scopePacketId.slice('nexus:element/'.length)
    : scopePacketId.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function createDiscussionSpaceId(scopePacketId: string): string {
  return `nexus:discussion-space/${getScopeSlug(scopePacketId)}`;
}

function createDiscussionForumId(
  scopePacketId: string,
  forumKind: string
): string {
  return `nexus:discussion-forum/${getScopeSlug(scopePacketId)}-${forumKind.replace(
    /_/g,
    '-'
  )}`;
}

function createDiscussionThreadId(
  scopePacketId: string,
  forumKind: string,
  suffix: string
): string {
  return `nexus:discussion-thread/${getScopeSlug(scopePacketId)}-${forumKind.replace(
    /_/g,
    '-'
  )}-${suffix}`;
}

function createDiscussionPostId(
  scopePacketId: string,
  forumKind: string,
  suffix: string
): string {
  return `nexus:discussion-post/${getScopeSlug(scopePacketId)}-${forumKind.replace(
    /_/g,
    '-'
  )}-${suffix}`;
}

function createDiscussionReplyId(
  scopePacketId: string,
  forumKind: string,
  suffix: string
): string {
  return `nexus:discussion-reply/${getScopeSlug(scopePacketId)}-${forumKind.replace(
    /_/g,
    '-'
  )}-${suffix}`;
}

function createDiscussionForumTitle(
  scopeName: string,
  forumKind: StarterThreadConfig['forumKind']
): string {
  if (forumKind === 'visitor_lobby') {
    return `${scopeName} visitor lobby`;
  }

  if (forumKind === 'general') {
    return `${scopeName} general`;
  }

  if (forumKind === 'proposals') {
    return `${scopeName} proposals`;
  }

  return `${scopeName} reports and AARs`;
}

function createForumParticipationRules(
  forumKind: StarterThreadConfig['forumKind']
): {
  top_level_actor_classes: DiscussionActorClass[];
  reply_actor_classes: DiscussionActorClass[];
  reaction_actor_classes: DiscussionActorClass[];
  top_level_post_cost: number;
} {
  if (forumKind === 'visitor_lobby') {
    return {
      top_level_actor_classes: [
        'anonymous_guest',
        'scope_member',
        'trusted_member',
        'steward',
      ],
      reply_actor_classes: [
        'anonymous_guest',
        'scope_member',
        'trusted_member',
        'steward',
      ],
      reaction_actor_classes: [
        'anonymous_guest',
        'scope_member',
        'trusted_member',
        'steward',
      ],
      top_level_post_cost: 0,
    };
  }

  return {
    top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
    top_level_post_cost: 0,
  };
}

function createScopeDiscussionPackets(input: ScopeSeedConfig): PacketEnvelope[] {
  const discussionSpaceRef = createPacketRef(
    createDiscussionSpaceId(input.packetRef.packet_id)
  );
  const visitorLobbyForumRef = createPacketRef(
    createDiscussionForumId(input.packetRef.packet_id, 'visitor_lobby')
  );
  const generalForumRef = createPacketRef(
    createDiscussionForumId(input.packetRef.packet_id, 'general')
  );
  const proposalsForumRef = createPacketRef(
    createDiscussionForumId(input.packetRef.packet_id, 'proposals')
  );
  const reportsForumRef = createPacketRef(
    createDiscussionForumId(input.packetRef.packet_id, 'reports')
  );
  const forums = [
    {
      packetRef: visitorLobbyForumRef,
      forumKind: 'visitor_lobby' as const,
      summary:
        'Public newcomer space for orientation, introductions, and locality routing.',
      defaultSort: 'new' as const,
    },
    {
      packetRef: generalForumRef,
      forumKind: 'general' as const,
      summary:
        'Open assembly discussion for context, updates, and broad questions.',
      defaultSort: 'hot' as const,
    },
    {
      packetRef: proposalsForumRef,
      forumKind: 'proposals' as const,
      summary:
        'Proposal review space for drafts, amendments, and governance context.',
      defaultSort: 'hot' as const,
    },
    {
      packetRef: reportsForumRef,
      forumKind: 'reports' as const,
      summary:
        'Record and after-action reporting space for outcomes and learning.',
      defaultSort: 'hot' as const,
    },
  ];

  const packets: PacketEnvelope[] = [
    createDiscussionSpacePacket({
      packet_id: discussionSpaceRef.packet_id,
      created_at: SEED_CREATED_AT,
      authority_scope_ref: input.packetRef,
      applicable_scope_refs: input.applicableScopeRefs,
      title: `${input.scopeName} discussions`,
      summary: `Packet-backed discussion surface for ${input.scopeName}.`,
      scope_ref: input.packetRef,
      status: 'open',
      metadata_tags: ['discussion-space', 'scope-discussions'],
    }),
    ...forums.map((forum) =>
      createDiscussionForumPacket({
        packet_id: forum.packetRef.packet_id,
        created_at: SEED_CREATED_AT,
        authority_scope_ref: input.packetRef,
        applicable_scope_refs: input.applicableScopeRefs,
        title: createDiscussionForumTitle(input.scopeName, forum.forumKind),
        summary: forum.summary,
        discussion_space_ref: discussionSpaceRef,
        forum_kind: forum.forumKind,
        status: 'open',
        participation_rules: createForumParticipationRules(forum.forumKind),
        default_sort: forum.defaultSort,
        metadata_tags: ['discussion-forum', forum.forumKind.replace(/_/g, '-')],
      })
    ),
  ];

  const starterThreads: StarterThreadConfig[] = [
    {
      forumKind: 'visitor_lobby',
      suffix: 'welcome',
      title:
        input.scopeName === 'Global Commons'
          ? 'Start here if you do not know your locality yet'
          : `${input.scopeName} newcomer thread`,
      body:
        input.scopeName === 'Global Commons'
          ? [
              'Guests can browse first, ask questions here, and narrow down to a local assembly later.',
              '',
              'If you already know your general area, mention it and we can point you toward the right branch.',
            ].join('\n\n')
          : [
              `This is the public newcomer thread for ${input.scopeName}.`,
              '',
              'Reply here with your question, area, or intent and we can help route you to the right next step.',
            ].join('\n\n'),
      relatedRefs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
    },
  ];

  if (input.packetRef.packet_id === PERSONAL_TREE_PACKET_IDS.global_commons) {
    starterThreads.push(
      {
        forumKind: 'general',
        suffix: 'commons-priorities',
        title: 'What should the public commons page show first?',
        body: [
          'This starter thread exists to exercise general discussion routing in the reset discussion model.',
          '',
          'Use it to test broad, low-stakes discussion outside the visitor lobby.',
        ].join('\n\n'),
      },
      {
        forumKind: 'proposals',
        suffix: 'onboarding-pilot',
        title: 'Pilot Sunnymead Ranch guest onboarding flow',
        body: [
          'This thread anchors proposal discussion around the Sunnymead Ranch onboarding pilot.',
          '',
          'It is meant to test proposal-context discussion under the new forum hierarchy.',
        ].join('\n\n'),
        relatedRefs: [PERSONAL_TREE_REFS.sunnymead_onboarding_proposal],
      },
      {
        forumKind: 'reports',
        suffix: 'seed-reset-aar',
        title: 'Discussion reset seed note',
        body: [
          'This starter report thread exists so the reports tab is not empty after reseed.',
          '',
          'It also gives us one canonical place to test report-style discussion cards.',
        ].join('\n\n'),
      }
    );
  }

  if (input.packetRef.packet_id === PERSONAL_TREE_PACKET_IDS.sunnymead_ranch) {
    starterThreads.push({
      forumKind: 'proposals',
      suffix: 'local-onboarding',
      title: 'How should Sunnymead Ranch welcome new guests?',
      body: [
        'Use this thread to sketch the local newcomer flow before we wire it into anything trust-sensitive.',
        '',
        'This is intentionally lightweight and public so we can test the discussion hierarchy with a local proposal thread.',
      ].join('\n\n'),
      relatedRefs: [PERSONAL_TREE_REFS.sunnymead_onboarding_proposal],
    });
  }

  for (const starterThread of starterThreads) {
    const forumRef = createPacketRef(
      createDiscussionForumId(input.packetRef.packet_id, starterThread.forumKind)
    );
    const threadRef = createPacketRef(
      createDiscussionThreadId(
        input.packetRef.packet_id,
        starterThread.forumKind,
        starterThread.suffix
      )
    );
    const rootPostRef = createPacketRef(
      createDiscussionPostId(
        input.packetRef.packet_id,
        starterThread.forumKind,
        starterThread.suffix
      )
    );

    packets.push(
      createDiscussionThreadPacket({
        packet_id: threadRef.packet_id,
        created_at: SEED_CREATED_AT,
        authority_scope_ref: input.packetRef,
        applicable_scope_refs: input.applicableScopeRefs,
        forum_ref: forumRef,
        title: starterThread.title,
        summary: starterThread.title,
        thread_kind: starterThread.forumKind,
        status: 'open',
        related_refs: starterThread.relatedRefs ?? [],
        participation_rules: createForumParticipationRules(starterThread.forumKind),
        default_sort:
          starterThread.forumKind === 'visitor_lobby' ? 'new' : 'hot',
        metadata_tags: ['discussion-thread', starterThread.forumKind.replace(/_/g, '-')],
      }),
      createDiscussionPostPacket({
        packet_id: rootPostRef.packet_id,
        created_at: SEED_CREATED_AT,
        authority_scope_ref: input.packetRef,
        applicable_scope_refs: input.applicableScopeRefs,
        created_by: input.authorRef,
        thread_ref: threadRef,
        title: starterThread.title,
        content_markdown: starterThread.body,
        reference_refs: starterThread.relatedRefs ?? [],
        metadata_tags: ['discussion-post', 'thread-root', starterThread.forumKind.replace(/_/g, '-')],
      })
    );
  }

  if (input.packetRef.packet_id === PERSONAL_TREE_PACKET_IDS.global_commons) {
    const rootPostRef = createPacketRef(
      createDiscussionPostId(input.packetRef.packet_id, 'visitor_lobby', 'welcome')
    );
    const threadRef = createPacketRef(
      createDiscussionThreadId(input.packetRef.packet_id, 'visitor_lobby', 'welcome')
    );
    const firstReplyRef = createPacketRef(
      createDiscussionReplyId(input.packetRef.packet_id, 'visitor_lobby', 'welcome-routing')
    );

    packets.push(
      createDiscussionReplyPacket({
        packet_id: firstReplyRef.packet_id,
        created_at: SEED_CREATED_AT,
        authority_scope_ref: input.packetRef,
        applicable_scope_refs: input.applicableScopeRefs,
        created_by: PERSONAL_TREE_REFS.aaron,
        thread_ref: threadRef,
        root_post_ref: rootPostRef,
        reply_to_ref: rootPostRef,
        title: 'Routing note',
        content_markdown: [
          'A good first reply asks where someone is roughly located and what they want to do.',
          '',
          'That gives us enough to route them without demanding too much up front.',
        ].join('\n\n'),
        metadata_tags: ['discussion-reply', 'seed-reply'],
      }),
      createDiscussionReplyPacket({
        packet_id: createDiscussionReplyId(
          input.packetRef.packet_id,
          'visitor_lobby',
          'welcome-routing-followup'
        ),
        created_at: SEED_CREATED_AT,
        authority_scope_ref: input.packetRef,
        applicable_scope_refs: input.applicableScopeRefs,
        created_by: PERSONAL_TREE_REFS.global_commons,
        thread_ref: threadRef,
        root_post_ref: rootPostRef,
        reply_to_ref: firstReplyRef,
        title: 'Routing follow-up',
        content_markdown: [
          'This second-level reply exists so the initial seed includes a real nested branch.',
          '',
          'It should make the collapse and child-loading behavior easier to verify after reset.',
        ].join('\n\n'),
        metadata_tags: ['discussion-reply', 'seed-reply'],
      })
    );
  }

  if (input.packetRef.packet_id === PERSONAL_TREE_PACKET_IDS.sunnymead_ranch) {
    const rootPostRef = createPacketRef(
      createDiscussionPostId(
        input.packetRef.packet_id,
        'visitor_lobby',
        'welcome'
      )
    );
    const threadRef = createPacketRef(
      createDiscussionThreadId(
        input.packetRef.packet_id,
        'visitor_lobby',
        'welcome'
      )
    );

    packets.push(
      createDiscussionReplyPacket({
        packet_id: createDiscussionReplyId(
          input.packetRef.packet_id,
          'visitor_lobby',
          'welcome-local-note'
        ),
        created_at: SEED_CREATED_AT,
        authority_scope_ref: input.packetRef,
        applicable_scope_refs: input.applicableScopeRefs,
        created_by: PERSONAL_TREE_REFS.aaron,
        thread_ref: threadRef,
        root_post_ref: rootPostRef,
        reply_to_ref: rootPostRef,
        title: 'Local note',
        content_markdown: [
          'This local seed reply gives the neighborhood visitor lobby one non-root reply for point and reply-tree testing.',
          '',
          'It also makes the lower scopes feel less empty right after reseed.',
        ].join('\n\n'),
        metadata_tags: ['discussion-reply', 'seed-reply'],
      })
    );
  }

  return packets;
}

export function createPersonalSeedPackets(): PacketEnvelope[] {
  const globalApplicableScopeRefs = createApplicableScopeRefs([
    PERSONAL_TREE_REFS.global_commons,
  ]);
  const unitedStatesApplicableScopeRefs = createApplicableScopeRefs([
    PERSONAL_TREE_REFS.united_states,
    PERSONAL_TREE_REFS.global_commons,
  ]);
  const californiaApplicableScopeRefs = createApplicableScopeRefs([
    PERSONAL_TREE_REFS.california,
    PERSONAL_TREE_REFS.united_states,
    PERSONAL_TREE_REFS.global_commons,
  ]);
  const morenoValleyApplicableScopeRefs = createApplicableScopeRefs([
    PERSONAL_TREE_REFS.moreno_valley,
    PERSONAL_TREE_REFS.california,
    PERSONAL_TREE_REFS.united_states,
    PERSONAL_TREE_REFS.global_commons,
  ]);
  const sunnymeadApplicableScopeRefs = createApplicableScopeRefs([
    PERSONAL_TREE_REFS.sunnymead_ranch,
    PERSONAL_TREE_REFS.moreno_valley,
    PERSONAL_TREE_REFS.california,
    PERSONAL_TREE_REFS.united_states,
    PERSONAL_TREE_REFS.global_commons,
  ]);

  const globalCommonsPacket = createAssemblyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_commons,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    name: 'Global Commons',
    subtype: 'global',
    summary:
      'The broadest public assembly layer for cross-scope browsing, signaling, and packet exchange.',
    locality_label: 'Global',
    tags: ['assembly', 'global', 'scope-root'],
  });

  const unitedStatesPacket = createAssemblyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.united_states,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.united_states,
    applicable_scope_refs: unitedStatesApplicableScopeRefs,
    edges: [
      createPacketEdge('parent_scope', PERSONAL_TREE_REFS.global_commons),
    ],
    name: 'United States',
    subtype: 'nation',
    summary:
      'A national assembly branch nested under the Global Commons assembly.',
    locality_label: 'United States',
    locality: {
      level: 'nation',
      canonical_name_key: 'united states',
      alias_keys: ['united states', 'us', 'usa'],
      display_aliases: ['US', 'USA'],
    },
    tags: ['assembly', 'nation'],
  });

  const californiaPacket = createAssemblyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.california,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.california,
    applicable_scope_refs: californiaApplicableScopeRefs,
    edges: [createPacketEdge('parent_scope', PERSONAL_TREE_REFS.united_states)],
    name: 'California',
    subtype: 'state',
    summary: 'A statewide assembly branch for California civic coordination.',
    locality_label: 'California',
    locality: {
      level: 'region',
      canonical_name_key: 'california',
      alias_keys: ['california', 'ca'],
      display_aliases: ['CA'],
    },
    tags: ['assembly', 'state'],
  });

  const morenoValleyPacket = createAssemblyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.moreno_valley,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.moreno_valley,
    applicable_scope_refs: morenoValleyApplicableScopeRefs,
    edges: [createPacketEdge('parent_scope', PERSONAL_TREE_REFS.california)],
    name: 'Moreno Valley',
    subtype: 'city',
    summary: 'A city assembly branch for Moreno Valley.',
    locality_label: 'Moreno Valley',
    locality: {
      level: 'city',
      canonical_name_key: 'moreno valley',
      alias_keys: ['moreno valley', 'moreno'],
      display_aliases: ['Moreno'],
    },
    tags: ['assembly', 'city'],
  });

  const sunnymeadRanchPacket = createAssemblyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.sunnymead_ranch,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    edges: [createPacketEdge('parent_scope', PERSONAL_TREE_REFS.moreno_valley)],
    name: 'Sunnymead Ranch',
    subtype: 'neighborhood',
    summary:
      'A neighborhood assembly branch nested inside Moreno Valley for local forum and governance activity.',
    locality_label: 'Sunnymead Ranch',
    locality: {
      level: 'district',
      canonical_name_key: 'sunnymead ranch',
      alias_keys: ['sunnymead ranch', 'sunnymead'],
      display_aliases: ['Sunnymead'],
    },
    tags: ['assembly', 'neighborhood'],
  });

  const aaronPacket = createPersonPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.aaron,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    edges: [createPacketEdge('member_of', PERSONAL_TREE_REFS.sunnymead_ranch)],
    name: 'Aaron',
    subtype: 'resident',
    summary:
      'A person element anchored in the Sunnymead Ranch assembly branch.',
    locality_label: 'Sunnymead Ranch',
    tags: ['person', 'resident'],
  });

  const owaHomeLocalityPolicyPacket = createPolicyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.owa_home_locality_policy,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'OWA Home Locality Relation Policy',
    summary:
      'Requires a supporting relation assertion claim for home-locality relations that count for mounted ancestry.',
    policy_kind: 'charter',
    body_markdown: [
      '# OWA Home Locality Relation Policy',
      '',
      '- Home-locality relations are structural graph facts.',
      '- A supporting relation assertion claim is required for the relation to count as the effective mounted home locality.',
    ].join('\n'),
    status: 'active',
    relation_requirements: {
      rules: [
        {
          relation_subtype: 'home_locality',
          required_claim_subtypes: ['relation_assertion'],
          required_attestation_subtypes: [],
          claim_target_mode: 'relation_packet',
          subject_match_mode: 'relation_subject',
        },
      ],
    },
  });

  const owaCausePacket = createCausePacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.owa_cause,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'OWA',
    summary:
      'The default OWA initiative anchor for current policy and future lineage-aware Nexus consumer behavior.',
    subtype: 'initiative',
    status: 'active',
    purpose_markdown:
      'Provides the default initiative anchor for OWA policy and schema-aware scope behavior.',
    policy_refs: [PERSONAL_TREE_REFS.owa_home_locality_policy],
  });

  const owaActionPacket = createActionPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.owa_action,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'OWA',
    summary:
      'The forward OWA initiative action for policy, defaults, and later work hierarchy selection.',
    subtype: 'initiative',
    status: 'active',
    objective_markdown:
      'Provides the default initiative action for OWA policy, template defaults, and schema-aware scope behavior.',
    cause_refs: [PERSONAL_TREE_REFS.owa_cause],
    policy_refs: [
      PERSONAL_TREE_REFS.owa_home_locality_policy,
      PERSONAL_TREE_REFS.trust_baseline_policy,
      PERSONAL_TREE_REFS.owa_default_inheritance_policy,
      PERSONAL_TREE_REFS.owa_governance_baseline_policy,
    ],
  });

  const unitedStatesAncestryRelation = createRelationPacket({
    packet_id: 'nexus:relation/default-ancestry-parent/united-states',
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.united_states,
    applicable_scope_refs: unitedStatesApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    subtype: 'default_ancestry_parent',
    subject_ref: PERSONAL_TREE_REFS.united_states,
    target_ref: PERSONAL_TREE_REFS.global_commons,
    scope_ref: PERSONAL_TREE_REFS.united_states,
    status: 'active',
  });

  const californiaAncestryRelation = createRelationPacket({
    packet_id: 'nexus:relation/default-ancestry-parent/california',
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.california,
    applicable_scope_refs: californiaApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    subtype: 'default_ancestry_parent',
    subject_ref: PERSONAL_TREE_REFS.california,
    target_ref: PERSONAL_TREE_REFS.united_states,
    scope_ref: PERSONAL_TREE_REFS.california,
    status: 'active',
  });

  const morenoValleyAncestryRelation = createRelationPacket({
    packet_id: 'nexus:relation/default-ancestry-parent/moreno-valley',
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.moreno_valley,
    applicable_scope_refs: morenoValleyApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    subtype: 'default_ancestry_parent',
    subject_ref: PERSONAL_TREE_REFS.moreno_valley,
    target_ref: PERSONAL_TREE_REFS.california,
    scope_ref: PERSONAL_TREE_REFS.moreno_valley,
    status: 'active',
  });

  const sunnymeadRanchAncestryRelation = createRelationPacket({
    packet_id: 'nexus:relation/default-ancestry-parent/sunnymead-ranch',
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    subtype: 'default_ancestry_parent',
    subject_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    target_ref: PERSONAL_TREE_REFS.moreno_valley,
    scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    status: 'active',
  });

  const visitorLobbyPolicyPacket = createPolicyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.visitor_lobby_policy,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Visitor Lobby Baseline Policy',
    summary:
      'Sets the default expectation for public guest posting in visitor lobby discussion spaces.',
    policy_kind: 'guest_lobby',
    body_markdown: [
      '# Visitor Lobby Baseline',
      '',
      '- Guests may introduce themselves and ask locality questions.',
      '- Deeper posting rights remain trust-gated.',
      '- Moderation actions should preserve public orientation where possible.',
    ].join('\n'),
    status: 'active',
  });

  const trustBaselinePolicyPacket = createPolicyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.trust_baseline_policy,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Global Trust Baseline Policy',
    summary:
      'Defines the initial legitimacy thresholds for association support, role claims, and trust-gated participation.',
    policy_kind: 'trust_baseline',
    body_markdown: [
      '# Global Trust Baseline',
      '',
      '- Association claims begin as self-asserted and gain legitimacy through outside support.',
      '- Role claims remain inspectable and require separate support evidence.',
      '- Posting, voting, and review gates use explicit threshold stages rather than opaque scores.',
    ].join('\n'),
    status: 'active',
    trust_policy: {
      association_support_threshold: 1,
      role_support_threshold: 2,
      posting_gate: 'emerging',
      voting_gate: 'recognized',
      review_gate: 'role_eligible',
    },
  });

  const owaDefaultInheritancePolicyPacket = createPolicyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.owa_default_inheritance_policy,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'OWA Default Inheritance Policy',
    summary:
      'Packet-backed default stack for OWA discussion surfaces, trust baseline, visitor lobby expectations, and future preference/template material.',
    policy_kind: 'default_inheritance',
    body_markdown: [
      '# OWA Default Inheritance',
      '',
      '- Defaults resolve through packet refs rather than runtime constants.',
      '- Initiative Actions may override these refs before element-local policies or actor preferences apply.',
      '- Fresh reseed material should keep default packet sets and preferences bundled rather than hardcoded into Element fields.',
    ].join('\n'),
    status: 'active',
    default_policy: {
      policy_refs: [
        PERSONAL_TREE_REFS.owa_home_locality_policy,
        PERSONAL_TREE_REFS.visitor_lobby_policy,
        PERSONAL_TREE_REFS.trust_baseline_policy,
      ],
      template_refs: [],
      default_packet_set_refs: [],
      preference_refs: [],
    },
  });

  const owaGovernanceBaselinePolicyPacket = createPolicyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.owa_governance_baseline_policy,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'OWA Governance Baseline Policy',
    summary:
      'Reseed-ready governance hooks for quorum, eligibility, vote method, and decision-report expectations without executing voting yet.',
    policy_kind: 'governance_baseline',
    body_markdown: [
      '# OWA Governance Baseline',
      '',
      '- Voting execution remains future work.',
      '- Proposal and decision flows should discover quorum, trust, eligibility, and report requirements through Policy packets.',
      '- Decision reports are expected for formal outcomes once proposal/vote execution is live.',
    ].join('\n'),
    status: 'active',
    governance_policy: {
      minimum_trust_stage: 'recognized',
      voter_eligibility: {
        eligible_scope_refs: [PERSONAL_TREE_REFS.global_commons],
        eligible_role_refs: [],
      },
      quorum_rule: {
        quorum_kind: 'none',
        minimum_count: null,
        percentage: null,
      },
      approval_threshold: {
        threshold_kind: 'simple_majority',
        percentage: null,
      },
      vote_method: 'simple_majority',
      decision_report_required: true,
    },
  });

  const facilitatorRolePacket = createRolePacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.facilitator_role,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Facilitator',
    summary:
      'Supports discussion flow, meeting/process clarity, and procedural legibility.',
    role_kind: 'facilitator',
    status: 'active',
    responsibility_markdown:
      'Helps deliberation stay navigable, inclusive, and procedurally coherent.',
  });

  const coordinatorRolePacket = createRolePacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.coordinator_role,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Coordinator',
    summary:
      'Coordinates execution, logistics, and follow-through for approved work.',
    role_kind: 'coordinator',
    status: 'active',
    responsibility_markdown:
      'Translates decisions into structured timing, logistics, and follow-up.',
  });

  const councilorRolePacket = createRolePacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.councilor_role,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Councilor',
    summary:
      'Carries elevated review responsibility for policy, decisions, and legitimacy-sensitive questions.',
    role_kind: 'councilor',
    status: 'active',
    responsibility_markdown:
      'Provides review, objection handling, and legitimacy-sensitive oversight.',
  });

  const sunnymeadOnboardingProposalPacket = createProposalPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.sunnymead_onboarding_proposal,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    title: 'Pilot Sunnymead Ranch guest onboarding flow',
    summary:
      'Creates a localized guest entry flow that points newcomers to the neighborhood assembly first.',
    proposal_kind: 'onboarding_flow',
    status: 'under_review',
    decision_scope_refs: [PERSONAL_TREE_REFS.sunnymead_ranch],
    related_policy_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
  });

  const globalOnboardingVotePacket = createVotePacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_onboarding_vote,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    proposal_ref: PERSONAL_TREE_REFS.sunnymead_onboarding_proposal,
    title: 'Vote: Sunnymead Ranch onboarding pilot',
    vote_method: 'simple-majority',
    status: 'up_for_vote',
    opened_at: SEED_CREATED_AT,
    closes_at: '2026-04-12T00:00:00.000Z',
  });
  const aaronSunnymeadClaimPacket = createClaimPacket({
    packet_id: 'nexus:claim/assembly-association/aaron-sunnymead-ranch',
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.aaron,
    claim_kind: 'assembly_association',
    subject_ref: PERSONAL_TREE_REFS.aaron,
    target_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    status: 'active',
    note: 'Resident and active local participant.',
  });

  return [
    globalCommonsPacket,
    unitedStatesPacket,
    californiaPacket,
    morenoValleyPacket,
    sunnymeadRanchPacket,
    aaronPacket,
    owaHomeLocalityPolicyPacket,
    owaCausePacket,
    owaActionPacket,
    visitorLobbyPolicyPacket,
    trustBaselinePolicyPacket,
    owaDefaultInheritancePolicyPacket,
    owaGovernanceBaselinePolicyPacket,
    unitedStatesAncestryRelation,
    californiaAncestryRelation,
    morenoValleyAncestryRelation,
    sunnymeadRanchAncestryRelation,
    facilitatorRolePacket,
    coordinatorRolePacket,
    councilorRolePacket,
    sunnymeadOnboardingProposalPacket,
    globalOnboardingVotePacket,
    aaronSunnymeadClaimPacket,
    ...createScopeDiscussionPackets({
      packetRef: PERSONAL_TREE_REFS.global_commons,
      applicableScopeRefs: globalApplicableScopeRefs,
      scopeName: 'Global Commons',
      authorRef: PERSONAL_TREE_REFS.global_commons,
    }),
    ...createScopeDiscussionPackets({
      packetRef: PERSONAL_TREE_REFS.united_states,
      applicableScopeRefs: unitedStatesApplicableScopeRefs,
      scopeName: 'United States',
      authorRef: PERSONAL_TREE_REFS.global_commons,
    }),
    ...createScopeDiscussionPackets({
      packetRef: PERSONAL_TREE_REFS.california,
      applicableScopeRefs: californiaApplicableScopeRefs,
      scopeName: 'California',
      authorRef: PERSONAL_TREE_REFS.global_commons,
    }),
    ...createScopeDiscussionPackets({
      packetRef: PERSONAL_TREE_REFS.moreno_valley,
      applicableScopeRefs: morenoValleyApplicableScopeRefs,
      scopeName: 'Moreno Valley',
      authorRef: PERSONAL_TREE_REFS.aaron,
    }),
    ...createScopeDiscussionPackets({
      packetRef: PERSONAL_TREE_REFS.sunnymead_ranch,
      applicableScopeRefs: sunnymeadApplicableScopeRefs,
      scopeName: 'Sunnymead Ranch',
      authorRef: PERSONAL_TREE_REFS.aaron,
    }),
  ];
}

export const PERSONAL_SEED_PACKETS = createPersonalSeedPackets();
