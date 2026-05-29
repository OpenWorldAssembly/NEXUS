/**
 * File: nexus-packet-service-registry.ts
 * Description: Composes the shared runtime packet services without owning cache or bootstrap policy.
 */

import { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteReactionService } from '@runtime/nexus/server/reaction-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { NexusPacketActionService } from '@runtime/nexus/server/packet-action-service';
import { NexusPacketVerificationService } from '@runtime/nexus/server/verification-service';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';
import type { NodeSQLiteQueryServices } from '@runtime/storage/node-sqlite-query-services';

export function createNexusPacketServiceRegistry(
  services: NodeSQLiteQueryServices
): NexusPacketServices {
  const reactionService = new SQLiteReactionService(services.packetStore);
  const discussionService = new SQLiteDiscussionService(
    services.packetStore,
    reactionService
  );
  const authService = new NexusAuthService(services.packetStore);
  const verificationService = new NexusPacketVerificationService(
    services.packetStore
  );
  const packetActionService = new NexusPacketActionService(
    services.browserQueryService,
    verificationService
  );
  return {
    ...services,
    authService,
    reactionService,
    discussionService,
    packetVoteService: reactionService,
    verificationService,
    packetActionService,
  };
}
