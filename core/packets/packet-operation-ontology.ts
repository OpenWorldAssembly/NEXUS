/**
 * File: packet-operation-ontology.ts
 * Description: Shadow-mode packet operation ontology and trusted generic planner/builder capability registry.
 */

import type {
  PacketActionDescriptor,
  PacketActionKind,
  PacketBuilderDescriptor,
  PacketMutationDescriptor,
  PacketPlannerDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';

export type PacketOperationKind =
  | 'single_packet.create'
  | 'single_packet.revise'
  | 'single_packet.withdraw'
  | 'relation.set'
  | 'relation.clear'
  | 'claim.assert'
  | 'claim.withdraw'
  | 'attestation.set'
  | 'attestation.clear'
  | 'bundle.import'
  | 'bundle.export'
  | 'projection.refresh'
  | 'compatibility.adapt'
  | 'workflow.compose';

export type PacketOperationGenericCapability =
  | 'direct'
  | 'requires_planner'
  | 'workflow_composed'
  | 'legacy_bridge';

export type PacketOperationScope =
  | 'single_packet'
  | 'relation'
  | 'claim'
  | 'attestation'
  | 'bundle'
  | 'projection'
  | 'compatibility'
  | 'workflow';

export type PacketOperationDescriptor = {
  operation_kind: PacketOperationKind;
  label: string;
  description: string;
  packet_type_scope: PacketOperationScope;
  planner_kinds: readonly PacketPlannerDescriptor['planner_kind'][];
  builder_kinds: readonly PacketBuilderDescriptor['builder_kind'][];
  action_kinds: readonly PacketActionKind[];
  policy_action_ids: readonly string[];
  result_families: readonly PacketMutationDescriptor['result_family'][];
  generic_capability: PacketOperationGenericCapability;
  trusted_runtime_engine: string;
  safety_notes: string;
};

export type PacketOperationCapabilityStatus =
  | 'shadow_available'
  | 'planner_needed'
  | 'runtime_owned';

export type PacketOperationCapabilityDescriptor = {
  engine_id: string;
  status: PacketOperationCapabilityStatus;
  operation_kinds: readonly PacketOperationKind[];
  planner_kinds: readonly PacketPlannerDescriptor['planner_kind'][];
  builder_kinds: readonly PacketBuilderDescriptor['builder_kind'][];
  notes: string;
};

export type PacketDefinitionOperationFinding = {
  severity: 'error' | 'warning';
  code: string;
  packet_type: string;
  path: string;
  message: string;
};

export type PacketDefinitionOperationMutationCoverage = {
  packet_type: string;
  mutation_intent: string;
  operation_kinds: readonly PacketOperationKind[];
  operation_status: 'mapped' | 'unmapped';
  planner_id: string;
};

export type PacketDefinitionOperationAuditReport = {
  status: 'pass' | 'fail';
  packet_type: string;
  checked_mutations: PacketDefinitionOperationMutationCoverage[];
  findings: PacketDefinitionOperationFinding[];
};

export type PacketOperationModernizationCoverage = {
  packet_type: string;
  mutation_intent: string;
  operation_kinds: readonly PacketOperationKind[];
  operation_mapping_status: 'mapped' | 'planned_gap';
  generic_capability: PacketOperationGenericCapability;
  trusted_runtime_engines: readonly string[];
  planned_gap_reason: string | null;
};

export const PACKET_OPERATION_DEFINITIONS = [
  {
    operation_kind: 'single_packet.create',
    label: 'Create single packet',
    description: 'Create a new packet body or envelope through a trusted single-packet builder.',
    packet_type_scope: 'single_packet',
    planner_kinds: ['single_packet_create', 'single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['create'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'direct',
    trusted_runtime_engine: 'generic.single_packet_planner',
    safety_notes:
      'Packet definitions may request this operation, but only local trusted builders may construct write candidates.',
  },
  {
    operation_kind: 'single_packet.revise',
    label: 'Revise single packet',
    description: 'Create a superseding or replacement revision for one packet.',
    packet_type_scope: 'single_packet',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['revise'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'direct',
    trusted_runtime_engine: 'generic.single_packet_planner',
    safety_notes:
      'Revision behavior remains constrained by the packet definition and local schema compatibility registry.',
  },
  {
    operation_kind: 'single_packet.withdraw',
    label: 'Withdraw single packet',
    description: 'Mark a packet projection or latest-active packet state as withdrawn.',
    packet_type_scope: 'single_packet',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['withdraw'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'direct',
    trusted_runtime_engine: 'generic.single_packet_planner',
    safety_notes:
      'Withdrawals must preserve audit history and must not delete prior signed revisions.',
  },
  {
    operation_kind: 'relation.set',
    label: 'Set relation',
    description: 'Create or revise a Relation packet that asserts an active relationship.',
    packet_type_scope: 'relation',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['create', 'revise'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'requires_planner',
    trusted_runtime_engine: 'generic.relation_planner',
    safety_notes:
      'Relation writes need target resolution and authority checks before they can be promoted to the generic path.',
  },
  {
    operation_kind: 'relation.clear',
    label: 'Clear relation',
    description: 'Revise or withdraw a Relation packet so an active relationship is no longer projected.',
    packet_type_scope: 'relation',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['revise', 'withdraw'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'requires_planner',
    trusted_runtime_engine: 'generic.relation_planner',
    safety_notes:
      'Clear operations must retain prior relation history while updating active projections.',
  },
  {
    operation_kind: 'claim.assert',
    label: 'Assert claim',
    description: 'Create or revise a Claim packet into an asserted active state.',
    packet_type_scope: 'claim',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['create', 'revise'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'requires_planner',
    trusted_runtime_engine: 'generic.claim_planner',
    safety_notes:
      'Claims need semantic target validation before they become direct generic writes.',
  },
  {
    operation_kind: 'claim.withdraw',
    label: 'Withdraw claim',
    description: 'Create a withdrawn Claim revision while preserving the claim history.',
    packet_type_scope: 'claim',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['withdraw'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'requires_planner',
    trusted_runtime_engine: 'generic.claim_planner',
    safety_notes:
      'Claim withdrawal must keep loss and projection notes visible to compatibility adapters.',
  },
  {
    operation_kind: 'attestation.set',
    label: 'Set attestation',
    description: 'Create or revise an Attestation packet that records support, dispute, or signal state.',
    packet_type_scope: 'attestation',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['attest', 'create', 'revise'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'requires_planner',
    trusted_runtime_engine: 'generic.attestation_planner',
    safety_notes:
      'Attestations need target summary lookup and mutual-exclusion planning before direct promotion.',
  },
  {
    operation_kind: 'attestation.clear',
    label: 'Clear attestation',
    description: 'Withdraw or neutralize an Attestation projection.',
    packet_type_scope: 'attestation',
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    action_kinds: ['withdraw', 'revise'],
    policy_action_ids: [],
    result_families: ['packet_write'],
    generic_capability: 'requires_planner',
    trusted_runtime_engine: 'generic.attestation_planner',
    safety_notes:
      'Clear operations must preserve previous attestation evidence and projection counts.',
  },
  {
    operation_kind: 'bundle.import',
    label: 'Import bundle',
    description: 'Review and hydrate a Bundle inventory through trusted import machinery.',
    packet_type_scope: 'bundle',
    planner_kinds: ['multi_packet_orchestration'],
    builder_kinds: ['multi_packet_bundle'],
    action_kinds: ['import', 'verify'],
    policy_action_ids: [],
    result_families: ['bundle_update'],
    generic_capability: 'workflow_composed',
    trusted_runtime_engine: 'generic.bundle_import_planner',
    safety_notes:
      'Imports must validate signatures, compatibility ladders, and policy before writing hydrated packets.',
  },
  {
    operation_kind: 'bundle.export',
    label: 'Export bundle',
    description: 'Collect packets and dependencies into a Bundle inventory.',
    packet_type_scope: 'bundle',
    planner_kinds: ['multi_packet_orchestration'],
    builder_kinds: ['multi_packet_bundle'],
    action_kinds: ['create', 'revise', 'export', 'bundle'],
    policy_action_ids: [],
    result_families: ['bundle_update'],
    generic_capability: 'workflow_composed',
    trusted_runtime_engine: 'generic.bundle_export_planner',
    safety_notes:
      'Exports must avoid turning the carrier Bundle into the semantic owner of the packets it carries.',
  },
  {
    operation_kind: 'projection.refresh',
    label: 'Refresh projection',
    description: 'Recompute a read-side projection or index from already trusted packet state.',
    packet_type_scope: 'projection',
    planner_kinds: ['projection_only'],
    builder_kinds: [],
    action_kinds: ['project', 'index'],
    policy_action_ids: [],
    result_families: ['projection_update'],
    generic_capability: 'direct',
    trusted_runtime_engine: 'generic.projection_refresher',
    safety_notes:
      'Projection refreshes are derived effects and must not become hidden write authority.',
  },
  {
    operation_kind: 'compatibility.adapt',
    label: 'Adapt compatibility',
    description: 'Apply a trusted compatibility adapter between known packet schema versions.',
    packet_type_scope: 'compatibility',
    planner_kinds: ['compatibility_adapter_chain'],
    builder_kinds: ['adapter_output'],
    action_kinds: ['adapt', 'verify'],
    policy_action_ids: [],
    result_families: ['compatibility_update'],
    generic_capability: 'direct',
    trusted_runtime_engine: 'generic.compatibility_adapter_chain',
    safety_notes:
      'Adapters must be known local capabilities and must record loss notes when fields are dropped or transformed.',
  },
  {
    operation_kind: 'workflow.compose',
    label: 'Compose workflow',
    description: 'Runtime-owned orchestration over multiple packet operations or side effects.',
    packet_type_scope: 'workflow',
    planner_kinds: ['multi_packet_orchestration'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope', 'multi_packet_bundle'],
    action_kinds: ['policy_action'],
    policy_action_ids: [],
    result_families: ['packet_write', 'projection_update', 'bundle_update'],
    generic_capability: 'workflow_composed',
    trusted_runtime_engine: 'runtime.workflow_orchestrator',
    safety_notes:
      'Workflow composition remains runtime-owned until component operations are split into trusted generic planners.',
  },
] as const satisfies readonly PacketOperationDescriptor[];

export const PACKET_OPERATION_CAPABILITY_REGISTRY = [
  {
    engine_id: 'generic.single_packet_planner',
    status: 'shadow_available',
    operation_kinds: [
      'single_packet.create',
      'single_packet.revise',
      'single_packet.withdraw',
    ],
    planner_kinds: ['single_packet_create', 'single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    notes: 'Trusted shadow engine for manifest-described single-packet candidates.',
  },
  {
    engine_id: 'generic.relation_planner',
    status: 'planner_needed',
    operation_kinds: ['relation.set', 'relation.clear'],
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    notes: 'Relation operation family awaiting extraction from current fortress handlers.',
  },
  {
    engine_id: 'generic.claim_planner',
    status: 'planner_needed',
    operation_kinds: ['claim.assert', 'claim.withdraw'],
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    notes: 'Claim operation family awaiting semantic target planner extraction.',
  },
  {
    engine_id: 'generic.attestation_planner',
    status: 'planner_needed',
    operation_kinds: ['attestation.set', 'attestation.clear'],
    planner_kinds: ['single_packet_revision'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope'],
    notes: 'Attestation operation family awaiting target summary and mutual-exclusion planner extraction.',
  },
  {
    engine_id: 'generic.bundle_import_planner',
    status: 'runtime_owned',
    operation_kinds: ['bundle.import'],
    planner_kinds: ['multi_packet_orchestration'],
    builder_kinds: ['multi_packet_bundle'],
    notes: 'Bundle import remains runtime-owned until reseed/import policy is designed.',
  },
  {
    engine_id: 'generic.bundle_export_planner',
    status: 'runtime_owned',
    operation_kinds: ['bundle.export'],
    planner_kinds: ['multi_packet_orchestration'],
    builder_kinds: ['multi_packet_bundle'],
    notes: 'Bundle export remains runtime-owned until dependency collection is hardened.',
  },
  {
    engine_id: 'generic.projection_refresher',
    status: 'shadow_available',
    operation_kinds: ['projection.refresh'],
    planner_kinds: ['projection_only'],
    builder_kinds: [],
    notes: 'Trusted derived projection capability; it does not grant write authority.',
  },
  {
    engine_id: 'generic.compatibility_adapter_chain',
    status: 'shadow_available',
    operation_kinds: ['compatibility.adapt'],
    planner_kinds: ['compatibility_adapter_chain'],
    builder_kinds: ['adapter_output'],
    notes: 'Trusted adapter-chain capability for known local compatibility descriptors.',
  },
  {
    engine_id: 'runtime.workflow_orchestrator',
    status: 'runtime_owned',
    operation_kinds: ['workflow.compose'],
    planner_kinds: ['multi_packet_orchestration'],
    builder_kinds: ['single_packet_body', 'single_packet_envelope', 'multi_packet_bundle'],
    notes: 'Runtime-owned workflow composition over multiple trusted operations.',
  },
] as const satisfies readonly PacketOperationCapabilityDescriptor[];

const OPERATION_DEFINITIONS_BY_KIND = new Map(
  PACKET_OPERATION_DEFINITIONS.map((definition) => [
    definition.operation_kind,
    definition,
  ])
);

const CAPABILITIES_BY_ENGINE = new Map(
  PACKET_OPERATION_CAPABILITY_REGISTRY.map((capability) => [
    capability.engine_id,
    capability,
  ])
);

export function listPacketOperationDefinitions(): PacketOperationDescriptor[] {
  return [...PACKET_OPERATION_DEFINITIONS];
}

export function getPacketOperationDefinition(
  operationKind: string
): PacketOperationDescriptor | null {
  return OPERATION_DEFINITIONS_BY_KIND.get(operationKind as PacketOperationKind) ?? null;
}

export function listTrustedPacketOperationCapabilities(): PacketOperationCapabilityDescriptor[] {
  return [...PACKET_OPERATION_CAPABILITY_REGISTRY];
}

function hasActionKind(
  actions: readonly PacketActionDescriptor[],
  actionKind: PacketActionKind
): boolean {
  return actions.some((action) => action.action_kind === actionKind);
}

function addOperationKind(
  operationKinds: Set<PacketOperationKind>,
  operationKind: PacketOperationKind
): void {
  if (!OPERATION_DEFINITIONS_BY_KIND.has(operationKind)) {
    return;
  }

  operationKinds.add(operationKind);
}

export function inferPacketOperationKindsForMutation(input: {
  definition: PacketTypeDefinition;
  mutation: PacketMutationDescriptor;
}): PacketOperationKind[] {
  const planner = input.definition.planners.find(
    (candidate) => candidate.planner_id === input.mutation.planner_id
  );
  const actionIds = new Set(input.mutation.action_ids);
  const actions = input.definition.actions.filter((action) =>
    actionIds.has(action.action_id)
  );
  const operationKinds = new Set<PacketOperationKind>();

  if (input.mutation.result_family === 'compatibility_update') {
    addOperationKind(operationKinds, 'compatibility.adapt');
  }

  if (
    input.mutation.result_family === 'projection_update' ||
    planner?.planner_kind === 'projection_only'
  ) {
    addOperationKind(operationKinds, 'projection.refresh');
  }

  if (input.mutation.result_family === 'bundle_update') {
    if (hasActionKind(actions, 'import')) {
      addOperationKind(operationKinds, 'bundle.import');
    }

    if (
      hasActionKind(actions, 'export') ||
      hasActionKind(actions, 'bundle') ||
      hasActionKind(actions, 'create') ||
      hasActionKind(actions, 'revise')
    ) {
      addOperationKind(operationKinds, 'bundle.export');
    }
  }

  if (input.mutation.result_family === 'packet_write') {
    if (hasActionKind(actions, 'create')) {
      addOperationKind(operationKinds, 'single_packet.create');
    }

    if (hasActionKind(actions, 'revise')) {
      addOperationKind(operationKinds, 'single_packet.revise');
    }

    if (hasActionKind(actions, 'withdraw')) {
      addOperationKind(operationKinds, 'single_packet.withdraw');
    }
  }

  if (hasActionKind(actions, 'adapt')) {
    addOperationKind(operationKinds, 'compatibility.adapt');
  }

  if (hasActionKind(actions, 'project') || hasActionKind(actions, 'index')) {
    addOperationKind(operationKinds, 'projection.refresh');
  }

  return [...operationKinds];
}

function getCapabilityForOperation(
  operationKind: PacketOperationKind
): PacketOperationCapabilityDescriptor | null {
  const definition = getPacketOperationDefinition(operationKind);

  if (!definition) {
    return null;
  }

  return CAPABILITIES_BY_ENGINE.get(definition.trusted_runtime_engine) ?? null;
}

function getMostConstrainedCapability(
  operationKinds: readonly PacketOperationKind[]
): PacketOperationGenericCapability {
  const capabilities = operationKinds
    .map((operationKind) => getPacketOperationDefinition(operationKind)?.generic_capability)
    .filter(
      (capability): capability is PacketOperationGenericCapability =>
        capability !== undefined
    );

  if (capabilities.includes('legacy_bridge')) {
    return 'legacy_bridge';
  }

  if (capabilities.includes('workflow_composed')) {
    return 'workflow_composed';
  }

  if (capabilities.includes('requires_planner')) {
    return 'requires_planner';
  }

  return 'direct';
}

export function auditPacketDefinitionOperations(
  definition: PacketTypeDefinition
): PacketDefinitionOperationAuditReport {
  const findings: PacketDefinitionOperationFinding[] = [];
  const checkedMutations: PacketDefinitionOperationMutationCoverage[] = [];

  for (const mutation of definition.mutations) {
    const operationKinds = inferPacketOperationKindsForMutation({
      definition,
      mutation,
    });

    checkedMutations.push({
      packet_type: definition.packet_type,
      mutation_intent: mutation.mutation_intent,
      operation_kinds: operationKinds,
      operation_status: operationKinds.length > 0 ? 'mapped' : 'unmapped',
      planner_id: mutation.planner_id,
    });

    if (operationKinds.length === 0) {
      findings.push({
        severity: 'error',
        code: 'packet_operation_unmapped_mutation',
        packet_type: definition.packet_type,
        path: `mutations.${mutation.mutation_intent}`,
        message: `Mutation ${mutation.mutation_intent} does not map to a known packet operation kind.`,
      });
      continue;
    }

    for (const operationKind of operationKinds) {
      const operation = getPacketOperationDefinition(operationKind);
      const capability = getCapabilityForOperation(operationKind);

      if (!operation) {
        findings.push({
          severity: 'error',
          code: 'packet_operation_unknown_kind',
          packet_type: definition.packet_type,
          path: `mutations.${mutation.mutation_intent}`,
          message: `Mutation ${mutation.mutation_intent} references unknown packet operation ${operationKind}.`,
        });
        continue;
      }

      if (!capability) {
        findings.push({
          severity: 'error',
          code: 'packet_operation_missing_capability',
          packet_type: definition.packet_type,
          path: `mutations.${mutation.mutation_intent}`,
          message: `Operation ${operationKind} has no trusted local capability registry entry.`,
        });
      }
    }
  }

  return {
    status: findings.some((finding) => finding.severity === 'error')
      ? 'fail'
      : 'pass',
    packet_type: definition.packet_type,
    checked_mutations: checkedMutations,
    findings,
  };
}

export function createPacketOperationModernizationCoverage(
  definitions: readonly PacketTypeDefinition[]
): PacketOperationModernizationCoverage[] {
  return definitions.flatMap((definition) =>
    definition.mutations.map((mutation) => {
      const operationKinds = inferPacketOperationKindsForMutation({
        definition,
        mutation,
      });
      const trustedRuntimeEngines = operationKinds
        .map((operationKind) => getPacketOperationDefinition(operationKind))
        .filter(
          (operation): operation is PacketOperationDescriptor => operation !== null
        )
        .map((operation) => operation.trusted_runtime_engine);

      return {
        packet_type: definition.packet_type,
        mutation_intent: mutation.mutation_intent,
        operation_kinds: operationKinds,
        operation_mapping_status:
          operationKinds.length > 0 ? 'mapped' : 'planned_gap',
        generic_capability: getMostConstrainedCapability(operationKinds),
        trusted_runtime_engines: [...new Set(trustedRuntimeEngines)],
        planned_gap_reason:
          operationKinds.length > 0
            ? null
            : 'Manifest mutation does not yet infer a known packet operation kind.',
      };
    })
  );
}
