/**
 * File: seeds.ts
 * Description: Defines the first reusable seed packet dataset for OWA assembly and forum fixtures.
 */

import type { PacketEnvelope, PacketRef } from '@/domain/schema/packet-schema';

import {
  createAssemblyPacket,
  createDiscussionPostPacket,
  createDiscussionThreadPacket,
  createPacketEdge,
  createPacketRef,
  createPersonPacket,
  createPolicyPacket,
  createProposalPacket,
  createVotePacket,
} from '@/domain/packets/builders';

export const SEED_CREATED_AT = '2026-04-08T00:00:00.000Z';

export const PERSONAL_TREE_PACKET_IDS = {
  global_commons: 'nexus:element/global-commons',
  united_states: 'nexus:element/united-states',
  california: 'nexus:element/california',
  moreno_valley: 'nexus:element/moreno-valley',
  sunnymead_ranch: 'nexus:element/sunnymead-ranch',
  aaron: 'nexus:element/aaron',
  visitor_lobby_policy: 'nexus:policy/visitor-lobby-baseline',
  sunnymead_onboarding_proposal:
    'nexus:proposal/sunnymead-ranch-onboarding',
  global_visitor_lobby_thread: 'nexus:discussion-thread/global-visitor-lobby',
  global_general_thread: 'nexus:discussion-thread/global-general',
  global_proposals_thread: 'nexus:discussion-thread/global-proposals',
  global_reports_thread: 'nexus:discussion-thread/global-reports',
  united_states_visitor_lobby_thread:
    'nexus:discussion-thread/united-states-visitor-lobby',
  california_visitor_lobby_thread:
    'nexus:discussion-thread/california-visitor-lobby',
  moreno_valley_visitor_lobby_thread:
    'nexus:discussion-thread/moreno-valley-visitor-lobby',
  sunnymead_visitor_lobby_thread:
    'nexus:discussion-thread/sunnymead-ranch-visitor-lobby',
  global_welcome_post: 'nexus:discussion-post/global-welcome-post',
  united_states_welcome_post:
    'nexus:discussion-post/united-states-welcome-post',
  california_welcome_post: 'nexus:discussion-post/california-welcome-post',
  moreno_valley_welcome_post:
    'nexus:discussion-post/moreno-valley-welcome-post',
  sunnymead_welcome_post: 'nexus:discussion-post/sunnymead-ranch-welcome-post',
  global_onboarding_vote: 'nexus:vote/sunnymead-ranch-onboarding',
} as const;

export const PERSONAL_TREE_REFS = {
  global_commons: createPacketRef(PERSONAL_TREE_PACKET_IDS.global_commons),
  united_states: createPacketRef(PERSONAL_TREE_PACKET_IDS.united_states),
  california: createPacketRef(PERSONAL_TREE_PACKET_IDS.california),
  moreno_valley: createPacketRef(PERSONAL_TREE_PACKET_IDS.moreno_valley),
  sunnymead_ranch: createPacketRef(PERSONAL_TREE_PACKET_IDS.sunnymead_ranch),
  aaron: createPacketRef(PERSONAL_TREE_PACKET_IDS.aaron),
  visitor_lobby_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.visitor_lobby_policy
  ),
  sunnymead_onboarding_proposal: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.sunnymead_onboarding_proposal
  ),
  global_visitor_lobby_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.global_visitor_lobby_thread
  ),
  global_general_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.global_general_thread
  ),
  global_proposals_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.global_proposals_thread
  ),
  global_reports_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.global_reports_thread
  ),
  united_states_visitor_lobby_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.united_states_visitor_lobby_thread
  ),
  california_visitor_lobby_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.california_visitor_lobby_thread
  ),
  moreno_valley_visitor_lobby_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.moreno_valley_visitor_lobby_thread
  ),
  sunnymead_visitor_lobby_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.sunnymead_visitor_lobby_thread
  ),
  global_onboarding_vote: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.global_onboarding_vote
  ),
} as const;

/**
 * Inputs: a list of packet refs that define a scope chain from local to broad.
 * Output: the same refs in the order expected by scope-aware packet headers.
 */
function createApplicableScopeRefs(scopeChain: PacketRef[]): PacketRef[] {
  return [...scopeChain];
}

/**
 * Inputs: none.
 * Output: the first OWA packet seed dataset covering one personal assembly tree and forum-linked packets.
 */
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

  const globalVisitorLobbyThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_visitor_lobby_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    related_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
    title: 'Global visitor lobby',
    summary:
      'The broadest public thread for introductions, routing, and guest orientation.',
    thread_kind: 'visitor_lobby',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['anonymous_guest'],
      reply_actor_classes: ['anonymous_guest'],
      reaction_actor_classes: ['anonymous_guest'],
      top_level_post_cost: 10,
    },
    default_sort: 'new',
  });

  const globalGeneralThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_general_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Global general',
    summary:
      'Assembly-wide context, updates, and cross-scope orientation threads.',
    thread_kind: 'general',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      top_level_post_cost: 10,
    },
    default_sort: 'hot',
  });

  const globalProposalsThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_proposals_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    related_refs: [PERSONAL_TREE_REFS.sunnymead_onboarding_proposal],
    title: 'Global proposals',
    summary:
      'Discussion floor for proposal drafts, reviews, and amendment context.',
    thread_kind: 'proposals',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      top_level_post_cost: 10,
    },
    default_sort: 'hot',
  });

  const globalReportsThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_reports_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'Global reports and AARs',
    summary:
      'Record and learning loop for mission reports, retrospectives, and improvements.',
    thread_kind: 'reports',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      reply_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      reaction_actor_classes: ['scope_member', 'trusted_member', 'steward'],
      top_level_post_cost: 10,
    },
    default_sort: 'hot',
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

  const unitedStatesVisitorLobbyThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.united_states_visitor_lobby_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.united_states,
    applicable_scope_refs: unitedStatesApplicableScopeRefs,
    related_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
    title: 'United States visitor lobby',
    summary:
      'National newcomer thread for introductions, routing, and first-stop public questions.',
    thread_kind: 'visitor_lobby',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['anonymous_guest'],
      reply_actor_classes: ['anonymous_guest'],
      reaction_actor_classes: ['anonymous_guest'],
      top_level_post_cost: 10,
    },
    default_sort: 'new',
  });

  const californiaVisitorLobbyThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.california_visitor_lobby_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.california,
    applicable_scope_refs: californiaApplicableScopeRefs,
    related_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
    title: 'California visitor lobby',
    summary:
      'State-level newcomer thread for introductions, locality narrowing, and public orientation.',
    thread_kind: 'visitor_lobby',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['anonymous_guest'],
      reply_actor_classes: ['anonymous_guest'],
      reaction_actor_classes: ['anonymous_guest'],
      top_level_post_cost: 10,
    },
    default_sort: 'new',
  });

  const morenoValleyVisitorLobbyThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.moreno_valley_visitor_lobby_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.moreno_valley,
    applicable_scope_refs: morenoValleyApplicableScopeRefs,
    related_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
    title: 'Moreno Valley visitor lobby',
    summary:
      'City-level newcomer thread for Moreno Valley orientation and routing into neighborhood assemblies.',
    thread_kind: 'visitor_lobby',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['anonymous_guest'],
      reply_actor_classes: ['anonymous_guest'],
      reaction_actor_classes: ['anonymous_guest'],
      top_level_post_cost: 10,
    },
    default_sort: 'new',
  });

  const sunnymeadVisitorLobbyThreadPacket = createDiscussionThreadPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.sunnymead_visitor_lobby_thread,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    related_refs: [
      PERSONAL_TREE_REFS.visitor_lobby_policy,
      PERSONAL_TREE_REFS.sunnymead_onboarding_proposal,
    ],
    title: 'Sunnymead Ranch visitor lobby',
    summary:
      'Public neighborhood thread for introductions, local questions, and assembly onboarding context.',
    thread_kind: 'visitor_lobby',
    status: 'open',
    participation_rules: {
      top_level_actor_classes: ['anonymous_guest'],
      reply_actor_classes: ['anonymous_guest'],
      reaction_actor_classes: ['anonymous_guest'],
      top_level_post_cost: 10,
    },
    default_sort: 'new',
  });

  const globalWelcomePostPacket = createDiscussionPostPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.global_welcome_post,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    thread_ref: PERSONAL_TREE_REFS.global_visitor_lobby_thread,
    post_kind: 'forum_post',
    title: 'Start here if you do not know your locality yet',
    content_markdown: [
      'Guests can browse first, ask questions here, and narrow down to a local assembly later.',
      '',
      'If you already know your general area, mention it and we can point you toward the right branch.',
    ].join('\n\n'),
    reference_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
  });

  const unitedStatesWelcomePostPacket = createDiscussionPostPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.united_states_welcome_post,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.united_states,
    applicable_scope_refs: unitedStatesApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    thread_ref: PERSONAL_TREE_REFS.united_states_visitor_lobby_thread,
    post_kind: 'forum_post',
    title: 'United States newcomer thread',
    content_markdown: [
      'Start here if you already know you are somewhere in the U.S. but have not narrowed down to your state or city assembly yet.',
      '',
      'Reply with your general area and we can help route you to the right locality branch.',
    ].join('\n\n'),
    reference_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
  });

  const californiaWelcomePostPacket = createDiscussionPostPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.california_welcome_post,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.california,
    applicable_scope_refs: californiaApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.global_commons,
    thread_ref: PERSONAL_TREE_REFS.california_visitor_lobby_thread,
    post_kind: 'forum_post',
    title: 'California newcomer thread',
    content_markdown: [
      'Use this thread if you know you are in California and want help finding the right local branch next.',
      '',
      'Replies here are the first chance to earn posting points before opening a new top-level visitor thread.',
    ].join('\n\n'),
    reference_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
  });

  const morenoValleyWelcomePostPacket = createDiscussionPostPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.moreno_valley_welcome_post,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.moreno_valley,
    applicable_scope_refs: morenoValleyApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.aaron,
    thread_ref: PERSONAL_TREE_REFS.moreno_valley_visitor_lobby_thread,
    post_kind: 'forum_post',
    title: 'Moreno Valley newcomer thread',
    content_markdown: [
      'This is the city-level entry point for Moreno Valley guests who have not narrowed down to a neighborhood assembly yet.',
      '',
      'Reply here with your area or question and we can point you toward the right local branch.',
    ].join('\n\n'),
    reference_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
  });

  const sunnymeadWelcomePostPacket = createDiscussionPostPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.sunnymead_welcome_post,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.aaron,
    thread_ref: PERSONAL_TREE_REFS.sunnymead_visitor_lobby_thread,
    post_kind: 'forum_post',
    title: 'Sunnymead Ranch newcomer thread',
    content_markdown: [
      'This thread is the neighborhood-level starting point for Sunnymead Ranch guests.',
      '',
      'We can use it to refine the local onboarding flow before wiring it into the broader forum surface.',
    ].join('\n\n'),
    reference_refs: [PERSONAL_TREE_REFS.sunnymead_onboarding_proposal],
  });

  return [
    globalCommonsPacket,
    unitedStatesPacket,
    californiaPacket,
    morenoValleyPacket,
    sunnymeadRanchPacket,
    aaronPacket,
    visitorLobbyPolicyPacket,
    sunnymeadOnboardingProposalPacket,
    globalOnboardingVotePacket,
    globalVisitorLobbyThreadPacket,
    globalGeneralThreadPacket,
    globalProposalsThreadPacket,
    globalReportsThreadPacket,
    unitedStatesVisitorLobbyThreadPacket,
    californiaVisitorLobbyThreadPacket,
    morenoValleyVisitorLobbyThreadPacket,
    sunnymeadVisitorLobbyThreadPacket,
    globalWelcomePostPacket,
    unitedStatesWelcomePostPacket,
    californiaWelcomePostPacket,
    morenoValleyWelcomePostPacket,
    sunnymeadWelcomePostPacket,
  ];
}

export const PERSONAL_SEED_PACKETS = createPersonalSeedPackets();
