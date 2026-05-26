/**
 * File: trusted_definition_coordinator.ts
 * Description: Public Trusted Definition Coordinator entry point and gated method surface.
 */

import type {
  PacketDefinitionPartDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type {
  TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  executeTrustedDefinitionOperation,
} from './trusted_definition_registry.ts';
import type {
  AuditTrustedDefinitionReadinessInput,
  AuditTrustedDefinitionConflictsInput,
  CompileTrustedDefinitionRuntimeViewInput,
  CompileTrustedDefinitionRuntimeViewsInput,
  ListTrustedDefinitionCandidatesInput,
  ListTrustedPacketDefinitionsInput,
  RankTrustedDefinitionCandidatesInput,
  ResolveTrustedCompatibilityDefinitionInput,
  ResolveTrustedDefinitionContextInput,
  ResolveTrustedDefinitionPartInput,
  ResolveTrustedPacketDefinitionInput,
  TrustedDefinitionCandidate,
  TrustedDefinitionContext,
  TrustedDefinitionReadinessReport,
  TrustedDefinitionRuntimeView,
  TrustedDefinitionRuntimeViewSet,
} from './trusted_definition_types.ts';

function castResult<T>(result: TrustedRuntimeCoordinatorResult<unknown>): TrustedRuntimeCoordinatorResult<T> {
  return result as TrustedRuntimeCoordinatorResult<T>;
}

export const trustedDefinitionCoordinator = {
  id: 'trusted_definition_coordinator.v0',

  resolveContext(
    input: ResolveTrustedDefinitionContextInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionContext> {
    return castResult<TrustedDefinitionContext>(
      executeTrustedDefinitionOperation({ operation: 'resolve_context', input })
    );
  },

  resolvePacketDefinition(
    input: ResolveTrustedPacketDefinitionInput
  ): TrustedRuntimeCoordinatorResult<PacketTypeDefinition> {
    return castResult<PacketTypeDefinition>(
      executeTrustedDefinitionOperation({ operation: 'resolve_packet_definition', input })
    );
  },

  listPacketDefinitions(
    input: ListTrustedPacketDefinitionsInput = {}
  ): TrustedRuntimeCoordinatorResult<PacketTypeDefinition[]> {
    return castResult<PacketTypeDefinition[]>(
      executeTrustedDefinitionOperation({ operation: 'list_packet_definitions', input })
    );
  },

  resolveDefinitionPart(
    input: ResolveTrustedDefinitionPartInput
  ): TrustedRuntimeCoordinatorResult<PacketDefinitionPartDescriptor> {
    return castResult<PacketDefinitionPartDescriptor>(
      executeTrustedDefinitionOperation({ operation: 'resolve_definition_part', input })
    );
  },

  resolveCompatibilityDefinition(
    input: ResolveTrustedCompatibilityDefinitionInput
  ): TrustedRuntimeCoordinatorResult<PacketDefinitionPartDescriptor> {
    return castResult<PacketDefinitionPartDescriptor>(
      executeTrustedDefinitionOperation({ operation: 'resolve_compatibility_definition', input })
    );
  },

  listCandidates(
    input: ListTrustedDefinitionCandidatesInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionCandidate[]> {
    return castResult<TrustedDefinitionCandidate[]>(
      executeTrustedDefinitionOperation({ operation: 'list_candidates', input })
    );
  },

  rankCandidates(
    input: RankTrustedDefinitionCandidatesInput
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionCandidate[]> {
    return castResult<TrustedDefinitionCandidate[]>(
      executeTrustedDefinitionOperation({ operation: 'rank_candidates', input })
    );
  },

  auditConflicts(
    input: AuditTrustedDefinitionConflictsInput
  ): TrustedRuntimeCoordinatorResult<string[]> {
    return castResult<string[]>(
      executeTrustedDefinitionOperation({ operation: 'audit_conflicts', input })
    );
  },

  compileRuntimeView(
    input: CompileTrustedDefinitionRuntimeViewInput
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionRuntimeView> {
    return castResult<TrustedDefinitionRuntimeView>(
      executeTrustedDefinitionOperation({ operation: 'compile_runtime_view', input })
    );
  },

  compileRuntimeViews(
    input: CompileTrustedDefinitionRuntimeViewsInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionRuntimeViewSet> {
    return castResult<TrustedDefinitionRuntimeViewSet>(
      executeTrustedDefinitionOperation({ operation: 'compile_runtime_views', input })
    );
  },

  auditReadiness(
    input: AuditTrustedDefinitionReadinessInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedDefinitionReadinessReport> {
    return castResult<TrustedDefinitionReadinessReport>(
      executeTrustedDefinitionOperation({ operation: 'audit_readiness', input })
    );
  },
};
