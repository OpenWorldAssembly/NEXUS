/**
 * File: trusted_exchange_internal.ts
 * Description: Internal helpers for Trusted Exchange Coordinator normalization, local archive comparison, traces, and plans.
 */

import { parsePacketEnvelope, type PacketRef, type PacketRevisionRef } from '@core/schema/packet-schema';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type BaseTrustedExchangeInput,
  type TrustedExchangeAction,
  type TrustedExchangeBundleNormalization,
  type TrustedExchangeBundleShape,
  type TrustedExchangeLocalStatus,
  type TrustedExchangePacketEntry,
  type TrustedExchangePacketPreview,
} from './trusted_exchange_types.ts';

export function exchangeTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    step_id: input.step_id,
    status: input.status ?? 'ok',
    preset_ids: input.preset_ids ?? ['trusted.exchange.v0'],
    notes: input.notes,
  });
}

export function exchangeIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function toTrustedExchangeStatus(
  issues: readonly TrustedRuntimeCoordinatorIssue[]
): TrustedRuntimeCoordinatorStatus {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'error';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'partial';
  }

  return 'ok';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPacketEnvelopeShape(value: unknown): boolean {
  return isRecord(value) && isRecord(value.header) && isRecord(value.body);
}

function decodeBytesToText(input: Uint8Array | ArrayBuffer): string {
  return new TextDecoder().decode(input instanceof Uint8Array ? input : new Uint8Array(input));
}

function parseJsonText(input: string): { value: unknown | null; error: string | null } {
  try {
    return { value: JSON.parse(input) as unknown, error: null };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : 'JSON text could not be parsed.',
    };
  }
}

function decodeRecordBytes(input: Record<string, unknown>): Uint8Array | ArrayBuffer | null {
  const bytes = input.bytes;

  if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
    return bytes;
  }

  if (Array.isArray(bytes) && bytes.every((entry) => typeof entry === 'number')) {
    return Uint8Array.from(bytes);
  }

  return null;
}

function collectPacketCandidates(input: unknown, depth = 0): {
  sourceShape: TrustedExchangeBundleShape;
  packets: unknown[];
  warnings: string[];
  blockers: string[];
} {
  if (depth > 6) {
    return {
      sourceShape: 'unknown',
      packets: [],
      warnings: [],
      blockers: ['Exchange bundle nesting exceeded the supported depth.'],
    };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return {
        sourceShape: 'json_string',
        packets: [],
        warnings: [],
        blockers: ['Exchange input string is empty.'],
      };
    }

    const parsed = parseJsonText(trimmed);
    if (parsed.error) {
      return {
        sourceShape: 'json_string',
        packets: [],
        warnings: [],
        blockers: [`Exchange input string is not valid JSON: ${parsed.error}`],
      };
    }

    const nested = collectPacketCandidates(parsed.value, depth + 1);
    return {
      sourceShape: 'json_string',
      packets: nested.packets,
      warnings: nested.warnings,
      blockers: nested.blockers,
    };
  }

  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const decoded = decodeBytesToText(input);
    const parsed = parseJsonText(decoded);
    if (parsed.error) {
      return {
        sourceShape: 'archive_export_bytes',
        packets: [],
        warnings: [],
        blockers: [`Exchange byte bundle is not valid JSON: ${parsed.error}`],
      };
    }

    const nested = collectPacketCandidates(parsed.value, depth + 1);
    return {
      sourceShape: 'archive_export_bytes',
      packets: nested.packets,
      warnings: nested.warnings,
      blockers: nested.blockers,
    };
  }

  if (Array.isArray(input)) {
    return {
      sourceShape: 'packet_array',
      packets: input,
      warnings: [],
      blockers: [],
    };
  }

  if (hasPacketEnvelopeShape(input)) {
    return {
      sourceShape: 'packet_envelope',
      packets: [input],
      warnings: [],
      blockers: [],
    };
  }

  if (!isRecord(input)) {
    return {
      sourceShape: 'unknown',
      packets: [],
      warnings: [],
      blockers: ['Exchange input is not a supported bundle shape.'],
    };
  }

  const decodedBytes = decodeRecordBytes(input);
  if (decodedBytes) {
    const decoded = collectPacketCandidates(decodedBytes, depth + 1);
    return {
      sourceShape: 'archive_export_bytes',
      packets: decoded.packets,
      warnings: decoded.warnings,
      blockers: decoded.blockers,
    };
  }

  const nestedBundle = input.bundle;
  if (
    isRecord(nestedBundle) ||
    Array.isArray(nestedBundle) ||
    typeof nestedBundle === 'string' ||
    nestedBundle instanceof Uint8Array ||
    nestedBundle instanceof ArrayBuffer
  ) {
    const nested = collectPacketCandidates(nestedBundle, depth + 1);
    return {
      sourceShape: 'nested_bundle_object',
      packets: nested.packets,
      warnings: nested.warnings,
      blockers: nested.blockers,
    };
  }

  if (Array.isArray(input.packets)) {
    return {
      sourceShape: 'packets_object',
      packets: input.packets,
      warnings: [],
      blockers: [],
    };
  }

  if (Array.isArray(input.revisions)) {
    return {
      sourceShape: 'revisions_object',
      packets: input.revisions,
      warnings: [],
      blockers: [],
    };
  }

  if (Array.isArray(input.items)) {
    const packets = input.items.map((item) => {
      if (!isRecord(item)) {
        return item;
      }
      return item.packet ?? item.envelope ?? item.packet_envelope ?? item.revision ?? item;
    });

    return {
      sourceShape: 'packets_object',
      packets,
      warnings: [],
      blockers: [],
    };
  }

  return {
    sourceShape: 'unknown',
    packets: [],
    warnings: [],
    blockers: ['Exchange object did not include packets, revisions, items, bytes, or a nested bundle.'],
  };
}

function normalizedRevisionKey(revisionRef: PacketRevisionRef | null): string | null {
  return revisionRef ? `${revisionRef.packet_id}::${revisionRef.revision_id}` : null;
}

function packetSubtype(packet: unknown): string | null {
  if (!isRecord(packet) || !isRecord(packet.body)) {
    return null;
  }

  const subtype = packet.body.subtype;
  return typeof subtype === 'string' ? subtype : null;
}

export function normalizeTrustedExchangeBundle(input: unknown): TrustedExchangeBundleNormalization {
  const collected = collectPacketCandidates(input);
  const entries: TrustedExchangePacketEntry[] = collected.packets.map((packet, index) => {
    try {
      const parsedPacket = parsePacketEnvelope(packet);
      const revisionRef = {
        packet_id: parsedPacket.header.packet_id,
        revision_id: parsedPacket.header.revision_id,
      };
      return {
        entry_index: index,
        entry_id: `entry-${index}`,
        packet,
        packet_ref: { packet_id: parsedPacket.header.packet_id },
        revision_ref: revisionRef,
        packet_type: parsedPacket.header.type,
        declared_schema_version: parsedPacket.header.schema_version,
        packet_subtype: packetSubtype(parsedPacket),
        normalized_key: normalizedRevisionKey(revisionRef),
        parent_revision_refs: [...parsedPacket.header.parent_revision_refs],
        parsed_packet: parsedPacket,
        parse_error: null,
      };
    } catch (error) {
      return {
        entry_index: index,
        entry_id: `entry-${index}`,
        packet,
        packet_ref: null,
        revision_ref: null,
        packet_type: null,
        declared_schema_version: null,
        packet_subtype: packetSubtype(packet),
        normalized_key: null,
        parent_revision_refs: [],
        parsed_packet: null,
        parse_error: error instanceof Error ? error.message : 'Packet envelope could not be parsed.',
      };
    }
  });

  const blockers = [...collected.blockers];
  const warnings = [...collected.warnings];

  for (const entry of entries) {
    if (entry.parse_error) {
      warnings.push(`Entry ${entry.entry_index} could not be parsed: ${entry.parse_error}`);
    }
  }

  return {
    result_kind: 'trusted.exchange_bundle_normalization',
    source_shape: collected.sourceShape,
    packet_count: entries.length,
    entries,
    warnings,
    blockers,
  };
}

export function createTrustedExchangeArchiveBundle(entries: readonly TrustedExchangePacketEntry[]): string {
  return JSON.stringify({
    bundle_version: 1,
    packets: entries.map((entry) => entry.packet),
  });
}

export function keyTrustedExchangeEntries(
  entries: readonly TrustedExchangePacketEntry[]
): Map<string, TrustedExchangePacketEntry> {
  const keyedEntries = new Map<string, TrustedExchangePacketEntry>();

  for (const entry of entries) {
    if (entry.normalized_key && !keyedEntries.has(entry.normalized_key)) {
      keyedEntries.set(entry.normalized_key, entry);
    }
  }

  return keyedEntries;
}

export function hasExchangeArchiveContext(input: BaseTrustedExchangeInput): boolean {
  return Boolean(input.packet_store || input.database_path);
}

function parentRefsInclude(input: {
  parentRevisionRefs: readonly PacketRevisionRef[];
  revision: PacketRevisionRef;
}): boolean {
  return input.parentRevisionRefs.some((parentRef) =>
    parentRef.packet_id === input.revision.packet_id &&
    parentRef.revision_id === input.revision.revision_id
  );
}

export async function resolveTrustedExchangeLocalStatus(input: {
  entry: TrustedExchangePacketEntry;
  context: BaseTrustedExchangeInput;
}): Promise<{
  localStatus: TrustedExchangeLocalStatus;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  if (!input.entry.packet_ref || !input.entry.revision_ref) {
    return {
      localStatus: 'blocked_invalid',
      issues,
      trace,
    };
  }

  if (!hasExchangeArchiveContext(input.context)) {
    return {
      localStatus: 'not_checked',
      issues,
      trace,
    };
  }

  try {
    const exactRevision = await trustedArchiveCoordinator.resolveRevision({
      packet_store: input.context.packet_store,
      database_path: input.context.database_path,
      packet_ref: input.entry.packet_ref,
      revision_id: input.entry.revision_ref.revision_id,
      context_mode: input.context.context_mode ?? 'import_preview',
    });
    issues.push(...exactRevision.issues.filter((issue) => issue.code !== 'trusted_archive_revision_not_found'));
    trace.push(...exactRevision.trace);

    if (exactRevision.value?.resolved_revision) {
      return {
        localStatus: 'duplicate_revision',
        issues,
        trace,
      };
    }

    const preferred = await trustedArchiveCoordinator.resolveRevision({
      packet_store: input.context.packet_store,
      database_path: input.context.database_path,
      packet_ref: input.entry.packet_ref,
      context_mode: input.context.context_mode ?? 'import_preview',
    });
    issues.push(...preferred.issues.filter((issue) => issue.code !== 'trusted_archive_revision_not_found'));
    trace.push(...preferred.trace);

    if (!preferred.value?.resolved_revision) {
      return {
        localStatus: 'new_packet',
        issues,
        trace,
      };
    }

    if (
      input.entry.parent_revision_refs.length > 0 &&
      !parentRefsInclude({
        parentRevisionRefs: input.entry.parent_revision_refs,
        revision: preferred.value.resolved_revision,
      })
    ) {
      return {
        localStatus: 'manual_conflict',
        issues,
        trace,
      };
    }

    return {
      localStatus: 'new_revision',
      issues,
      trace,
    };
  } catch (error) {
    return {
      localStatus: 'unknown',
      issues: [
        exchangeIssue({
          severity: 'warning',
          code: 'trusted_exchange_local_compare_failed',
          path: `entries.${input.entry.entry_index}`,
          message: error instanceof Error
            ? error.message
            : 'Exchange could not compare incoming packet material against the local archive.',
        }),
      ],
      trace,
    };
  }
}

export function chooseTrustedExchangeAction(input: {
  readable: boolean;
  verified: boolean;
  localStatus: TrustedExchangeLocalStatus;
  compatibilityNeedsAck: boolean;
  verificationNeedsAck: boolean;
}): TrustedExchangeAction {
  if (!input.readable) {
    return 'block_unsupported';
  }

  if (input.localStatus === 'blocked_invalid') {
    return 'block_invalid';
  }

  if (input.localStatus === 'duplicate_revision') {
    return 'skip_duplicate';
  }

  if (input.localStatus === 'manual_conflict') {
    return 'manual_conflict';
  }

  if (input.compatibilityNeedsAck) {
    return 'needs_compatibility_acknowledgement';
  }

  if (!input.verified || input.verificationNeedsAck) {
    return 'needs_verification_acknowledgement';
  }

  if (input.localStatus === 'new_packet') {
    return 'accept_new_packet';
  }

  if (input.localStatus === 'new_revision') {
    return 'accept_new_revision';
  }

  return 'import_revision';
}

export function previewActionToCommitAction(action: TrustedExchangeAction): TrustedExchangeAction {
  if (action === 'accept_new_packet' || action === 'accept_new_revision') {
    return 'import_revision';
  }

  if (action === 'manual_conflict') {
    return 'needs_manual_resolution';
  }

  return action;
}

export function acknowledgementForAction(action: TrustedExchangeAction): string | null {
  if (action === 'needs_compatibility_acknowledgement' || action === 'needs_verification_acknowledgement') {
    return action;
  }

  return null;
}

export function actionReason(action: TrustedExchangeAction): string {
  switch (action) {
    case 'import_revision':
      return 'Incoming revision is accepted for Archive import by the Exchange plan.';
    case 'accept_new_packet':
      return 'Incoming packet is not present in the checked archive.';
    case 'accept_new_revision':
      return 'Incoming packet exists locally, but this revision is new.';
    case 'skip_duplicate':
      return 'Incoming revision already exists locally.';
    case 'block_conflict':
    case 'manual_conflict':
    case 'needs_manual_resolution':
      return 'Incoming revision requires manual conflict review.';
    case 'needs_compatibility_acknowledgement':
      return 'Incoming packet has compatibility warnings or possible loss that require acknowledgement.';
    case 'needs_verification_acknowledgement':
      return 'Incoming packet has advisory verification warnings that require acknowledgement.';
    case 'block_invalid':
      return 'Incoming packet material is invalid.';
    case 'block_unsupported':
      return 'Incoming packet schema is unsupported by this runtime.';
    default:
      return 'Exchange action selected by trusted preview.';
  }
}

export function packetPreviewHasBlocker(preview: TrustedExchangePacketPreview): boolean {
  return preview.recommended_action === 'block_invalid' ||
    preview.recommended_action === 'block_unsupported' ||
    preview.recommended_action === 'block_conflict' ||
    preview.blockers.length > 0;
}

export function packetPreviewHasConflict(preview: TrustedExchangePacketPreview): boolean {
  return preview.local_status === 'manual_conflict' ||
    preview.recommended_action === 'manual_conflict' ||
    preview.recommended_action === 'needs_manual_resolution';
}

export function createRootRefsFromEntries(entries: readonly TrustedExchangePacketEntry[]): PacketRef[] {
  const refs: PacketRef[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!entry.packet_ref || seen.has(entry.packet_ref.packet_id)) {
      continue;
    }
    refs.push(entry.packet_ref);
    seen.add(entry.packet_ref.packet_id);
  }

  return refs;
}
