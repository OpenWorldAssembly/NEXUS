/**
 * File: verify_packet.ts
 * Description: Verifies one packet envelope for structure, compatibility, digest, signature, and signer availability.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  appendTrustedProcessStage,
  completeTrustedProcessChain,
  completeTrustedProcessStage,
  createTrustedProcessChain,
  failTrustedProcessStage,
  startTrustedProcessStage,
} from '@runtime/trusted_coordinators/trusted_process.ts';
import {
  assessPacketSignature,
  compatibilityStatus,
  emptyPacketVerificationResult,
  inspectVerificationPacket,
  normalizeVerificationMode,
  overallStatus,
  packetRef,
  packetSubtype,
  revisionRef,
  verificationIssue,
  verificationTrace,
} from '../trusted_verification_internal.ts';
import {
  TRUSTED_VERIFICATION_COORDINATOR_ID,
  type TrustedPacketVerificationResult,
  type VerifyTrustedPacketInput,
} from '../trusted_verification_types.ts';

export async function verifyTrustedPacket(
  input: VerifyTrustedPacketInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketVerificationResult>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const verificationMode = normalizeVerificationMode(input.verification_mode);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
    coordinator_kind: 'verification',
    operation_name: 'verify_packet',
    completion_policy: 'dry_run_only',
    mode: contextMode,
  });
  const rawPacket = input.raw_packet ?? input.packet ?? null;

  if (!rawPacket) {
    issues.push(verificationIssue({
      severity: 'error',
      code: 'trusted_verification_packet_missing',
      path: 'packet',
      message: 'Trusted Verification requires a packet or raw_packet input.',
    }));

    const value = emptyPacketVerificationResult({
      entryId: input.entry_id,
      blocker: 'No packet material was supplied for verification.',
    });

    trace.push(verificationTrace({
      step_id: 'verification.packet.input',
      status: 'blocked',
      preset_ids: ['trusted.verification.packet.v0'],
      notes: 'Packet verification blocked because packet material is missing.',
    }));
    processChain = appendTrustedProcessStage(
      processChain,
      failTrustedProcessStage(
        startTrustedProcessStage({
          stage_id: 'verification.packet.input',
          coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
          coordinator_kind: 'verification',
          operation_name: 'verify_packet_input',
          preset_ids: ['trusted.verification.packet.v0'],
          notes: 'Packet verification blocked because packet material is missing.',
        }),
        {
          status: 'blocked',
          issues,
          blocked_work: [{
            work_id: 'verification.packet.assess',
            label: 'Packet assessment could not run without packet material.',
            reason_code: 'verification.packet_missing',
          }],
        }
      ),
      { issues }
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
      coordinator_kind: 'verification',
      status: 'blocked',
      value,
      issues,
      trace,
      mode: contextMode,
      process_chain: completeTrustedProcessChain(processChain, { status: 'blocked' }),
    });
  }

  try {
    const compatibilityRead = inspectVerificationPacket({
      rawPacket,
      targetSchemaVersion: input.target_schema_version,
    });
    const adaptedPacket = compatibilityRead.adapted_packet;
    const signatureAssessment = await assessPacketSignature({
      rawPacket,
      adaptedPacket,
      signerPacket: input.signer_packet,
      verificationMode,
    });
    const warnings = [...signatureAssessment.warnings];
    const blockers = [...signatureAssessment.blockers];
    const result: TrustedPacketVerificationResult = {
      result_kind: 'trusted.packet_verification_result',
      entry_id: input.entry_id ?? null,
      packet_ref: packetRef(adaptedPacket),
      revision_ref: revisionRef(adaptedPacket),
      packet_type: adaptedPacket.header.type,
      packet_subtype: packetSubtype(adaptedPacket),
      structural_status: 'passed',
      compatibility_status: compatibilityStatus(compatibilityRead),
      digest_status: signatureAssessment.digestStatus,
      signature_status: signatureAssessment.signatureStatus,
      signer_status: signatureAssessment.signerStatus,
      lineage_status: 'skipped',
      ref_status: 'skipped',
      overall_status: 'unknown',
      signer_packet_ref: signatureAssessment.signerPacketRef,
      declared_schema_version: compatibilityRead.status.declared_schema_version,
      target_schema_version: compatibilityRead.status.target_schema_version,
      warnings,
      blockers,
    };

    if (result.compatibility_status === 'lossy') {
      warnings.push('Packet adaptation is lossy for the requested target schema version.');
    }

    if (result.compatibility_status === 'blocked') {
      blockers.push('Packet target schema version is not a supported write/read target.');
    }

    result.overall_status = overallStatus({
      structuralStatus: result.structural_status,
      compatibilityStatus: result.compatibility_status,
      digestStatus: result.digest_status,
      signatureStatus: result.signature_status,
      signerStatus: result.signer_status,
      lineageStatus: result.lineage_status,
      refStatus: result.ref_status,
      blockers: result.blockers,
      warnings: result.warnings,
    });

    trace.push(verificationTrace({
      step_id: 'verification.packet.assess',
      status: result.overall_status === 'blocked'
        ? 'blocked'
        : result.overall_status === 'warning'
          ? 'partial'
          : 'ok',
      preset_ids: ['trusted.verification.packet.v0'],
      notes: `Verified packet ${adaptedPacket.header.packet_id} with status ${result.overall_status}.`,
    }));
    processChain = appendTrustedProcessStage(
      processChain,
      completeTrustedProcessStage(
        startTrustedProcessStage({
          stage_id: 'verification.packet.assess',
          coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
          coordinator_kind: 'verification',
          operation_name: 'assess_packet',
          preset_ids: ['trusted.verification.packet.v0'],
          notes: `Verified packet ${adaptedPacket.header.packet_id} with status ${result.overall_status}.`,
        }),
        {
          status: result.overall_status === 'blocked'
            ? 'blocked'
            : result.overall_status === 'warning'
              ? 'partial'
              : 'ok',
          issues,
          artifacts: [{
            artifact_id: `${adaptedPacket.header.packet_id}:${adaptedPacket.header.revision_id}`,
            artifact_kind: 'packet_verification_result',
            label: 'Packet verification result.',
            packet_id: adaptedPacket.header.packet_id,
            revision_id: adaptedPacket.header.revision_id,
            redacted: true,
          }],
          blocked_work: result.overall_status === 'blocked'
            ? [{
                work_id: 'verification.packet.accept',
                label: 'Packet cannot be accepted by verification.',
                reason_code: 'verification.packet_structural_invalid',
                packet_id: adaptedPacket.header.packet_id,
                revision_id: adaptedPacket.header.revision_id,
              }]
            : [],
        }
      ),
      { issues }
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
      coordinator_kind: 'verification',
      status: result.overall_status === 'blocked'
        ? 'blocked'
        : result.overall_status === 'warning'
          ? 'partial'
          : 'ok',
      value: result,
      issues,
      trace,
      mode: contextMode,
      process_chain: completeTrustedProcessChain(processChain),
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Packet structural verification failed.';
    const value = emptyPacketVerificationResult({
      entryId: input.entry_id,
      blocker: message,
    });

    issues.push(verificationIssue({
      severity: 'error',
      code: 'trusted_verification_packet_structural_invalid',
      path: 'packet',
      message,
    }));
    trace.push(verificationTrace({
      step_id: 'verification.packet.assess',
      status: 'blocked',
      preset_ids: ['trusted.verification.packet.v0'],
      notes: 'Packet verification blocked during structural parsing.',
    }));
    processChain = appendTrustedProcessStage(
      processChain,
      failTrustedProcessStage(
        startTrustedProcessStage({
          stage_id: 'verification.packet.assess',
          coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
          coordinator_kind: 'verification',
          operation_name: 'assess_packet',
          preset_ids: ['trusted.verification.packet.v0'],
          notes: 'Packet verification blocked during structural parsing.',
        }),
        {
          status: 'blocked',
          issues,
          blocked_work: [{
            work_id: 'verification.packet.accept',
            label: 'Packet cannot be accepted by verification.',
            reason_code: 'verification.packet_structural_invalid',
          }],
        }
      ),
      { issues }
    );

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_VERIFICATION_COORDINATOR_ID,
      coordinator_kind: 'verification',
      status: 'blocked',
      value,
      issues,
      trace,
      mode: contextMode,
      process_chain: completeTrustedProcessChain(processChain, { status: 'blocked' }),
    });
  }
}
