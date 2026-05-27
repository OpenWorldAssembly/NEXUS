/**
 * File: trusted_dispatch_types.ts
 * Description: Public type aliases for the Trusted Dispatch Coordinator compatibility bridge.
 */

export type {
  AuditTrustedRequestReadinessInput as AuditTrustedDispatchReadinessInput,
  ListTrustedRequestEnrollmentsInput as ListTrustedDispatchEnrollmentsInput,
  NormalizeTrustedRequestInput as NormalizeTrustedDispatchRequestInput,
  PreflightTrustedClientIntentInput as PreflightTrustedDispatchClientIntentInput,
  TrustedRequestEnrollmentList as TrustedDispatchEnrollmentList,
  TrustedRequestOperationKind as TrustedDispatchOperationKind,
  TrustedRequestPreflight as TrustedDispatchPreflight,
  TrustedRequestReadinessReport as TrustedDispatchReadinessReport,
  TrustedRequestSourceKind as TrustedDispatchSourceKind,
  TrustedRuntimeRequest as TrustedRuntimeDispatchRequest,
} from '@runtime/trusted_coordinators/trusted_request_coordinator/trusted_request_types.ts';
