/**
 * File: compatibility-standard.ts
 * Description: Shared definition-definition compatibility descriptor helpers and audits.
 */

import type {
  PacketCompatibilityEntry,
  PacketType,
} from '@core/schema/packet-schema';

import type {
  PacketCompatibilityAdapterDescriptor,
  PacketCompatibilityPosture,
  PacketTypeDefinition,
} from './packet-definition-types.ts';

export type PacketCompatibilityStandardIssue = {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
};

type CompatibilityDescriptorInput = {
  packetType: string;
  baseId: string;
  currentSchemaVersion: string;
  packetSubtype?: string | null;
};

export function createCurrentIdentityCompatibilityAdapter(
  input: CompatibilityDescriptorInput
): PacketCompatibilityAdapterDescriptor {
  return {
    adapter_id: `${input.baseId}.${input.currentSchemaVersion}_current_neighbor`,
    packet_subtype: input.packetSubtype ?? null,
    from_schema_version: input.currentSchemaVersion,
    to_schema_version: input.currentSchemaVersion,
    direction: 'bidirectional_neighbor',
    loss_awareness: 'none',
    availability: 'runtime_ready',
    notes: `Identity adapter descriptor for current ${input.packetType} schema compatibility.`,
  };
}

export function createRegistryCompatibilityAdapterDescriptors<TType extends PacketType>(
  input: CompatibilityDescriptorInput & {
    type: TType;
    entry: PacketCompatibilityEntry<TType>;
  }
): PacketCompatibilityAdapterDescriptor[] {
  const adapters = [createCurrentIdentityCompatibilityAdapter(input)];

  for (const [schemaVersion, versionDefinition] of Object.entries(input.entry.versions)) {
    if (
      versionDefinition.next_schema_version &&
      typeof versionDefinition.adaptToNext === 'function'
    ) {
      const nextVersion = versionDefinition.next_schema_version;
      adapters.push({
        adapter_id: `${input.baseId}.${schemaVersion}_to_${nextVersion}`,
        packet_subtype: input.packetSubtype ?? null,
        from_schema_version: schemaVersion,
        to_schema_version: nextVersion,
        direction:
          nextVersion === input.currentSchemaVersion
            ? 'upcast_to_current'
            : 'upcast_to_next',
        loss_awareness: 'loss_annotated',
        availability: 'runtime_ready',
        notes:
          'Definition descriptor for an existing compatibility-registry upcast edge; adapter output records default fills, conversions, and losses at execution time.',
      });
    }

    if (
      versionDefinition.previous_schema_version &&
      typeof versionDefinition.adaptToPrevious === 'function'
    ) {
      const previousVersion = versionDefinition.previous_schema_version;
      adapters.push({
        adapter_id: `${input.baseId}.${schemaVersion}_to_${previousVersion}`,
        packet_subtype: input.packetSubtype ?? null,
        from_schema_version: schemaVersion,
        to_schema_version: previousVersion,
        direction:
          schemaVersion === input.currentSchemaVersion
            ? 'downcast_from_current'
            : 'downcast_to_previous',
        loss_awareness: 'loss_annotated',
        availability: 'runtime_ready',
        notes:
          'Definition descriptor for an existing compatibility-registry downcast edge; adapter output records dropped, converted, or renamed data and write policy decides whether loss acknowledgement is required.',
      });
    }
  }

  return adapters;
}

export function derivePacketCompatibilityPosture(input: {
  currentSchemaVersion: string;
  adapters: readonly PacketCompatibilityAdapterDescriptor[];
  notes: string;
}): PacketCompatibilityPosture {
  const functionalAdapters = input.adapters.filter(
    (adapter) => adapter.from_schema_version !== adapter.to_schema_version
  );
  const hasFullChainEdge = functionalAdapters.some(
    (adapter) =>
      adapter.from_schema_version !== input.currentSchemaVersion &&
      adapter.to_schema_version !== input.currentSchemaVersion
  );
  const lossAwareness = input.adapters.some(
    (adapter) => adapter.loss_awareness === 'loss_ack_required'
  )
    ? 'loss_ack_required'
    : input.adapters.some((adapter) => adapter.loss_awareness === 'loss_annotated')
      ? 'loss_annotated'
      : 'none';

  return {
    strategy:
      functionalAdapters.length === 0
        ? 'current_only'
        : hasFullChainEdge
          ? 'full_chain_bundle'
          : 'current_neighbor_adapters',
    current_schema_version: input.currentSchemaVersion,
    supports_upcast: input.adapters.some((adapter) =>
      adapter.direction.startsWith('upcast')
    ),
    supports_downcast: input.adapters.some((adapter) =>
      adapter.direction.startsWith('downcast')
    ),
    loss_awareness: lossAwareness,
    notes: input.notes,
  };
}

function isCurrentIdentityAdapter(input: {
  adapter: PacketCompatibilityAdapterDescriptor;
  currentVersion: string;
}): boolean {
  return (
    input.adapter.from_schema_version === input.currentVersion &&
    input.adapter.to_schema_version === input.currentVersion &&
    input.adapter.direction === 'bidirectional_neighbor'
  );
}

function hasPathToCurrent(input: {
  adapters: readonly PacketCompatibilityAdapterDescriptor[];
  currentVersion: string;
  version: string;
}): boolean {
  const graph = new Map<string, Set<string>>();

  for (const adapter of input.adapters) {
    if (adapter.from_schema_version === adapter.to_schema_version) {
      continue;
    }

    const from = graph.get(adapter.from_schema_version) ?? new Set<string>();
    from.add(adapter.to_schema_version);
    graph.set(adapter.from_schema_version, from);

    const to = graph.get(adapter.to_schema_version) ?? new Set<string>();
    to.add(adapter.from_schema_version);
    graph.set(adapter.to_schema_version, to);
  }

  const visited = new Set<string>();
  const queue = [input.version];

  while (queue.length > 0) {
    const version = queue.shift();

    if (!version || visited.has(version)) {
      continue;
    }

    if (version === input.currentVersion) {
      return true;
    }

    visited.add(version);
    queue.push(...(graph.get(version) ?? []));
  }

  return false;
}

export function auditPacketCompatibilityStandard(
  definition: PacketTypeDefinition
): PacketCompatibilityStandardIssue[] {
  const issues: PacketCompatibilityStandardIssue[] = [];
  const currentVersion = definition.current_schema_version;
  const adapters = definition.compatibility_adapters;
  const compatibilityParts = (definition.packet_definition_parts ?? []).filter(
    (part) => part.part_subtype === 'packet_compatibility' && part.required
  );

  if (definition.compatibility.current_schema_version !== currentVersion) {
    issues.push({
      severity: 'error',
      code: 'compatibility_version_mismatch',
      path: 'compatibility.current_schema_version',
      message: `Compatibility posture current version ${definition.compatibility.current_schema_version} does not match definition current version ${currentVersion}.`,
    });
  }

  if (compatibilityParts.length === 0) {
    issues.push({
      severity: 'error',
      code: 'missing_required_compatibility_part',
      path: 'packet_definition_parts.packet_compatibility',
      message: `Definition ${definition.packet_type} must expose a required packet_compatibility definition part.`,
    });
  }

  if (!adapters.some((adapter) => isCurrentIdentityAdapter({ adapter, currentVersion }))) {
    issues.push({
      severity: 'error',
      code: 'missing_current_identity_adapter',
      path: 'compatibility_adapters',
      message: `Definition ${definition.packet_type} must expose a current-version identity compatibility adapter.`,
    });
  }

  const functionalAdapters = adapters.filter(
    (adapter) => adapter.from_schema_version !== adapter.to_schema_version
  );
  const upcastAdapters = adapters.filter((adapter) =>
    adapter.direction.startsWith('upcast')
  );
  const downcastAdapters = adapters.filter((adapter) =>
    adapter.direction.startsWith('downcast')
  );
  const descriptorLossAwareness = adapters.some(
    (adapter) => adapter.loss_awareness === 'loss_ack_required'
  )
    ? 'loss_ack_required'
    : adapters.some((adapter) => adapter.loss_awareness === 'loss_annotated')
      ? 'loss_annotated'
      : 'none';

  if (definition.compatibility.supports_upcast && upcastAdapters.length === 0) {
    issues.push({
      severity: 'error',
      code: 'compatibility_upcast_without_adapter',
      path: 'compatibility.supports_upcast',
      message: 'Compatibility posture claims upcast support but no upcast adapter descriptor exists.',
    });
  }

  if (!definition.compatibility.supports_upcast && upcastAdapters.length > 0) {
    issues.push({
      severity: 'error',
      code: 'compatibility_upcast_adapter_without_posture',
      path: 'compatibility.supports_upcast',
      message: 'Upcast adapter descriptors exist but compatibility posture does not claim upcast support.',
    });
  }

  if (definition.compatibility.supports_downcast && downcastAdapters.length === 0) {
    issues.push({
      severity: 'error',
      code: 'compatibility_downcast_without_adapter',
      path: 'compatibility.supports_downcast',
      message:
        'Compatibility posture claims downcast support but no downcast adapter descriptor exists.',
    });
  }

  if (!definition.compatibility.supports_downcast && downcastAdapters.length > 0) {
    issues.push({
      severity: 'error',
      code: 'compatibility_downcast_adapter_without_posture',
      path: 'compatibility.supports_downcast',
      message:
        'Downcast adapter descriptors exist but compatibility posture does not claim downcast support.',
    });
  }

  if (definition.compatibility.loss_awareness !== descriptorLossAwareness) {
    issues.push({
      severity: 'error',
      code: 'compatibility_loss_awareness_mismatch',
      path: 'compatibility.loss_awareness',
      message: `Compatibility posture loss awareness ${definition.compatibility.loss_awareness} does not match descriptor coverage ${descriptorLossAwareness}.`,
    });
  }

  const nonCurrentEdges = functionalAdapters.filter(
    (adapter) =>
      adapter.from_schema_version !== currentVersion &&
      adapter.to_schema_version !== currentVersion
  );

  if (
    definition.compatibility.strategy !== 'full_chain_bundle' &&
    nonCurrentEdges.length > 0
  ) {
    issues.push({
      severity: 'error',
      code: 'compatibility_full_chain_edge_without_strategy',
      path: 'compatibility.strategy',
      message:
        'Compatibility descriptors include non-current adapter edges, so the definition must use full_chain_bundle strategy.',
    });
  }

  if (
    definition.compatibility.strategy === 'current_only' &&
    functionalAdapters.length > 0
  ) {
    issues.push({
      severity: 'error',
      code: 'compatibility_current_only_with_adapter_edges',
      path: 'compatibility.strategy',
      message:
        'current_only compatibility definitions may only expose identity adapter descriptors.',
    });
  }

  const edgeIds = new Set<string>();
  for (const adapter of adapters) {
    const edgeId = `${adapter.from_schema_version}->${adapter.to_schema_version}`;

    if (edgeIds.has(edgeId)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_compatibility_edge',
        path: `compatibility_adapters.${adapter.adapter_id}`,
        message: `Duplicate compatibility adapter edge ${edgeId}.`,
      });
    }
    edgeIds.add(edgeId);

    if (adapter.notes.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'compatibility_adapter_missing_notes',
        path: `compatibility_adapters.${adapter.adapter_id}.notes`,
        message: `Compatibility adapter ${adapter.adapter_id} must describe defaults, conversions, or loss posture.`,
      });
    }

    if (
      adapter.direction.startsWith('downcast') &&
      adapter.from_schema_version !== adapter.to_schema_version &&
      adapter.loss_awareness === 'none'
    ) {
      issues.push({
        severity: 'error',
        code: 'downcast_without_loss_awareness',
        path: `compatibility_adapters.${adapter.adapter_id}.loss_awareness`,
        message: `Downcast adapter ${adapter.adapter_id} must carry loss awareness.`,
      });
    }
  }

  if (definition.compatibility.strategy === 'full_chain_bundle') {
    const versions = new Set(
      functionalAdapters.flatMap((adapter) => [
        adapter.from_schema_version,
        adapter.to_schema_version,
      ])
    );

    for (const version of versions) {
      if (
        !hasPathToCurrent({
          adapters,
          currentVersion,
          version,
        })
      ) {
        issues.push({
          severity: 'error',
          code: 'compatibility_adapter_graph_disconnected',
          path: 'compatibility_adapters',
          message: `Compatibility adapter graph has no path between ${version} and current version ${currentVersion}.`,
        });
      }
    }
  }

  return issues;
}
