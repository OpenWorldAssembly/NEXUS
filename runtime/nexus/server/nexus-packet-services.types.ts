/**
 * File: nexus-packet-services.types.ts
 * Description: Shared runtime-facing type surface for the Nexus packet service registry.
 */

import { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import type { NodeSQLiteQueryServices } from '@runtime/storage/node-sqlite-query-services';

export interface NexusPacketServices extends NodeSQLiteQueryServices {
  authService: NexusAuthService;
  attestationService: SQLiteAttestationService;
  discussionService: SQLiteDiscussionService;
  packetVoteService: SQLiteAttestationService;
}
