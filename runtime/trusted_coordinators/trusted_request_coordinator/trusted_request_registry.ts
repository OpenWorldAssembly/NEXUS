/**
 * File: trusted_request_registry.ts
 * Description: Internal operation registry for the Trusted Request Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { normalizeTrustedRequest } from './functions/normalize_trusted_request.ts';
import { preflightTrustedClientIntent } from './functions/preflight_trusted_client_intent.ts';
import { listTrustedRequestEnrollments } from './functions/list_trusted_request_enrollments.ts';
import { auditTrustedRequestReadiness } from './functions/audit_trusted_request_readiness.ts';
import type {
  AuditTrustedRequestReadinessInput,
  ListTrustedRequestEnrollmentsInput,
  NormalizeTrustedRequestInput,
  PreflightTrustedClientIntentInput,
} from './trusted_request_types.ts';

type TrustedRequestOperation =
  | 'normalize_request'
  | 'preflight_client_intent'
  | 'list_enrollments'
  | 'audit_readiness';

type TrustedRequestOperationInput =
  | NormalizeTrustedRequestInput
  | PreflightTrustedClientIntentInput
  | ListTrustedRequestEnrollmentsInput
  | AuditTrustedRequestReadinessInput;

const TRUSTED_REQUEST_OPERATION_REGISTRY = {
  normalize_request: normalizeTrustedRequest,
  preflight_client_intent: preflightTrustedClientIntent,
  list_enrollments: listTrustedRequestEnrollments,
  audit_readiness: auditTrustedRequestReadiness,
} as const;

export function executeTrustedRequestOperation(input: {
  operation: TrustedRequestOperation;
  input: TrustedRequestOperationInput;
}): TrustedRuntimeCoordinatorResult<unknown> {
  const operation = TRUSTED_REQUEST_OPERATION_REGISTRY[input.operation] as (
    value: TrustedRequestOperationInput
  ) => TrustedRuntimeCoordinatorResult<unknown>;

  return operation(input.input);
}
