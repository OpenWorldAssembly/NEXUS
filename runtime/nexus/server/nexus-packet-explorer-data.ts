/**
 * File: nexus-packet-explorer-data.ts
 * Description: Builds Packet Explorer payloads from the shared browser query service, packet store, and runtime projection helpers.
 */

import { interpretPacket } from '@core/packets/packet-interpreter';
import type {
  NexusActionIntentDescriptor,
  NexusActionMap,
} from '@core/contracts';
import type {
  PacketCompatibilityReadResult,
  PacketEnvelope,
  PacketFamily,
} from '@core/schema/packet-schema';
import type {
  NexusPacketExplorerAdaptationSummary,
  NexusPacketExplorerInspectionLens,
  NexusPacketExplorerLinkGroup,
  NexusPacketExplorerLinkRow,
  NexusPacketExplorerPayload,
  NexusPacketExplorerScopeSummary,
  NexusPacketExplorerSummary,
} from '@runtime/nexus/nexus-api-types';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';

type PacketExplorerDataServices = Pick<
  NexusPacketServices,
  'packetStore' | 'browserQueryService' | 'discussionService'
>;

const EXPLORER_DEBUG_ENABLED = process.env.NODE_ENV !== 'production';
const DISCUSSION_FAMILIES = new Set<PacketFamily>([
  'Discussion',
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
]);

function logExplorerStage(
  packetId: string,
  stage: string,
  details: string
): void {
  if (!EXPLORER_DEBUG_ENABLED) {
    return;
  }

  console.info(`[Packet Explorer] ${packetId} :: ${stage} :: ${details}`);
}

async function runExplorerStage<TValue>(input: {
  packetId: string;
  stage: string;
  run: () => Promise<TValue>;
}): Promise<TValue> {
  const startedAt = Date.now();

  try {
    const value = await input.run();

    logExplorerStage(
      input.packetId,
      input.stage,
      `ok (${Date.now() - startedAt}ms)`
    );

    return value;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Unknown ${input.stage} failure.`;

    logExplorerStage(
      input.packetId,
      input.stage,
      `error (${Date.now() - startedAt}ms): ${message}`
    );

    throw new Error(
      `Packet Explorer failed during ${input.stage} for ${input.packetId}: ${message}`
    );
  }
}

function getPacketKind(packet: PacketEnvelope): string | null {
  const body = packet.body as Record<string, unknown>;

  if (typeof body.kind === 'string') {
    return body.kind;
  }

  if (typeof body.role === 'string') {
    return body.role;
  }

  if (typeof body.claim_kind === 'string') {
    return body.claim_kind;
  }

  if (typeof body.attestation_kind === 'string') {
    return body.attestation_kind;
  }

  if (typeof body.subtype === 'string') {
    return body.subtype;
  }

  if (typeof body.role_kind === 'string') {
    return body.role_kind;
  }

  if (typeof body.proposal_kind === 'string') {
    return body.proposal_kind;
  }

  if (typeof body.vote_method === 'string') {
    return body.vote_method;
  }

  if (typeof body.forum_kind === 'string') {
    return body.forum_kind;
  }

  if (typeof body.thread_kind === 'string') {
    return body.thread_kind;
  }

  if (typeof body.post_kind === 'string') {
    return body.post_kind;
  }

  return null;
}

async function getScopeSummary(
  services: PacketExplorerDataServices,
  packetId: string
): Promise<NexusPacketExplorerScopeSummary> {
  const packetProjection = await services.browserQueryService.getPacket({
    packet_id: packetId,
  });

  return {
    packet_id: packetId,
    label: packetProjection?.title ?? packetProjection?.label ?? null,
  };
}

function toAdaptationSummary(
  compatibilityRead: PacketCompatibilityReadResult,
  readModelInterpretation: ReturnType<typeof interpretPacket> | null,
  readModelWarnings: string[]
): NexusPacketExplorerAdaptationSummary {
  if (readModelInterpretation) {
    return {
      compatibility_mode: readModelInterpretation.compatibility_mode,
      source_family: readModelInterpretation.source_family,
      target_family: readModelInterpretation.target_family,
      source_schema_version: readModelInterpretation.source_schema_version,
      target_schema_version: readModelInterpretation.target_schema_version,
      stages: [...readModelInterpretation.stages],
      changes: readModelInterpretation.changes,
      losses: readModelInterpretation.losses,
      warnings: [...readModelInterpretation.warnings, ...readModelWarnings],
      requires_guarded_migration:
        readModelInterpretation.requires_guarded_migration,
      requires_loss_acknowledgement:
        readModelInterpretation.requires_loss_acknowledgement,
    };
  }

  return {
    compatibility_mode: compatibilityRead.status.is_lossy
      ? 'lossy'
      : compatibilityRead.status.direction === 'downcast'
        ? 'downcast'
        : compatibilityRead.status.is_exact
          ? 'native'
          : 'adapted',
    source_family: compatibilityRead.adapted_packet.header.family,
    target_family: compatibilityRead.adapted_packet.header.family,
    source_schema_version: compatibilityRead.status.source_schema_version,
    target_schema_version: compatibilityRead.status.target_schema_version,
    stages: ['raw_packet_read', 'same_family_adaptation'],
    changes: compatibilityRead.status.changes,
    losses: compatibilityRead.status.losses,
    warnings: readModelWarnings,
    requires_guarded_migration:
      compatibilityRead.status.requires_guarded_upgrade,
    requires_loss_acknowledgement:
      compatibilityRead.status.requires_loss_acknowledgement,
  };
}

function getLinksBasis(): NexusPacketExplorerPayload['links_basis'] {
  return 'current_indexed_graph';
}

function getActionsBasis(): NexusPacketExplorerPayload['actions_basis'] {
  return 'runtime_operational';
}

async function resolveExplorerLinks(input: {
  services: PacketExplorerDataServices;
  packetId: string;
  direction: 'incoming' | 'outgoing';
}): Promise<NexusPacketExplorerLinkRow[]> {
  const edges =
    input.direction === 'incoming'
      ? await input.services.browserQueryService.listIncomingLinks({
          packet_id: input.packetId,
        })
      : await input.services.browserQueryService.listOutgoingLinks({
          packet_id: input.packetId,
        });
  const relatedPacketIds = Array.from(
    new Set(edges.map((edge) => edge.target.packet_id))
  );
  const relatedEntries = await Promise.all(
    relatedPacketIds.map(async (packetId) => {
      const projection = await input.services.browserQueryService.getPacket({
        packet_id: packetId,
      });

      return [packetId, projection] as const;
    })
  );
  const projectionByPacketId = new Map(relatedEntries);

  return edges.map((edge) => {
    const relatedProjection = projectionByPacketId.get(edge.target.packet_id) ?? null;
    const metadata = edge.metadata as Record<string, unknown>;
    const sourceRevisionId =
      typeof metadata.source_revision_id === 'string'
        ? metadata.source_revision_id
        : null;

    return {
      direction: input.direction,
      edge_type: edge.edge_type,
      packet_id: edge.target.packet_id,
      revision_id:
        input.direction === 'incoming'
          ? sourceRevisionId
          : relatedProjection?.revision.revision_id ?? null,
      family: relatedProjection?.family ?? null,
      label: relatedProjection?.label ?? null,
      title: relatedProjection?.title ?? null,
      metadata,
    };
  });
}

function groupExplorerLinks(
  links: NexusPacketExplorerLinkRow[]
): NexusPacketExplorerLinkGroup[] {
  const groups = new Map<string, NexusPacketExplorerLinkGroup>();

  for (const link of links) {
    const existingGroup = groups.get(link.packet_id);

    if (!existingGroup) {
      groups.set(link.packet_id, {
        direction: link.direction,
        packet_id: link.packet_id,
        family: link.family,
        label: link.label,
        title: link.title,
        total_count: 1,
        edge_type_counts: [
          {
            edge_type: link.edge_type,
            count: 1,
          },
        ],
        rows: [link],
      });
      continue;
    }

    existingGroup.total_count += 1;
    existingGroup.rows.push(link);
    const existingEdgeType = existingGroup.edge_type_counts.find(
      (edgeType) => edgeType.edge_type === link.edge_type
    );

    if (existingEdgeType) {
      existingEdgeType.count += 1;
    } else {
      existingGroup.edge_type_counts.push({
        edge_type: link.edge_type,
        count: 1,
      });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    edge_type_counts: [...group.edge_type_counts].sort((left, right) =>
      left.edge_type.localeCompare(right.edge_type)
    ),
    rows: [...group.rows].sort((left, right) => {
      if (left.edge_type !== right.edge_type) {
        return left.edge_type.localeCompare(right.edge_type);
      }

      return (left.revision_id ?? '').localeCompare(right.revision_id ?? '');
    }),
  }));
}

async function resolveExplorerActions(input: {
  services: PacketExplorerDataServices;
  packetId: string;
  adaptedPacket: PacketEnvelope;
  viewerActorPacketId: string | null;
}): Promise<{
  actions: NexusActionMap;
  actionDescriptors: NexusActionIntentDescriptor[];
}> {
  if (!DISCUSSION_FAMILIES.has(input.adaptedPacket.header.family)) {
    return {
      actions: {},
      actionDescriptors: [],
    };
  }

  const actionInspection =
    await input.services.discussionService.inspectPacketActionsForExplorer({
      packet_id: input.packetId,
      viewer_actor_key: input.viewerActorPacketId
        ? `element:${input.viewerActorPacketId}`
        : null,
    });

  return {
    actions: actionInspection.actions,
    actionDescriptors: [...actionInspection.action_descriptors],
  };
}

export async function buildNexusPacketExplorerPayload(input: {
  services: PacketExplorerDataServices;
  packetId: string;
  viewerActorPacketId?: string | null;
  inspectionLens?: NexusPacketExplorerInspectionLens;
}): Promise<NexusPacketExplorerPayload> {
  const { services, packetId } = input;
  const packetProjection = await runExplorerStage({
    packetId,
    stage: 'packet summary lookup',
    run: async () =>
      services.browserQueryService.getPacket({
        packet_id: packetId,
      }),
  });
  const preferredRevision = await runExplorerStage({
    packetId,
    stage: 'preferred revision lookup',
    run: async () =>
      services.packetStore.fetchPreferredRevision({
        packet_id: packetId,
      }),
  });
  const revisionHeads = await runExplorerStage({
    packetId,
    stage: 'head revision lookup',
    run: async () =>
      services.browserQueryService.getRevisionHeads({
        packet_id: packetId,
      }),
  });
  const compatibilityRead = await runExplorerStage({
    packetId,
    stage: 'raw/adapted packet read',
    run: async () =>
      services.packetStore.readByPacket(
        {
          packet_id: packetId,
        },
        {
          mode: 'raw_plus_adaptation',
        }
      ),
  });

  if (!packetProjection || !preferredRevision || !compatibilityRead) {
    throw new Error(`Unknown packet: ${packetId}`);
  }

  const adaptedPacket = compatibilityRead.adapted_packet;
  const authorityScope = adaptedPacket.header.authority_scope_ref
    ? await runExplorerStage({
        packetId,
        stage: 'authority scope lookup',
        run: async () =>
          getScopeSummary(
            services,
            adaptedPacket.header.authority_scope_ref!.packet_id
          ),
      })
    : null;
  const applicableScopes = await runExplorerStage({
    packetId,
    stage: 'applicable scope lookup',
    run: async () =>
      Promise.all(
        adaptedPacket.header.applicable_scope_refs.map((scopeRef) =>
          getScopeSummary(services, scopeRef.packet_id)
        )
      ),
  });
  const readModelResult = await runExplorerStage({
    packetId,
    stage: 'read model projection',
    run: async () => {
      try {
        return {
          interpretation: interpretPacket({
            packet: compatibilityRead.raw_packet,
            target: {
              mode: 'read_model',
              read_model_id: 'nexus-interface@1',
            },
          }),
          warning: null,
        } as const;
      } catch (error) {
        return {
          interpretation: null,
          warning:
            error instanceof Error
              ? error.message
              : 'Read model interpretation is unavailable for this packet.',
        } as const;
      }
    },
  });
  const incomingLinks = await runExplorerStage({
    packetId,
    stage: 'incoming link query',
    run: async () =>
      resolveExplorerLinks({
        services,
        packetId,
        direction: 'incoming',
      }),
  });
  const outgoingLinks = await runExplorerStage({
    packetId,
    stage: 'outgoing link query',
    run: async () =>
      resolveExplorerLinks({
        services,
        packetId,
        direction: 'outgoing',
      }),
  });
  const actionInspection = await runExplorerStage({
    packetId,
    stage: 'action inspection',
    run: async () =>
      resolveExplorerActions({
        services,
        packetId,
        adaptedPacket,
        viewerActorPacketId: input.viewerActorPacketId ?? null,
      }),
  });
  const packetSummary: NexusPacketExplorerSummary = {
    packet: {
      packet_id: adaptedPacket.header.packet_id,
    },
    revision: preferredRevision,
    family: adaptedPacket.header.family,
    label: packetProjection.label,
    title: packetProjection.title,
    summary: packetProjection.summary,
    kind: getPacketKind(adaptedPacket),
    schema_version: adaptedPacket.header.schema_version,
    created_at: adaptedPacket.header.created_at,
    authority_scope: authorityScope,
    applicable_scopes: applicableScopes,
  };
  const readModelWarnings = readModelResult.warning
    ? [readModelResult.warning]
    : [];
  const inspectionLens = input.inspectionLens ?? 'summary';
  const incomingLinkGroups = groupExplorerLinks(incomingLinks);
  const outgoingLinkGroups = groupExplorerLinks(outgoingLinks);

  return {
    inspection_lens: inspectionLens,
    packet_summary: packetSummary,
    preferred_revision: preferredRevision,
    head_revisions: revisionHeads.head_revisions,
    revision_state: revisionHeads.revision_state,
    raw_view: compatibilityRead.raw_packet,
    adapted_view: compatibilityRead.adapted_packet,
    read_model_view: readModelResult.interpretation?.interpreted ?? null,
    adaptation_summary: toAdaptationSummary(
      compatibilityRead,
      readModelResult.interpretation,
      readModelWarnings
    ),
    links_basis: getLinksBasis(),
    actions_basis: getActionsBasis(),
    incoming_links: incomingLinks,
    outgoing_links: outgoingLinks,
    incoming_link_groups: incomingLinkGroups,
    outgoing_link_groups: outgoingLinkGroups,
    actions: actionInspection.actions,
    action_descriptors: actionInspection.actionDescriptors,
  };
}

/**
 * Inputs: one packet id.
 * Output: the read-only Packet Explorer payload for the current preferred revision.
 */
export async function getNexusPacketExplorerPayload(input: {
  packetId: string;
  viewerActorPacketId?: string | null;
  inspectionLens?: NexusPacketExplorerInspectionLens;
}): Promise<NexusPacketExplorerPayload> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerPayload({
    services,
    packetId: input.packetId,
    viewerActorPacketId: input.viewerActorPacketId ?? null,
    inspectionLens: input.inspectionLens,
  });
}
