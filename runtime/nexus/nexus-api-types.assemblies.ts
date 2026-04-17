/**
 * File: nexus-api-types.assemblies.ts
 * Description: Assembly-claim and assembly-creation payloads shared across Nexus routes and clients.
 */

import type { AssemblyAssociationClaimProjection } from '@core/contracts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusVoteSummaryPayload } from '@runtime/nexus/nexus-api-types.discussions';

export interface NexusAssemblyClaimsPayload {
  actor_packet_id: string;
  claims: AssemblyAssociationClaimProjection[];
}

export interface NexusAssemblyClaimMutationPayload {
  assembly_packet_id: string;
  summary: NexusVoteSummaryPayload;
  claims: AssemblyAssociationClaimProjection[];
}

export interface NexusCreateAssemblyPayload {
  assembly_packet: PacketEnvelopeByType['Element'];
  claims: AssemblyAssociationClaimProjection[];
}
