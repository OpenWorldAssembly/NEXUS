/**
 * File: preference-packet-definition.ts
 * Description: Conversion and definition-planning helpers between runtime scope-display preferences and Preference.element packets.
 */

import {
  assertPacketDefinitionMutationActionPlanReady,
  auditPacketTypeDefinition,
  buildElementPreferenceBody,
  createElementPreferenceContextKey,
  createElementPreferencePacketId,
  normalizeScopeDisplayPreferenceValue,
  resolvePacketDefinitionMutationActionPlan,
  type PacketDefinitionMutationActionPlan,
  type ElementPreferenceBody,
  type ScopeDisplayPreferenceContext,
} from '@core/packets/packet-definition-manifest';
import {
  trustedDefinitionCoordinator,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator';
import type { PacketRevisionRef } from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';

export type ElementPreferenceDefinitionPlan = {
  packet_type: 'Preference';
  packet_subtype: 'element';
  mutation_intent: 'preference.element.set' | 'preference.element.withdraw';
  packet_id: string;
  schema_version: string;
  storage_class: string;
  revision_behavior: string;
  external_definition_execution_enabled: false;
  action_plan: PacketDefinitionMutationActionPlan;
  body: ElementPreferenceBody;
  projected_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  notes: string[];
};

export function runtimeScopeDisplayPreferencesToPreferenceBody(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ElementPreferenceBody {
  return buildElementPreferenceBody({
    owner_ref: { packet_id: input.actorPacketId },
    context: input.context ?? undefined,
    privacy: 'private_sync',
    supersedes_ref: input.supersedes_ref ?? null,
    note: input.note ?? null,
    value: input.preferences,
  });
}

export function preferenceBodyToRuntimeScopeDisplayPreferences(
  body: ElementPreferenceBody
): NexusScopeDisplayPreferencesPayload {
  return normalizeScopeDisplayPreferenceValue(body.value.interface.scope_display);
}

export function createElementPreferenceDefinitionSetPlan(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ElementPreferenceDefinitionPlan {
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: 'Preference',
  });
  const definition = definitionResult.value;

  if (definition === null) {
    throw new Error('Trusted Preference packet definition is not registered.');
  }

  const actionPlan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: 'preference.element.set',
  });
  assertPacketDefinitionMutationActionPlanReady(actionPlan);

  const body = runtimeScopeDisplayPreferencesToPreferenceBody(input);
  const packetId = createElementPreferencePacketId({
    owner_ref: { packet_id: input.actorPacketId },
    context: body.context,
  });

  return {
    packet_type: 'Preference',
    packet_subtype: 'element',
    mutation_intent: 'preference.element.set',
    packet_id: packetId,
    schema_version: definition.current_schema_version,
    storage_class: definition.storage_class,
    revision_behavior: definition.revision_behavior,
    external_definition_execution_enabled: false,
    action_plan: actionPlan,
    body,
    projected_runtime_preferences: preferenceBodyToRuntimeScopeDisplayPreferences(body),
    notes: [
      'Definition plan only: Preference.element is envelope-capable and claimed writes are fortress-enrolled, but this manifest-derived plan does not create tickets or persist packets.',
      'This plan proves the manifest can resolve actions, builders, planners, policy action ids, and packet ids without executing imported definition behavior.',
    ],
  };
}

export type ElementPreferenceDefinitionSeed = {
  seed_kind: 'preference.element.definition_seed';
  actor_packet_id: string;
  packet_id: string;
  context_key: string;
  source_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  body: ElementPreferenceBody;
  projected_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  projection_equivalent: boolean;
  action_plan: PacketDefinitionMutationActionPlan;
  packet_definition_audit_status: 'pass' | 'warn' | 'fail';
  safe_to_seed_definition: boolean;
  external_definition_execution_enabled: false;
  notes: string[];
};

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function createElementPreferenceDefinitionSeed(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ElementPreferenceDefinitionSeed {
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: 'Preference',
  });
  const definition = definitionResult.value;

  if (definition === null) {
    throw new Error('Trusted Preference packet definition is not registered.');
  }

  const plan = createElementPreferenceDefinitionSetPlan(input);
  const normalizedSourcePreferences = normalizeScopeDisplayPreferenceValue(input.preferences);
  const projectedPreferences = preferenceBodyToRuntimeScopeDisplayPreferences(plan.body);
  const projectionEquivalent =
    stableJson(normalizedSourcePreferences) === stableJson(projectedPreferences);
  const auditReport = auditPacketTypeDefinition({
    definition,
    requireDefinitionRuntimeReady: true,
  });

  return {
    seed_kind: 'preference.element.definition_seed',
    actor_packet_id: input.actorPacketId,
    packet_id: plan.packet_id,
    context_key: createElementPreferenceContextKey(plan.body.context),
    source_runtime_preferences: normalizedSourcePreferences,
    body: plan.body,
    projected_runtime_preferences: projectedPreferences,
    projection_equivalent: projectionEquivalent,
    action_plan: plan.action_plan,
    packet_definition_audit_status: auditReport.status,
    safe_to_seed_definition:
      projectionEquivalent &&
      plan.action_plan.ready_for_runtime &&
      auditReport.finding_counts.error === 0,
    external_definition_execution_enabled: false,
    notes: [
      'Definition seed only: this object is not written by the manifest bridge; live claimed writes use the fortress-enrolled Preference.element workflow.',
      'Use this to compare runtime preference state against the Preference.element packet projection while manifest-driven execution remains trusted-local.',
    ],
  };
}

export function createElementPreferenceDefinitionSeedBatch(
  inputs: readonly Parameters<typeof createElementPreferenceDefinitionSeed>[0][]
): ElementPreferenceDefinitionSeed[] {
  return inputs.map((input) => createElementPreferenceDefinitionSeed(input));
}
