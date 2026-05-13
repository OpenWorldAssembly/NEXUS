/**
 * File: nexus-packet-service-registry.ts
 * Description: Composes the shared runtime packet services without owning cache or bootstrap policy.
 */

import { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { NexusMutationService } from '@runtime/nexus/server/mutation-service';
import { NexusPacketActionService } from '@runtime/nexus/server/packet-action-service';
import { NexusPacketVerificationService } from '@runtime/nexus/server/verification-service';
import { MutationTicketStore } from '@runtime/nexus/server/mutation-ticket-store';
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
  const verificationService = new NexusPacketVerificationService(
    services.packetStore
  );
  const packetActionService = new NexusPacketActionService(
    services.browserQueryService,
    verificationService
  );
  const mutationService = new NexusMutationService(
    services.packetStore,
    authService,
    discussionService,
    attestationService,
    new MutationTicketStore()
  );

  return {
    ...services,
    authService,
    attestationService,
    discussionService,
    packetVoteService: attestationService,
    mutationService,
    verificationService,
    packetActionService,
  };
}
