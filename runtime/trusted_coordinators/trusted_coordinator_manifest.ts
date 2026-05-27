/**
 * File: trusted_coordinator_manifest.ts
 * Description: Standard scaffold manifest for trusted runtime coordinators.
 */

import type { TrustedRuntimeCoordinatorScaffoldDescriptor } from './trusted_runtime_coordinator.ts';

export const TRUSTED_COORDINATOR_SCAFFOLD_MANIFEST = [
  {
    coordinator_id: 'trusted_request_coordinator.v0',
    coordinator_kind: 'request',
    public_object_name: 'trustedRequestCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_request_coordinator',
    runtime_path: 'runtime/trusted_coordinators/trusted_request_coordinator',
    structure: 'foldered_gated',
    expected_methods: [
      { method_name: 'normalizeRequest', notes: 'Validates and normalizes interface/API signals into trusted runtime requests.' },
      { method_name: 'preflightClientIntent', notes: 'Checks route/intent enrollment before mutation preparation.' },
      { method_name: 'listEnrollments', notes: 'Lists registered client/API ingress enrollments.' },
      { method_name: 'auditReadiness', notes: 'Audits request intake enrollment coverage.' },
    ],
    notes: 'Runtime front desk for request intake. It does not plan or build packets.',
  },
  {
    coordinator_id: 'trusted_definition_coordinator.v0',
    coordinator_kind: 'definition',
    public_object_name: 'trustedDefinitionCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts',
    runtime_path: 'runtime/trusted_coordinators/trusted_definition_coordinator',
    structure: 'foldered_gated',
    expected_methods: [
      { method_name: 'resolveContext', notes: 'Resolves active trusted definition context.' },
      { method_name: 'resolvePacketDefinition', notes: 'Resolves a trusted packet definition.' },
      { method_name: 'resolveDefinitionPart', notes: 'Resolves an active trusted definition part.' },
      { method_name: 'compileRuntimeView', notes: 'Compiles coordinator-facing definition runtime view.' },
      { method_name: 'auditReadiness', notes: 'Audits definition readiness.' },
    ],
    notes: 'Definition source of truth for active trusted definition material.',
  },
  {
    coordinator_id: 'trusted_regulation_coordinator.v0',
    coordinator_kind: 'regulation',
    public_object_name: 'trustedRegulationCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts',
    runtime_path: 'runtime/trusted_coordinators/trusted_regulation_coordinator',
    structure: 'foldered_gated',
    expected_methods: [
      { method_name: 'resolveContext', notes: 'Resolves policy/write-gate regulation context.' },
      { method_name: 'resolvePolicyContext', notes: 'Resolves policy requirements and verdict context.' },
      { method_name: 'resolveWritePolicyGate', notes: 'Resolves the write-policy gate.' },
      { method_name: 'listRequirements', notes: 'Lists regulation requirements.' },
      { method_name: 'auditReadiness', notes: 'Audits regulation readiness.' },
    ],
    notes: 'Rule envelope coordinator. It does not own structural defaults or build dependencies.',
  },
  {
    coordinator_id: 'trusted_planning_coordinator.v0',
    coordinator_kind: 'planning',
    public_object_name: 'trustedPlanningCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts',
    runtime_path: 'runtime/trusted_coordinators/trusted_planning_coordinator',
    structure: 'foldered_gated',
    expected_methods: [
      { method_name: 'resolveOperationPlan', notes: 'Compiles intent into a build/operation plan.' },
      { method_name: 'resolveDefaultPlan', notes: 'Resolves planned defaults.' },
      { method_name: 'resolveDependencyPlan', notes: 'Resolves structural dependencies.' },
      { method_name: 'selectBuilderDescriptor', notes: 'Selects the builder descriptor for a plan node.' },
      { method_name: 'auditReadiness', notes: 'Audits planning readiness.' },
    ],
    notes: 'Operation compiler and recursive blueprint owner.',
  },
  {
    coordinator_id: 'trusted_building_coordinator.v0',
    coordinator_kind: 'building',
    public_object_name: 'trustedBuildingCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts',
    runtime_path: 'runtime/trusted_coordinators/trusted_building_coordinator',
    structure: 'foldered_gated',
    expected_methods: [
      { method_name: 'buildFromOperationPlan', notes: 'Materializes packet candidates from trusted operation plans.' },
      { method_name: 'buildPacketBodyCandidate', notes: 'Builds a single packet candidate node from a plan node.' },
      { method_name: 'buildPacketTypeBodyCandidate', notes: 'Runs local body builders for runtime-ready typed body candidates.' },
      { method_name: 'buildDefinitionPartCandidates', notes: 'Builds Definition part body candidates for reseed readiness.' },
      { method_name: 'buildCandidateGraph', notes: 'Builds a candidate packet graph from a plan tree.' },
      { method_name: 'auditReadiness', notes: 'Audits whether operation plans can materialize candidate graphs.' },
    ],
    notes: 'Candidate materialization coordinator. It consumes Planning output and does not resolve policy/default/dependency DSL directly.',
  },
  {
    coordinator_id: 'trusted_projection_coordinator.v0',
    coordinator_kind: 'projection',
    public_object_name: 'trustedProjectionCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_projection_coordinator',
    runtime_path: 'runtime/trusted_coordinators/trusted_projection_coordinator.ts',
    structure: 'legacy_flat',
    expected_methods: [
      { method_name: 'resolvePacketProjection', notes: 'Planned future public method once Projection is foldered.' },
    ],
    notes: 'Still flat. Basic packet projection exists; surface/component projection can wait.',
  },
  {
    coordinator_id: 'trusted_resolution_coordinator.v0',
    coordinator_kind: 'resolution',
    public_object_name: 'trustedResolutionCoordinator',
    public_import_path: '@runtime/trusted_coordinators/trusted_resolution_coordinator',
    runtime_path: 'runtime/trusted_coordinators/trusted_resolution_coordinator.ts',
    structure: 'legacy_flat',
    expected_methods: [
      { method_name: 'runStep', notes: 'Planned future public method if Resolution becomes foldered.' },
    ],
    notes: 'Shared DSL executor is intentionally small and flat for now.',
  },
] as const satisfies readonly TrustedRuntimeCoordinatorScaffoldDescriptor[];

export function listTrustedCoordinatorScaffoldDescriptors(): readonly TrustedRuntimeCoordinatorScaffoldDescriptor[] {
  return TRUSTED_COORDINATOR_SCAFFOLD_MANIFEST;
}
