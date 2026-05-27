/**
 * File: trusted_runtime_coordinator.ts
 * Description: Shared trusted-runtime coordinator result contract, envelope helpers, and scaffold metadata types.
 */

export type TrustedRuntimeCoordinatorKind =
  | 'request'
  | 'dispatch'
  | 'definition'
  | 'regulation'
  | 'planning'
  | 'building'
  | 'projection'
  | 'resolution'
  | 'inspection'
  | 'testing'
  | 'verification'
  | 'certification'
  | 'archive'
  | 'archival'
  | 'import'
  | 'export'
  | 'compatibility'
  | 'exchange'
  | 'workflow'
  | 'composite_workflow'
  // Transitional aliases used by older coordinator files until they are foldered.
  | 'builder'
  | 'defaults'
  | 'dependency'
  | 'policy';

export type TrustedRuntimeCoordinatorStatus =
  | 'ok'
  | 'partial'
  | 'blocked'
  | 'error';

export type TrustedRuntimeCoordinatorMode =
  | 'normal_runtime'
  | 'reseed'
  | 'import_preview'
  | 'compatibility_read'
  | 'migration'
  | 'debug_audit';

export type TrustedRuntimeCoordinatorIssue = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  path: string;
  message: string;
};

export type TrustedRuntimeCoordinatorTraceEntry = {
  step_id: string;
  coordinator_id: string;
  preset_ids: readonly string[];
  status: TrustedRuntimeCoordinatorStatus;
  notes: string;
};

export type TrustedRuntimeCoordinatorResult<TValue> = {
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  status: TrustedRuntimeCoordinatorStatus;
  value: TValue | null;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
  operation_id?: string | null;
  request_id?: string | null;
  mode?: TrustedRuntimeCoordinatorMode | string | null;
};

export type TrustedRuntimeCoordinatorPublicMethod = {
  method_name: string;
  notes: string;
};

export type TrustedRuntimeCoordinatorScaffoldDescriptor = {
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  public_object_name: string;
  public_import_path: string;
  runtime_path: string;
  structure: 'foldered_gated' | 'legacy_flat' | 'planned';
  expected_methods: readonly TrustedRuntimeCoordinatorPublicMethod[];
  notes: string;
};

export function createTrustedRuntimeCoordinatorResult<TValue>(input: {
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  value: TValue | null;
  issues?: readonly TrustedRuntimeCoordinatorIssue[];
  trace?: readonly TrustedRuntimeCoordinatorTraceEntry[];
  status?: TrustedRuntimeCoordinatorStatus;
  operation_id?: string | null;
  request_id?: string | null;
  mode?: TrustedRuntimeCoordinatorMode | string | null;
}): TrustedRuntimeCoordinatorResult<TValue> {
  const issues = [...(input.issues ?? [])];
  const status =
    input.status ??
    (issues.some((issue) => issue.severity === 'error')
      ? 'error'
      : issues.some((issue) => issue.severity === 'warning')
        ? 'partial'
        : 'ok');

  return {
    coordinator_id: input.coordinator_id,
    coordinator_kind: input.coordinator_kind,
    status,
    value: input.value,
    issues,
    trace: [...(input.trace ?? [])],
    operation_id: input.operation_id ?? null,
    request_id: input.request_id ?? null,
    mode: input.mode ?? null,
  };
}

export function trustedIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return input;
}

export function hasBlockingTrustedIssue(issues: readonly TrustedRuntimeCoordinatorIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function createTrustedTraceEntry(input: {
  step_id: string;
  coordinator_id: string;
  preset_ids?: readonly string[];
  status?: TrustedRuntimeCoordinatorStatus;
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return {
    step_id: input.step_id,
    coordinator_id: input.coordinator_id,
    preset_ids: [...(input.preset_ids ?? [])],
    status: input.status ?? 'ok',
    notes: input.notes,
  };
}
