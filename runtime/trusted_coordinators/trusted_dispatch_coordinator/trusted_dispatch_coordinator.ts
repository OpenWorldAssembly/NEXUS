/**
 * File: trusted_dispatch_coordinator.ts
 * Description: Canonical dispatch-facing bridge over trusted request intake.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { trustedRequestCoordinator } from '@runtime/trusted_coordinators/trusted_request_coordinator/trusted_request_coordinator.ts';
import type {
  AuditTrustedRequestReadinessInput,
  ListTrustedRequestEnrollmentsInput,
  NormalizeTrustedRequestInput,
  PreflightTrustedClientIntentInput,
  TrustedRequestEnrollmentList,
  TrustedRequestPreflight,
  TrustedRequestReadinessReport,
  TrustedRuntimeRequest,
} from '@runtime/trusted_coordinators/trusted_request_coordinator/trusted_request_types.ts';

function asDispatchResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<TValue>
): TrustedRuntimeCoordinatorResult<TValue> {
  return {
    ...result,
    coordinator_id: 'trusted_dispatch_coordinator.v0',
    coordinator_kind: 'dispatch',
    trace: [
      ...result.trace,
      {
        step_id: 'dispatch.compat_request_bridge',
        coordinator_id: 'trusted_dispatch_coordinator.v0',
        preset_ids: [],
        status: result.status,
        notes:
          'Trusted Dispatch Coordinator is the canonical runtime front desk; current implementation delegates to the compatibility Trusted Request Coordinator.',
      },
    ],
  };
}

export const trustedDispatchCoordinator = {
  id: 'trusted_dispatch_coordinator.v0',

  normalizeRequest(
    input: NormalizeTrustedRequestInput
  ): TrustedRuntimeCoordinatorResult<TrustedRuntimeRequest> {
    return asDispatchResult(trustedRequestCoordinator.normalizeRequest(input));
  },

  preflightClientIntent(
    input: PreflightTrustedClientIntentInput
  ): TrustedRuntimeCoordinatorResult<TrustedRequestPreflight> {
    return asDispatchResult(trustedRequestCoordinator.preflightClientIntent(input));
  },

  listEnrollments(
    input: ListTrustedRequestEnrollmentsInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedRequestEnrollmentList> {
    return asDispatchResult(trustedRequestCoordinator.listEnrollments(input));
  },

  auditReadiness(
    input: AuditTrustedRequestReadinessInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedRequestReadinessReport> {
    return asDispatchResult(trustedRequestCoordinator.auditReadiness(input));
  },
};
