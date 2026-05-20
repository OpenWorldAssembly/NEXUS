/**
 * File: packet-runtime-modernization-audit.ts
 * Description: Runtime-side modernization audit for packet connectors and mutation intents.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import {
  listPacketFamilyModernizationCoverage,
  listPacketTypeModernizationCoverage,
  type PacketFamilyModernizationCoverage,
  type PacketTypeModernizationCoverage,
  type PacketModernizationPlannedGap,
} from '@core/packets/packet-modernization-coverage';
import { PACKET_RUNTIME_CONNECTORS } from '@runtime/nexus/server/packet-runtime-connectors';
import {
  listMutationIntentDescriptors,
  type MutationIntentDescriptor,
} from '@runtime/nexus/server/mutation-intent-registry';

export type RuntimeConnectorStatus =
  | 'master_handler_enrolled'
  | 'planned_gap';

export interface PacketFamilyRuntimeModernizationCoverage
  extends PacketFamilyModernizationCoverage {
  runtime_connector_status: RuntimeConnectorStatus;
  runtime_connector_ids: string[];
}

export interface PacketTypeRuntimeModernizationCoverage
  extends PacketTypeModernizationCoverage {
  runtime_connector_status: RuntimeConnectorStatus;
  runtime_connector_ids: string[];
}

export interface MutationRuntimeModernizationGap {
  area: 'master_handler_connector';
  status: 'planned_gap';
  reason: string;
}

export interface MutationRuntimeModernizationCoverage {
  mutation_intent: MutationIntent['kind'];
  domain: MutationIntentDescriptor['domain'];
  prepare_handler: MutationIntentDescriptor['prepare'];
  finalize_handler: MutationIntentDescriptor['finalize'];
  policy_action_ids: MutationActionId[];
  signed_corridor_status: 'enrolled';
  master_handler_connector_status: RuntimeConnectorStatus;
  connector_ids: string[];
  planned_gaps: MutationRuntimeModernizationGap[];
}

const MUTATION_POLICY_ACTION_IDS = {
  'locality.path.create': ['locality.element.create'],
  'locality.graph.apply': [
    'locality.element.create',
    'home_locality.relation.set',
    'home_locality.relation.clear',
    'assembly_association.relation.set',
    'assembly_association.relation.clear',
    'follows.relation.set',
    'follows.relation.clear',
  ],
  'discussion.thread_post.create': [
    'discussion.thread.create',
    'discussion.post.create',
  ],
  'discussion.reply.create': ['discussion.reply.create'],
  'discussion.surfaces.ensure': ['discussion.surfaces.ensure'],
  'attestation.packet_signal.set': [
    'attestation.packet_signal.set',
    'attestation.packet_signal.clear',
  ],
  'assembly.element.create': ['assembly.element.create'],
  'assembly_association.relation.set': ['assembly_association.relation.set'],
  'assembly_association.relation.clear': ['assembly_association.relation.clear'],
  'home_locality.relation.set': [
    'home_locality.relation.set',
    'home_locality.relation.clear',
  ],
  'follows.relation.set': ['follows.relation.set'],
  'follows.relation.clear': ['follows.relation.clear'],
  'role_association.claim.set': [
    'role_association.claim.set',
    'role_association.claim.withdraw',
  ],
  'role_association.attestation.set': [
    'role_association.attestation.support',
    'role_association.attestation.dispute',
    'role_association.attestation.clear',
  ],
  'actor.write_policy.update': ['actor.write_policy.update'],
} as const satisfies Record<MutationIntent['kind'], readonly MutationActionId[]>;

function connectorIdsForPacketType(packetType: string): string[] {
  return PACKET_RUNTIME_CONNECTORS.filter(
    (connector) => connector.packet_type === packetType
  ).map((connector) => connector.connector_id);
}

function plannedRuntimeConnectorGap(): PacketModernizationPlannedGap {
  return {
    area: 'runtime_connector',
    status: 'planned_gap',
    reason:
      'Runtime connector enrollment is intentionally staged behind manifest-native packet-type builder coverage and master-handler integration.',
  };
}

export function listPacketFamilyRuntimeModernizationCoverage(): PacketFamilyRuntimeModernizationCoverage[] {
  return listPacketFamilyModernizationCoverage().map((coverage) => {
    const runtime_connector_ids = connectorIdsForPacketType(coverage.family);
    const runtime_connector_status =
      runtime_connector_ids.length > 0
        ? 'master_handler_enrolled'
        : 'planned_gap';

    return {
      ...coverage,
      runtime_connector_status,
      runtime_connector_ids,
      planned_gaps:
        runtime_connector_status === 'planned_gap'
          ? [...coverage.planned_gaps, plannedRuntimeConnectorGap()]
          : coverage.planned_gaps,
    };
  });
}

export function listPacketTypeRuntimeModernizationCoverage(): PacketTypeRuntimeModernizationCoverage[] {
  return listPacketTypeModernizationCoverage().map((coverage) => {
    const runtime_connector_ids = connectorIdsForPacketType(coverage.packet_type);
    const runtime_connector_status =
      runtime_connector_ids.length > 0
        ? 'master_handler_enrolled'
        : 'planned_gap';

    return {
      ...coverage,
      runtime_connector_status,
      runtime_connector_ids,
      planned_gaps:
        runtime_connector_status === 'planned_gap'
          ? [...coverage.planned_gaps, plannedRuntimeConnectorGap()]
          : coverage.planned_gaps,
    };
  });
}

export function listMutationRuntimeModernizationCoverage(): MutationRuntimeModernizationCoverage[] {
  return listMutationIntentDescriptors().map((descriptor) => ({
    mutation_intent: descriptor.kind,
    domain: descriptor.domain,
    prepare_handler: descriptor.prepare,
    finalize_handler: descriptor.finalize,
    policy_action_ids: [...MUTATION_POLICY_ACTION_IDS[descriptor.kind]],
    signed_corridor_status: 'enrolled',
    master_handler_connector_status: 'planned_gap',
    connector_ids: [],
    planned_gaps: [
      {
        area: 'master_handler_connector',
        status: 'planned_gap',
        reason:
          'This live mutation intent still runs through the signed fortress corridor and is scheduled for connector enrollment in the modernization chapter.',
      },
    ],
  }));
}
