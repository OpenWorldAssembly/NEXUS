/**
 * File: nexus-api-types.packet-actions.ts
 * Description: Shared API payload contracts for runtime-projected packet actions.
 */

import type {
  NexusActionIntentDescriptor,
  NexusActionMap,
  NexusPacketVerificationSummary,
} from '@core/contracts';
import type { PacketType } from '@core/schema/packet-schema';
export type NexusPacketActionSurface =
  | 'dashboard'
  | 'discussions'
  | 'votes'
  | 'roles'
  | 'trust'
  | 'library'
  | 'explorer';

export interface NexusPacketActionTargetInput {
  packet_id: string;
  revision_id?: string | null;
  type?: PacketType | null;
  label?: string | null;
  title?: string | null;
  summary?: string | null;
  preferred_surface?: NexusPacketActionSurface | null;
}

export interface NexusPacketActionsBatchRequest {
  scope_id?: string | null;
  viewer_actor_packet_id?: string | null;
  surface?: NexusPacketActionSurface | null;
  targets: NexusPacketActionTargetInput[];
}

export interface NexusPacketActionProjection {
  packet_id: string;
  revision_id: string | null;
  type: PacketType | null;
  label: string | null;
  title: string | null;
  summary: string | null;
  preferred_surface: NexusPacketActionSurface;
  verification_summary: NexusPacketVerificationSummary | null;
  actions: NexusActionMap;
  action_descriptors: NexusActionIntentDescriptor[];
}

export interface NexusPacketActionsBatchPayload {
  scope_id: string | null;
  viewer_actor_packet_id: string | null;
  surface: NexusPacketActionSurface;
  projections: NexusPacketActionProjection[];
}
