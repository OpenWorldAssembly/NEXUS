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
  sunnymead_visitor_lobby_thread:
    'nexus:discussion-thread/sunnymead-ranch-visitor-lobby',
  global_welcome_post: 'nexus:discussion-post/global-welcome-post',
  sunnymead_welcome_post: 'nexus:discussion-post/sunnymead-ranch-welcome-post',
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
  sunnymead_visitor_lobby_thread: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.sunnymead_visitor_lobby_thread
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
    globalVisitorLobbyThreadPacket,
    sunnymeadVisitorLobbyThreadPacket,
    globalWelcomePostPacket,
    sunnymeadWelcomePostPacket,
  ];
}

export const PERSONAL_SEED_PACKETS = createPersonalSeedPackets();
