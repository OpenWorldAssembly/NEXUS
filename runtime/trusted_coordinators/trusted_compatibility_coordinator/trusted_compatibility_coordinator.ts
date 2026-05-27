/**
 * File: trusted_compatibility_coordinator.ts
 * Description: Gated public Trusted Compatibility Coordinator surface for runtime schema compatibility decisions.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedCompatibilityOperation } from './trusted_compatibility_registry.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type AdaptTrustedPacketForReadInput,
  type AuditTrustedCompatibilityCoverageInput,
  type AuditTrustedCompatibilityReadinessInput,
  type PrepareTrustedPacketForWriteInput,
  type ResolveTrustedAdapterPathInput,
  type ResolveTrustedCompatibilityProfileInput,
  type ResolveTrustedPacketCompatibilityInput,
  type TrustedAdapterPathResolution,
  type TrustedCompatibilityCoverageAudit,
  type TrustedCompatibilityProfile,
  type TrustedCompatibilityReadinessReport,
  type TrustedCompatibilityReadResult,
  type TrustedCompatibilityWritePreparation,
  type TrustedPacketCompatibilityResolution,
} from './trusted_compatibility_types.ts';

function castResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<unknown>
): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedCompatibilityCoordinator = {
  id: 'trusted_compatibility_coordinator.v0',

  resolvePacketCompatibility(
    input: ResolveTrustedPacketCompatibilityInput
  ): TrustedRuntimeCoordinatorResult<TrustedPacketCompatibilityResolution> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'resolve_packet_compatibility',
      input,
    }));
  },

  adaptPacketForRead(
    input: AdaptTrustedPacketForReadInput
  ): TrustedRuntimeCoordinatorResult<TrustedCompatibilityReadResult> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'adapt_packet_for_read',
      input,
    }));
  },

  preparePacketForWrite(
    input: PrepareTrustedPacketForWriteInput
  ): TrustedRuntimeCoordinatorResult<TrustedCompatibilityWritePreparation> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'prepare_packet_for_write',
      input,
    }));
  },

  resolveAdapterPath(
    input: ResolveTrustedAdapterPathInput
  ): TrustedRuntimeCoordinatorResult<TrustedAdapterPathResolution> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'resolve_adapter_path',
      input,
    }));
  },

  resolveCompatibilityProfile(
    input: ResolveTrustedCompatibilityProfileInput
  ): TrustedRuntimeCoordinatorResult<TrustedCompatibilityProfile> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'resolve_compatibility_profile',
      input,
    }));
  },

  auditCompatibilityCoverage(
    input?: AuditTrustedCompatibilityCoverageInput
  ): TrustedRuntimeCoordinatorResult<TrustedCompatibilityCoverageAudit> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'audit_compatibility_coverage',
      input,
    }));
  },

  auditReadiness(
    input?: AuditTrustedCompatibilityReadinessInput
  ): TrustedRuntimeCoordinatorResult<TrustedCompatibilityReadinessReport> {
    return castResult(runTrustedCompatibilityOperation({
      operation: 'audit_readiness',
      input,
    }));
  },
} as const satisfies {
  id: typeof TRUSTED_COMPATIBILITY_COORDINATOR_ID;
  resolvePacketCompatibility(input: ResolveTrustedPacketCompatibilityInput): TrustedRuntimeCoordinatorResult<TrustedPacketCompatibilityResolution>;
  adaptPacketForRead(input: AdaptTrustedPacketForReadInput): TrustedRuntimeCoordinatorResult<TrustedCompatibilityReadResult>;
  preparePacketForWrite(input: PrepareTrustedPacketForWriteInput): TrustedRuntimeCoordinatorResult<TrustedCompatibilityWritePreparation>;
  resolveAdapterPath(input: ResolveTrustedAdapterPathInput): TrustedRuntimeCoordinatorResult<TrustedAdapterPathResolution>;
  resolveCompatibilityProfile(input: ResolveTrustedCompatibilityProfileInput): TrustedRuntimeCoordinatorResult<TrustedCompatibilityProfile>;
  auditCompatibilityCoverage(input?: AuditTrustedCompatibilityCoverageInput): TrustedRuntimeCoordinatorResult<TrustedCompatibilityCoverageAudit>;
  auditReadiness(input?: AuditTrustedCompatibilityReadinessInput): TrustedRuntimeCoordinatorResult<TrustedCompatibilityReadinessReport>;
};
