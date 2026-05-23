/**
 * File: compatibility/types.ts
 * Description: Shared compatibility contracts and error types for packet schema adaptation.
 */

import type {
  PacketAdaptationChangeKind,
  PacketAdaptationDirection,
  PacketAdaptationLossKind,
  PacketCompatibilitySupportLevel,
  PacketType,
  PacketRevisionMode,
  PacketWriteTargetPolicy,
  PacketWriteTargetSupport,
} from '@core/schema/packet-ontology';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-body-schemas';

export type { PacketAdaptationDirection } from '@core/schema/packet-ontology';

export interface PacketAdaptationChange {
  kind: PacketAdaptationChangeKind;
  path: string;
  from_schema_version: string;
  to_schema_version: string;
  message: string;
}

export interface PacketAdaptationLoss {
  kind: PacketAdaptationLossKind;
  path: string;
  from_schema_version: string;
  to_schema_version: string;
  message: string;
}

export interface PacketCompatibilityStatus {
  type: PacketType;
  declared_schema_version: string;
  effective_source_schema_version: string;
  interpreted_as_legacy_profile: boolean;
  source_schema_version: string;
  target_schema_version: string;
  direction: PacketAdaptationDirection;
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  is_lossy: boolean;
  is_exact: boolean;
  writable_as_is: boolean;
  requires_guarded_upgrade: boolean;
  requires_loss_acknowledgement: boolean;
  supported_write_target: PacketWriteTargetSupport;
}

export interface PacketCompatibilityReadResult {
  raw_packet: unknown;
  adapted_packet: PacketEnvelope;
  status: PacketCompatibilityStatus;
}

export interface PacketVersionedWritePreparation {
  raw_packet: unknown;
  adapted_packet: PacketEnvelope;
  prepared_packet: PacketEnvelope | null;
  declared_schema_version: string;
  effective_source_schema_version: string;
  interpreted_as_legacy_profile: boolean;
  source_schema_version: string;
  target_schema_version: string;
  direction: PacketAdaptationDirection;
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  is_lossy: boolean;
  is_exact: boolean;
  writable_as_is: boolean;
  requires_guarded_upgrade: boolean;
  requires_loss_acknowledgement: boolean;
  supported_write_target: PacketWriteTargetSupport;
}

export type PacketAdaptedWritePreparation = PacketVersionedWritePreparation;

export interface PacketCompatibilityAuditSummary {
  type: PacketType;
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  support_level: PacketCompatibilitySupportLevel;
  write_target_policy: PacketWriteTargetPolicy;
  supported_schema_versions: string[];
  has_legacy_versions: boolean;
  has_write_preparation: boolean;
}

export type PacketSignatureCandidateSource =
  | 'exact'
  | 'header_compatibility'
  | 'type_compatibility'
  | 'combined_compatibility';

export interface PacketSignatureCanonicalCandidate<TPacket> {
  packet: TPacket;
  source: PacketSignatureCandidateSource;
}

export type PacketCompatibilityAdapterOutput = {
  body: unknown;
  changes: PacketAdaptationChange[];
  losses?: PacketAdaptationLoss[];
};

export type PacketSchemaVersionDefinition<TType extends PacketType> = {
  parseBody: (body: unknown) => unknown;
  next_schema_version?: string;
  adaptToNext?: (body: unknown) => PacketCompatibilityAdapterOutput;
  previous_schema_version?: string;
  adaptToPrevious?: (body: unknown) => PacketCompatibilityAdapterOutput;
  matchesDeclaredCurrentBodyShape?: (body: unknown) => boolean;
  createUnsignedPacketCandidate?: (
    packet: PacketEnvelopeByType[TType]
  ) => PacketEnvelopeByType[TType] | null;
};

export type PacketCompatibilityEntry<TType extends PacketType> = {
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  support_level: PacketCompatibilitySupportLevel;
  write_target_policy: PacketWriteTargetPolicy;
  versions: Record<string, PacketSchemaVersionDefinition<TType>>;
};

export class PacketCompatibilityError extends Error {
  readonly type: PacketType;
  readonly source_schema_version: string;
  readonly target_schema_version: string;
  readonly code:
    | 'unsupported_schema_version'
    | 'missing_adapter_path'
    | 'blocked_write_target';

  constructor(input: {
    code: PacketCompatibilityError['code'];
    type: PacketType;
    sourceSchemaVersion: string;
    targetSchemaVersion: string;
    message: string;
  }) {
    super(input.message);
    this.name = 'PacketCompatibilityError';
    this.type = input.type;
    this.source_schema_version = input.sourceSchemaVersion;
    this.target_schema_version = input.targetSchemaVersion;
    this.code = input.code;
  }
}
