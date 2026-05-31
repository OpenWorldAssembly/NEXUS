/**
 * File: resolve_trusted_definition_context.ts
 * Description: Resolves the active Trusted Definition context for a node/runtime request.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type ResolveTrustedDefinitionContextInput,
  type TrustedDefinitionCandidate,
  type TrustedDefinitionContext,
} from '../trusted_definition_types.ts';
import { definitionTrace, normalizeContextMode, uniqueKeyForCandidate } from '../trusted_definition_internal.ts';
import { listTrustedDefinitionCandidates } from './list_trusted_definition_candidates.ts';
import { rankTrustedDefinitionCandidates } from './rank_trusted_definition_candidates.ts';
import { auditTrustedDefinitionConflicts } from './audit_trusted_definition_conflicts.ts';
import { normalizePacketBackedDefinitionPreferences } from './normalize_packet_backed_definition_preferences.ts';

function chooseActiveCandidates(input: {
  ranked: readonly TrustedDefinitionCandidate[];
  includeCompatibility: boolean;
}): {
  active: TrustedDefinitionCandidate[];
  inactive: TrustedDefinitionCandidate[];
  compatibility: TrustedDefinitionCandidate[];
  ignored: TrustedDefinitionCandidate[];
} {
  const activeByKey = new Map<string, TrustedDefinitionCandidate>();
  const inactive: TrustedDefinitionCandidate[] = [];
  const compatibility: TrustedDefinitionCandidate[] = [];
  const ignored: TrustedDefinitionCandidate[] = [];

  for (const candidate of input.ranked) {
    if (candidate.status === 'ignored_candidate') {
      ignored.push(candidate);
      continue;
    }

    if (candidate.status === 'compatibility_candidate' || candidate.trust_status === 'compatibility_only') {
      compatibility.push(candidate);
      if (!input.includeCompatibility) {
        continue;
      }
    }

    if (candidate.status !== 'active_candidate') {
      inactive.push(candidate);
      continue;
    }

    const key = uniqueKeyForCandidate(candidate);
    if (!activeByKey.has(key)) {
      activeByKey.set(key, candidate);
    } else {
      inactive.push(candidate);
    }
  }

  return {
    active: [...activeByKey.values()],
    inactive,
    compatibility,
    ignored,
  };
}


function preferenceTargetMatches(input: {
  preference: { node_element_id?: string | null; scope_packet_id?: string | null };
  nodeElementId?: string | null;
  scopePacketId?: string | null;
}): boolean {
  const { preference, nodeElementId, scopePacketId } = input;

  if (preference.node_element_id && preference.node_element_id !== nodeElementId) {
    return false;
  }

  if (preference.scope_packet_id && preference.scope_packet_id !== scopePacketId) {
    return false;
  }

  return true;
}

export function resolveTrustedDefinitionContext(
  input: ResolveTrustedDefinitionContextInput = {}
): TrustedRuntimeCoordinatorResult<TrustedDefinitionContext> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const contextMode = normalizeContextMode(input.context_mode);
  const packetTypeFilters = input.packet_type_filters ? [...input.packet_type_filters] : [];
  const packetPreferenceResult = normalizePacketBackedDefinitionPreferences({
    preference_packets: input.definition_profile_preference_packets,
    node_element_id: input.node_element_id ?? null,
    scope_packet_id: input.scope_packet_id ?? null,
  });
  issues.push(...packetPreferenceResult.issues);

  const preferences = [
    ...packetPreferenceResult.preferences,
    ...(input.preferences ?? []),
  ].filter((preference) =>
    preferenceTargetMatches({
      preference,
      nodeElementId: input.node_element_id ?? null,
      scopePacketId: input.scope_packet_id ?? null,
    })
  );

  if (packetPreferenceResult.preferences.length > 0) {
    trace.push(
      definitionTrace({
        step_id: 'definition.profile_preferences.packet_backed',
        status: packetPreferenceResult.issues.some((issue) => issue.severity === 'error')
          ? 'error'
          : packetPreferenceResult.issues.length > 0
            ? 'partial'
            : 'ok',
        notes: `Loaded ${packetPreferenceResult.preferences.length} packet-backed trusted definition runtime preference(s).`,
      })
    );
  }

  const listResult = listTrustedDefinitionCandidates({
    ...input,
    packet_type_filters: packetTypeFilters,
  });
  issues.push(...listResult.issues);
  trace.push(...listResult.trace);

  if (!listResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'definition',
      value: null,
      issues,
      trace,
    });
  }

  const rankResult = rankTrustedDefinitionCandidates({
    ...input,
    preferences,
    candidates: listResult.value,
  });
  issues.push(...rankResult.issues);
  trace.push(...rankResult.trace);

  if (!rankResult.value) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
      coordinator_kind: 'definition',
      value: null,
      issues,
      trace,
    });
  }

  const conflictResult = auditTrustedDefinitionConflicts({
    ...input,
    preferences,
    candidates: rankResult.value,
  });
  issues.push(...conflictResult.issues);
  trace.push(...conflictResult.trace);

  const chosen = chooseActiveCandidates({
    ranked: rankResult.value,
    includeCompatibility: input.include_compatibility === true || contextMode === 'compatibility_read' || contextMode === 'migration',
  });

  trace.push(
    definitionTrace({
      step_id: 'definition.context.resolve',
      status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
      notes: `Resolved trusted definition context with ${chosen.active.length} active candidates, ${chosen.compatibility.length} compatibility candidates, and ${chosen.ignored.length} ignored candidates.`,
    })
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: {
      context_kind: 'trusted.definition_context',
      context_id: `${input.node_element_id ?? 'local-node'}.${contextMode}.${packetTypeFilters.join('-') || 'all'}`,
      context_mode: contextMode,
      node_element_id: input.node_element_id ?? null,
      scope_packet_id: input.scope_packet_id ?? null,
      packet_type_filters: packetTypeFilters,
      active_candidates: chosen.active,
      inactive_candidates: chosen.inactive,
      compatibility_candidates: chosen.compatibility,
      ignored_candidates: chosen.ignored,
      preferences_used: preferences,
      conflict_decisions: conflictResult.value ?? [],
      issues,
      trace,
    },
    issues,
    trace,
  });
}
