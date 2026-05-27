/**
 * File: trusted_regulation_registry.ts
 * Description: Internal operation registry for the Trusted Regulation Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import type { TrustedRegulationCoordinatorRequest, TrustedRegulationOperation } from './trusted_regulation_types.ts';
import { resolveTrustedRegulationContext } from './functions/resolve_trusted_regulation_context.ts';
import { resolveTrustedDefaultContext } from './functions/resolve_trusted_default_context.ts';
import { resolveTrustedDependencyContext } from './functions/resolve_trusted_dependency_context.ts';
import { resolveTrustedPolicyContext } from './functions/resolve_trusted_policy_context.ts';
import { resolveTrustedWritePolicyGate } from './functions/resolve_trusted_write_policy_gate.ts';
import { listTrustedRegulationRequirements } from './functions/list_trusted_regulation_requirements.ts';
import { auditTrustedRegulationReadiness } from './functions/audit_trusted_regulation_readiness.ts';

type TrustedRegulationOperationExecutor = (
  request: TrustedRegulationCoordinatorRequest
) => TrustedRuntimeCoordinatorResult<unknown>;

function executeResolveContext(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_context') throw new Error('Invalid Trusted Regulation Coordinator request for resolve_context.');
  return resolveTrustedRegulationContext(request.input);
}

function executeResolveDefaultContext(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_default_context') throw new Error('Invalid Trusted Regulation Coordinator request for resolve_default_context.');
  return resolveTrustedDefaultContext(request.input);
}

function executeResolveDependencyContext(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_dependency_context') throw new Error('Invalid Trusted Regulation Coordinator request for resolve_dependency_context.');
  return resolveTrustedDependencyContext(request.input);
}

function executeResolvePolicyContext(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_policy_context') throw new Error('Invalid Trusted Regulation Coordinator request for resolve_policy_context.');
  return resolveTrustedPolicyContext(request.input);
}

function executeResolveWritePolicyGate(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_write_policy_gate') throw new Error('Invalid Trusted Regulation Coordinator request for resolve_write_policy_gate.');
  return resolveTrustedWritePolicyGate(request.input);
}

function executeListRequirements(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'list_requirements') throw new Error('Invalid Trusted Regulation Coordinator request for list_requirements.');
  return listTrustedRegulationRequirements(request.input);
}

function executeAuditReadiness(request: TrustedRegulationCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'audit_readiness') throw new Error('Invalid Trusted Regulation Coordinator request for audit_readiness.');
  return auditTrustedRegulationReadiness(request.input ?? {});
}

const TRUSTED_REGULATION_OPERATION_REGISTRY: Record<TrustedRegulationOperation, TrustedRegulationOperationExecutor> = {
  resolve_context: executeResolveContext,
  resolve_default_context: executeResolveDefaultContext,
  resolve_dependency_context: executeResolveDependencyContext,
  resolve_policy_context: executeResolvePolicyContext,
  resolve_write_policy_gate: executeResolveWritePolicyGate,
  list_requirements: executeListRequirements,
  audit_readiness: executeAuditReadiness,
};

export function executeTrustedRegulationOperation(
  request: TrustedRegulationCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_REGULATION_OPERATION_REGISTRY[request.operation](request);
}
