/**
 * File: resolve_trusted_policy_context.ts
 * Description: Resolves policy requirement context for creation, projection, governance, import, and non-creation policy checks.
 */

import {
  listPacketPolicyRequirementDescriptorsFromDefinitions,
  type PacketPolicyRequirementDescriptor,
} from '@core/packets/packet-policy-dependency.ts';
import {
  listPacketPolicySemanticDescriptors,
  resolvePolicyPacketSemantics,
} from '@core/packets/packet-policy-semantics.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { regulationTrace, uniqueSorted } from '../trusted_regulation_internal.ts';
import {
  TRUSTED_REGULATION_COORDINATOR_ID,
  type ResolveTrustedPolicyContextInput,
  type TrustedPolicyContext,
} from '../trusted_regulation_types.ts';

function filterPolicyRequirements(input: {
  requirements: readonly PacketPolicyRequirementDescriptor[];
  packetType?: string | null;
}): PacketPolicyRequirementDescriptor[] {
  return input.requirements.filter(
    (requirement) =>
      !input.packetType ||
      requirement.packet_type === input.packetType ||
      requirement.packet_type === null
  );
}

export function resolveTrustedPolicyContext(
  input: ResolveTrustedPolicyContextInput
): TrustedRuntimeCoordinatorResult<TrustedPolicyContext> {
  const operationKind = input.operation_kind ?? 'policy_resolution';
  const definitions = input.definitions ?? (input.definition ? [input.definition] : []);
  const packetType = input.packet_type ?? input.definition?.packet_type ?? null;
  const packetSubtype = input.packet_subtype ?? input.definition?.default_subtype ?? null;
  const requirements = filterPolicyRequirements({
    requirements: listPacketPolicyRequirementDescriptorsFromDefinitions({ definitions }),
    packetType,
  });
  const semanticDescriptors = listPacketPolicySemanticDescriptors();
  const resolvedPolicyPacketSemantics = (input.policy_packets ?? []).map(resolvePolicyPacketSemantics);
  const semanticBySubtype = new Map(
    semanticDescriptors.map((descriptor) => [descriptor.policy_subtype, descriptor])
  );
  const activePolicyRequirementIds = uniqueSorted(
    requirements
      .filter((requirement) => requirement.live_write_policy_action)
      .map((requirement) => requirement.policy_requirement_id)
  );
  const definitionAuditPolicyRequirementIds = uniqueSorted(
    requirements
      .filter((requirement) => !requirement.live_write_policy_action)
      .map((requirement) => requirement.policy_requirement_id)
  );
  const futureHookPolicyRequirementIds = uniqueSorted(
    requirements
      .filter((requirement) => {
        const semantic = semanticBySubtype.get(requirement.policy_action_id);
        return semantic?.live_enforcement === 'definition_audit';
      })
      .map((requirement) => requirement.policy_requirement_id)
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'policy',
    value: {
      context_kind: 'trusted.policy_context',
      packet_type: packetType,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      requirements,
      semantic_descriptors: semanticDescriptors,
      resolved_policy_packet_semantics: resolvedPolicyPacketSemantics,
      active_policy_requirement_ids: activePolicyRequirementIds,
      advisory_policy_requirement_ids: [],
      definition_audit_policy_requirement_ids: definitionAuditPolicyRequirementIds,
      future_hook_policy_requirement_ids: futureHookPolicyRequirementIds,
    },
    issues: [],
    trace: [
      regulationTrace({
        step_id: 'regulation.policies.context.resolve',
        status: 'ok',
        preset_ids: ['resolution.policy_gate.v0'],
        notes: `Resolved ${requirements.length} policy requirements and ${resolvedPolicyPacketSemantics.length} policy packet semantic summaries for ${packetType ?? operationKind}.`,
      }),
    ],
  });
}
