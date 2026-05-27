/**
 * File: trusted_planning_coordinator.ts
 * Description: Public gated coordinator surface for trusted packet planning.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { executeTrustedPlanningOperation } from './trusted_planning_registry.ts';
import type {
  AuditTrustedPlanningReadinessInput,
  ResolveTrustedChildPacketPlansInput,
  ResolveTrustedDefaultPlanInput,
  ResolveTrustedDependencyPlanInput,
  ResolveTrustedOperationPlanInput,
  SelectTrustedBuilderDescriptorInput,
  TrustedBuilderSelection,
  TrustedChildPacketPlanSet,
  TrustedDefaultPlan,
  TrustedDependencyPlan,
  TrustedOperationPlan,
  TrustedPlanningReadinessReport,
} from './trusted_planning_types.ts';

function castResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<unknown>
): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

export const trustedPlanningCoordinator = {
  resolveOperationPlan(input: ResolveTrustedOperationPlanInput): TrustedRuntimeCoordinatorResult<TrustedOperationPlan> {
    return castResult<TrustedOperationPlan>(
      executeTrustedPlanningOperation({ operation: 'resolve_operation_plan', input })
    );
  },

  resolveDefaultPlan(input: ResolveTrustedDefaultPlanInput): TrustedRuntimeCoordinatorResult<TrustedDefaultPlan> {
    return castResult<TrustedDefaultPlan>(
      executeTrustedPlanningOperation({ operation: 'resolve_default_plan', input })
    );
  },

  resolveDependencyPlan(input: ResolveTrustedDependencyPlanInput): TrustedRuntimeCoordinatorResult<TrustedDependencyPlan> {
    return castResult<TrustedDependencyPlan>(
      executeTrustedPlanningOperation({ operation: 'resolve_dependency_plan', input })
    );
  },

  selectBuilderDescriptor(input: SelectTrustedBuilderDescriptorInput): TrustedRuntimeCoordinatorResult<TrustedBuilderSelection> {
    return castResult<TrustedBuilderSelection>(
      executeTrustedPlanningOperation({ operation: 'select_builder_descriptor', input })
    );
  },

  resolveChildPacketPlans(input: ResolveTrustedChildPacketPlansInput): TrustedRuntimeCoordinatorResult<TrustedChildPacketPlanSet> {
    return castResult<TrustedChildPacketPlanSet>(
      executeTrustedPlanningOperation({ operation: 'resolve_child_packet_plans', input })
    );
  },

  auditReadiness(input: AuditTrustedPlanningReadinessInput = {}): TrustedRuntimeCoordinatorResult<TrustedPlanningReadinessReport> {
    return castResult<TrustedPlanningReadinessReport>(
      executeTrustedPlanningOperation({ operation: 'audit_readiness', input })
    );
  },
};
