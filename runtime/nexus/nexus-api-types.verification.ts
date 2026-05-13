/**
 * File: nexus-api-types.verification.ts
 * Description: Shared API payload contracts for packet verification actions and reports.
 */

import type {
  NexusPacketVerificationStatus,
} from '@core/contracts';

export interface NexusPacketVerificationRequest {
  packet_id: string;
}

export interface NexusPacketVerificationActionPayload {
  packet_id: string;
  report_packet_id: string;
  report_revision_id: string;
  status: NexusPacketVerificationStatus;
  validated_at: string;
  validator_packet_id: string;
  title: string;
  summary: string;
  warnings: string[];
}
