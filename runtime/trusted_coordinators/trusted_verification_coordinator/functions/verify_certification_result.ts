/**
 * File: verify_certification_result.ts
 * Description: Verifies the structural handoff produced by Trusted Certification before archive/import consumers trust it.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  createTrustedVerificationReport,
  hashTrustedVerificationValue,
  normalizeVerificationMode,
  verificationIssue,
  verificationTrace,
} from '../trusted_verification_internal.ts';
import {
  TRUSTED_VERIFICATION_COORDINATOR_ID,
  type TrustedVerificationReport,
  type VerifyTrustedCertificationResultInput,
} from '../trusted_verification_types.ts';

export async function verifyTrustedCertificationResult(
  input: VerifyTrustedCertificationResultInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedVerificationReport>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const verificationMode = normalizeVerificationMode(input.verification_mode);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const certificationResults: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  const certifiedSet = input.certified_packet_set;

  if (certifiedSet.certified_kind !== 'trusted.certified_packet_set') {
    blockers.push('Certification result is not a trusted certified packet set.');
  }

  if (!certifiedSet.archive_ready) {
    blockers.push('Certification result is not archive-ready.');
  }

  if (certifiedSet.blockers.length > 0) {
    blockers.push(...certifiedSet.blockers.map((blocker) => `Certification blocker: ${blocker}`));
  }

  if (certifiedSet.warnings.length > 0) {
    warnings.push(...certifiedSet.warnings.map((warning) => `Certification warning: ${warning}`));
  }

  certificationResults.push(`ticket:${certifiedSet.ticket_id}`);
  certificationResults.push(`signer:${certifiedSet.signer_ref}`);
  certificationResults.push(`candidate_count:${certifiedSet.candidate_graph.candidate_nodes.length}`);

  if (input.recompute_candidate_graph_hash ?? true) {
    const candidateGraphHash = hashTrustedVerificationValue(certifiedSet.candidate_graph);

    if (candidateGraphHash !== certifiedSet.hashes.candidate_graph_hash) {
      blockers.push('Candidate graph hash does not match the certified hash bundle.');
      certificationResults.push('candidate_graph_hash:mismatch');
    } else {
      certificationResults.push('candidate_graph_hash:passed');
    }
  }

  if (certifiedSet.candidate_graph.blockers.length > 0) {
    blockers.push(...certifiedSet.candidate_graph.blockers.map(
      (blocker) => `Candidate graph blocker: ${blocker}`
    ));
  }

  if (certifiedSet.candidate_graph.warnings.length > 0) {
    warnings.push(...certifiedSet.candidate_graph.warnings.map(
      (warning) => `Candidate graph warning: ${warning}`
    ));
  }

  if (blockers.length > 0) {
    issues.push(verificationIssue({
      severity: 'error',
      code: 'trusted_verification_certification_result_blocked',
      path: 'certified_packet_set',
      message: blockers[0] ?? 'Certification result verification blocked.',
    }));
  }

  trace.push(verificationTrace({
    step_id: 'verification.certification_result.assess',
    status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.verification.certification_result.v0'],
    notes: `Verified certification result ${certifiedSet.certification_id}.`,
  }));

  const report = createTrustedVerificationReport({
    targetKind: 'certification_result',
    verificationMode,
    packetResults: [],
    certificationResults,
    warnings,
    blockers,
    issues,
    trace,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
    coordinator_kind: 'verification',
    status: report.blocking_issue_count > 0
      ? 'blocked'
      : report.warning_count > 0
        ? 'partial'
        : 'ok',
    value: report,
    issues,
    trace,
    mode: contextMode,
  });
}
