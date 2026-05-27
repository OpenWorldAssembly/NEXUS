/**
 * File: resolve_trusted_dependency_context.ts
 * Description: Classifies dependency descriptors for trusted regulation contexts.
 */

import {
  listPacketDependencyRequirementDescriptorsFromDefinitions,
  type PacketDependencyRequirementDescriptor,
} from '@core/packets/packet-policy-dependency.ts';
import {
  listPacketDependencySemanticDescriptors,
} from '@core/packets/packet-policy-semantics.ts';
import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  createRequirement,
  missingDefinitionParts,
  regulationTrace,
  uniqueSorted,
} from '../trusted_regulation_internal.ts';
import {
  TRUSTED_REGULATION_COORDINATOR_ID,
  type ResolveTrustedDependencyContextInput,
  type TrustedDependencyContext,
  type TrustedRegulationRequirement,
} from '../trusted_regulation_types.ts';

function filterDependencyRequirements(input: {
  requirements: readonly PacketDependencyRequirementDescriptor[];
  packetType?: string | null;
}): PacketDependencyRequirementDescriptor[] {
  return input.requirements.filter(
    (requirement) =>
      !input.packetType ||
      requirement.packet_type === input.packetType ||
      requirement.packet_type === null
  );
}

export function resolveTrustedDependencyContext(
  input: ResolveTrustedDependencyContextInput
): TrustedRuntimeCoordinatorResult<TrustedDependencyContext> {
  const operationKind = input.operation_kind ?? 'dependency_resolution';
  const packetType = input.packet_type ?? input.definition?.packet_type ?? null;
  const definitions = input.definitions ?? (input.definition ? [input.definition] : trustedDefinitionCoordinator.listPacketDefinitions({
    context_mode: input.context_mode ?? 'reseed',
    node_element_id: input.node_element_id,
    preferences: input.preferences,
    packet_type_filters: packetType ? [packetType] : undefined,
  }).value ?? []);
  const packetSubtype = input.packet_subtype ?? input.definition?.default_subtype ?? null;
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const requirements = filterDependencyRequirements({
    requirements: listPacketDependencyRequirementDescriptorsFromDefinitions({ definitions }),
    packetType,
  });
  const semanticDescriptors = listPacketDependencySemanticDescriptors({ definitions }).filter(
    (descriptor) => !packetType || descriptor.packet_type === packetType || descriptor.packet_type === null
  );
  const missingParts = input.definition ? missingDefinitionParts(input.definition) : [];
  const blockingRequirements: TrustedRegulationRequirement[] = requirements
    .filter((requirement) => !requirement.runtime_metadata_only)
    .map((requirement) => createRequirement({
      requirement_id: requirement.dependency_id,
      requirement_kind: 'dependency',
      strength: requirement.anchor_kind === 'trusted_runtime_capability' ? 'advisory' : 'blocking',
      source:
        requirement.anchor_kind === 'packet_definition_part'
          ? 'definition_part'
          : requirement.anchor_kind === 'policy_packet_semantics'
            ? 'semantic_descriptor'
            : requirement.anchor_kind === 'trusted_runtime_capability'
              ? 'trusted_runtime_capability'
              : 'semantic_descriptor',
      packet_type: requirement.packet_type,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      notes: requirement.notes,
    }));
  const advisoryRequirements: TrustedRegulationRequirement[] = requirements
    .filter((requirement) => requirement.runtime_metadata_only)
    .map((requirement) => createRequirement({
      requirement_id: requirement.dependency_id,
      requirement_kind: 'dependency',
      strength: 'advisory',
      source: 'trusted_runtime_capability',
      packet_type: requirement.packet_type,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      notes: requirement.notes,
    }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'policy',
    value: {
      context_kind: 'trusted.dependency_context',
      packet_type: packetType,
      packet_subtype: packetSubtype,
      operation_kind: operationKind,
      requirements,
      semantic_descriptors: semanticDescriptors,
      blocking_requirements: blockingRequirements.filter((requirement) => requirement.strength === 'blocking'),
      advisory_requirements: [
        ...advisoryRequirements,
        ...blockingRequirements.filter((requirement) => requirement.strength !== 'blocking'),
      ],
      runtime_metadata_dependency_ids: uniqueSorted(
        requirements
          .filter((requirement) => requirement.runtime_metadata_only)
          .map((requirement) => requirement.dependency_id)
      ),
      packet_backed_dependency_ids: uniqueSorted(
        requirements
          .filter((requirement) => !requirement.runtime_metadata_only)
          .map((requirement) => requirement.dependency_id)
      ),
      missing_required_definition_parts: missingParts,
    },
    issues,
    trace: [
      regulationTrace({
        step_id: 'regulation.dependencies.context.resolve',
        status: missingParts.length > 0 ? 'partial' : 'ok',
        preset_ids: ['resolution.dependency_gate.v0'],
        notes: `Resolved ${requirements.length} dependency requirements for ${packetType ?? operationKind}.`,
      }),
    ],
  });
}
