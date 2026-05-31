/**
 * File: list_node_preference_definition_preferences.ts
 * Description: Reads Preference.node definition profile settings through Trusted Archive and converts them into Trusted Definition runtime preferences.
 */

import {
  createNodePreferencePacketId,
  projectLatestActiveNodePreference,
  type NodePreferenceBody,
} from '@core/packets/definitions/preference-helpers.ts';
import { createPacketRef } from '@core/packets/builders.ts';
import { parsePacketEnvelope } from '@core/schema/packet-schema';
import { SEEDED_DEFINITION_PROFILE_ID } from '@core/packets/packet-definition-seeds.ts';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { definitionTrace } from '../trusted_definition_internal.ts';
import type {
  ResolveTrustedDefinitionContextFromArchiveInput,
  TrustedDefinitionRuntimePreference,
} from '../trusted_definition_types.ts';

function hasArchiveReadSurface(input: ResolveTrustedDefinitionContextFromArchiveInput): boolean {
  if (input.database_path) {
    return true;
  }

  const store = input.packet_store as Record<string, unknown> | null | undefined;
  return typeof store?.fetchPreferredRevision === 'function';
}

function toRuntimePreferences(input: {
  body: NodePreferenceBody;
  nodeElementId: string;
}): TrustedDefinitionRuntimePreference[] {
  const definitions = input.body.value.definitions;
  const preferences: TrustedDefinitionRuntimePreference[] = [];

  if (definitions.active_definition_profile_ref) {
    preferences.push({
      preference_id: `preference.node.${input.nodeElementId}.active_definition_profile`,
      node_element_id: input.nodeElementId,
      source_id: definitions.active_definition_profile_ref.packet_id,
      trust_mode: 'pin',
      priority: 1000,
      notes:
        'Derived from Preference.node value.definitions.active_definition_profile_ref.',
    });
  }

  for (const [index, profileRef] of definitions.trusted_definition_profile_refs.entries()) {
    preferences.push({
      preference_id: `preference.node.${input.nodeElementId}.trusted_definition_profile.${index}`,
      node_element_id: input.nodeElementId,
      source_id: profileRef.packet_id,
      trust_mode: 'allow',
      priority: 100,
      notes:
        'Derived from Preference.node value.definitions.trusted_definition_profile_refs.',
    });
  }

  if (definitions.allow_seeded_definition_fallback === false) {
    preferences.push({
      preference_id: `preference.node.${input.nodeElementId}.disable_seeded_definition_fallback`,
      node_element_id: input.nodeElementId,
      source_id: SEEDED_DEFINITION_PROFILE_ID,
      trust_mode: 'ignore',
      priority: 2000,
      notes:
        'Derived from Preference.node value.definitions.allow_seeded_definition_fallback=false.',
    });
  }

  return preferences;
}

export async function listNodePreferenceDefinitionPreferences(
  input: ResolveTrustedDefinitionContextFromArchiveInput = {}
): Promise<{
  preferences: TrustedDefinitionRuntimePreference[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const nodeElementId = input.node_element_id ?? null;

  if (!nodeElementId) {
    trace.push(
      definitionTrace({
        step_id: 'definition.preferences.node_profile.skipped',
        status: 'ok',
        notes:
          'No node_element_id was supplied, so Preference.node definition-profile preferences were not loaded.',
      })
    );

    return { preferences: [], issues, trace };
  }

  if (!hasArchiveReadSurface(input)) {
    trace.push(
      definitionTrace({
        step_id: 'definition.preferences.node_profile.skipped',
        status: 'ok',
        notes:
          'Preference.node definition-profile preferences were not loaded because no Trusted Archive read surface was supplied.',
      })
    );

    return { preferences: [], issues, trace };
  }

  const packetId = createNodePreferencePacketId({
    owner_ref: createPacketRef(nodeElementId),
  });
  const readResult = await trustedArchiveCoordinator.readPacket({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_ref: createPacketRef(packetId),
    revision_ref: null,
    mode: 'adapted',
    context_mode: input.context_mode,
  });

  trace.push(...readResult.trace);

  if (!readResult.value?.packet) {
    trace.push(
      definitionTrace({
        step_id: 'definition.preferences.node_profile.missing',
        status: issues.some((issue) => issue.severity === 'error') ? 'error' : 'ok',
        notes: `No active Preference.node packet was found for ${nodeElementId}.`,
      })
    );

    return { preferences: [], issues, trace };
  }

  issues.push(...readResult.issues);

  let body: NodePreferenceBody | null = null;
  try {
    const packet = parsePacketEnvelope(readResult.value.packet);
    if (packet.header.type !== 'Preference' || packet.body.subtype !== 'node') {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'definition.profile_preference_invalid',
          path: packetId,
          message:
            'Trusted Definition found the expected Preference.node packet id, but the archived packet was not a Preference.node revision.',
        })
      );
    } else {
      body = packet.body as NodePreferenceBody;
    }
  } catch {
    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'definition.profile_preference_invalid',
        path: packetId,
        message:
          'Trusted Definition found a Preference.node candidate, but Trusted Archive could not read it as a PacketEnvelope.',
      })
    );
  }

  const latest = body
    ? projectLatestActiveNodePreference({
        owner_ref: createPacketRef(nodeElementId),
        context: null,
        records: [body],
      })
    : null;
  const preferences = latest
    ? toRuntimePreferences({ body: latest, nodeElementId })
    : [];

  trace.push(
    definitionTrace({
      step_id: 'definition.preferences.node_profile.loaded',
      status: issues.some((issue) => issue.severity === 'error')
        ? 'error'
        : issues.some((issue) => issue.severity === 'warning')
          ? 'partial'
          : 'ok',
      notes: `Loaded ${preferences.length} Trusted Definition runtime preference(s) from Preference.node ${packetId}.`,
    })
  );

  return { preferences, issues, trace };
}
