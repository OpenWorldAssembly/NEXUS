/**
 * File: trusted_resolution_registry.ts
 * Description: Internal operation registry for Trusted Resolution Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedResolutionStep } from './functions/run_resolution_step.ts';
import type {
  TrustedResolutionCoordinatorRequest,
  TrustedResolutionOperation,
} from './trusted_resolution_types.ts';

type TrustedResolutionOperationExecutor = (
  request: TrustedResolutionCoordinatorRequest
) => TrustedRuntimeCoordinatorResult<unknown>;

function executeRunStep(
  request: TrustedResolutionCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'run_step') {
    throw new Error('Invalid Trusted Resolution Coordinator request for run_step.');
  }

  return runTrustedResolutionStep(request.input);
}

const TRUSTED_RESOLUTION_OPERATION_REGISTRY = {
  run_step: executeRunStep,
} as const satisfies Record<TrustedResolutionOperation, TrustedResolutionOperationExecutor>;

export function executeTrustedResolutionOperation(
  request: TrustedResolutionCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_RESOLUTION_OPERATION_REGISTRY[request.operation](request);
}
