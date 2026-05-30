/**
 * File: preference-packet-shadow.ts
 * Description: Conversion and shadow-planning helpers between runtime scope-display preferences and Preference.element packets.
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
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type { PacketRevisionRef } from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';

export type ShadowPacketDefinitionMutationActionPlan = PacketDefinitionMutationActionPlan & {
  ready_for_shadow_runtime: boolean;
};

export type ElementPreferenceShadowPlan = {
  packet_type: 'Preference';
  packet_subtype: 'element';
  mutation_intent: 'preference.element.set' | 'preference.element.withdraw';
  packet_id: string;
  schema_version: string;
  storage_class: string;
  revision_behavior: string;
  live_dispatch_ready: false;
  action_plan: ShadowPacketDefinitionMutationActionPlan;
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

export function createElementPreferenceShadowSetPlan(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ElementPreferenceShadowPlan {
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: 'Preference',
  });
  const definition = definitionResult.value;

  if (definition === null) {
    throw new Error('Trusted Preference packet definition is not registered for shadow compatibility planning.');
  }

  const actionPlan = {
    ...resolvePacketDefinitionMutationActionPlan({
      definition,
      mutation_intent: 'preference.element.set',
    }),
    ready_for_shadow_runtime: false,
  };
  actionPlan.ready_for_shadow_runtime = actionPlan.ready_for_runtime;
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
    live_dispatch_ready: false,
    action_plan: actionPlan,
    body,
    projected_runtime_preferences: preferenceBodyToRuntimeScopeDisplayPreferences(body),
    notes: [
      'Shadow plan only: Preference.element is envelope-capable and claimed writes have trusted-write coverage, but this manifest-derived plan does not create tickets or persist packets.',
      'This plan proves the manifest can resolve actions, builders, planners, policy action ids, and packet ids without executing imported definition behavior.',
    ],
  };
}

export type ElementPreferenceShadowSeed = {
  seed_kind: 'preference.element.shadow_seed';
  actor_packet_id: string;
  packet_id: string;
  context_key: string;
  source_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  body: ElementPreferenceBody;
  projected_runtime_preferences: NexusScopeDisplayPreferencesPayload;
  projection_equivalent: boolean;
  action_plan: ShadowPacketDefinitionMutationActionPlan;
  packet_definition_audit_status: 'pass' | 'warn' | 'fail';
  safe_to_seed_shadow: boolean;
  live_dispatch_ready: false;
  notes: string[];
};

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function createElementPreferenceShadowSeed(input: {
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  supersedes_ref?: PacketRevisionRef | null;
  note?: string | null;
}): ElementPreferenceShadowSeed {
  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: 'Preference',
  });
  const definition = definitionResult.value;

  if (definition === null) {
    throw new Error('Trusted Preference packet definition is not registered for shadow compatibility planning.');
  }

  const plan = createElementPreferenceShadowSetPlan(input);
  const normalizedSourcePreferences = normalizeScopeDisplayPreferenceValue(input.preferences);
  const projectedPreferences = preferenceBodyToRuntimeScopeDisplayPreferences(plan.body);
  const projectionEquivalent =
    stableJson(normalizedSourcePreferences) === stableJson(projectedPreferences);
  const auditReport = auditPacketTypeDefinition({
    definition,
    requireDefinitionRuntimeReady: true,
  });

  return {
    seed_kind: 'preference.element.shadow_seed',
    actor_packet_id: input.actorPacketId,
    packet_id: plan.packet_id,
    context_key: createElementPreferenceContextKey(plan.body.context),
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
    live_dispatch_ready: false,
    notes: [
      'Shadow seed only: this object is not written by the manifest bridge; live claimed writes use the trusted Preference.element write workflow.',
      'Use this to compare runtime preference state against the Preference.element packet projection while manifest-driven execution remains trusted-local.',
    ],
  };
}

export function createElementPreferenceShadowSeedBatch(
  inputs: readonly Parameters<typeof createElementPreferenceShadowSeed>[0][]
): ElementPreferenceShadowSeed[] {
  return inputs.map((input) => createElementPreferenceShadowSeed(input));
}
