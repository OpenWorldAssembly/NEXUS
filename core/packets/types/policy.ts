/**
 * File: types/policy.ts
 * Description: Type-owned build rules for canonical Policy packets.
 */

import type { PolicyPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createTextExcerpt } from '@core/packets/packet-build-helpers';

export const policyBuildDefinition: PacketTypeBuildDefinition<
  'Policy',
  PolicyPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Policy packets require a title.');
    }
  },
  finalizeBody: (input) => ({
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    body_markdown: input.body_markdown,
    status: input.status,
    trust_policy: input.trust_policy
      ? {
          association_support_threshold:
            input.trust_policy.association_support_threshold ?? 1,
          role_support_threshold: input.trust_policy.role_support_threshold ?? 2,
          posting_gate: input.trust_policy.posting_gate ?? 'emerging',
          voting_gate: input.trust_policy.voting_gate ?? 'recognized',
          review_gate: input.trust_policy.review_gate ?? 'role_eligible',
        }
      : null,
    write_policy: input.write_policy
      ? {
          default_proof_level: input.write_policy.default_proof_level ?? 'session',
          action_overrides: input.write_policy.action_overrides ?? {},
        }
      : null,
    dependency_policy: input.dependency_policy
      ? {
          required_refs: input.dependency_policy.required_refs ?? [],
          optional_refs: input.dependency_policy.optional_refs ?? [],
          required_relation_subtypes:
            input.dependency_policy.required_relation_subtypes ?? [],
        }
      : null,
    alignment_policy: input.alignment_policy
      ? {
          required_action_refs: input.alignment_policy.required_action_refs ?? [],
          accepted_relation_subtypes:
            input.alignment_policy.accepted_relation_subtypes ?? [],
        }
      : null,
    relation_requirements: input.relation_requirements
      ? {
          rules: input.relation_requirements.rules.map((rule) => ({
            relation_subtype: rule.relation_subtype,
            required_claim_subtypes: rule.required_claim_subtypes ?? [],
            required_attestation_subtypes:
              rule.required_attestation_subtypes ?? [],
            claim_target_mode: rule.claim_target_mode ?? 'relation_packet',
            subject_match_mode: rule.subject_match_mode ?? 'relation_subject',
          })),
        }
      : null,
    default_policy: input.default_policy
      ? {
          policy_refs: input.default_policy.policy_refs ?? [],
          template_refs: input.default_policy.template_refs ?? [],
          default_packet_set_refs: input.default_policy.default_packet_set_refs ?? [],
          preference_refs: input.default_policy.preference_refs ?? [],
        }
      : null,
    governance_policy: input.governance_policy
      ? {
          minimum_trust_stage:
            input.governance_policy.minimum_trust_stage ?? 'recognized',
          voter_eligibility: {
            eligible_scope_refs:
              input.governance_policy.voter_eligibility?.eligible_scope_refs ?? [],
            eligible_role_refs:
              input.governance_policy.voter_eligibility?.eligible_role_refs ?? [],
          },
          quorum_rule: {
            quorum_kind:
              input.governance_policy.quorum_rule?.quorum_kind ?? 'none',
            minimum_count:
              input.governance_policy.quorum_rule?.minimum_count ?? null,
            percentage: input.governance_policy.quorum_rule?.percentage ?? null,
          },
          approval_threshold: {
            threshold_kind:
              input.governance_policy.approval_threshold?.threshold_kind ??
              'simple_majority',
            percentage:
              input.governance_policy.approval_threshold?.percentage ?? null,
          },
          vote_method: input.governance_policy.vote_method ?? 'simple_majority',
          decision_report_required:
            input.governance_policy.decision_report_required ?? true,
        }
      : null,
  }),
  prepareMetadataSummary: (input) =>
    input.summary ?? createTextExcerpt(input.body_markdown),
};
