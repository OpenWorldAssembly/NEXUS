/**
 * File: list_trusted_request_enrollments.ts
 * Description: Lists registered client/API request enrollments through the Trusted Request Coordinator.
 */

import {
  listPacketClientIntentEnrollments,
} from '@runtime/nexus/server/packet-client-intent-enrollment';
import {
  createTrustedRuntimeCoordinatorResult,
  createTrustedTraceEntry,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type {
  ListTrustedRequestEnrollmentsInput,
  TrustedRequestEnrollmentList,
} from '../trusted_request_types.ts';

export function listTrustedRequestEnrollments(
  input: ListTrustedRequestEnrollmentsInput = {}
): TrustedRuntimeCoordinatorResult<TrustedRequestEnrollmentList> {
  const enrollments = listPacketClientIntentEnrollments();

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_request_coordinator.v0',
    coordinator_kind: 'request',
    value: {
      list_kind: 'trusted.request_enrollments',
      enrollments,
    },
    mode: input.mode ?? 'debug_audit',
    trace: [
      createTrustedTraceEntry({
        step_id: 'request.enrollments.list',
        coordinator_id: 'trusted_request_coordinator.v0',
        notes: `Listed ${enrollments.length} client/API request enrollments.`,
      }),
    ],
  });
}
