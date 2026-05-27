/**
 * File: trusted_regulation_coordinator.ts
 * Description: Public Trusted Regulation Coordinator entry point and gated method surface.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { executeTrustedRegulationOperation } from './trusted_regulation_registry.ts';
import type {
  AuditTrustedRegulationReadinessInput,
  ListTrustedRegulationRequirementsInput,
  ResolveTrustedPolicyContextInput,
  ResolveTrustedRegulationContextInput,
  ResolveTrustedWritePolicyGateInput,
  TrustedPolicyContext,
  TrustedRegulationContext,
  TrustedRegulationReadinessReport,
  TrustedRegulationRequirement,
  TrustedWritePolicyGate,
} from './trusted_regulation_types.ts';

function castResult<T>(result: TrustedRuntimeCoordinatorResult<unknown>): TrustedRuntimeCoordinatorResult<T> {
  return result as TrustedRuntimeCoordinatorResult<T>;
}

export const trustedRegulationCoordinator = {
  id: 'trusted_regulation_coordinator.v0',

  resolveContext(input: ResolveTrustedRegulationContextInput): TrustedRuntimeCoordinatorResult<TrustedRegulationContext> {
    return castResult<TrustedRegulationContext>(
      executeTrustedRegulationOperation({ operation: 'resolve_context', input })
    );
  },

  resolvePolicyContext(input: ResolveTrustedPolicyContextInput): TrustedRuntimeCoordinatorResult<TrustedPolicyContext> {
    return castResult<TrustedPolicyContext>(
      executeTrustedRegulationOperation({ operation: 'resolve_policy_context', input })
    );
  },

  resolveWritePolicyGate(input: ResolveTrustedWritePolicyGateInput): TrustedRuntimeCoordinatorResult<TrustedWritePolicyGate> {
    return castResult<TrustedWritePolicyGate>(
      executeTrustedRegulationOperation({ operation: 'resolve_write_policy_gate', input })
    );
  },

  listRequirements(input: ListTrustedRegulationRequirementsInput): TrustedRuntimeCoordinatorResult<TrustedRegulationRequirement[]> {
    return castResult<TrustedRegulationRequirement[]>(
      executeTrustedRegulationOperation({ operation: 'list_requirements', input })
    );
  },

  auditReadiness(input: AuditTrustedRegulationReadinessInput = {}): TrustedRuntimeCoordinatorResult<TrustedRegulationReadinessReport> {
    return castResult<TrustedRegulationReadinessReport>(
      executeTrustedRegulationOperation({ operation: 'audit_readiness', input })
    );
  },
};
