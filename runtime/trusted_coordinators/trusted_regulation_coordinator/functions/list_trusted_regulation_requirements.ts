/**
 * File: list_trusted_regulation_requirements.ts
 * Description: Lists regulation requirements through the public regulation context shape.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { TRUSTED_REGULATION_COORDINATOR_ID, type ListTrustedRegulationRequirementsInput, type TrustedRegulationRequirement } from '../trusted_regulation_types.ts';
import { resolveTrustedRegulationContext } from './resolve_trusted_regulation_context.ts';

export function listTrustedRegulationRequirements(
  input: ListTrustedRegulationRequirementsInput
): TrustedRuntimeCoordinatorResult<TrustedRegulationRequirement[]> {
  const contextResult = resolveTrustedRegulationContext(input);

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_REGULATION_COORDINATOR_ID,
    coordinator_kind: 'policy',
    value: contextResult.value?.requirements ?? null,
    issues: contextResult.issues,
    trace: contextResult.trace,
  });
}
