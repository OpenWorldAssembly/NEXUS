/**
 * File: trusted_exchange_coordinator.ts
 * Description: Gated public Trusted Exchange Coordinator surface for packet movement previews, plans, exports, merges, and rebundles.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedExchangeOperation } from './trusted_exchange_registry.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type AuditTrustedExchangeReadinessInput,
  type CommitTrustedImportInput,
  type ExportTrustedPacketSetInput,
  type PlanTrustedImportCommitInput,
  type PlanTrustedMergeInput,
  type PreviewTrustedImportInput,
  type PreviewTrustedRebundleInput,
  type TrustedExchangeExportPacketSet,
  type TrustedExchangeImportCommit,
  type TrustedExchangeImportCommitPlan,
  type TrustedExchangeImportPreview,
  type TrustedExchangeMergePlan,
  type TrustedExchangeReadinessReport,
  type TrustedExchangeRebundlePreview,
} from './trusted_exchange_types.ts';

function castPromise<TValue>(
  result: Promise<TrustedRuntimeCoordinatorResult<unknown>>
): Promise<TrustedRuntimeCoordinatorResult<TValue>> {
  return result as Promise<TrustedRuntimeCoordinatorResult<TValue>>;
}

export const trustedExchangeCoordinator = {
  id: 'trusted_exchange_coordinator.v0',

  previewImport(
    input: PreviewTrustedImportInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportPreview>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'preview_import',
      input,
    }));
  },

  planImportCommit(
    input: PlanTrustedImportCommitInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportCommitPlan>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'plan_import_commit',
      input,
    }));
  },

  commitImport(
    input: CommitTrustedImportInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportCommit>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'commit_import',
      input,
    }));
  },

  exportPacketSet(
    input: ExportTrustedPacketSetInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeExportPacketSet>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'export_packet_set',
      input,
    }));
  },

  planMerge(
    input: PlanTrustedMergeInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeMergePlan>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'plan_merge',
      input,
    }));
  },

  previewRebundle(
    input: PreviewTrustedRebundleInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeRebundlePreview>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'preview_rebundle',
      input,
    }));
  },

  auditReadiness(
    input?: AuditTrustedExchangeReadinessInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeReadinessReport>> {
    return castPromise(runTrustedExchangeOperation({
      operation: 'audit_readiness',
      input,
    }));
  },
} as const satisfies {
  id: typeof TRUSTED_EXCHANGE_COORDINATOR_ID;
  previewImport(input: PreviewTrustedImportInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportPreview>>;
  planImportCommit(input: PlanTrustedImportCommitInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportCommitPlan>>;
  commitImport(input: CommitTrustedImportInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportCommit>>;
  exportPacketSet(input: ExportTrustedPacketSetInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeExportPacketSet>>;
  planMerge(input: PlanTrustedMergeInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeMergePlan>>;
  previewRebundle(input: PreviewTrustedRebundleInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeRebundlePreview>>;
  auditReadiness(input?: AuditTrustedExchangeReadinessInput): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeReadinessReport>>;
};
