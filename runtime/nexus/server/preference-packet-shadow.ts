/**
 * File: preference-packet-shadow.ts
 * Description: Shadow-mode conversion and planning helpers between runtime scope-display preferences and experimental Preference packets.
 */

import {
  assertPacketDefinitionMutationActionPlanReady,
  auditPacketTypeDefinition,
  buildScopeDisplayPreferenceBody,
  createScopeDisplayPreferenceContextKey,
  createScopeDisplayPreferencePacketId,
  getExperimentalPacketTypeDefinition,
  normalizeScopeDisplayPreferenceValue,
  resolvePacketDefinitionMutationActionPlan,
  type PacketDefinitionMutationActionPlan,
  type ScopeDisplayPreferenceBody,
  type ScopeDisplayPreferenceContext,
} from '@core/packets/packet-definition-manifest';
import type { PacketRevisionRef } from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';

export type ScopeDisplayPreferenceShadowPlan = {
  packet_type: 'Preference';
  packet_subtype: 'scope_display';
  mutation_intent: 'preference.scope_display.set' | 'preference.scope_display.withdraw';
  packet_id: string;
  schema_version: string;
  storage_class: string;
  revision_behavior: string;
  live_fortress_ready: false;
  action_plan: PacketDefinitionMutationActionPlan;
  body: ScopeDisplayPreferenceBody;
  projected_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  notes: string[];
};

export function runtimeScopeDisplayPreferencesToPreferenceBody(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ScopeDisplayPreferenceBody {
  return buildScopeDisplayPreferenceBody({
    owner_ref: { packet_id: input.actorPacketId },
    context: input.context ?? undefined,
    privacy: 'private_sync',
    supersedes_ref: input.supersedes_ref ?? null,
    note: input.note ?? null,
    value: input.preferences,
  });
}

export function preferenceBodyToRuntimeScopeDisplayPreferences(
  body: ScopeDisplayPreferenceBody
): NexusScopeDisplayPreferencesPayload {
  return normalizeScopeDisplayPreferenceValue(body.value);
}

export function createScopeDisplayPreferenceShadowSetPlan(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ScopeDisplayPreferenceShadowPlan {
  const definition = getExperimentalPacketTypeDefinition('Preference');

  if (definition === null) {
    throw new Error('Experimental Preference packet definition is not registered.');
  }

  const actionPlan = resolvePacketDefinitionMutationActionPlan({
    definition,
    mutation_intent: 'preference.scope_display.set',
  });
  assertPacketDefinitionMutationActionPlanReady(actionPlan);

  const body = runtimeScopeDisplayPreferencesToPreferenceBody(input);
  const packetId = createScopeDisplayPreferencePacketId({
    owner_ref: { packet_id: input.actorPacketId },
    context: body.context,
  });

  return {
    packet_type: 'Preference',
    packet_subtype: 'scope_display',
    mutation_intent: 'preference.scope_display.set',
    packet_id: packetId,
    schema_version: definition.current_schema_version,
    storage_class: definition.storage_class,
    revision_behavior: definition.revision_behavior,
    live_fortress_ready: false,
    action_plan: actionPlan,
    body,
    projected_runtime_preferences: preferenceBodyToRuntimeScopeDisplayPreferences(body),
    notes: [
      'Shadow plan only: current runtime scope-display preferences remain canonical.',
      'This plan proves the manifest can resolve actions, builders, planners, policy action ids, and packet ids without touching the live fortress write path.',
    ],
  };
}

export type ScopeDisplayPreferenceShadowSeed = {
  seed_kind: 'preference.scope_display.shadow_seed';
  actor_packet_id: string;
  packet_id: string;
  context_key: string;
  source_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  body: ScopeDisplayPreferenceBody;
  projected_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  projection_equivalent: boolean;
  action_plan: PacketDefinitionMutationActionPlan;
  packet_definition_audit_status: 'pass' | 'warn' | 'fail';
  safe_to_seed_shadow: boolean;
  live_fortress_ready: false;
  notes: string[];
};

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function createScopeDisplayPreferenceShadowSeed(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ScopeDisplayPreferenceShadowSeed {
  const definition = getExperimentalPacketTypeDefinition('Preference');

  if (definition === null) {
    throw new Error('Experimental Preference packet definition is not registered.');
  }

  const plan = createScopeDisplayPreferenceShadowSetPlan(input);
  const normalizedSourcePreferences = normalizeScopeDisplayPreferenceValue(input.preferences);
  const projectedPreferences = preferenceBodyToRuntimeScopeDisplayPreferences(plan.body);
  const projectionEquivalent =
    stableJson(normalizedSourcePreferences) === stableJson(projectedPreferences);
  const auditReport = auditPacketTypeDefinition({
    definition,
    requireShadowRuntimeReady: true,
  });

  return {
    seed_kind: 'preference.scope_display.shadow_seed',
    actor_packet_id: input.actorPacketId,
    packet_id: plan.packet_id,
    context_key: createScopeDisplayPreferenceContextKey(plan.body.context),
    source_runtime_preferences: normalizedSourcePreferences,
    body: plan.body,
    projected_runtime_preferences: projectedPreferences,
    projection_equivalent: projectionEquivalent,
    action_plan: plan.action_plan,
    packet_definition_audit_status: auditReport.status,
    safe_to_seed_shadow:
      projectionEquivalent &&
      plan.action_plan.ready_for_shadow_runtime &&
      auditReport.finding_counts.error === 0,
    live_fortress_ready: false,
    notes: [
      'Shadow seed only: this object is not persisted by the live runtime preference store.',
      'Use this to compare runtime preference state against the future Preference.scope_display packet projection before enabling live writes.',
    ],
  };
}

export function createScopeDisplayPreferenceShadowSeedBatch(
  inputs: readonly Parameters<typeof createScopeDisplayPreferenceShadowSeed>[0][]
): ScopeDisplayPreferenceShadowSeed[] {
  return inputs.map((input) => createScopeDisplayPreferenceShadowSeed(input));
}
