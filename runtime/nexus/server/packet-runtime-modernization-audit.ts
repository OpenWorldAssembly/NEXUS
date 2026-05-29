/**
 * File: packet-runtime-modernization-audit.ts
 * Description: Runtime-side modernization audit for packet connectors and mutation intents.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import {
  listPacketTypeModernizationCoverage,
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
  | 'missing_coverage';

export interface PacketTypeRuntimeModernizationCoverage
  extends Omit<PacketTypeModernizationCoverage, 'runtime_connector_status'> {
  runtime_connector_status: RuntimeConnectorStatus;
  runtime_connector_ids: string[];
}

export interface MutationRuntimeModernizationGap {
  area: 'master_handler_connector';
  status: 'missing_coverage';
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
  missing_coverage_items: MutationRuntimeModernizationGap[];
}

const MUTATION_POLICY_ACTION_IDS = {
  'locality.path.create': ['locality.element.create'],
  'locality.graph.apply': [
    'locality.element.create',
    'relation.residence.add',
    'relation.residence.clear',
    'relation.association.add',
    'relation.association.clear',
    'relation.follow.add',
    'relation.follow.clear',
  ],
  'discussion.thread_post.create': [
    'discussion.thread.create',
    'discussion.post.create',
  ],
  'discussion.reply.create': ['discussion.reply.create'],
  'discussion.surfaces.ensure': ['discussion.surfaces.ensure'],
  'reaction.vote.set': [
    'reaction.vote.set',
    'reaction.vote.clear',
  ],
  'assembly.element.create': ['assembly.element.create'],
  'relation.association.add': ['relation.association.add'],
  'relation.association.clear': ['relation.association.clear'],
  'relation.residence.add': [
    'relation.residence.add',
    'relation.residence.clear',
  ],
  'relation.follow.add': ['relation.follow.add'],
  'relation.follow.clear': ['relation.follow.clear'],
  'relation.participation.add': [
    'relation.participation.add',
    'relation.participation.clear',
  ],
  'relation.participation.clear': ['relation.participation.clear'],
  'reaction.attestation.set': [
    'reaction.attestation.set',
    'reaction.attestation.clear',
  ],
  'actor.write_policy.update': ['actor.write_policy.update'],
  'preference.element.set': ['preference.element.write'],
} as const satisfies Record<MutationIntent['kind'], readonly MutationActionId[]>;

function connectorIdsForPacketType(packetType: string): string[] {
  return PACKET_RUNTIME_CONNECTORS.filter(
    (connector) =>
      connector.packet_type === packetType && connector.availability !== 'definition'
  ).map((connector) => connector.connector_id);
}

function plannedRuntimeConnectorGap(): PacketModernizationPlannedGap {
  return {
    area: 'runtime_connector',
    status: 'missing_coverage',
    reason:
      'Runtime connector enrollment is intentionally staged behind canonical packet-type builder coverage and master-handler integration.',
  };
}

export function listPacketTypeRuntimeModernizationCoverage(): PacketTypeRuntimeModernizationCoverage[] {
  return listPacketTypeModernizationCoverage().map((coverage) => {
    const runtime_connector_ids = connectorIdsForPacketType(coverage.type);
    const runtime_connector_status =
      runtime_connector_ids.length > 0
        ? 'master_handler_enrolled'
        : 'missing_coverage';

    return {
      ...coverage,
      runtime_connector_status,
      runtime_connector_ids,
      missing_coverage_items:
        runtime_connector_status === 'missing_coverage'
          ? [...coverage.missing_coverage_items, plannedRuntimeConnectorGap()]
          : coverage.missing_coverage_items,
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
    master_handler_connector_status: 'missing_coverage',
    connector_ids: [],
    missing_coverage_items: [
      {
        area: 'master_handler_connector',
        status: 'missing_coverage',
        reason:
          descriptor.kind === 'preference.element.set'
            ? 'Preference.element has trusted-write coverage; the old connector remains runtime-ready for compatibility tests and local comparison.'
            : 'This live mutation intent still needs explicit Dispatch-chain coverage before it can leave transitional modernization tracking.',
      },
    ],
  }));
}
