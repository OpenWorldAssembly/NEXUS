/**
 * File: nexus-api-types.assemblies.ts
 * Description: Association-claim and assembly-creation payloads shared across Nexus routes and clients.
 */

import type { AssociationClaimProjection } from '@core/contracts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusVoteSummaryPayload } from '@runtime/nexus/nexus-api-types.discussions';

export interface NexusAssemblyClaimsPayload {
  actor_packet_id: string;
  claims: AssociationClaimProjection[];
}

export interface NexusAssemblyClaimMutationPayload {
  target_packet_id: string;
  summary: NexusVoteSummaryPayload;
  claims: AssociationClaimProjection[];
}

export interface NexusCreateAssemblyPayload {
  assembly_packet: PacketEnvelopeByType['Element'];
  claims: AssociationClaimProjection[];
}
