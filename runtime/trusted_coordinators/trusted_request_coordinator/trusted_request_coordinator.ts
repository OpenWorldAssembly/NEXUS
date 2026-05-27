/**
 * File: trusted_request_coordinator.ts
 * Description: Public gated coordinator surface for trusted runtime request intake.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { executeTrustedRequestOperation } from './trusted_request_registry.ts';
import type {
  AuditTrustedRequestReadinessInput,
  ListTrustedRequestEnrollmentsInput,
  NormalizeTrustedRequestInput,
  PreflightTrustedClientIntentInput,
  TrustedRequestEnrollmentList,
  TrustedRequestPreflight,
  TrustedRequestReadinessReport,
  TrustedRuntimeRequest,
} from './trusted_request_types.ts';

function castResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<unknown>
): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedRequestCoordinator = {
  id: 'trusted_request_coordinator.v0',

  normalizeRequest(input: NormalizeTrustedRequestInput): TrustedRuntimeCoordinatorResult<TrustedRuntimeRequest> {
    return castResult<TrustedRuntimeRequest>(
      executeTrustedRequestOperation({ operation: 'normalize_request', input })
    );
  },

  preflightClientIntent(input: PreflightTrustedClientIntentInput): TrustedRuntimeCoordinatorResult<TrustedRequestPreflight> {
    return castResult<TrustedRequestPreflight>(
      executeTrustedRequestOperation({ operation: 'preflight_client_intent', input })
    );
  },

  listEnrollments(input: ListTrustedRequestEnrollmentsInput = {}): TrustedRuntimeCoordinatorResult<TrustedRequestEnrollmentList> {
    return castResult<TrustedRequestEnrollmentList>(
      executeTrustedRequestOperation({ operation: 'list_enrollments', input })
    );
  },

  auditReadiness(input: AuditTrustedRequestReadinessInput = {}): TrustedRuntimeCoordinatorResult<TrustedRequestReadinessReport> {
    return castResult<TrustedRequestReadinessReport>(
      executeTrustedRequestOperation({ operation: 'audit_readiness', input })
    );
  },
};
