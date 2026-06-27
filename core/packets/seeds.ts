/**
 * File: seeds.ts
 * Description: Defines the reusable OWA packet seed dataset for scope trees, discussion spaces, forums, threads, root posts, and replies.
 */

import type {
  PacketEnvelope,
  PacketRef,
} from '@core/schema/packet-schema';

import {
  buildDefinitionBundleSeedEnvelope,
  buildDefinitionPacketSeedEnvelopes,
} from '@core/packets/packet-definition-seeds';
import {
  createActionPacket,
  createAssemblyPacket,
  createDiscussionReplyPacket,
  createPacketEdge,
  createPacketRef,
  createPersonPacket,
  createPolicyPacket,
  createProposalPacket,
  createRelationPacket,
  createRolePacket,
} from '@core/packets/builders';
import {
  buildElementDefaultDiscussionPackets,
  createElementDiscussionPostId,
  createElementDiscussionReplyId,
  createElementDiscussionThreadId,
  type ElementDiscussionStarterThreadInput,
} from '@core/packets/defaults/element-discussion-defaults';
import { createOwaElementDiscussionDefaultOverrides } from '@core/packets/defaults/owa-discussion-defaults.ts';
import {
  buildCuratedGlobalGeographySeedPackets,
} from '@core/packets/curated-geography-seeds.ts';

export const SEED_CREATED_AT = '2026-04-08T00:00:00.000Z';
export const DISCUSSION_SEED_VERSION = '2026-04-11-discussions-membership-v1';

export const PERSONAL_TREE_PACKET_IDS = {
  global_commons: 'nexus:element/global-commons',
  united_states: 'nexus:element/united-states',
  california: 'nexus:element/california',
  moreno_valley: 'nexus:element/moreno-valley',
  sunnymead_ranch: 'nexus:element/sunnymead-ranch',
  aaron: 'nexus:element/aaron',
  owa_action: 'nexus:action/owa',
  owa_residence_policy: 'nexus:policy/owa-residence',
  owa_default_inheritance_policy: 'nexus:policy/owa-default-inheritance',
  owa_governance_baseline_policy: 'nexus:policy/owa-governance-baseline',
  visitor_lobby_policy: 'nexus:policy/visitor-lobby-baseline',
  trust_baseline_policy: 'nexus:policy/global-trust-baseline',
  facilitator_role: 'nexus:role/facilitator',
  coordinator_role: 'nexus:role/coordinator',
  councilor_role: 'nexus:role/councilor',
  sunnymead_onboarding_proposal:
    'nexus:proposal/sunnymead-ranch-onboarding',
} as const;

export const PERSONAL_TREE_REFS = {
  global_commons: createPacketRef(PERSONAL_TREE_PACKET_IDS.global_commons),
  united_states: createPacketRef(PERSONAL_TREE_PACKET_IDS.united_states),
  california: createPacketRef(PERSONAL_TREE_PACKET_IDS.california),
  moreno_valley: createPacketRef(PERSONAL_TREE_PACKET_IDS.moreno_valley),
  sunnymead_ranch: createPacketRef(PERSONAL_TREE_PACKET_IDS.sunnymead_ranch),
  aaron: createPacketRef(PERSONAL_TREE_PACKET_IDS.aaron),
  owa_action: createPacketRef(PERSONAL_TREE_PACKET_IDS.owa_action),
  owa_residence_policy: createPacketRef(
    PERSONAL_TREE_PACKET_IDS.owa_residence_policy
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
} as const;

type ScopeSeedConfig = {
  packetRef: PacketRef;
  applicableScopeRefs: PacketRef[];
  scopeName: string;
  authorRef: PacketRef;
};

type StarterThreadConfig = ElementDiscussionStarterThreadInput;

function createApplicableScopeRefs(scopeChain: PacketRef[]): PacketRef[] {
  return [...scopeChain];
}

function createDiscussionThreadId(
  scopePacketId: string,
  forumKind: string,
  suffix: string
): string {
  return createElementDiscussionThreadId({
    elementPacketId: scopePacketId,
    forumKind,
    suffix,
  });
}

function createDiscussionPostId(
  scopePacketId: string,
  forumKind: string,
  suffix: string
): string {
  return createElementDiscussionPostId({
    elementPacketId: scopePacketId,
    forumKind,
    suffix,
  });
}

function createDiscussionReplyId(
  scopePacketId: string,
  forumKind: string,
  suffix: string
): string {
  return createElementDiscussionReplyId({
    elementPacketId: scopePacketId,
    forumKind,
    suffix,
  });
}

function createScopeDiscussionPackets(input: ScopeSeedConfig): PacketEnvelope[] {
  const starterThreads: StarterThreadConfig[] = [];

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

  const packets: PacketEnvelope[] = buildElementDefaultDiscussionPackets({
    ...createOwaElementDiscussionDefaultOverrides({
      elementName: input.scopeName,
      relatedRefs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
    }),
    elementRef: input.packetRef,
    elementName: input.scopeName,
    profile: 'locality_assembly',
    createdAt: SEED_CREATED_AT,
    applicableScopeRefs: input.applicableScopeRefs,
    authorRef: input.authorRef,
    includeProposalsForum: true,
    includeReportsForum: true,
    starterThreads,
  });

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

  const owaResidencePolicyPacket = createPolicyPacket({
    packet_id: PERSONAL_TREE_PACKET_IDS.owa_residence_policy,
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.global_commons,
    applicable_scope_refs: globalApplicableScopeRefs,
    title: 'OWA Home Locality Relation Policy',
    summary:
      'Declares residence relations as structural graph facts; legitimacy evidence can attach separately.',
    subtype: 'charter',
    body_markdown: [
      '# OWA Home Locality Relation Policy',
      '',
      '- Home-locality relations are structural graph facts.',
      '- Claims and reactions may support, dispute, or contextualize a residency relation, but fresh relation writes do not auto-wrap themselves in claims.',
    ].join('\n'),
    status: 'active',
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
    policy_refs: [
      PERSONAL_TREE_REFS.owa_residence_policy,
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
    subtype: 'guest_lobby',
    body_markdown: [
      '# Visitor Lobby Baseline',
      '',
      '- Guests may introduce themselves, share local context, and invite others into Nexus.',
      '- Deeper posting rights remain trust-gated.',
      '- Moderation actions should preserve public community participation where possible.',
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
    subtype: 'trust_baseline',
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
      role_participation_support_threshold: 2,
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
    subtype: 'default_inheritance',
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
        PERSONAL_TREE_REFS.owa_residence_policy,
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
    subtype: 'governance_baseline',
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
    subtype: 'facilitator',
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
    subtype: 'coordinator',
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
    subtype: 'councilor',
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
    subtype: 'onboarding_flow',
    status: 'under_review',
    decision_scope_refs: [PERSONAL_TREE_REFS.sunnymead_ranch],
    related_policy_refs: [PERSONAL_TREE_REFS.visitor_lobby_policy],
  });

  const aaronSunnymeadAssociationRelation = createRelationPacket({
    packet_id: 'nexus:relation/association/aaron-sunnymead-ranch',
    created_at: SEED_CREATED_AT,
    authority_scope_ref: PERSONAL_TREE_REFS.sunnymead_ranch,
    applicable_scope_refs: sunnymeadApplicableScopeRefs,
    created_by: PERSONAL_TREE_REFS.aaron,
    subtype: 'association',
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
    owaResidencePolicyPacket,
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
    aaronSunnymeadAssociationRelation,
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
    ...buildElementDefaultDiscussionPackets({
      elementRef: PERSONAL_TREE_REFS.aaron,
      elementName: 'Aaron',
      profile: 'person',
      createdAt: SEED_CREATED_AT,
      applicableScopeRefs: [PERSONAL_TREE_REFS.aaron, ...sunnymeadApplicableScopeRefs],
      authorRef: PERSONAL_TREE_REFS.aaron,
    }),
  ];
}

export const PERSONAL_SEED_PACKETS = createPersonalSeedPackets();
export const CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS =
  buildCuratedGlobalGeographySeedPackets({
    rootRef: PERSONAL_TREE_REFS.global_commons,
    createdAt: SEED_CREATED_AT,
    createdByRef: PERSONAL_TREE_REFS.global_commons,
  });
export const DEFINITION_PROFILE_SEED_PACKETS = [
  ...buildDefinitionPacketSeedEnvelopes(),
  buildDefinitionBundleSeedEnvelope(),
];
export const CANONICAL_SEED_PACKETS = [
  ...PERSONAL_SEED_PACKETS,
  ...CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS,
  ...DEFINITION_PROFILE_SEED_PACKETS,
];
