/**
 * File: owa-domain-defaults.ts
 * Description: OWA-domain default values for generic Action, Proposal, and Decision packet definitions.
 */

export type OwaDomainDefaultPacketType = 'Action' | 'Proposal' | 'Decision';

export const OWA_DOMAIN_DEFAULT_DECISIONS = {
  Action:
    'Actions default to draft/active work hierarchy semantics with packet-backed policies, templates, child actions, locations, and default packet sets kept as refs instead of body-specific runtime constants.',
  Proposal:
    'Proposals default to draft deliberation records with decision scopes and related policies resolved through packet refs; support/dispute and votes remain Reaction packets, not Proposal body fields.',
  Decision:
    'Decisions default to recorded governance outcomes that point back to Proposal and vote/report material by packet ref rather than embedding the whole vote result.',
} as const satisfies Record<OwaDomainDefaultPacketType, string>;

const ACTION_SUBTYPE_DEFAULTS: Record<string, Record<string, unknown>> = {
  initiative: {
    subtype: 'initiative',
    status: 'active',
    objective_markdown: null,
    location_refs: [],
    action_refs: [],
    parent_action_ref: null,
    child_action_refs: [],
    policy_refs: [],
    template_refs: [],
    default_packet_set_refs: [],
    owa_default_role: 'initiative_anchor',
  },
  campaign: {
    subtype: 'campaign',
    status: 'draft',
    objective_markdown: null,
    location_refs: [],
    action_refs: [],
    parent_action_ref: null,
    child_action_refs: [],
    policy_refs: [],
    template_refs: [],
    default_packet_set_refs: [],
    owa_default_role: 'coordinated_work_stream',
  },
  program: {
    subtype: 'program',
    status: 'draft',
    objective_markdown: null,
    location_refs: [],
    action_refs: [],
    parent_action_ref: null,
    child_action_refs: [],
    policy_refs: [],
    template_refs: [],
    default_packet_set_refs: [],
    owa_default_role: 'standing_work_area',
  },
  mission: {
    subtype: 'mission',
    status: 'draft',
    objective_markdown: null,
    location_refs: [],
    action_refs: [],
    parent_action_ref: null,
    child_action_refs: [],
    policy_refs: [],
    template_refs: [],
    default_packet_set_refs: [],
    owa_default_role: 'time_bounded_execution',
  },
  task: {
    subtype: 'task',
    status: 'open',
    objective_markdown: null,
    location_refs: [],
    action_refs: [],
    parent_action_ref: null,
    child_action_refs: [],
    policy_refs: [],
    template_refs: [],
    default_packet_set_refs: [],
    owa_default_role: 'discrete_work_item',
  },
};

export function createOwaDomainDefaultValues(input: {
  type: string;
  subtype: string;
}): Record<string, unknown> | null {
  if (input.type === 'Action') {
    return ACTION_SUBTYPE_DEFAULTS[input.subtype] ?? {
      subtype: input.subtype,
      status: 'draft',
      objective_markdown: null,
      location_refs: [],
      action_refs: [],
      parent_action_ref: null,
      child_action_refs: [],
      policy_refs: [],
      template_refs: [],
      default_packet_set_refs: [],
      owa_default_role: 'custom_action',
    };
  }

  if (input.type === 'Proposal') {
    return {
      subtype: input.subtype,
      status: 'draft',
      decision_scope_refs: [],
      related_policy_refs: [],
      default_discussion_behavior: 'proposal_thread_expected',
      default_vote_behavior: 'reaction_or_governance_policy_defined',
    };
  }

  if (input.type === 'Decision') {
    return {
      subtype: input.subtype,
      outcome: 'recorded',
      proposal_ref: null,
      vote_ref: null,
      default_report_behavior: 'decision_report_expected_when_policy_requires',
    };
  }

  return null;
}

export function hasOwaDomainDefaultDecision(packetType: string): boolean {
  return packetType in OWA_DOMAIN_DEFAULT_DECISIONS;
}
