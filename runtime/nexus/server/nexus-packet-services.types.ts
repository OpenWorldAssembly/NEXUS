/**
 * File: nexus-packet-services.types.ts
 * Description: Shared runtime-facing type surface for the Nexus packet service registry.
 */

import { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteReactionService } from '@runtime/nexus/server/reaction-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { NexusPacketActionService } from '@runtime/nexus/server/packet-action-service';
import { NexusPacketVerificationService } from '@runtime/nexus/server/verification-service';
import type { NodeSQLiteQueryServices } from '@runtime/storage/node-sqlite-query-services';

export interface NexusPacketServices extends NodeSQLiteQueryServices {
  authService: NexusAuthService;
  reactionService: SQLiteReactionService;
  discussionService: SQLiteDiscussionService;
  packetVoteService: SQLiteReactionService;
  verificationService: NexusPacketVerificationService;
  packetActionService: NexusPacketActionService;
}
