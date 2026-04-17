/**
 * File: nexus-packet-service-registry.ts
 * Description: Composes the shared runtime packet services without owning cache or bootstrap policy.
 */

import { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';
import type { NodeSQLiteQueryServices } from '@runtime/storage/node-sqlite-query-services';

export function createNexusPacketServiceRegistry(
  services: NodeSQLiteQueryServices
): NexusPacketServices {
  const attestationService = new SQLiteAttestationService(services.packetStore);
  const discussionService = new SQLiteDiscussionService(
    services.packetStore,
    attestationService
  );
  const authService = new NexusAuthService(services.packetStore);

  return {
    ...services,
    authService,
    attestationService,
    discussionService,
    packetVoteService: attestationService,
  };
}
