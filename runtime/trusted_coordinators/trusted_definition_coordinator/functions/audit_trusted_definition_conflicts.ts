/**
 * File: audit_trusted_definition_conflicts.ts
 * Description: Detects conflicting, unsafe, or incomplete Trusted Definition candidate sets.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type AuditTrustedDefinitionConflictsInput,
} from '../trusted_definition_types.ts';
import { definitionTrace, uniqueKeyForCandidate } from '../trusted_definition_internal.ts';

export function auditTrustedDefinitionConflicts(
  input: AuditTrustedDefinitionConflictsInput
): TrustedRuntimeCoordinatorResult<string[]> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const conflictDecisions: string[] = [];
  const activeByKey = new Map<string, string[]>();

  for (const candidate of input.candidates) {
    if (candidate.status !== 'active_candidate') {
      continue;
    }

    const key = uniqueKeyForCandidate(candidate);
    activeByKey.set(key, [...(activeByKey.get(key) ?? []), candidate.candidate_id]);
  }

  for (const [key, candidateIds] of activeByKey.entries()) {
    if (candidateIds.length <= 1) {
      continue;
    }

    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'multiple_active_definition_candidates',
        path: key,
        message: `Multiple active definition candidates resolve for ${key}: ${candidateIds.join(', ')}. Highest ranked candidate will be used by callers unless pinned differently.`,
      })
    );
    conflictDecisions.push(`${key}: chose highest-ranked active candidate from ${candidateIds.length} candidates.`);
  }

  for (const candidate of input.candidates) {
    if (candidate.status === 'active_candidate' && candidate.trust_status === 'compatibility_only') {
      issues.push(
        trustedIssue({
          severity: 'error',
          code: 'compatibility_definition_promoted_to_active',
          path: candidate.candidate_id,
          message: `${candidate.candidate_id} is compatibility-only but appeared as an active definition candidate.`,
        })
      );
    }

    if (candidate.source.verified === false && candidate.status === 'active_candidate') {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'unverified_definition_candidate_active',
          path: candidate.candidate_id,
          message: `${candidate.candidate_id} is active but source verification is not confirmed.`,
        })
      );
    }
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: conflictDecisions,
    issues,
    trace: [
      definitionTrace({
        step_id: 'definition.conflicts.audit',
        status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
        notes: `Audited ${input.candidates.length} trusted definition candidates for active conflicts.`,
      }),
    ],
  });
}
