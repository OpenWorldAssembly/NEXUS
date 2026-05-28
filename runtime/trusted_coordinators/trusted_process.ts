/**
 * File: trusted_process.ts
 * Description: Lightweight trusted-runtime process chain records and conversion helpers.
 */

import {
  createTrustedTraceEntry,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorKind,
  type TrustedRuntimeCoordinatorMode,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from './trusted_runtime_coordinator.ts';
import { randomUUID } from 'node:crypto';
import {
  normalizeTrustedIssue,
  resolveTrustedIssueDescriptor,
  type TrustedIssueCategory,
  type TrustedIssueRetryability,
} from './trusted_issue_taxonomy.ts';

export type TrustedProcessCompletionPolicy =
  | 'preserve_partial'
  | 'atomic_required'
  | 'dry_run_only'
  | 'coordinator_defined';

export type TrustedProcessWorkSummary = {
  work_id: string;
  label: string;
  artifact_id?: string | null;
  packet_id?: string | null;
  revision_id?: string | null;
  count?: number | null;
  notes?: string | null;
};

export type TrustedProcessBlockedWork = TrustedProcessWorkSummary & {
  reason_code: string;
};

export type TrustedProcessArtifact = {
  artifact_id: string;
  artifact_kind: string;
  label: string;
  packet_id?: string | null;
  revision_id?: string | null;
  count?: number | null;
  redacted?: boolean;
};

export type TrustedProcessIssue = TrustedRuntimeCoordinatorIssue & {
  canonical_code: string;
  original_code: string;
  category: TrustedIssueCategory | 'unknown';
  retryability: TrustedIssueRetryability;
  user_title: string;
  user_message: string;
};

export type TrustedProcessStage = {
  stage_id: string;
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  operation_name: string;
  status: TrustedRuntimeCoordinatorStatus;
  started_at: string;
  completed_at: string | null;
  preset_ids: string[];
  notes: string | null;
  issue_codes: string[];
  artifacts: TrustedProcessArtifact[];
  completed_work: TrustedProcessWorkSummary[];
  failed_work: TrustedProcessWorkSummary[];
  blocked_work: TrustedProcessBlockedWork[];
  skipped_work: TrustedProcessWorkSummary[];
  child_chain_ids: string[];
};

export type TrustedProcessChain = {
  chain_kind: 'trusted.process_chain';
  chain_id: string;
  root_stage_id: string | null;
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  operation_name: string;
  status: TrustedRuntimeCoordinatorStatus;
  mode: TrustedRuntimeCoordinatorMode | string | null;
  request_id: string | null;
  operation_id: string | null;
  completion_policy: TrustedProcessCompletionPolicy;
  started_at: string;
  completed_at: string | null;
  stages: TrustedProcessStage[];
  issues: TrustedProcessIssue[];
  artifacts: TrustedProcessArtifact[];
  child_chains: TrustedProcessChain[];
};

export type TrustedProcessSummary = {
  chain_id: string;
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  operation_name: string;
  status: TrustedRuntimeCoordinatorStatus;
  issue_count: number;
  error_count: number;
  warning_count: number;
  stage_count: number;
  completed_work_count: number;
  failed_work_count: number;
  blocked_work_count: number;
  skipped_work_count: number;
  primary_issue: TrustedProcessIssue | null;
};

export type TrustedProcessReportDraft = {
  report_kind: 'trusted.process_report_draft';
  summary: TrustedProcessSummary;
  summary_markdown: string;
  report_data: {
    chain_id: string;
    status: TrustedRuntimeCoordinatorStatus;
    coordinator_id: string;
    coordinator_kind: TrustedRuntimeCoordinatorKind;
    operation_name: string;
    issue_codes: string[];
    stage_ids: string[];
    child_chain_ids: string[];
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}:${randomUUID()}`;
}

function deriveStatusFromIssues(
  issues: readonly TrustedRuntimeCoordinatorIssue[],
  fallback: TrustedRuntimeCoordinatorStatus = 'ok'
): TrustedRuntimeCoordinatorStatus {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'error';
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'partial';
  }
  return fallback;
}

function processIssueFromRuntimeIssue(issue: TrustedRuntimeCoordinatorIssue): TrustedProcessIssue {
  const descriptor = resolveTrustedIssueDescriptor(issue.code);
  const normalized = normalizeTrustedIssue(issue);

  return {
    ...normalized,
    original_code: issue.code,
    canonical_code: normalized.code,
    category: descriptor?.category ?? 'unknown',
    retryability: descriptor?.retryability ?? 'unknown',
    user_title: descriptor?.user_title ?? 'Runtime issue',
    user_message: descriptor?.user_message ?? issue.message,
  };
}

function cloneStage(stage: TrustedProcessStage): TrustedProcessStage {
  return {
    ...stage,
    preset_ids: [...stage.preset_ids],
    issue_codes: [...stage.issue_codes],
    artifacts: stage.artifacts.map((artifact) => ({ ...artifact })),
    completed_work: stage.completed_work.map((work) => ({ ...work })),
    failed_work: stage.failed_work.map((work) => ({ ...work })),
    blocked_work: stage.blocked_work.map((work) => ({ ...work })),
    skipped_work: stage.skipped_work.map((work) => ({ ...work })),
    child_chain_ids: [...stage.child_chain_ids],
  };
}

export function createTrustedProcessChain(input: {
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  operation_name: string;
  completion_policy?: TrustedProcessCompletionPolicy;
  chain_id?: string;
  mode?: TrustedRuntimeCoordinatorMode | string | null;
  request_id?: string | null;
  operation_id?: string | null;
  started_at?: string;
}): TrustedProcessChain {
  const startedAt = input.started_at ?? nowIso();

  return {
    chain_kind: 'trusted.process_chain',
    chain_id: input.chain_id ?? createId('trusted-process'),
    root_stage_id: null,
    coordinator_id: input.coordinator_id,
    coordinator_kind: input.coordinator_kind,
    operation_name: input.operation_name,
    status: 'ok',
    mode: input.mode ?? null,
    request_id: input.request_id ?? null,
    operation_id: input.operation_id ?? null,
    completion_policy: input.completion_policy ?? 'coordinator_defined',
    started_at: startedAt,
    completed_at: null,
    stages: [],
    issues: [],
    artifacts: [],
    child_chains: [],
  };
}

export function startTrustedProcessStage(input: {
  stage_id: string;
  coordinator_id: string;
  coordinator_kind: TrustedRuntimeCoordinatorKind;
  operation_name: string;
  preset_ids?: readonly string[];
  notes?: string | null;
  started_at?: string;
}): TrustedProcessStage {
  return {
    stage_id: input.stage_id,
    coordinator_id: input.coordinator_id,
    coordinator_kind: input.coordinator_kind,
    operation_name: input.operation_name,
    status: 'ok',
    started_at: input.started_at ?? nowIso(),
    completed_at: null,
    preset_ids: [...(input.preset_ids ?? [])],
    notes: input.notes ?? null,
    issue_codes: [],
    artifacts: [],
    completed_work: [],
    failed_work: [],
    blocked_work: [],
    skipped_work: [],
    child_chain_ids: [],
  };
}

export function completeTrustedProcessStage(
  stage: TrustedProcessStage,
  input: {
    status?: TrustedRuntimeCoordinatorStatus;
    issues?: readonly TrustedRuntimeCoordinatorIssue[];
    artifacts?: readonly TrustedProcessArtifact[];
    completed_work?: readonly TrustedProcessWorkSummary[];
    failed_work?: readonly TrustedProcessWorkSummary[];
    blocked_work?: readonly TrustedProcessBlockedWork[];
    skipped_work?: readonly TrustedProcessWorkSummary[];
    child_chain_ids?: readonly string[];
    notes?: string | null;
    completed_at?: string;
  } = {}
): TrustedProcessStage {
  const normalizedIssues = (input.issues ?? []).map((issue) => processIssueFromRuntimeIssue(issue));

  return {
    ...cloneStage(stage),
    status: input.status ?? deriveStatusFromIssues(normalizedIssues, stage.status),
    completed_at: input.completed_at ?? nowIso(),
    notes: input.notes ?? stage.notes,
    issue_codes: [
      ...stage.issue_codes,
      ...normalizedIssues.map((issue) => issue.canonical_code),
    ],
    artifacts: [
      ...stage.artifacts.map((artifact) => ({ ...artifact })),
      ...(input.artifacts ?? []).map((artifact) => ({ ...artifact })),
    ],
    completed_work: [
      ...stage.completed_work.map((work) => ({ ...work })),
      ...(input.completed_work ?? []).map((work) => ({ ...work })),
    ],
    failed_work: [
      ...stage.failed_work.map((work) => ({ ...work })),
      ...(input.failed_work ?? []).map((work) => ({ ...work })),
    ],
    blocked_work: [
      ...stage.blocked_work.map((work) => ({ ...work })),
      ...(input.blocked_work ?? []).map((work) => ({ ...work })),
    ],
    skipped_work: [
      ...stage.skipped_work.map((work) => ({ ...work })),
      ...(input.skipped_work ?? []).map((work) => ({ ...work })),
    ],
    child_chain_ids: [
      ...stage.child_chain_ids,
      ...(input.child_chain_ids ?? []),
    ],
  };
}

export function failTrustedProcessStage(
  stage: TrustedProcessStage,
  input: Parameters<typeof completeTrustedProcessStage>[1] = {}
): TrustedProcessStage {
  return completeTrustedProcessStage(stage, {
    ...input,
    status: input.status ?? 'error',
  });
}

export function appendTrustedProcessStage(
  chain: TrustedProcessChain,
  stage: TrustedProcessStage,
  input: {
    issues?: readonly TrustedRuntimeCoordinatorIssue[];
    child_chains?: readonly TrustedProcessChain[];
  } = {}
): TrustedProcessChain {
  const stageIssues = (input.issues ?? []).map((issue) => processIssueFromRuntimeIssue(issue));
  const stageArtifacts = stage.artifacts.map((artifact) => ({ ...artifact }));
  const childChains = (input.child_chains ?? []).map(cloneTrustedProcessChain);
  const childIssues = childChains.flatMap((child) => child.issues.map((issue) => ({ ...issue })));
  const allIssues = [...chain.issues.map((issue) => ({ ...issue })), ...stageIssues, ...childIssues];
  const allStages = [...chain.stages.map(cloneStage), cloneStage(stage)];
  const status = deriveStatusFromIssues(allIssues, stage.status === 'blocked' ? 'blocked' : stage.status);

  return {
    ...cloneTrustedProcessChain(chain),
    root_stage_id: chain.root_stage_id ?? stage.stage_id,
    status,
    stages: allStages,
    issues: allIssues,
    artifacts: [
      ...chain.artifacts.map((artifact) => ({ ...artifact })),
      ...stageArtifacts,
      ...childChains.flatMap((child) => child.artifacts.map((artifact) => ({ ...artifact }))),
    ],
    child_chains: [
      ...chain.child_chains.map(cloneTrustedProcessChain),
      ...childChains,
    ],
  };
}

export function completeTrustedProcessChain(
  chain: TrustedProcessChain,
  input: {
    status?: TrustedRuntimeCoordinatorStatus;
    completed_at?: string;
  } = {}
): TrustedProcessChain {
  return {
    ...cloneTrustedProcessChain(chain),
    status: input.status ?? deriveStatusFromIssues(chain.issues, chain.status),
    completed_at: input.completed_at ?? nowIso(),
  };
}

export function appendTrustedChildResult(
  chain: TrustedProcessChain,
  result: TrustedRuntimeCoordinatorResult<unknown>,
  input: {
    stage_id: string;
    operation_name: string;
    notes?: string | null;
  }
): TrustedProcessChain {
  const childChain = result.process_chain;
  const stage = completeTrustedProcessStage(
    startTrustedProcessStage({
      stage_id: input.stage_id,
      coordinator_id: result.coordinator_id,
      coordinator_kind: result.coordinator_kind,
      operation_name: input.operation_name,
      notes: input.notes ?? null,
    }),
    {
      status: result.status,
      issues: result.issues,
      child_chain_ids: childChain ? [childChain.chain_id] : [],
    }
  );

  return appendTrustedProcessStage(chain, stage, {
    issues: result.issues,
    child_chains: childChain ? [childChain] : [],
  });
}

export function flattenTrustedProcessIssues(
  chain: TrustedProcessChain | null | undefined
): TrustedProcessIssue[] {
  if (!chain) {
    return [];
  }

  return [
    ...chain.issues.map((issue) => ({ ...issue })),
    ...chain.child_chains.flatMap(flattenTrustedProcessIssues),
  ];
}

export function getPrimaryTrustedIssue(
  chainOrIssues: TrustedProcessChain | readonly TrustedProcessIssue[] | null | undefined
): TrustedProcessIssue | null {
  const issues = Array.isArray(chainOrIssues)
    ? [...chainOrIssues]
    : flattenTrustedProcessIssues(chainOrIssues as TrustedProcessChain | null | undefined);

  return (
    issues.find((issue) => issue.severity === 'error') ??
    issues.find((issue) => issue.severity === 'warning') ??
    issues[0] ??
    null
  );
}

export function summarizeTrustedProcessChain(chain: TrustedProcessChain): TrustedProcessSummary {
  const issues = flattenTrustedProcessIssues(chain);
  const stages = [
    ...chain.stages,
    ...chain.child_chains.flatMap((child) => child.stages),
  ];

  return {
    chain_id: chain.chain_id,
    coordinator_id: chain.coordinator_id,
    coordinator_kind: chain.coordinator_kind,
    operation_name: chain.operation_name,
    status: chain.status,
    issue_count: issues.length,
    error_count: issues.filter((issue) => issue.severity === 'error').length,
    warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    stage_count: stages.length,
    completed_work_count: stages.reduce((count, stage) => count + stage.completed_work.length, 0),
    failed_work_count: stages.reduce((count, stage) => count + stage.failed_work.length, 0),
    blocked_work_count: stages.reduce((count, stage) => count + stage.blocked_work.length, 0),
    skipped_work_count: stages.reduce((count, stage) => count + stage.skipped_work.length, 0),
    primary_issue: getPrimaryTrustedIssue(issues),
  };
}

export function toTrustedRuntimeIssues(chain: TrustedProcessChain | null | undefined): TrustedRuntimeCoordinatorIssue[] {
  return flattenTrustedProcessIssues(chain).map((issue) => ({
    severity: issue.severity,
    code: issue.canonical_code,
    path: issue.path,
    message: issue.message,
  }));
}

export function toTrustedRuntimeTrace(chain: TrustedProcessChain | null | undefined): TrustedRuntimeCoordinatorTraceEntry[] {
  if (!chain) {
    return [];
  }

  return chain.stages.map((stage) => createTrustedTraceEntry({
    step_id: stage.stage_id,
    coordinator_id: stage.coordinator_id,
    preset_ids: stage.preset_ids,
    status: stage.status,
    notes: stage.notes ?? `Trusted process stage ${stage.operation_name}.`,
  }));
}

export function createTrustedProcessReportDraft(chain: TrustedProcessChain): TrustedProcessReportDraft {
  const summary = summarizeTrustedProcessChain(chain);
  const issueCodes = flattenTrustedProcessIssues(chain).map((issue) => issue.canonical_code);
  const stageIds = chain.stages.map((stage) => stage.stage_id);
  const childChainIds = chain.child_chains.map((child) => child.chain_id);
  const primaryIssue = summary.primary_issue;
  const lines = [
    `Trusted process ${chain.operation_name}: ${chain.status}`,
    '',
    `Coordinator: ${chain.coordinator_id}`,
    `Stages: ${summary.stage_count}`,
    `Issues: ${summary.issue_count}`,
    primaryIssue ? `Primary issue: ${primaryIssue.canonical_code} - ${primaryIssue.user_title}` : 'Primary issue: none',
  ];

  return {
    report_kind: 'trusted.process_report_draft',
    summary,
    summary_markdown: lines.join('\n'),
    report_data: {
      chain_id: chain.chain_id,
      status: chain.status,
      coordinator_id: chain.coordinator_id,
      coordinator_kind: chain.coordinator_kind,
      operation_name: chain.operation_name,
      issue_codes: issueCodes,
      stage_ids: stageIds,
      child_chain_ids: childChainIds,
    },
  };
}

export function cloneTrustedProcessChain(chain: TrustedProcessChain): TrustedProcessChain {
  return {
    ...chain,
    stages: chain.stages.map(cloneStage),
    issues: chain.issues.map((issue) => ({ ...issue })),
    artifacts: chain.artifacts.map((artifact) => ({ ...artifact })),
    child_chains: chain.child_chains.map(cloneTrustedProcessChain),
  };
}
