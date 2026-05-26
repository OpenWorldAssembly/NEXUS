/**
 * File: trusted_definition_registry.ts
 * Description: Internal operation registry for the Trusted Definition Coordinator.
 */

import type { TrustedDefinitionCoordinatorRequest, TrustedDefinitionOperation } from './trusted_definition_types.ts';
import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { resolveTrustedDefinitionContext } from './functions/resolve_trusted_definition_context.ts';
import { resolveTrustedPacketDefinition } from './functions/resolve_trusted_packet_definition.ts';
import { resolveTrustedDefinitionPart } from './functions/resolve_trusted_definition_part.ts';
import { listTrustedDefinitionCandidates } from './functions/list_trusted_definition_candidates.ts';
import { rankTrustedDefinitionCandidates } from './functions/rank_trusted_definition_candidates.ts';
import { auditTrustedDefinitionConflicts } from './functions/audit_trusted_definition_conflicts.ts';
import { resolveTrustedCompatibilityDefinition } from './functions/resolve_trusted_compatibility_definition.ts';
import {
  compileTrustedDefinitionRuntimeView,
  compileTrustedDefinitionRuntimeViews,
} from './functions/compile_trusted_definition_runtime_view.ts';
import { auditTrustedDefinitionReadiness } from './functions/audit_trusted_definition_readiness.ts';

type TrustedDefinitionOperationExecutor = (
  request: TrustedDefinitionCoordinatorRequest
) => TrustedRuntimeCoordinatorResult<unknown>;

function executeResolveContext(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_context') {
    throw new Error('Invalid Trusted Definition Coordinator request for resolve_context.');
  }
  return resolveTrustedDefinitionContext(request.input);
}

function executeResolvePacketDefinition(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_packet_definition') {
    throw new Error('Invalid Trusted Definition Coordinator request for resolve_packet_definition.');
  }
  return resolveTrustedPacketDefinition(request.input);
}

function executeResolveDefinitionPart(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_definition_part') {
    throw new Error('Invalid Trusted Definition Coordinator request for resolve_definition_part.');
  }
  return resolveTrustedDefinitionPart(request.input);
}

function executeListCandidates(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'list_candidates') {
    throw new Error('Invalid Trusted Definition Coordinator request for list_candidates.');
  }
  return listTrustedDefinitionCandidates(request.input);
}

function executeRankCandidates(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'rank_candidates') {
    throw new Error('Invalid Trusted Definition Coordinator request for rank_candidates.');
  }
  return rankTrustedDefinitionCandidates(request.input);
}

function executeAuditConflicts(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'audit_conflicts') {
    throw new Error('Invalid Trusted Definition Coordinator request for audit_conflicts.');
  }
  return auditTrustedDefinitionConflicts(request.input);
}

function executeResolveCompatibilityDefinition(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'resolve_compatibility_definition') {
    throw new Error('Invalid Trusted Definition Coordinator request for resolve_compatibility_definition.');
  }
  return resolveTrustedCompatibilityDefinition(request.input);
}

function executeCompileRuntimeView(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'compile_runtime_view') {
    throw new Error('Invalid Trusted Definition Coordinator request for compile_runtime_view.');
  }
  return compileTrustedDefinitionRuntimeView(request.input);
}

function executeCompileRuntimeViews(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'compile_runtime_views') {
    throw new Error('Invalid Trusted Definition Coordinator request for compile_runtime_views.');
  }
  return compileTrustedDefinitionRuntimeViews(request.input ?? {});
}

function executeAuditReadiness(request: TrustedDefinitionCoordinatorRequest): TrustedRuntimeCoordinatorResult<unknown> {
  if (request.operation !== 'audit_readiness') {
    throw new Error('Invalid Trusted Definition Coordinator request for audit_readiness.');
  }
  return auditTrustedDefinitionReadiness(request.input ?? {});
}

const TRUSTED_DEFINITION_OPERATION_REGISTRY: Record<TrustedDefinitionOperation, TrustedDefinitionOperationExecutor> = {
  resolve_context: executeResolveContext,
  resolve_packet_definition: executeResolvePacketDefinition,
  resolve_definition_part: executeResolveDefinitionPart,
  list_candidates: executeListCandidates,
  rank_candidates: executeRankCandidates,
  audit_conflicts: executeAuditConflicts,
  resolve_compatibility_definition: executeResolveCompatibilityDefinition,
  compile_runtime_view: executeCompileRuntimeView,
  compile_runtime_views: executeCompileRuntimeViews,
  audit_readiness: executeAuditReadiness,
};

export function executeTrustedDefinitionOperation(
  request: TrustedDefinitionCoordinatorRequest
): TrustedRuntimeCoordinatorResult<unknown> {
  return TRUSTED_DEFINITION_OPERATION_REGISTRY[request.operation](request);
}
