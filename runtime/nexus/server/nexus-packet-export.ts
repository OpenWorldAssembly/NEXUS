/**
 * File: nexus-packet-export.ts
 * Description: Builds Packet Explorer raw-packet and bundle export artifacts over the shared packet services.
 */

import type { PacketEnvelope, PacketRef } from '@core/schema/packet-schema';
import type {
  NexusPacketExplorerBundleExportMode,
  NexusPacketExplorerExportArtifactMode,
  NexusPacketExplorerExportPreviewPayload,
  NexusPacketExplorerExportRequest,
} from '@runtime/nexus/nexus-api-types';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';

type PacketExportServices = Pick<NexusPacketServices, 'packetStore'>;

const PREVIEW_BYTE_LIMIT = 1024 * 1024;
const DOWNLOAD_BYTE_LIMIT = 25 * 1024 * 1024;

type ResolvedExportArtifact = {
  artifactMode: NexusPacketExplorerExportArtifactMode;
  exportMode: NexusPacketExplorerExportPreviewPayload['export_mode'];
  rootPacketRefs: PacketRef[];
  title: string | null;
  note: string | null;
  packetCount: number;
  revisionCount: number;
  byteCount: number;
  fileName: string;
  jsonText: string;
};

function trimOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isBundleExportMode(
  value: unknown
): value is NexusPacketExplorerBundleExportMode {
  return (
    value === 'packet_history' ||
    value === 'with_references' ||
    value === 'with_referrers' ||
    value === 'with_scope_stack' ||
    value === 'with_references_referrers_scope_stack' ||
    value === 'full_store'
  );
}

function sanitizeFileNameSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'export';
}

function buildExportFileName(input: {
  artifactMode: NexusPacketExplorerExportArtifactMode;
  exportMode: NexusPacketExplorerExportPreviewPayload['export_mode'];
  rootPacketId?: string | null;
  title?: string | null;
}): string {
  const preferredLabel =
    trimOptionalString(input.title) ??
    trimOptionalString(input.rootPacketId)?.split('/').at(-1) ??
    null;
  const labelPart = preferredLabel
    ? `-${sanitizeFileNameSegment(preferredLabel)}`
    : '';
  const modePart = sanitizeFileNameSegment(input.exportMode);
  const artifactPrefix =
    input.artifactMode === 'raw_packet' ? 'nexus-packet' : 'nexus-bundle';

  return `${artifactPrefix}-${modePart}${labelPart}.json`;
}

function encodeJson(value: unknown): { text: string; byteCount: number } {
  const text = JSON.stringify(value, null, 2);
  const byteCount = new TextEncoder().encode(text).byteLength;

  return { text, byteCount };
}

function ensureDownloadSizeWithinLimit(byteCount: number): void {
  if (byteCount > DOWNLOAD_BYTE_LIMIT) {
    throw new Error(
      'This export is too large for the current phase-1 download limit. Narrow the export scope and try again.'
    );
  }
}

function parseRootPacketId(
  requestBody: NexusPacketExplorerExportRequest
): string | null {
  const packetId = trimOptionalString(requestBody.root_packet_id ?? null);

  return packetId;
}

export function parseNexusPacketExplorerExportRequest(
  input: unknown
): NexusPacketExplorerExportRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('Explorer export requests must use a JSON object body.');
  }

  const candidate = input as Record<string, unknown>;
  const artifactMode = candidate.artifact_mode;

  if (artifactMode !== 'raw_packet' && artifactMode !== 'bundle') {
    throw new Error('Explorer export requests must declare a valid artifact mode.');
  }

  const requestBody: NexusPacketExplorerExportRequest = {
    artifact_mode: artifactMode,
    root_packet_id:
      typeof candidate.root_packet_id === 'string'
        ? candidate.root_packet_id
        : null,
    bundle_mode:
      candidate.bundle_mode == null
        ? null
        : isBundleExportMode(candidate.bundle_mode)
          ? candidate.bundle_mode
          : null,
    title: typeof candidate.title === 'string' ? candidate.title : null,
    note: typeof candidate.note === 'string' ? candidate.note : null,
  };

  if (
    requestBody.bundle_mode !== null &&
    requestBody.bundle_mode !== undefined &&
    !isBundleExportMode(requestBody.bundle_mode)
  ) {
    throw new Error('Explorer bundle exports must use a supported bundle mode.');
  }

  return requestBody;
}

async function getPreferredRawPacket(input: {
  services: PacketExportServices;
  packetId: string;
}): Promise<PacketEnvelope> {
  const preferredRevision = await input.services.packetStore.fetchPreferredRevision({
    packet_id: input.packetId,
  });

  if (!preferredRevision) {
    throw new Error(`No preferred revision exists for ${input.packetId}.`);
  }

  const rawPacket = await input.services.packetStore.readByRevision(preferredRevision, {
    mode: 'raw',
  });

  if (!rawPacket) {
    throw new Error(`Unable to load the raw preferred revision for ${input.packetId}.`);
  }

  return rawPacket as PacketEnvelope;
}

async function resolvePacketWithPreferredHeader(input: {
  services: PacketExportServices;
  packetId: string;
}): Promise<PacketEnvelope> {
  const packet = await input.services.packetStore.fetchByPacket({
    packet_id: input.packetId,
  });

  if (!packet) {
    throw new Error(`Unable to resolve packet ${input.packetId} for export.`);
  }

  return packet;
}

async function collectOutgoingReferencePacketIds(input: {
  services: PacketExportServices;
  packetId: string;
}): Promise<string[]> {
  const packet = await resolvePacketWithPreferredHeader(input);

  return Array.from(
    new Set(packet.header.edges.map((edge) => edge.target.packet_id))
  );
}

async function collectIncomingReferrerPacketIds(input: {
  services: PacketExportServices;
  packetId: string;
}): Promise<string[]> {
  const edges = await input.services.packetStore.queryEdges(
    { packet_id: input.packetId },
    { direction: 'incoming' }
  );

  return Array.from(new Set(edges.map((edge) => edge.target.packet_id)));
}

async function collectScopeStackPacketIds(input: {
  services: PacketExportServices;
  packetId: string;
}): Promise<string[]> {
  const rootPacket = await resolvePacketWithPreferredHeader(input);
  const seedScopeIds = [
    rootPacket.header.authority_scope_ref?.packet_id ?? null,
    ...rootPacket.header.applicable_scope_refs.map((scopeRef) => scopeRef.packet_id),
  ].filter((scopeId): scopeId is string => typeof scopeId === 'string');
  const seenScopeIds = new Set<string>();
  const orderedScopeIds: string[] = [];
  const queue = [...seedScopeIds];

  while (queue.length > 0) {
    const scopePacketId = queue.shift();

    if (!scopePacketId || seenScopeIds.has(scopePacketId)) {
      continue;
    }

    seenScopeIds.add(scopePacketId);
    orderedScopeIds.push(scopePacketId);

    const scopePacket = await input.services.packetStore.fetchByPacket({
      packet_id: scopePacketId,
    });

    const parentScopeIds =
      scopePacket?.header.edges
        .filter((edge) => edge.edge_type === 'parent_scope')
        .map((edge) => edge.target.packet_id) ?? [];

    for (const parentScopeId of parentScopeIds) {
      if (!seenScopeIds.has(parentScopeId)) {
        queue.push(parentScopeId);
      }
    }
  }

  return orderedScopeIds;
}

async function resolveBundlePacketIds(input: {
  services: PacketExportServices;
  rootPacketId: string;
  bundleMode: Exclude<NexusPacketExplorerBundleExportMode, 'full_store'>;
}): Promise<string[]> {
  const packetIds = new Set<string>([input.rootPacketId]);

  if (
    input.bundleMode === 'with_references' ||
    input.bundleMode === 'with_references_referrers_scope_stack'
  ) {
    for (const packetId of await collectOutgoingReferencePacketIds({
      services: input.services,
      packetId: input.rootPacketId,
    })) {
      packetIds.add(packetId);
    }
  }

  if (
    input.bundleMode === 'with_referrers' ||
    input.bundleMode === 'with_references_referrers_scope_stack'
  ) {
    for (const packetId of await collectIncomingReferrerPacketIds({
      services: input.services,
      packetId: input.rootPacketId,
    })) {
      packetIds.add(packetId);
    }
  }

  if (
    input.bundleMode === 'with_scope_stack' ||
    input.bundleMode === 'with_references_referrers_scope_stack'
  ) {
    for (const packetId of await collectScopeStackPacketIds({
      services: input.services,
      packetId: input.rootPacketId,
    })) {
      packetIds.add(packetId);
    }
  }

  return Array.from(packetIds);
}

function toRootPacketRefs(rootPacketId: string | null): PacketRef[] {
  return rootPacketId ? [{ packet_id: rootPacketId }] : [];
}

async function buildRawPacketExport(input: {
  services: PacketExportServices;
  requestBody: NexusPacketExplorerExportRequest;
}): Promise<ResolvedExportArtifact> {
  const rootPacketId = parseRootPacketId(input.requestBody);

  if (!rootPacketId) {
    throw new Error('Raw packet export requires a selected packet.');
  }

  const rawPacket = await getPreferredRawPacket({
    services: input.services,
    packetId: rootPacketId,
  });
  const encoded = encodeJson(rawPacket);

  ensureDownloadSizeWithinLimit(encoded.byteCount);

  return {
    artifactMode: 'raw_packet',
    exportMode: 'raw_current_preferred',
    rootPacketRefs: toRootPacketRefs(rootPacketId),
    title: null,
    note: null,
    packetCount: 1,
    revisionCount: 1,
    byteCount: encoded.byteCount,
    fileName: buildExportFileName({
      artifactMode: 'raw_packet',
      exportMode: 'raw_current_preferred',
      rootPacketId,
    }),
    jsonText: encoded.text,
  };
}

async function buildBundleExport(input: {
  services: PacketExportServices;
  requestBody: NexusPacketExplorerExportRequest;
}): Promise<ResolvedExportArtifact> {
  const bundleMode = input.requestBody.bundle_mode ?? 'packet_history';
  const title = trimOptionalString(input.requestBody.title ?? null);
  const note = trimOptionalString(input.requestBody.note ?? null);
  const rootPacketId = parseRootPacketId(input.requestBody);

  if (bundleMode !== 'full_store' && !rootPacketId) {
    throw new Error('Bundle export requires a selected packet unless exporting the full local store.');
  }

  const packetIds =
    bundleMode === 'full_store'
      ? await input.services.packetStore.listPacketIds()
      : await resolveBundlePacketIds({
          services: input.services,
          rootPacketId: rootPacketId!,
          bundleMode,
        });

  if (packetIds.length === 0) {
    throw new Error('There are no packet ids available for this export scope.');
  }

  const exportedBundle = await input.services.packetStore.exportBundle(
    packetIds.map((packetId) => ({ packet_id: packetId }))
  );
  const parsedExport = JSON.parse(
    new TextDecoder().decode(exportedBundle.bytes)
  ) as {
    bundle_version: number;
    exported_at: string;
    packets: unknown[];
  };
  const payload = {
    bundle_version: parsedExport.bundle_version,
    exported_at: parsedExport.exported_at,
    export_mode: bundleMode,
    root_packet_refs: bundleMode === 'full_store' ? [] : toRootPacketRefs(rootPacketId),
    title,
    note,
    packet_count: exportedBundle.packet_count,
    revision_count: exportedBundle.revision_count,
    packets: parsedExport.packets,
  };
  const encoded = encodeJson(payload);

  ensureDownloadSizeWithinLimit(encoded.byteCount);

  return {
    artifactMode: 'bundle',
    exportMode: bundleMode,
    rootPacketRefs: bundleMode === 'full_store' ? [] : toRootPacketRefs(rootPacketId),
    title,
    note,
    packetCount: exportedBundle.packet_count,
    revisionCount: exportedBundle.revision_count,
    byteCount: encoded.byteCount,
    fileName: buildExportFileName({
      artifactMode: 'bundle',
      exportMode: bundleMode,
      rootPacketId,
      title,
    }),
    jsonText: encoded.text,
  };
}

async function buildResolvedExportArtifact(input: {
  services: PacketExportServices;
  requestBody: NexusPacketExplorerExportRequest;
}): Promise<ResolvedExportArtifact> {
  if (input.requestBody.artifact_mode === 'raw_packet') {
    return buildRawPacketExport(input);
  }

  return buildBundleExport(input);
}

export async function buildNexusPacketExplorerExportPreview(input: {
  services: PacketExportServices;
  requestBody: NexusPacketExplorerExportRequest;
}): Promise<NexusPacketExplorerExportPreviewPayload> {
  const artifact = await buildResolvedExportArtifact(input);

  return {
    artifact_mode: artifact.artifactMode,
    export_mode: artifact.exportMode,
    root_packet_refs: artifact.rootPacketRefs,
    title: artifact.title,
    note: artifact.note,
    packet_count: artifact.packetCount,
    revision_count: artifact.revisionCount,
    byte_count: artifact.byteCount,
    file_name: artifact.fileName,
    preview_suppressed: artifact.byteCount > PREVIEW_BYTE_LIMIT,
    preview_json:
      artifact.byteCount > PREVIEW_BYTE_LIMIT ? null : artifact.jsonText,
  };
}

export async function buildNexusPacketExplorerExportDownload(input: {
  services: PacketExportServices;
  requestBody: NexusPacketExplorerExportRequest;
}): Promise<{
  bytes: Uint8Array;
  fileName: string;
}> {
  const artifact = await buildResolvedExportArtifact(input);

  return {
    bytes: new TextEncoder().encode(artifact.jsonText),
    fileName: artifact.fileName,
  };
}

export async function getNexusPacketExplorerExportPreview(
  requestBody: NexusPacketExplorerExportRequest
): Promise<NexusPacketExplorerExportPreviewPayload> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerExportPreview({
    services,
    requestBody,
  });
}

export async function getNexusPacketExplorerExportDownload(
  requestBody: NexusPacketExplorerExportRequest
): Promise<{
  bytes: Uint8Array;
  fileName: string;
}> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerExportDownload({
    services,
    requestBody,
  });
}
