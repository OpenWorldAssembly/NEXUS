/**
 * File: trusted_exchange_registry.ts
 * Description: Internal operation registry for the Trusted Exchange Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { auditTrustedExchangeReadiness } from './functions/audit_trusted_exchange_readiness.ts';
import { exportTrustedPacketSet } from './functions/export_packet_set.ts';
import { planTrustedImportCommit } from './functions/plan_import_commit.ts';
import { planTrustedMerge } from './functions/plan_merge.ts';
import { previewTrustedImport } from './functions/preview_import.ts';
import { previewTrustedRebundle } from './functions/preview_rebundle.ts';
import type { TrustedExchangeCoordinatorRequest } from './trusted_exchange_types.ts';

type TrustedExchangeHandler = (
  request: TrustedExchangeCoordinatorRequest
) => Promise<TrustedRuntimeCoordinatorResult<unknown>>;

const TRUSTED_EXCHANGE_REGISTRY: Record<
  TrustedExchangeCoordinatorRequest['operation'],
  TrustedExchangeHandler
> = {
  preview_import: async (request) => {
    if (request.operation !== 'preview_import') {
      throw new Error('Invalid Trusted Exchange operation dispatch.');
    }
    return previewTrustedImport(request.input);
  },
  plan_import_commit: async (request) => {
    if (request.operation !== 'plan_import_commit') {
      throw new Error('Invalid Trusted Exchange operation dispatch.');
    }
    return planTrustedImportCommit(request.input);
  },
  export_packet_set: async (request) => {
    if (request.operation !== 'export_packet_set') {
      throw new Error('Invalid Trusted Exchange operation dispatch.');
    }
    return exportTrustedPacketSet(request.input);
  },
  plan_merge: async (request) => {
    if (request.operation !== 'plan_merge') {
      throw new Error('Invalid Trusted Exchange operation dispatch.');
    }
    return planTrustedMerge(request.input);
  },
  preview_rebundle: async (request) => {
    if (request.operation !== 'preview_rebundle') {
      throw new Error('Invalid Trusted Exchange operation dispatch.');
    }
    return previewTrustedRebundle(request.input);
  },
  audit_readiness: async (request) => {
    if (request.operation !== 'audit_readiness') {
      throw new Error('Invalid Trusted Exchange operation dispatch.');
    }
    return auditTrustedExchangeReadiness(request.input);
  },
};

export function runTrustedExchangeOperation(
  request: TrustedExchangeCoordinatorRequest
): Promise<TrustedRuntimeCoordinatorResult<unknown>> {
  return TRUSTED_EXCHANGE_REGISTRY[request.operation](request);
}
