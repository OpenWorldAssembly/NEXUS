/**
 * File: nexus-api-types.explorer.ts
 * Description: Packet Explorer payloads shared across Nexus routes and clients.
 */

import type {
  NexusActionIntentDescriptor,
  NexusActionMap,
  PacketHeadStatus,
} from '@core/contracts';
import type {
  PacketAdaptationChange,
  PacketAdaptationLoss,
  PacketFamily,
  PacketRef,
  PacketRevisionRef,
} from '@core/schema/packet-schema';

export interface NexusPacketExplorerScopeSummary {
  packet_id: string;
  label: string | null;
}

export interface NexusPacketExplorerLinkRow {
  direction: 'incoming' | 'outgoing';
  edge_type: string;
  packet_id: string;
  revision_id: string | null;
  family: PacketFamily | null;
  label: string | null;
  title: string | null;
  metadata: Record<string, unknown>;
}

export interface NexusPacketExplorerAdaptationSummary {
  compatibility_mode: 'native' | 'adapted' | 'downcast' | 'lossy' | 'blocked';
  source_family: PacketFamily;
  target_family: PacketFamily;
  source_schema_version: string;
  target_schema_version: string;
  stages: string[];
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  warnings: string[];
  requires_guarded_migration: boolean;
  requires_loss_acknowledgement: boolean;
}

export interface NexusPacketExplorerSummary {
  packet: PacketRef;
  revision: PacketRevisionRef;
  family: PacketFamily;
  label: string;
  title: string;
  summary: string | null;
  kind: string | null;
  schema_version: string;
  created_at: string;
  authority_scope: NexusPacketExplorerScopeSummary | null;
  applicable_scopes: NexusPacketExplorerScopeSummary[];
}

export interface NexusPacketExplorerPayload {
  packet_summary: NexusPacketExplorerSummary;
  preferred_revision: PacketRevisionRef;
  head_revisions: PacketRevisionRef[];
  revision_state: PacketHeadStatus['revision_state'];
  raw_view: unknown;
  adapted_view: unknown;
  read_model_view: unknown | null;
  adaptation_summary: NexusPacketExplorerAdaptationSummary;
  incoming_links: NexusPacketExplorerLinkRow[];
  outgoing_links: NexusPacketExplorerLinkRow[];
  actions: NexusActionMap;
  action_descriptors: NexusActionIntentDescriptor[];
}
