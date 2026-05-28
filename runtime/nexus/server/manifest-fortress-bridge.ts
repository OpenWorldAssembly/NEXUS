/**
 * File: manifest-fortress-bridge.ts
 * Description: Definition-mode bridge that translates packet-definition manifest actions into fortress-shaped prepare metadata without live writes.
 */

import { createHash } from 'node:crypto';

import {
  resolvePacketDefinitionMutationActionPlan,
  type PacketDefinitionMutationActionPlan,
  type PacketDefinitionRuntimeCapabilities,
  type ElementPreferenceBody,
  type ScopeDisplayPreferenceContext,
} from '@core/packets/packet-definition-manifest';
import {
  trustedDefinitionCoordinator,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type { PacketRevisionRef } from '@core/schema/packet-schema';
import {
  createElementPreferenceDefinitionSetPlan,
  type ElementPreferenceDefinitionPlan,
} from '@runtime/nexus/server/preference-packet-definition';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';

export type ManifestDefinitionFortressActionPlan = {
  bridge_kind: 'manifest.fortress.action_plan';
  packet_type: string;
  packet_subtype: string;
  mutation_intent: string;
  definition_found: boolean;
  subtype_supported: boolean;
  supported: boolean;
  external_definition_execution_enabled: false;
  action_plan: PacketDefinitionMutationActionPlan | null;
  planner_id: string | null;
  builder_ids: string[];
  action_ids: string[];
  policy_action_ids: string[];
  reason_codes: string[];
  notes: string[];
};

export type ManifestDefinitionFortressPreparedCandidate<TBody = unknown> = {
  candidate_kind: 'manifest.definition_packet_candidate';
  packet_type: string;
  packet_subtype: string;
  packet_id: string;
  schema_version: string;
  storage_class: string;
  revision_behavior: string;
  body: TBody;
  unsigned_digest: string;
  current_packet_envelope_supported: boolean;
  live_signed_corridor_enrolled: false;
  notes: string[];
};

export type ManifestDefinitionFortressPrepareShape = {
  kind: string;
  action_ids: string[];
  policy_action_ids: string[];
  prepared_packet_count: number;
  source_policy_packet_ids: string[];
  governing_scope_packet_id: string | null;
  live_ticket_ready: false;
  notes: string[];
};

export type PreferenceElementManifestDefinitionFortressPlan = {
  bridge_kind: 'preference.element.fortress_prepare';
  packet_type: 'Preference';
  packet_subtype: 'element';
  mutation_intent: 'preference.element.set';
  ready_for_definition_prepare: boolean;
  external_definition_execution_enabled: false;
  action_plan: ManifestDefinitionFortressActionPlan;
  preference_definition_plan: ElementPreferenceDefinitionPlan;
  packet_candidate: ManifestDefinitionFortressPreparedCandidate<ElementPreferenceBody>;
  prepare_shape: ManifestDefinitionFortressPrepareShape;
  projected_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  notes: string[];
};

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function createDefinitionUnsignedDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export function resolveManifestDefinitionFortressActionPlan(input: {
  packet_type: string;
  packet_subtype: string;
  mutation_intent: string;
  capabilities?: PacketDefinitionRuntimeCapabilities;
}): ManifestDefinitionFortressActionPlan {
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: input.packet_type,
  });
  const definition = definitionResult.value;

  if (definition === null) {
    return {
      bridge_kind: 'manifest.fortress.action_plan',
      packet_type: input.packet_type,
      packet_subtype: input.packet_subtype,
      mutation_intent: input.mutation_intent,
      definition_found: false,
      subtype_supported: false,
      supported: false,
      external_definition_execution_enabled: false,
      action_plan: null,
      planner_id: null,
      builder_ids: [],
      action_ids: [],
      policy_action_ids: [],
      reason_codes: ['unknown_packet_type'],
      notes: [
        'No trusted packet definition resolved for this packet type.',
        'The external definition execution mutation corridor is untouched by definition manifest resolution.',
      ],
    };
  }

  const subtypeSupported = definition.declared_subtypes.includes(input.packet_subtype);
  const actionPlan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: input.mutation_intent,
    capabilities: input.capabilities,
  });
  const reasonCodes = [
    subtypeSupported ? null : 'unknown_packet_subtype',
    ...actionPlan.missing_descriptor_ids.map((id) => `missing_descriptor:${id}`),
    ...actionPlan.unsupported_capabilities.map((capability) => `unsupported:${capability}`),
  ].filter((code): code is string => code !== null);

  return {
    bridge_kind: 'manifest.fortress.action_plan',
    packet_type: definition.packet_type,
    packet_subtype: input.packet_subtype,
    mutation_intent: input.mutation_intent,
    definition_found: true,
    subtype_supported: subtypeSupported,
    supported: subtypeSupported && actionPlan.ready_for_runtime,
    external_definition_execution_enabled: false,
    action_plan: actionPlan,
    planner_id: actionPlan.planner?.planner_id ?? null,
    builder_ids: actionPlan.builders.map((builder) => builder.builder_id),
    action_ids: actionPlan.actions.map((action) => action.action_id),
    policy_action_ids: actionPlan.policy_action_ids,
    reason_codes: uniqueSorted(reasonCodes),
    notes: [
      'Definition action plan only: descriptors are resolved against local capability allowlists, not executed from packet manifests.',
      'A supported definition plan means the manifest can feed fortress-shaped prepare metadata; it does not enroll the mutation in live routes.',
    ],
  };
}

export function createPreferenceElementManifestDefinitionFortressPlan(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
  capabilities?: PacketDefinitionRuntimeCapabilities;
}): PreferenceElementManifestDefinitionFortressPlan {
  const actionPlan = resolveManifestDefinitionFortressActionPlan({
    packet_type: 'Preference',
    packet_subtype: 'element',
    mutation_intent: 'preference.element.set',
    capabilities: input.capabilities,
  });
  const preferenceDefinitionPlan = createElementPreferenceDefinitionSetPlan({
    actorPacketId: input.actorPacketId,
    preferences: input.preferences,
    context: input.context,
    supersedes_ref: input.supersedes_ref,
    note: input.note,
  });
  const candidateCore = {
    packet_type: 'Preference',
    packet_subtype: 'element',
    packet_id: preferenceDefinitionPlan.packet_id,
    schema_version: preferenceDefinitionPlan.schema_version,
    body: preferenceDefinitionPlan.body,
  };

  const packetCandidate: ManifestDefinitionFortressPreparedCandidate<ElementPreferenceBody> = {
    candidate_kind: 'manifest.definition_packet_candidate',
    packet_type: 'Preference',
    packet_subtype: 'element',
    packet_id: preferenceDefinitionPlan.packet_id,
    schema_version: preferenceDefinitionPlan.schema_version,
    storage_class: preferenceDefinitionPlan.storage_class,
    revision_behavior: preferenceDefinitionPlan.revision_behavior,
    body: preferenceDefinitionPlan.body,
    unsigned_digest: createDefinitionUnsignedDigest(candidateCore),
    current_packet_envelope_supported: true,
    live_signed_corridor_enrolled: false,
    notes: [
      'Preference.element is live PacketEnvelope-capable and has a fortress-enrolled shell write path; this manifest-derived candidate remains definition comparison metadata.',
      'The digest is deterministic definition metadata for equivalence checks and future corridor comparison only.',
    ],
  };

  return {
    bridge_kind: 'preference.element.fortress_prepare',
    packet_type: 'Preference',
    packet_subtype: 'element',
    mutation_intent: 'preference.element.set',
    ready_for_definition_prepare: actionPlan.supported,
    external_definition_execution_enabled: false,
    action_plan: actionPlan,
    preference_definition_plan: preferenceDefinitionPlan,
    packet_candidate: packetCandidate,
    prepare_shape: {
      kind: 'preference.element.set',
      action_ids: actionPlan.action_ids,
      policy_action_ids: actionPlan.policy_action_ids,
      prepared_packet_count: 1,
      source_policy_packet_ids: [],
      governing_scope_packet_id: null,
      live_ticket_ready: false,
      notes: [
        'This mirrors the data shape the fortress prepare corridor uses, but this definition bridge intentionally does not create a ticket.',
        'Policy action IDs resolve to the live Preference.element write-policy action while remaining descriptor-derived metadata here.',
      ],
    },
    projected_runtime_preferences: preferenceDefinitionPlan.projected_runtime_preferences,
    notes: [
      'Definition fortress bridge: proves manifest descriptors can resolve body, candidate identity, builder/planner metadata, and policy action IDs before live wiring.',
      'Authenticated Preference.element shell writes are now fortress-enrolled; this manifest bridge remains runtime-ready and does not execute imported definition behavior.',
    ],
  };
}
