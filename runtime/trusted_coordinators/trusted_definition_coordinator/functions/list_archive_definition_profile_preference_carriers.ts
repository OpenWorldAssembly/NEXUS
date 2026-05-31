/**
 * File: list_archive_definition_profile_preference_carriers.ts
 * Description: Discovers packet-backed definition profile preference carriers through Trusted Archive reads.
 */

import { parsePacketEnvelope, type PacketEnvelope } from '@core/schema/packet-schema';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { definitionTrace } from '../trusted_definition_internal.ts';
import type {
  ResolveTrustedDefinitionContextFromArchiveInput,
  TrustedDefinitionProfilePreferencePacket,
} from '../trusted_definition_types.ts';

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.max(1, Math.min(250, Math.trunc(value ?? 100)));
}

function toPacketEnvelope(value: unknown): PacketEnvelope | null {
  try {
    return parsePacketEnvelope(value);
  } catch {
    return null;
  }
}

function carriesDefinitionProfilePreferences(packet: PacketEnvelope): boolean {
  if (packet.header.type !== 'Bundle') {
    return false;
  }

  const body = packet.body as { bundle_data?: Record<string, unknown> } | null;
  const bundleData = body && typeof body === 'object' ? body.bundle_data : null;

  return Boolean(
    bundleData &&
      typeof bundleData === 'object' &&
      (
        Array.isArray(bundleData.definition_profile_preferences) ||
        Array.isArray(bundleData.trusted_definition_runtime_preferences)
      )
  );
}

export async function listArchiveDefinitionProfilePreferenceCarriers(
  input: ResolveTrustedDefinitionContextFromArchiveInput = {}
): Promise<{
  preference_packets: TrustedDefinitionProfilePreferencePacket[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const limit = clampLimit(input.archive_profile_preference_limit);
  const queryResult = await trustedArchiveCoordinator.queryPackets({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_type: 'Bundle',
    text: input.archive_profile_preference_text ?? null,
    limit,
    context_mode: input.context_mode,
  });

  issues.push(...queryResult.issues);
  trace.push(...queryResult.trace);

  const cards = queryResult.value?.packets ?? [];
  const preferencePackets: TrustedDefinitionProfilePreferencePacket[] = [];

  for (const card of cards) {
    const readResult = await trustedArchiveCoordinator.readPacket({
      packet_store: input.packet_store,
      database_path: input.database_path,
      packet_ref: card.packet,
      revision_ref: card.revision,
      mode: 'adapted',
      context_mode: input.context_mode,
    });

    issues.push(...readResult.issues);
    trace.push(...readResult.trace);

    const packet = toPacketEnvelope(readResult.value?.packet ?? null);

    if (!packet) {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'definition.profile_preference_invalid',
          path: `${card.packet.packet_id}:${card.revision.revision_id}`,
          message:
            'Trusted Definition discovered an archived Bundle profile carrier row, but Trusted Archive could not read it as a PacketEnvelope.',
        })
      );
      continue;
    }

    if (!carriesDefinitionProfilePreferences(packet)) {
      continue;
    }

    preferencePackets.push(packet);
  }

  trace.push(
    definitionTrace({
      step_id: 'definition.profile_preferences.archive_discovery',
      status: issues.some((issue) => issue.severity === 'error')
        ? 'error'
        : issues.some((issue) => issue.severity === 'warning')
          ? 'partial'
          : 'ok',
      notes: `Discovered ${preferencePackets.length} archived Bundle.packet_set definition profile preference carrier(s) through Trusted Archive.`,
    })
  );

  return {
    preference_packets: preferencePackets,
    issues,
    trace,
  };
}
