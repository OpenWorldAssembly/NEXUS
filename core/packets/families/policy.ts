/**
 * File: families/policy.ts
 * Description: Family-owned build rules for canonical Policy packets.
 */

import type { PolicyPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createTextExcerpt } from '@core/packets/packet-build-helpers';

export const policyBuildDefinition: PacketFamilyBuildDefinition<
  'Policy',
  PolicyPacketInput
> = {
  prepareBody: (input) => ({
    title: input.title,
    summary: input.summary ?? null,
    policy_kind: input.policy_kind,
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
  }),
  prepareMetadataSummary: (input) =>
    input.summary ?? createTextExcerpt(input.body_markdown),
};
