/**
 * File: trusted_planning_registry.ts
 * Description: Internal operation registry for the Trusted Planning Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type { TrustedPlanningCoordinatorRequest, TrustedPlanningOperation } from './trusted_planning_types.ts';
import { resolveTrustedOperationPlan } from './functions/resolve_trusted_operation_plan.ts';
import { resolveTrustedDefaultPlan } from './functions/resolve_trusted_default_plan.ts';
import { resolveTrustedDependencyPlan } from './functions/resolve_trusted_dependency_plan.ts';
import { selectTrustedBuilderDescriptor } from './functions/select_trusted_builder_descriptor.ts';
import { resolveTrustedChildPacketPlans } from './functions/resolve_trusted_child_packet_plans.ts';
import { auditTrustedPlanningReadiness } from './functions/audit_trusted_planning_readiness.ts';

type TrustedPlanningOperationExecutor = (
  request: TrustedPlanningCoordinatorRequest
) => TrustedRuntimeCoordinatorResult<unknown>;

function executeResolveOperationPlan(request: TrustedPlanningCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_operation_plan') throw new Error('Invalid Trusted Planning Coordinator request for resolve_operation_plan.');
  return resolveTrustedOperationPlan(request.input);
}

function executeResolveDefaultPlan(request: TrustedPlanningCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_default_plan') throw new Error('Invalid Trusted Planning Coordinator request for resolve_default_plan.');
  return resolveTrustedDefaultPlan(request.input);
}

function executeResolveDependencyPlan(request: TrustedPlanningCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_dependency_plan') throw new Error('Invalid Trusted Planning Coordinator request for resolve_dependency_plan.');
  return resolveTrustedDependencyPlan(request.input);
}

function executeSelectBuilderDescriptor(request: TrustedPlanningCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'select_builder_descriptor') throw new Error('Invalid Trusted Planning Coordinator request for select_builder_descriptor.');
  return selectTrustedBuilderDescriptor(request.input);
}

function executeResolveChildPacketPlans(request: TrustedPlanningCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_child_packet_plans') throw new Error('Invalid Trusted Planning Coordinator request for resolve_child_packet_plans.');
  return resolveTrustedChildPacketPlans(request.input);
}

function executeAuditReadiness(request: TrustedPlanningCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'audit_readiness') throw new Error('Invalid Trusted Planning Coordinator request for audit_readiness.');
  return auditTrustedPlanningReadiness(request.input ?? {});
}

const TRUSTED_PLANNING_OPERATION_REGISTRY: Record<TrustedPlanningOperation, TrustedPlanningOperationExecutor> = {
  resolve_operation_plan: executeResolveOperationPlan,
  resolve_default_plan: executeResolveDefaultPlan,
  resolve_dependency_plan: executeResolveDependencyPlan,
  select_builder_descriptor: executeSelectBuilderDescriptor,
  resolve_child_packet_plans: executeResolveChildPacketPlans,
  audit_readiness: executeAuditReadiness,
};

export function executeTrustedPlanningOperation(
  request: TrustedPlanningCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_PLANNING_OPERATION_REGISTRY[request.operation](request);
}
