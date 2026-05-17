/**
 * File: packet-definition-action-bridge.ts
 * Description: Shadow-mode resolver that turns packet manifest action descriptors into generic runtime action plans.
 */

import type {
  PacketActionDescriptor,
  PacketActionKind,
  PacketBuilderDescriptor,
  PacketMutationDescriptor,
  PacketPlannerDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  getPacketDefinitionAction,
  getPacketDefinitionBuilder,
  getPacketDefinitionPlanner,
} from '@core/packets/packet-definition-helpers.ts';

export type PacketDefinitionRuntimeCapabilities = {
  action_kinds: readonly PacketActionKind[];
  builder_kinds: readonly PacketBuilderDescriptor['builder_kind'][];
  planner_kinds: readonly PacketPlannerDescriptor['planner_kind'][];
};

export const GENERIC_SHADOW_PACKET_RUNTIME_CAPABILITIES = {
  action_kinds: [
    'create',
    'revise',
    'withdraw',
    'project',
    'index',
    'adapt',
    'bundle',
    'import',
    'export',
    'verify',
    'policy_action',
  ],
  builder_kinds: [
    'single_packet_body',
    'single_packet_envelope',
    'multi_packet_bundle',
    'adapter_output',
  ],
  planner_kinds: [
    'single_packet_create',
    'single_packet_revision',
    'projection_only',
    'compatibility_adapter_chain',
    'multi_packet_orchestration',
  ],
} as const satisfies PacketDefinitionRuntimeCapabilities;

export type PacketDefinitionMutationActionPlan = {
  packet_type: string;
  mutation_intent: string;
  mutation: PacketMutationDescriptor | null;
  planner: PacketPlannerDescriptor | null;
  actions: PacketActionDescriptor[];
  builders: PacketBuilderDescriptor[];
  policy_action_ids: string[];
  availability: 'shadow_only' | 'runtime_ready' | 'canonical' | 'unavailable';
  missing_descriptor_ids: string[];
  unsupported_capabilities: string[];
  ready_for_shadow_runtime: boolean;
};

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function listUnsupportedCapabilities(input: {
  actions: readonly PacketActionDescriptor[];
  builders: readonly PacketBuilderDescriptor[];
  planner: PacketPlannerDescriptor | null;
  capabilities: PacketDefinitionRuntimeCapabilities;
}): string[] {
  const unsupported: string[] = [];
  const actionKinds = new Set(input.capabilities.action_kinds);
  const builderKinds = new Set(input.capabilities.builder_kinds);
  const plannerKinds = new Set(input.capabilities.planner_kinds);

  for (const action of input.actions) {
    if (!actionKinds.has(action.action_kind)) {
      unsupported.push(`action_kind:${action.action_kind}`);
    }
  }

  for (const builder of input.builders) {
    if (!builderKinds.has(builder.builder_kind)) {
      unsupported.push(`builder_kind:${builder.builder_kind}`);
    }
  }

  if (input.planner && !plannerKinds.has(input.planner.planner_kind)) {
    unsupported.push(`planner_kind:${input.planner.planner_kind}`);
  }

  return uniqueSorted(unsupported);
}

function resolveAvailability(input: {
  mutation: PacketMutationDescriptor | null;
  planner: PacketPlannerDescriptor | null;
  actions: readonly PacketActionDescriptor[];
  builders: readonly PacketBuilderDescriptor[];
}): PacketDefinitionMutationActionPlan['availability'] {
  const descriptors = [
    input.mutation,
    input.planner,
    ...input.actions,
    ...input.builders,
  ].filter(
    (descriptor): descriptor is
      | PacketMutationDescriptor
      | PacketPlannerDescriptor
      | PacketActionDescriptor
      | PacketBuilderDescriptor => descriptor !== null
  );

  if (descriptors.length === 0) {
    return 'unavailable';
  }

  if (descriptors.some((descriptor) => descriptor.availability === 'canonical')) {
    return 'canonical';
  }

  if (descriptors.some((descriptor) => descriptor.availability === 'runtime_ready')) {
    return 'runtime_ready';
  }

  return 'shadow_only';
}

export function resolvePacketDefinitionMutationActionPlan(input: {
  definition: PacketTypeDefinition;
  mutation_intent: string;
  capabilities?: PacketDefinitionRuntimeCapabilities;
}): PacketDefinitionMutationActionPlan {
  const capabilities = input.capabilities ?? GENERIC_SHADOW_PACKET_RUNTIME_CAPABILITIES;
  const mutation =
    input.definition.mutations.find(
      (descriptor) => descriptor.mutation_intent === input.mutation_intent
    ) ?? null;

  const planner = mutation
    ? getPacketDefinitionPlanner(input.definition, mutation.planner_id)
    : null;

  const mutationActions = (mutation?.action_ids ?? []).map((actionId) =>
    getPacketDefinitionAction(input.definition, actionId)
  );
  const plannerActions = (planner?.action_ids ?? []).map((actionId) =>
    getPacketDefinitionAction(input.definition, actionId)
  );
  const actions = [
    ...mutationActions,
    ...plannerActions,
  ].filter((action): action is PacketActionDescriptor => action !== null);

  const builders = (planner?.builder_ids ?? [])
    .map((builderId) => getPacketDefinitionBuilder(input.definition, builderId))
    .filter((builder): builder is PacketBuilderDescriptor => builder !== null);

  const missingDescriptorIds = [
    mutation === null ? input.mutation_intent : null,
    mutation !== null && planner === null ? mutation.planner_id : null,
    ...(mutation?.action_ids ?? []).filter(
      (actionId) => getPacketDefinitionAction(input.definition, actionId) === null
    ),
    ...(planner?.action_ids ?? []).filter(
      (actionId) => getPacketDefinitionAction(input.definition, actionId) === null
    ),
    ...(planner?.builder_ids ?? []).filter(
      (builderId) => getPacketDefinitionBuilder(input.definition, builderId) === null
    ),
  ].filter((descriptorId): descriptorId is string => descriptorId !== null);

  const unsupportedCapabilities = listUnsupportedCapabilities({
    actions,
    builders,
    planner,
    capabilities,
  });

  const policyActionIds = uniqueSorted([
    ...(mutation?.action_ids ?? [])
      .map((actionId) => getPacketDefinitionAction(input.definition, actionId)?.policy_action_id ?? null)
      .filter((policyActionId): policyActionId is string => policyActionId !== null),
    ...(planner?.policy_action_ids ?? []),
  ]);

  return {
    packet_type: input.definition.packet_type,
    mutation_intent: input.mutation_intent,
    mutation,
    planner,
    actions,
    builders,
    policy_action_ids: policyActionIds,
    availability: resolveAvailability({ mutation, planner, actions, builders }),
    missing_descriptor_ids: uniqueSorted(missingDescriptorIds),
    unsupported_capabilities: unsupportedCapabilities,
    ready_for_shadow_runtime:
      mutation !== null &&
      planner !== null &&
      missingDescriptorIds.length === 0 &&
      unsupportedCapabilities.length === 0,
  };
}

export function assertPacketDefinitionMutationActionPlanReady(
  plan: PacketDefinitionMutationActionPlan
): void {
  if (plan.ready_for_shadow_runtime) {
    return;
  }

  const problems = [
    ...plan.missing_descriptor_ids.map((id) => `missing descriptor ${id}`),
    ...plan.unsupported_capabilities.map((capability) => `unsupported ${capability}`),
  ];

  throw new Error(
    `Packet mutation ${plan.mutation_intent} for ${plan.packet_type} is not shadow-runtime ready: ${
      problems.length > 0 ? problems.join('; ') : 'unknown descriptor problem'
    }`
  );
}
