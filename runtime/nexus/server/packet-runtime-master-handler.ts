/**
 * File: packet-runtime-master-handler.ts
 * Description: Generic runtime connector corridor for manifest-backed packet actions before full fortress enrollment.
 */

import {
  getDefinedPacketTypeDefinition,
  resolvePacketDefinitionMutationActionPlan,
  type PacketDefinitionMutationActionPlan,
  type PacketDefinitionRuntimeCapabilities,
  type PacketTypeDefinition,
} from '@core/packets/packet-definition-manifest';
import type {
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type { MutationProofBundle } from '@core/auth/proof-types';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export type PacketRuntimeActorContext = {
  actorPacketId: string;
  actorPacket?: PacketEnvelopeByType['Element'] | null;
  proofBundle?: MutationProofBundle | null;
};

export type PacketRuntimeConnectorContext = {
  packetStore: NodeSQLitePacketStore;
  actorContext: PacketRuntimeActorContext;
  definition: PacketTypeDefinition;
  actionPlan: PacketDefinitionMutationActionPlan;
  createdAt: string;
  request?: Request | null;
};

export type PacketRuntimeConnector<TResult = unknown> = {
  connector_id: string;
  packet_type: string;
  packet_subtype: string;
  mutation_intent: string;
  availability: 'definition' | 'live_bridge' | 'fortress_enrolled';
  run: (input: unknown, context: PacketRuntimeConnectorContext) => Promise<TResult>;
};

export type PacketRuntimeMutationInput = {
  packetStore: NodeSQLitePacketStore;
  actorContext: PacketRuntimeActorContext;
  connectorId?: string | null;
  mutationIntent?: string | null;
  input: unknown;
  request?: Request | null;
  createdAt?: string | null;
  capabilities?: PacketDefinitionRuntimeCapabilities;
  connectors: readonly PacketRuntimeConnector[];
};

export type PacketRuntimeMutationResult<TResult = unknown> = {
  corridor_kind: 'packet_runtime_master_handler';
  connector_id: string;
  packet_type: string;
  packet_subtype: string;
  mutation_intent: string;
  availability: PacketRuntimeConnector['availability'];
  definition_found: true;
  action_plan_ready: boolean;
  action_ids: string[];
  policy_action_ids: string[];
  missing_descriptor_ids: string[];
  unsupported_capabilities: string[];
  result: TResult;
};

function getConnector(input: {
  connectors: readonly PacketRuntimeConnector[];
  connectorId?: string | null;
  mutationIntent?: string | null;
}): PacketRuntimeConnector {
  if (input.connectorId) {
    const connector = input.connectors.find(
      (candidate) => candidate.connector_id === input.connectorId
    );

    if (!connector) {
      throw new Error(`Unknown packet runtime connector: ${input.connectorId}`);
    }

    if (input.mutationIntent && connector.mutation_intent !== input.mutationIntent) {
      throw new Error(
        `Packet runtime connector ${input.connectorId} handles ${connector.mutation_intent}, not ${input.mutationIntent}.`
      );
    }

    return connector;
  }

  if (input.mutationIntent) {
    const matches = input.connectors.filter(
      (candidate) => candidate.mutation_intent === input.mutationIntent
    );

    if (matches.length === 0) {
      throw new Error(
        `Unknown packet runtime mutation intent: ${input.mutationIntent}`
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `Packet runtime mutation intent ${input.mutationIntent} is ambiguous across connectors: ${matches
          .map((connector) => connector.connector_id)
          .join(', ')}`
      );
    }

    return matches[0];
  }

  throw new Error('Packet runtime mutation requires connectorId or mutationIntent.');
}

/**
 * Inputs: a mutation intent or connector id plus route/runtime context.
 * Output: one manifest-resolved packet-runtime action result.
 */
export async function runPacketRuntimeMutation<TResult = unknown>(
  input: PacketRuntimeMutationInput
): Promise<PacketRuntimeMutationResult<TResult>> {
  const connector = getConnector({
    connectors: input.connectors,
    connectorId: input.connectorId,
    mutationIntent: input.mutationIntent,
  });
  const definition = getDefinedPacketTypeDefinition(connector.packet_type);

  if (!definition) {
    throw new Error(
      `No packet definition registered for runtime connector packet type: ${connector.packet_type}`
    );
  }

  if (!(definition.declared_subtypes as readonly string[]).includes(connector.packet_subtype)) {
    throw new Error(
      `Packet definition ${connector.packet_type} does not declare subtype ${connector.packet_subtype}.`
    );
  }

  const actionPlan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: connector.mutation_intent,
    capabilities: input.capabilities,
  });

  if (!actionPlan.ready_for_runtime) {
    throw new Error(
      [
        `Packet runtime connector ${connector.connector_id} could not resolve a ready action plan.`,
        actionPlan.missing_descriptor_ids.length > 0
          ? `Missing descriptors: ${actionPlan.missing_descriptor_ids.join(', ')}`
          : null,
        actionPlan.unsupported_capabilities.length > 0
          ? `Unsupported capabilities: ${actionPlan.unsupported_capabilities.join(', ')}`
          : null,
      ]
        .filter((part): part is string => part !== null)
        .join(' ')
    );
  }

  const result = await connector.run(input.input, {
    packetStore: input.packetStore,
    actorContext: input.actorContext,
    definition,
    actionPlan,
    createdAt: input.createdAt ?? new Date().toISOString(),
    request: input.request ?? null,
  });

  return {
    corridor_kind: 'packet_runtime_master_handler',
    connector_id: connector.connector_id,
    packet_type: connector.packet_type,
    packet_subtype: connector.packet_subtype,
    mutation_intent: connector.mutation_intent,
    availability: connector.availability,
    definition_found: true,
    action_plan_ready: actionPlan.ready_for_runtime,
    action_ids: actionPlan.actions.map((action) => action.action_id),
    policy_action_ids: actionPlan.policy_action_ids,
    missing_descriptor_ids: actionPlan.missing_descriptor_ids,
    unsupported_capabilities: actionPlan.unsupported_capabilities,
    result: result as TResult,
  };
}
