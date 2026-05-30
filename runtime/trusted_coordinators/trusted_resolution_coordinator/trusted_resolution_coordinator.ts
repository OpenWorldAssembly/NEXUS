/**
 * File: trusted_resolution_coordinator.ts
 * Description: Public coordinator facade for trusted Resolution DSL execution.
 */

import { listResolutionDslPresets } from '@core/packets/resolution-dsl.ts';
import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { executeTrustedResolutionOperation } from './trusted_resolution_registry.ts';
import {
  TRUSTED_RESOLUTION_COORDINATOR_ID,
  type RunTrustedResolutionStepInput,
  type TrustedResolutionStepValue,
} from './trusted_resolution_types.ts';
import { resolveTrustedResolutionBinding } from './functions/resolve_resolution_binding.ts';
import { runTrustedResolutionStep } from './functions/run_resolution_step.ts';

function castResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<unknown>
): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedResolutionCoordinator = {
  id: 'trusted_resolution_coordinator.v0',

  runStep(
    input: RunTrustedResolutionStepInput
  ): TrustedRuntimeCoordinatorResult<TrustedResolutionStepValue> {
    return castResult<TrustedResolutionStepValue>(
      executeTrustedResolutionOperation({ operation: 'run_step', input })
    );
  },

  listPresets() {
    return listResolutionDslPresets();
  },
};

export { resolveTrustedResolutionBinding, runTrustedResolutionStep };

export function listTrustedResolutionPresets() {
  return trustedResolutionCoordinator.listPresets();
}
