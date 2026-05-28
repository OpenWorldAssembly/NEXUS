/**
 * File: trusted_projection_types.ts
 * Description: Contracts for the Trusted Projection Coordinator read-model seam.
 */

import type {
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type {
  PacketEdge,
  PacketEnvelope,
  PacketRef,
  PacketRevisionRef,
  PacketType,
} from '@core/schema/packet-schema';
import type { PacketEdgeQuery } from '@core/contracts';
import type {
  TrustedArchiveContextMode,
  TrustedArchivePacketCard,
  TrustedArchiveStoreContext,
} from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import type { TrustedDefinitionContextMode } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type { TrustedResolutionCoordinatorContext } from '@runtime/trusted_coordinators/trusted_resolution_coordinator.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_PROJECTION_COORDINATOR_ID = 'trusted_projection_coordinator.v0' as const;

export type TrustedProjectionContextMode = TrustedArchiveContextMode | TrustedDefinitionContextMode;

export type TrustedPacketProjectionViewModel = {
  view_model_kind: 'trusted.packet_projection_view_model';
  packet_id: string;
  revision_id: string | null;
  packet_type: string;
  packet_subtype: string | null;
  projection_key: string;
  target_surface: string;
  preferred_surface: string | null;
  layout_key: string | null;
  component_key: string | null;
  action_registry_keys: string[];
  title: string;
  label: string;
  summary: string | null;
  status: string | null;
  fields: Record<string, unknown>;
};

export type TrustedPacketListProjectionItem = {
  item_kind: 'trusted.packet_list_projection_item';
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef;
  packet_type: string;
  title: string;
  label: string;
  summary: string | null;
  status: string | null;
  preferred_surface: string | null;
  created_at: string;
  archive_card: TrustedArchivePacketCard;
};

export type TrustedPacketListProjection = {
  projection_kind: 'trusted.packet_list_projection';
  total_count: number;
  offset: number;
  limit: number;
  target_surface: string | null;
  items: TrustedPacketListProjectionItem[];
  archive_cards: TrustedArchivePacketCard[];
};


export type TrustedPreselectedPacketCardInput = {
  packet: PacketRef;
  revision: PacketRevisionRef;
  type: PacketType | string;
  label: string;
  title: string;
  summary: string | null;
  status: string | null;
  created_at: string;
  verification?: unknown;
  authority_scope_packet_id?: string | null;
  applicable_scope_ids?: readonly string[];
};

export type TrustedPacketCardProjectionItem = {
  item_kind: 'trusted.packet_card_projection_item';
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef;
  packet_type: string;
  title: string;
  label: string;
  summary: string | null;
  status: string | null;
  preferred_surface: string | null;
  created_at: string;
  source_card: TrustedPreselectedPacketCardInput;
};

export type TrustedPacketCardListProjection = {
  projection_kind: 'trusted.packet_card_list_projection';
  total_count: number;
  target_surface: string | null;
  items: TrustedPacketCardProjectionItem[];
  source_cards: TrustedPreselectedPacketCardInput[];
};

export type TrustedPacketGraphProjection = {
  projection_kind: 'trusted.packet_graph_projection';
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef | null;
  target_surface: string | null;
  root_projection: TrustedPacketProjectionViewModel | null;
  edge_count: number;
  edges: PacketEdge[];
};

export type TrustedPreferredProjectionSurface = {
  result_kind: 'trusted.preferred_projection_surface';
  packet_type: string;
  preferred_surface: string | null;
  projection_key: string | null;
};

export type TrustedProjectionReadinessReport = {
  report_kind: 'trusted.projection_readiness_report';
  mode: TrustedProjectionContextMode;
  ready: boolean;
  checked_packet_type_count: number;
  packet_types_without_projection: string[];
  projection_descriptor_count: number;
  blocking_issue_count: number;
  warning_count: number;
};

export type BaseTrustedProjectionInput = {
  context_mode?: TrustedProjectionContextMode;
  node_element_id?: string | null;
  operation_id?: string | null;
  request_id?: string | null;
};

export type ResolveTrustedPacketProjectionInput = BaseTrustedProjectionInput & {
  packet: PacketEnvelope;
  revision_ref?: PacketRevisionRef | null;
  projection_key?: string | null;
  target_surface?: string | null;
  context?: Omit<TrustedResolutionCoordinatorContext, 'current_packet' | 'definition'>;
};

export type ResolveTrustedArchivedPacketProjectionInput = BaseTrustedProjectionInput & TrustedArchiveStoreContext & {
  packet_ref: PacketRef;
  revision_ref?: PacketRevisionRef | null;
  projection_key?: string | null;
  target_surface?: string | null;
  context?: Omit<TrustedResolutionCoordinatorContext, 'current_packet' | 'definition'>;
};

export type ResolveTrustedPacketListProjectionInput = BaseTrustedProjectionInput & TrustedArchiveStoreContext & {
  packet_type?: PacketType | null;
  text?: string | null;
  authority_scope_packet_id?: string | null;
  limit?: number;
  offset?: number;
  target_surface?: string | null;
};


export type ResolveTrustedPacketCardListProjectionInput = BaseTrustedProjectionInput & {
  cards: readonly TrustedPreselectedPacketCardInput[];
  target_surface?: string | null;
};

export type ResolveTrustedPacketGraphProjectionInput = BaseTrustedProjectionInput & TrustedArchiveStoreContext & {
  packet_ref: PacketRef;
  revision_ref?: PacketRevisionRef | null;
  projection_key?: string | null;
  target_surface?: string | null;
  edge_query?: PacketEdgeQuery;
  context?: Omit<TrustedResolutionCoordinatorContext, 'current_packet' | 'definition'>;
};

export type ResolveTrustedPreferredSurfaceInput = BaseTrustedProjectionInput & {
  packet_type: string;
};

export type AuditTrustedProjectionReadinessInput = BaseTrustedProjectionInput & {
  packet_type_filters?: readonly string[];
};

export type TrustedProjectionOperation =
  | 'resolve_packet_projection'
  | 'resolve_archived_packet_projection'
  | 'resolve_packet_list_projection'
  | 'resolve_packet_card_list_projection'
  | 'resolve_packet_graph_projection'
  | 'resolve_preferred_surface'
  | 'audit_readiness';

export type TrustedProjectionCoordinatorRequest =
  | {
      operation: 'resolve_packet_projection';
      input: ResolveTrustedPacketProjectionInput;
    }
  | {
      operation: 'resolve_archived_packet_projection';
      input: ResolveTrustedArchivedPacketProjectionInput;
    }
  | {
      operation: 'resolve_packet_list_projection';
      input: ResolveTrustedPacketListProjectionInput;
    }
  | {
      operation: 'resolve_packet_card_list_projection';
      input: ResolveTrustedPacketCardListProjectionInput;
    }
  | {
      operation: 'resolve_packet_graph_projection';
      input: ResolveTrustedPacketGraphProjectionInput;
    }
  | {
      operation: 'resolve_preferred_surface';
      input: ResolveTrustedPreferredSurfaceInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedProjectionReadinessInput;
    };

export type TrustedProjectionDescriptorSelection = {
  definition: PacketTypeDefinition;
  projection: PacketProjectionDescriptor | null;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};
