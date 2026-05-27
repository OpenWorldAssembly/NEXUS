/**
 * File: trusted_compatibility_registry.ts
 * Description: Internal operation registry for the Trusted Compatibility Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { adaptTrustedPacketForRead } from './functions/adapt_packet_for_read.ts';
import { auditTrustedCompatibilityCoverage } from './functions/audit_compatibility_coverage.ts';
import { auditTrustedCompatibilityReadiness } from './functions/audit_trusted_compatibility_readiness.ts';
import { prepareTrustedPacketForWrite } from './functions/prepare_packet_for_write.ts';
import { resolveTrustedAdapterPath } from './functions/resolve_adapter_path.ts';
import { resolveTrustedCompatibilityProfile } from './functions/resolve_compatibility_profile.ts';
import { resolveTrustedPacketCompatibility } from './functions/resolve_packet_compatibility.ts';
import type { TrustedCompatibilityCoordinatorRequest } from './trusted_compatibility_types.ts';

type TrustedCompatibilityHandler = (
  request: TrustedCompatibilityCoordinatorRequest
) => TrustedRuntimeCoordinatorResult<unknown>;

const TRUSTED_COMPATIBILITY_REGISTRY: Record<
  TrustedCompatibilityCoordinatorRequest['operation'],
  TrustedCompatibilityHandler
> = {
  resolve_packet_compatibility: (request) => {
    if (request.operation !== 'resolve_packet_compatibility') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return resolveTrustedPacketCompatibility(request.input);
  },
  adapt_packet_for_read: (request) => {
    if (request.operation !== 'adapt_packet_for_read') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return adaptTrustedPacketForRead(request.input);
  },
  prepare_packet_for_write: (request) => {
    if (request.operation !== 'prepare_packet_for_write') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return prepareTrustedPacketForWrite(request.input);
  },
  resolve_adapter_path: (request) => {
    if (request.operation !== 'resolve_adapter_path') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return resolveTrustedAdapterPath(request.input);
  },
  resolve_compatibility_profile: (request) => {
    if (request.operation !== 'resolve_compatibility_profile') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return resolveTrustedCompatibilityProfile(request.input);
  },
  audit_compatibility_coverage: (request) => {
    if (request.operation !== 'audit_compatibility_coverage') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return auditTrustedCompatibilityCoverage(request.input);
  },
  audit_readiness: (request) => {
    if (request.operation !== 'audit_readiness') {
      throw new Error('Invalid Trusted Compatibility operation dispatch.');
    }
    return auditTrustedCompatibilityReadiness(request.input);
  },
};

export function runTrustedCompatibilityOperation(
  request: TrustedCompatibilityCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_COMPATIBILITY_REGISTRY[request.operation](request);
}
