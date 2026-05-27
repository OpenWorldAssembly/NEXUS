/**
 * File: inspect_packet_body_candidate.ts
 * Description: Validates one built packet body candidate against the plan node snapshot that produced it.
 */

import { getPacketBodySchema } from '@core/schema/packet-body-schemas.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  candidateBodyRecord,
  inspectionIssue,
  inspectionTrace,
  safePacketType,
  sameTrustedValue,
  uniqueSorted,
} from '../trusted_inspection_internal.ts';
import {
  TRUSTED_INSPECTION_COORDINATOR_ID,
  type InspectTrustedPacketBodyCandidateInput,
  type TrustedPacketBodyInspection,
} from '../trusted_inspection_types.ts';

export function inspectTrustedPacketBodyCandidate(
  input: InspectTrustedPacketBodyCandidateInput
): TrustedRuntimeCoordinatorResult<TrustedPacketBodyInspection> {
  const candidateNode = input.candidate_node;
  const planNode = input.plan_node ?? null;
  const issues: TrustedRuntimeCoordinatorIssue[] = [...candidateNode.issues];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const blockers = [...candidateNode.blockers];
  const warnings = [...candidateNode.warnings];
  const body = candidateBodyRecord(candidateNode);
  const packetType = safePacketType(candidateNode.packet_type);
  let schemaValid = false;
  let schemaErrorCount = 0;
  const mismatchPaths: string[] = [];

  if (!candidateNode.body_candidate) {
    blockers.push('Candidate node has no body candidate.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'candidate_body_missing',
      path: `candidate_nodes.${candidateNode.candidate_id}.body_candidate`,
      message: 'Inspection cannot validate a candidate node without a body candidate.',
    }));
  }

  if (!packetType) {
    blockers.push('Candidate node has an unknown packet type.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'candidate_packet_type_unknown',
      path: `candidate_nodes.${candidateNode.candidate_id}.packet_type`,
      message: `Unknown candidate packet type: ${candidateNode.packet_type ?? 'null'}.`,
    }));
  }

  if (!body) {
    blockers.push('Candidate body is not a record.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'candidate_body_not_record',
      path: `candidate_nodes.${candidateNode.candidate_id}.body`,
      message: 'Candidate body must be an object record before schema validation.',
    }));
  }

  if (planNode) {
    if (candidateNode.packet_type !== planNode.packet_type) {
      mismatchPaths.push('packet_type');
      blockers.push('Candidate packet type does not match its source plan node.');
      issues.push(inspectionIssue({
        severity: 'error',
        code: 'candidate_packet_type_plan_mismatch',
        path: `candidate_nodes.${candidateNode.candidate_id}.packet_type`,
        message: `Candidate packet type ${candidateNode.packet_type ?? 'null'} does not match plan packet type ${planNode.packet_type ?? 'null'}.`,
      }));
    }

    if (candidateNode.packet_subtype !== planNode.packet_subtype) {
      mismatchPaths.push('packet_subtype');
      blockers.push('Candidate packet subtype does not match its source plan node.');
      issues.push(inspectionIssue({
        severity: 'error',
        code: 'candidate_packet_subtype_plan_mismatch',
        path: `candidate_nodes.${candidateNode.candidate_id}.packet_subtype`,
        message: `Candidate packet subtype ${candidateNode.packet_subtype ?? 'null'} does not match plan packet subtype ${planNode.packet_subtype ?? 'null'}.`,
      }));
    }

    if (candidateNode.builder_id !== (planNode.body_input_plan?.builder_id ?? planNode.builder_selection?.builder?.builder_id ?? null)) {
      mismatchPaths.push('builder_id');
      warnings.push('Candidate builder ID does not match the planned builder ID.');
      issues.push(inspectionIssue({
        severity: 'warning',
        code: 'candidate_builder_plan_mismatch',
        path: `candidate_nodes.${candidateNode.candidate_id}.builder_id`,
        message: 'Candidate builder ID differs from the builder selected by Planning.',
      }));
    }

    if (body && body.subtype !== planNode.packet_subtype) {
      mismatchPaths.push('body.subtype');
      blockers.push('Candidate body subtype does not match its source plan node.');
      issues.push(inspectionIssue({
        severity: 'error',
        code: 'candidate_body_subtype_plan_mismatch',
        path: `candidate_nodes.${candidateNode.candidate_id}.body.subtype`,
        message: `Candidate body subtype ${String(body.subtype)} does not match plan subtype ${planNode.packet_subtype ?? 'null'}.`,
      }));
    }

    for (const [key, plannedValue] of Object.entries(planNode.body_input_plan?.resolved_input_values ?? {})) {
      if (!body || !sameTrustedValue(body[key], plannedValue)) {
        mismatchPaths.push(`body.${key}`);
      }
    }
  }

  if (body && packetType) {
    const schemaResult = getPacketBodySchema(packetType).safeParse(body);
    schemaValid = schemaResult.success;
    schemaErrorCount = schemaResult.success ? 0 : schemaResult.error.issues.length;

    if (!schemaResult.success) {
      blockers.push('Candidate body failed packet body schema validation.');
      issues.push(inspectionIssue({
        severity: 'error',
        code: 'candidate_body_schema_invalid',
        path: `candidate_nodes.${candidateNode.candidate_id}.body`,
        message: `${candidateNode.packet_type ?? 'unknown'} body failed schema validation with ${schemaErrorCount} issue(s).`,
      }));
    }
  }

  const plannedValuesValid = mismatchPaths.length === 0;
  const valid = schemaValid && plannedValuesValid && blockers.length === 0 && !issues.some((issue) => issue.severity === 'error');

  traceEntries.push(inspectionTrace({
    step_id: 'inspection.packet_body_candidate.inspect',
    status: valid ? 'ok' : blockers.length > 0 ? 'blocked' : 'partial',
    preset_ids: ['trusted.packet_body_inspection.v0'],
    notes: `Inspected packet body candidate ${candidateNode.candidate_id}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_INSPECTION_COORDINATOR_ID,
    coordinator_kind: 'inspection',
    value: {
      inspection_kind: 'trusted.packet_body_inspection',
      candidate_id: candidateNode.candidate_id,
      source_plan_id: candidateNode.source_plan_id,
      packet_type: candidateNode.packet_type,
      packet_subtype: candidateNode.packet_subtype,
      builder_id: candidateNode.builder_id,
      schema_valid: schemaValid,
      planned_values_valid: plannedValuesValid,
      valid,
      schema_error_count: schemaErrorCount,
      planned_value_mismatch_paths: uniqueSorted(mismatchPaths),
      blockers: uniqueSorted(blockers),
      warnings: uniqueSorted(warnings),
      issues,
      trace: traceEntries,
    },
    issues,
    trace: traceEntries,
    mode: input.context_mode,
  });
}
