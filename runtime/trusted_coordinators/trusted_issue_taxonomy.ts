/**
 * File: trusted_issue_taxonomy.ts
 * Description: Canonical issue-code taxonomy for trusted runtime process reporting.
 */

import type {
  TrustedRuntimeCoordinatorIssue,
} from './trusted_runtime_coordinator.ts';

export type TrustedIssueCategory =
  | 'validation'
  | 'policy'
  | 'signature'
  | 'storage'
  | 'compatibility'
  | 'not_found'
  | 'conflict'
  | 'blocked_dependency'
  | 'unexpected';

export type TrustedIssueRetryability = 'retryable' | 'not_retryable' | 'unknown';

export type TrustedIssueDescriptor = {
  code: string;
  legacy_aliases: readonly string[];
  default_severity: TrustedRuntimeCoordinatorIssue['severity'];
  category: TrustedIssueCategory;
  retryability: TrustedIssueRetryability;
  user_title: string;
  user_message: string;
};

const TRUSTED_ISSUE_DESCRIPTORS = [
  {
    code: 'archive.certified_set_not_ready',
    legacy_aliases: ['trusted_archive_certified_set_not_ready'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Archive input is not ready',
    user_message: 'The packet set was not certified as archive-ready.',
  },
  {
    code: 'archive.no_packet_envelopes',
    legacy_aliases: ['trusted_archive_no_packet_envelopes'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'No archiveable packets',
    user_message: 'No packet envelopes were available for archive storage.',
  },
  {
    code: 'archive.revision_not_found',
    legacy_aliases: ['trusted_archive_revision_not_found'],
    default_severity: 'warning',
    category: 'not_found',
    retryability: 'unknown',
    user_title: 'Revision not found',
    user_message: 'The requested packet revision could not be found.',
  },
  {
    code: 'archive.packet_not_found',
    legacy_aliases: ['trusted_archive_packet_not_found', 'projection_archive_packet_missing'],
    default_severity: 'warning',
    category: 'not_found',
    retryability: 'unknown',
    user_title: 'Packet not found',
    user_message: 'The requested packet could not be found.',
  },
  {
    code: 'archive.store_unavailable',
    legacy_aliases: ['trusted_archive_store_unavailable'],
    default_severity: 'error',
    category: 'storage',
    retryability: 'retryable',
    user_title: 'Archive store unavailable',
    user_message: 'The archive store was unavailable.',
  },
  {
    code: 'archive.write_failed',
    legacy_aliases: [],
    default_severity: 'error',
    category: 'storage',
    retryability: 'unknown',
    user_title: 'Archive write failed',
    user_message: 'Archive storage failed before all work completed.',
  },
  {
    code: 'compatibility.unknown_packet_type',
    legacy_aliases: ['trusted_compatibility_unknown_packet_type'],
    default_severity: 'error',
    category: 'compatibility',
    retryability: 'not_retryable',
    user_title: 'Unknown packet type',
    user_message: 'The packet type is not registered for compatibility handling.',
  },
  {
    code: 'compatibility.definition_schema_mismatch',
    legacy_aliases: [
      'trusted_compatibility_definition_schema_mismatch',
      'trusted_compatibility_definition_part_missing',
      'trusted_compatibility_registry_definition_mismatch',
      'trusted_compatibility_current_only_has_legacy_versions',
    ],
    default_severity: 'error',
    category: 'compatibility',
    retryability: 'not_retryable',
    user_title: 'Compatibility definition mismatch',
    user_message: 'The compatibility definition does not match the active registry.',
  },
  {
    code: 'compatibility.unsupported_schema_version',
    legacy_aliases: ['unsupported_schema_version', 'trusted_compatibility_registry_unavailable'],
    default_severity: 'error',
    category: 'compatibility',
    retryability: 'not_retryable',
    user_title: 'Unsupported schema version',
    user_message: 'No compatibility path exists for the requested schema version.',
  },
  {
    code: 'compatibility.write_blocked',
    legacy_aliases: ['trusted_compatibility_write_blocked'],
    default_severity: 'error',
    category: 'compatibility',
    retryability: 'not_retryable',
    user_title: 'Compatibility write blocked',
    user_message: 'The packet could not be prepared for a compatible write.',
  },
  {
    code: 'definition.unknown_packet_type',
    legacy_aliases: ['unknown_definition_packet_type'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Unknown definition packet type',
    user_message: 'No active definition is available for this packet type.',
  },
  {
    code: 'definition.part_missing',
    legacy_aliases: ['trusted_definition_part_missing', 'trusted_compatibility_definition_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Definition part missing',
    user_message: 'A required definition part is missing.',
  },
  {
    code: 'definition.candidate_conflict',
    legacy_aliases: [
      'multiple_active_definition_candidates',
      'compatibility_definition_promoted_to_active',
      'unverified_definition_candidate_active',
      'projection_definition_candidate_missing',
    ],
    default_severity: 'warning',
    category: 'conflict',
    retryability: 'unknown',
    user_title: 'Definition candidate conflict',
    user_message: 'Definition candidates need review before the runtime can rely on them.',
  },
  {
    code: 'planning.definition_missing',
    legacy_aliases: ['trusted_planning_definition_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Planning definition missing',
    user_message: 'Planning could not continue because a required definition is missing.',
  },
  {
    code: 'planning.required_parts_missing',
    legacy_aliases: ['required_definition_parts_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Required plan parts missing',
    user_message: 'The operation plan is missing required definition parts.',
  },
  {
    code: 'planning.builder_descriptor_missing',
    legacy_aliases: ['trusted_builder_descriptor_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Builder descriptor missing',
    user_message: 'No trusted builder descriptor is available for this plan.',
  },
  {
    code: 'building.body_candidate_failed',
    legacy_aliases: [
      'trusted_body_candidate_build_failed',
      'body_input_plan_missing',
      'plan_packet_type_missing',
      'building.actor_packet_missing',
      'building.target_packet_missing',
    ],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Body candidate failed',
    user_message: 'Building could not materialize a packet body candidate.',
  },
  {
    code: 'building.definition_parts_missing',
    legacy_aliases: ['definition_has_no_definition_parts'],
    default_severity: 'warning',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Definition parts missing',
    user_message: 'No definition parts were available for candidate construction.',
  },
  {
    code: 'inspection.plan_mismatch',
    legacy_aliases: [
      'build_result_plan_id_mismatch',
      'candidate_graph_plan_id_mismatch',
      'candidate_source_plan_unknown',
      'candidate_for_plan_node_missing',
      'candidate_graph_source_plan_mismatch',
      'candidate_graph_root_missing',
      'candidate_packet_type_plan_mismatch',
      'candidate_packet_subtype_plan_mismatch',
      'candidate_builder_plan_mismatch',
      'candidate_body_subtype_plan_mismatch',
    ],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Plan alignment failed',
    user_message: 'Inspection found that a candidate does not match its trusted plan.',
  },
  {
    code: 'inspection.candidate_invalid',
    legacy_aliases: ['candidate_body_missing', 'candidate_packet_type_unknown', 'candidate_body_not_record', 'candidate_body_schema_invalid'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Candidate invalid',
    user_message: 'Inspection found an invalid packet candidate.',
  },
  {
    code: 'certification.ticket_unknown',
    legacy_aliases: ['trusted_certification_ticket_unknown'],
    default_severity: 'error',
    category: 'not_found',
    retryability: 'not_retryable',
    user_title: 'Certification ticket unknown',
    user_message: 'The certification ticket could not be found.',
  },
  {
    code: 'certification.ticket_expired',
    legacy_aliases: ['trusted_certification_ticket_expired'],
    default_severity: 'error',
    category: 'policy',
    retryability: 'not_retryable',
    user_title: 'Certification ticket expired',
    user_message: 'The certification ticket has expired.',
  },
  {
    code: 'certification.ticket_invalid',
    legacy_aliases: [
      'trusted_certification_payload_hash_mismatch',
      'trusted_certification_signer_mismatch',
      'trusted_certification_signature_missing',
      'trusted_certification_ticket_not_open',
      'trusted_certification_ticket_consume_failed',
      'trusted_certification_plan_snapshot_mismatch',
      'trusted_certification_invalid_candidate_graph',
      'certification.ticket_consume_failed',
      'certification.signed_packet_count_mismatch',
      'certification.expected_packet_missing',
      'certification.unsigned_digest_mismatch',
      'certification.packet_type_mismatch',
      'certification.signer_mismatch',
    ],
    default_severity: 'error',
    category: 'signature',
    retryability: 'not_retryable',
    user_title: 'Certification ticket invalid',
    user_message: 'The certification ticket failed validation.',
  },
  {
    code: 'exchange.bundle_blocked',
    legacy_aliases: ['trusted_exchange_bundle_blocked', 'trusted_exchange_merge_bundle_blocked', 'trusted_exchange_rebundle_blocked'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Bundle blocked',
    user_message: 'The bundle could not be processed safely.',
  },
  {
    code: 'exchange.bundle_warning',
    legacy_aliases: ['trusted_exchange_bundle_warning', 'trusted_exchange_merge_bundle_warning', 'trusted_exchange_rebundle_warning'],
    default_severity: 'warning',
    category: 'validation',
    retryability: 'unknown',
    user_title: 'Bundle warning',
    user_message: 'The bundle can be processed, but warnings were found.',
  },
  {
    code: 'exchange.import_preview_missing',
    legacy_aliases: ['trusted_exchange_import_preview_missing', 'trusted_exchange_import_plan_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Import preview missing',
    user_message: 'Import commit requires a preview or bundle to plan from.',
  },
  {
    code: 'exchange.import_commit_blocked',
    legacy_aliases: [
      'trusted_exchange_import_commit_blocked',
      'trusted_exchange_import_acknowledgement_missing',
      'trusted_exchange_import_plan_entry_missing',
    ],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Import commit blocked',
    user_message: 'Import commit cannot continue until blockers are resolved.',
  },
  {
    code: 'exchange.export_failed',
    legacy_aliases: ['trusted_exchange_export_failed'],
    default_severity: 'error',
    category: 'storage',
    retryability: 'unknown',
    user_title: 'Export failed',
    user_message: 'Export failed while reading from the archive.',
  },
  {
    code: 'exchange.feature_not_ready',
    legacy_aliases: ['trusted_exchange_export_options_not_expanded_yet', 'trusted_exchange_bundle_normalization_unavailable'],
    default_severity: 'warning',
    category: 'blocked_dependency',
    retryability: 'unknown',
    user_title: 'Exchange feature not ready',
    user_message: 'This Exchange feature is not fully implemented yet.',
  },
  {
    code: 'exchange.compare_failed',
    legacy_aliases: ['trusted_exchange_local_compare_failed'],
    default_severity: 'warning',
    category: 'conflict',
    retryability: 'unknown',
    user_title: 'Exchange comparison failed',
    user_message: 'Local comparison failed while planning exchange work.',
  },
  {
    code: 'exchange.archive_audit_failed',
    legacy_aliases: ['trusted_exchange_archive_audit_failed'],
    default_severity: 'error',
    category: 'storage',
    retryability: 'retryable',
    user_title: 'Archive audit failed',
    user_message: 'Exchange could not confirm Archive readiness.',
  },
  {
    code: 'exchange.archive_import_failed',
    legacy_aliases: ['trusted_exchange_archive_import_failed'],
    default_severity: 'error',
    category: 'storage',
    retryability: 'unknown',
    user_title: 'Archive import failed',
    user_message: 'Archive import failed during Exchange commit.',
  },
  {
    code: 'exchange.archive_import_mismatch',
    legacy_aliases: [
      'trusted_exchange_archive_import_unexpected_count',
      'trusted_exchange_archive_import_missing_revision',
    ],
    default_severity: 'error',
    category: 'storage',
    retryability: 'unknown',
    user_title: 'Archive import mismatch',
    user_message: 'Archive import results did not match the Exchange commit plan.',
  },
  {
    code: 'exchange.archive_import_skipped',
    legacy_aliases: ['trusted_exchange_archive_import_skipped_planned_revision'],
    default_severity: 'warning',
    category: 'storage',
    retryability: 'unknown',
    user_title: 'Archive import skipped planned revision',
    user_message: 'Archive imported fewer revisions than Exchange accepted, but accepted keys resolved locally.',
  },
  {
    code: 'verification.packet_missing',
    legacy_aliases: ['trusted_verification_packet_missing', 'trusted_verification_archive_packet_missing'],
    default_severity: 'error',
    category: 'not_found',
    retryability: 'unknown',
    user_title: 'Packet missing',
    user_message: 'The packet could not be found for verification.',
  },
  {
    code: 'verification.packet_structural_invalid',
    legacy_aliases: ['trusted_verification_packet_structural_invalid'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Packet structure invalid',
    user_message: 'The packet failed structural verification.',
  },
  {
    code: 'verification.archive_set_empty',
    legacy_aliases: ['trusted_verification_archive_set_empty'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Archive set empty',
    user_message: 'No packets were available for archive-set verification.',
  },
  {
    code: 'verification.certification_result_blocked',
    legacy_aliases: ['trusted_verification_certification_result_blocked'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Certification result blocked',
    user_message: 'Verification could not continue because certification was blocked.',
  },
  {
    code: 'projection.packet_type_unknown',
    legacy_aliases: ['unknown_projection_packet_type'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Projection packet type unknown',
    user_message: 'No projection descriptor exists for this packet type.',
  },
  {
    code: 'projection.descriptor_unknown',
    legacy_aliases: ['unknown_projection_descriptor', 'trusted_projection_descriptor_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Projection descriptor missing',
    user_message: 'The requested projection descriptor is unavailable.',
  },
  {
    code: 'projection.packet_invalid',
    legacy_aliases: ['projection_archive_packet_invalid'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Projection packet invalid',
    user_message: 'The archived packet could not be projected.',
  },
  {
    code: 'regulation.definition_missing',
    legacy_aliases: ['trusted_regulation_definition_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Regulation definition missing',
    user_message: 'Regulation could not continue because a required definition is missing.',
  },
  {
    code: 'regulation.required_parts_missing',
    legacy_aliases: ['required_definition_parts_missing'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Regulation parts missing',
    user_message: 'The policy context is missing required definition parts.',
  },
  {
    code: 'dispatch.missing_source_route',
    legacy_aliases: ['trusted_request_missing_source_route'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Missing source route',
    user_message: 'The dispatch request did not include a source route.',
  },
  {
    code: 'dispatch.intent_unidentified',
    legacy_aliases: ['trusted_request_unidentified_intent'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Intent unidentified',
    user_message: 'The dispatch request could not identify a client intent.',
  },
  {
    code: 'dispatch.write_pipeline_not_ready',
    legacy_aliases: [],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Write pipeline not ready',
    user_message: 'The dispatch write pipeline cannot complete this enrolled write yet.',
  },
  {
    code: 'dispatch.certification_payload_unsupported',
    legacy_aliases: [],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Certification payload unsupported',
    user_message: 'The finalize payload does not match the Certification signed-return contract.',
  },
  {
    code: 'resolution.required_value_missing',
    legacy_aliases: ['required_resolution_value_missing'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Resolution value missing',
    user_message: 'A required resolution value was missing.',
  },
  {
    code: 'resolution.preset_unknown',
    legacy_aliases: ['unknown_resolution_preset'],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Resolution preset unknown',
    user_message: 'The requested resolution preset is unknown.',
  },
  {
    code: 'workflow.alignment_missing',
    legacy_aliases: ['missing_workflow_alignment', 'workflow_not_ready', 'workflow_plan_mismatch', 'operation_kind_mismatch'],
    default_severity: 'error',
    category: 'blocked_dependency',
    retryability: 'not_retryable',
    user_title: 'Workflow alignment missing',
    user_message: 'The workflow is not aligned with the trusted definition plan.',
  },
  {
    code: 'workflow.metadata_incomplete',
    legacy_aliases: [
      'incomplete_live_generic_metadata',
      'unknown_phase_reference',
      'unknown_operation_kind',
      'unknown_policy_action',
      'unknown_dependency',
      'phase_order_incomplete',
      'unknown_adapter',
      'unknown_live_composite_adapter',
      'incomplete_live_composite_metadata',
    ],
    default_severity: 'error',
    category: 'validation',
    retryability: 'not_retryable',
    user_title: 'Workflow metadata incomplete',
    user_message: 'The workflow metadata is incomplete or references unknown parts.',
  },
] as const satisfies readonly TrustedIssueDescriptor[];

const CANONICAL_BY_CODE = new Map<string, TrustedIssueDescriptor>();
const CANONICAL_BY_ALIAS = new Map<string, TrustedIssueDescriptor>();

for (const descriptor of TRUSTED_ISSUE_DESCRIPTORS) {
  CANONICAL_BY_CODE.set(descriptor.code, descriptor);
  for (const alias of descriptor.legacy_aliases) {
    CANONICAL_BY_ALIAS.set(alias, descriptor);
  }
}

export function listTrustedIssueDescriptors(): TrustedIssueDescriptor[] {
  return TRUSTED_ISSUE_DESCRIPTORS.map((descriptor) => ({
    ...descriptor,
    legacy_aliases: [...descriptor.legacy_aliases],
  }));
}

export function resolveTrustedIssueDescriptor(code: string): TrustedIssueDescriptor | null {
  return CANONICAL_BY_CODE.get(code) ?? CANONICAL_BY_ALIAS.get(code) ?? null;
}

export function toCanonicalTrustedIssueCode(code: string): string {
  return resolveTrustedIssueDescriptor(code)?.code ?? code;
}

export function isCanonicalTrustedIssueCode(code: string): boolean {
  return CANONICAL_BY_CODE.has(code);
}

export function isKnownTrustedIssueCode(code: string): boolean {
  return CANONICAL_BY_CODE.has(code) || CANONICAL_BY_ALIAS.has(code);
}

export function normalizeTrustedIssue(
  issue: TrustedRuntimeCoordinatorIssue
): TrustedRuntimeCoordinatorIssue {
  return {
    ...issue,
    code: toCanonicalTrustedIssueCode(issue.code),
  };
}
