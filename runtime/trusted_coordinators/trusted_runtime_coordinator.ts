/**
 * File: trusted_runtime_coordinator.ts
 * Description: Shared trusted-runtime coordinator result contract and helpers.
 */

export type TrustedRuntimeCoordinatorKind =
  | 'resolution'
  | 'builder'
  | 'defaults'
  | 'dependency'
  | 'policy'
  | 'projection'
  | 'workflow'
  | 'composite_workflow';

export type TrustedRuntimeCoordinatorStatus =
  | 'ok'
  | 'partial'
  | 'blocked'
  | 'error';

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
};

export function createTrustedRuntimeCoordinatorResult<TValue>(input: {
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  value: TValue | null;
  issues?: readonly TrustedRuntimeCoordinatorIssue[];
  trace?: readonly TrustedRuntimeCoordinatorTraceEntry[];
  status?: TrustedRuntimeCoordinatorStatus;
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
  };
}

export function trustedIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return input;
}
