/**
 * File: nexus-packet-import.ts
 * Description: Analyzes and commits Packet Explorer import requests over the shared packet store.
 */

import {
  inspectPacketEnvelope,
  type PacketEnvelope,
  type PacketRef,
} from '@core/schema/packet-schema';
import type {
  NexusPacketExplorerImportArtifactType,
  NexusPacketExplorerImportCommitPayload,
  NexusPacketExplorerImportPreviewPayload,
  NexusPacketExplorerImportRequest,
} from '@runtime/nexus/nexus-api-types';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';

type PacketImportServices = Pick<NexusPacketServices, 'packetStore'>;

type NormalizedImportEntry = {
  rawPacket: unknown;
  adaptedPacket: PacketEnvelope;
};

type NormalizedImportSource = {
  artifactType: NexusPacketExplorerImportArtifactType;
  bundleVersion: string | number | null;
  title: string | null;
  note: string | null;
  exportMode: string | null;
  rootPacketRefs: PacketRef[];
  rawEntries: unknown[];
};

type AnalyzedImport = {
  payload: NexusPacketExplorerImportPreviewPayload;
  normalizedBundleText: string | null;
  affectedPacketIds: string[];
  packetIdsWithNewRevisions: string[];
};

type PreferredSnapshot = {
  preferredRevisionId: string | null;
  headRevisionIds: string[];
};

function trimOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function parsePacketRefs(input: unknown): PacketRef[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((value) => {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const packetId = (value as Record<string, unknown>).packet_id;

    return typeof packetId === 'string' ? [{ packet_id: packetId }] : [];
  });
}

function getImportStatus(input: {
  hasInvalidJson: boolean;
  blockingErrors: string[];
  newRevisionCount: number;
  duplicateRevisionCount: number;
  warnings: string[];
}): NexusPacketExplorerImportPreviewPayload['status'] {
  if (input.hasInvalidJson) {
    return 'invalid_json';
  }

  if (input.blockingErrors.length > 0) {
    return 'blocked';
  }

  if (input.newRevisionCount === 0 && input.duplicateRevisionCount > 0) {
    return 'duplicates_only';
  }

  if (input.warnings.length > 0) {
    return 'partial_risk';
  }

  return 'ready';
}

function getRevisionKey(packetId: string, revisionId: string): string {
  return `${packetId}::${revisionId}`;
}

function buildBlockedPreviewPayload(input: {
  sourceFileName: string | null;
  status: NexusPacketExplorerImportPreviewPayload['status'];
  blockingErrors: string[];
}): NexusPacketExplorerImportPreviewPayload {
  return {
    artifact_type: null,
    bundle_version: null,
    title: null,
    note: null,
    export_mode: null,
    root_packet_refs: [],
    packet_count: 0,
    revision_count: 0,
    unique_packet_count: 0,
    unique_revision_count: 0,
    new_revision_count: 0,
    duplicate_revision_count: 0,
    affected_packet_count: 0,
    affected_packet_ids: [],
    missing_parent_count: 0,
    invalid_entry_count: 0,
    family_conflict_count: 0,
    status: input.status,
    blocking_errors: input.blockingErrors,
    warnings: [],
    open_packet_id: null,
    source_file_name: input.sourceFileName,
  };
}

function orderImportEntries(input: {
  entries: NormalizedImportEntry[];
  existingRevisionPresence: Map<string, boolean>;
}): NormalizedImportEntry[] {
  const pendingEntries = [...input.entries];
  const orderedEntries: NormalizedImportEntry[] = [];
  const availableRevisionKeys = new Set<string>();

  for (const [revisionKey, exists] of input.existingRevisionPresence.entries()) {
    if (exists) {
      availableRevisionKeys.add(revisionKey);
    }
  }

  while (pendingEntries.length > 0) {
    let didProgress = false;

    for (let entryIndex = 0; entryIndex < pendingEntries.length; entryIndex += 1) {
      const entry = pendingEntries[entryIndex]!;
      const revisionKey = getRevisionKey(
        entry.adaptedPacket.header.packet_id,
        entry.adaptedPacket.header.revision_id
      );
      const parentsAreAvailable = entry.adaptedPacket.header.parent_revision_refs.every(
        (parentRevision) =>
          availableRevisionKeys.has(
            getRevisionKey(parentRevision.packet_id, parentRevision.revision_id)
          )
      );

      if (!parentsAreAvailable) {
        continue;
      }

      orderedEntries.push(entry);
      availableRevisionKeys.add(revisionKey);
      pendingEntries.splice(entryIndex, 1);
      entryIndex -= 1;
      didProgress = true;
    }

    if (!didProgress) {
      orderedEntries.push(...pendingEntries);
      break;
    }
  }

  return orderedEntries;
}

function normalizeImportSource(
  requestBody: NexusPacketExplorerImportRequest
): NormalizedImportSource {
  const sourceText = requestBody.source_text.trim();

  if (sourceText.length === 0) {
    throw new SyntaxError('Paste JSON or upload a .json file to analyze.');
  }

  const parsed = JSON.parse(sourceText) as unknown;

  if (Array.isArray(parsed)) {
    return {
      artifactType: 'revision_array',
      bundleVersion: null,
      title: null,
      note: null,
      exportMode: null,
      rootPacketRefs: [],
      rawEntries: parsed,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      artifactType: 'raw_packet',
      bundleVersion: null,
      title: null,
      note: null,
      exportMode: null,
      rootPacketRefs: [],
      rawEntries: [parsed],
    };
  }

  const candidate = parsed as Record<string, unknown>;
  const packets = Array.isArray(candidate.packets) ? candidate.packets : null;
  const revisions = Array.isArray(candidate.revisions) ? candidate.revisions : null;

  if (packets || revisions) {
    return {
      artifactType: 'bundle',
      bundleVersion:
        typeof candidate.bundle_version === 'string' ||
        typeof candidate.bundle_version === 'number'
          ? candidate.bundle_version
          : null,
      title: trimOptionalString(
        typeof candidate.title === 'string' ? candidate.title : null
      ),
      note: trimOptionalString(
        typeof candidate.note === 'string' ? candidate.note : null
      ),
      exportMode:
        typeof candidate.export_mode === 'string' ? candidate.export_mode : null,
      rootPacketRefs: parsePacketRefs(candidate.root_packet_refs),
      rawEntries: packets ?? revisions ?? [],
    };
  }

  return {
    artifactType: 'raw_packet',
    bundleVersion: null,
    title: null,
    note: null,
    exportMode: null,
    rootPacketRefs: [],
    rawEntries: [parsed],
  };
}

async function analyzeImportRequest(input: {
  services: PacketImportServices;
  requestBody: NexusPacketExplorerImportRequest;
}): Promise<AnalyzedImport> {
  const sourceFileName = trimOptionalString(input.requestBody.file_name ?? null);

  let normalizedSource: NormalizedImportSource;

  try {
    normalizedSource = normalizeImportSource(input.requestBody);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Import source is not valid JSON.';

    return {
      payload: buildBlockedPreviewPayload({
        sourceFileName,
        status: 'invalid_json',
        blockingErrors: [message],
      }),
      normalizedBundleText: null,
      affectedPacketIds: [],
      packetIdsWithNewRevisions: [],
    };
  }

  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const validEntries: NormalizedImportEntry[] = [];
  const packetIdsWithConflicts = new Set<string>();
  const packetFamiliesById = new Map<string, string>();

  normalizedSource.rawEntries.forEach((rawEntry, entryIndex) => {
    try {
      const compatibilityRead = inspectPacketEnvelope(rawEntry);
      const adaptedPacket = compatibilityRead.adapted_packet;
      const packetId = adaptedPacket.header.packet_id;
      const family = adaptedPacket.header.family;
      const knownFamily = packetFamiliesById.get(packetId) ?? null;

      if (knownFamily && knownFamily !== family) {
        packetIdsWithConflicts.add(packetId);
        blockingErrors.push(
          `Packet ${packetId} appears with conflicting families (${knownFamily} and ${family}) inside this import source.`
        );
      } else {
        packetFamiliesById.set(packetId, family);
      }

      validEntries.push({
        rawPacket: rawEntry,
        adaptedPacket,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Packet entry is malformed.';

      blockingErrors.push(`Entry ${entryIndex + 1}: ${message}`);
    }
  });

  const packetIdKeys = Array.from(
    new Set(validEntries.map((entry) => entry.adaptedPacket.header.packet_id))
  );
  const existingPackets = new Map<string, PacketEnvelope | null>();

  await Promise.all(
    packetIdKeys.map(async (packetId) => {
      const packet = await input.services.packetStore.fetchByPacket({
        packet_id: packetId,
      });
      existingPackets.set(packetId, packet);
    })
  );

  for (const entry of validEntries) {
    const packetId = entry.adaptedPacket.header.packet_id;
    const existingPacket = existingPackets.get(packetId) ?? null;

    if (
      existingPacket &&
      existingPacket.header.family !== entry.adaptedPacket.header.family
    ) {
      packetIdsWithConflicts.add(packetId);
    }
  }

  for (const packetId of packetIdsWithConflicts) {
    const existingPacket = existingPackets.get(packetId) ?? null;

    if (existingPacket) {
      blockingErrors.push(
        `Packet ${packetId} already exists locally as ${existingPacket.header.family}, which conflicts with this import source.`
      );
    }
  }

  const seenRevisionKeys = new Set<string>();
  const importedRevisionIdsByPacketId = new Map<string, Set<string>>();
  const existingRevisionPresence = new Map<string, boolean>();
  const packetIdsWithNewRevisions = new Set<string>();
  let duplicateRevisionCount = 0;
  let newRevisionCount = 0;

  for (const entry of validEntries) {
    const packetId = entry.adaptedPacket.header.packet_id;
    const revisionId = entry.adaptedPacket.header.revision_id;
    const revisionKey = getRevisionKey(packetId, revisionId);
    const importedPacketRevisions =
      importedRevisionIdsByPacketId.get(packetId) ?? new Set<string>();

    if (seenRevisionKeys.has(revisionKey)) {
      duplicateRevisionCount += 1;
      importedPacketRevisions.add(revisionId);
      importedRevisionIdsByPacketId.set(packetId, importedPacketRevisions);
      continue;
    }

    seenRevisionKeys.add(revisionKey);
    importedPacketRevisions.add(revisionId);
    importedRevisionIdsByPacketId.set(packetId, importedPacketRevisions);

    let alreadyExists = existingRevisionPresence.get(revisionKey);

    if (alreadyExists === undefined) {
      alreadyExists =
        (await input.services.packetStore.fetchByRevision({
          packet_id: packetId,
          revision_id: revisionId,
        })) !== null;
      existingRevisionPresence.set(revisionKey, alreadyExists);
    }

    if (alreadyExists) {
      duplicateRevisionCount += 1;
      continue;
    }

    newRevisionCount += 1;
    packetIdsWithNewRevisions.add(packetId);
  }

  const existingParentPresence = new Map<string, boolean>();
  let missingParentCount = 0;

  for (const entry of validEntries) {
    const packetId = entry.adaptedPacket.header.packet_id;
    const revisionId = entry.adaptedPacket.header.revision_id;
    const revisionKey = `${packetId}::${revisionId}`;

    if (existingRevisionPresence.get(revisionKey) === true) {
      continue;
    }

    for (const parentRef of entry.adaptedPacket.header.parent_revision_refs) {
      const parentKey = getRevisionKey(
        parentRef.packet_id,
        parentRef.revision_id
      );
      const importedParentRevisionIds =
        importedRevisionIdsByPacketId.get(packetId) ?? new Set<string>();

      if (
        parentRef.packet_id === packetId &&
        importedParentRevisionIds.has(parentRef.revision_id)
      ) {
        continue;
      }

      let parentExists = existingParentPresence.get(parentKey);

      if (parentExists === undefined) {
        parentExists =
          parentRef.packet_id === packetId &&
          (await input.services.packetStore.fetchByRevision(parentRef)) !== null;
        existingParentPresence.set(parentKey, parentExists);
      }

      if (!parentExists) {
        missingParentCount += 1;
        blockingErrors.push(
          normalizedSource.artifactType === 'raw_packet'
            ? `Raw packet import for ${packetId} is missing parent revision ${parentRef.revision_id}. Import a packet-history bundle instead.`
            : `Revision ${revisionId} for ${packetId} references missing parent revision ${parentRef.revision_id}.`
        );
      }
    }
  }

  if (duplicateRevisionCount > 0) {
    warnings.push(
      `${duplicateRevisionCount} revision${duplicateRevisionCount === 1 ? '' : 's'} already exist locally or are duplicated inside this import source and will be skipped.`
    );
  }

  const affectedPacketIds = Array.from(
    new Set(validEntries.map((entry) => entry.adaptedPacket.header.packet_id))
  ).sort();
  const uniqueRevisionCount = seenRevisionKeys.size;
  const invalidEntryCount = normalizedSource.rawEntries.length - validEntries.length;
  const familyConflictCount = packetIdsWithConflicts.size;
  const openPacketId =
    normalizedSource.exportMode === 'full_store'
      ? null
      : normalizedSource.rootPacketRefs.length === 1
        ? normalizedSource.rootPacketRefs[0]?.packet_id ?? null
        : affectedPacketIds.length === 1
          ? affectedPacketIds[0] ?? null
          : null;
  const status = getImportStatus({
    hasInvalidJson: false,
    blockingErrors,
    newRevisionCount,
    duplicateRevisionCount,
    warnings,
  });
  const orderedValidEntries = orderImportEntries({
    entries: validEntries,
    existingRevisionPresence,
  });

  return {
    payload: {
      artifact_type: normalizedSource.artifactType,
      bundle_version: normalizedSource.bundleVersion,
      title: normalizedSource.title,
      note: normalizedSource.note,
      export_mode: normalizedSource.exportMode,
      root_packet_refs: normalizedSource.rootPacketRefs,
      packet_count: normalizedSource.rawEntries.length,
      revision_count: validEntries.length,
      unique_packet_count: affectedPacketIds.length,
      unique_revision_count: uniqueRevisionCount,
      new_revision_count: newRevisionCount,
      duplicate_revision_count: duplicateRevisionCount,
      affected_packet_count: affectedPacketIds.length,
      affected_packet_ids: affectedPacketIds,
      missing_parent_count: missingParentCount,
      invalid_entry_count: invalidEntryCount,
      family_conflict_count: familyConflictCount,
      status,
      blocking_errors: Array.from(new Set(blockingErrors)),
      warnings,
      open_packet_id: openPacketId,
      source_file_name: sourceFileName,
    },
    normalizedBundleText:
      orderedValidEntries.length > 0
        ? JSON.stringify({
            bundle_version: normalizedSource.bundleVersion ?? 1,
            packets: orderedValidEntries.map((entry) => entry.rawPacket),
          })
        : null,
    affectedPacketIds,
    packetIdsWithNewRevisions: Array.from(packetIdsWithNewRevisions),
  };
}

function canCommitImport(
  payload: NexusPacketExplorerImportPreviewPayload
): boolean {
  return (
    payload.status === 'ready' ||
    payload.status === 'duplicates_only' ||
    payload.status === 'partial_risk'
  );
}

async function snapshotPreferredHeads(input: {
  services: PacketImportServices;
  packetIds: string[];
}): Promise<Map<string, PreferredSnapshot>> {
  const snapshots = new Map<string, PreferredSnapshot>();

  await Promise.all(
    input.packetIds.map(async (packetId) => {
      const headStatus = await input.services.packetStore.fetchRevisionHeads({
        packet_id: packetId,
      });

      snapshots.set(packetId, {
        preferredRevisionId: headStatus.preferred_revision?.revision_id ?? null,
        headRevisionIds: headStatus.head_revisions.map(
          (revision) => revision.revision_id
        ),
      });
    })
  );

  return snapshots;
}

async function repairPreferredHeadsAfterImport(input: {
  services: PacketImportServices;
  packetIdsWithNewRevisions: string[];
  snapshots: Map<string, PreferredSnapshot>;
}): Promise<{
  restoredPreferredPacketCount: number;
  divergedPacketCount: number;
}> {
  let restoredPreferredPacketCount = 0;
  let divergedPacketCount = 0;

  for (const packetId of input.packetIdsWithNewRevisions) {
    const headStatus = await input.services.packetStore.fetchRevisionHeads({
      packet_id: packetId,
    });
    const nextHeadRevisionIds = headStatus.head_revisions.map(
      (revision) => revision.revision_id
    );
    const snapshot = input.snapshots.get(packetId) ?? {
      preferredRevisionId: null,
      headRevisionIds: [],
    };

    if (nextHeadRevisionIds.length === 1) {
      await input.services.packetStore.publishRevision({
        packet_id: packetId,
        revision_id: nextHeadRevisionIds[0]!,
      });
      continue;
    }

    if (
      snapshot.preferredRevisionId &&
      nextHeadRevisionIds.includes(snapshot.preferredRevisionId)
    ) {
      await input.services.packetStore.publishRevision({
        packet_id: packetId,
        revision_id: snapshot.preferredRevisionId,
      });
      restoredPreferredPacketCount += 1;
      continue;
    }

    if (nextHeadRevisionIds.length > 1) {
      divergedPacketCount += 1;
    }
  }

  return {
    restoredPreferredPacketCount,
    divergedPacketCount,
  };
}

export function parseNexusPacketExplorerImportRequest(
  input: unknown
): NexusPacketExplorerImportRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('Explorer import requests must use a JSON object body.');
  }

  const candidate = input as Record<string, unknown>;

  if (typeof candidate.source_text !== 'string') {
    throw new Error('Explorer import requests must include a source_text string.');
  }

  return {
    source_text: candidate.source_text,
    file_name:
      typeof candidate.file_name === 'string' ? candidate.file_name : null,
  };
}

export async function buildNexusPacketExplorerImportPreview(input: {
  services: PacketImportServices;
  requestBody: NexusPacketExplorerImportRequest;
}): Promise<NexusPacketExplorerImportPreviewPayload> {
  const analyzedImport = await analyzeImportRequest(input);

  return analyzedImport.payload;
}

export async function buildNexusPacketExplorerImportCommit(input: {
  services: PacketImportServices;
  requestBody: NexusPacketExplorerImportRequest;
}): Promise<NexusPacketExplorerImportCommitPayload> {
  const analyzedImport = await analyzeImportRequest(input);

  if (
    !canCommitImport(analyzedImport.payload) ||
    !analyzedImport.normalizedBundleText
  ) {
    return {
      ...analyzedImport.payload,
      committed: false,
      imported_revision_count: 0,
      skipped_duplicate_count: analyzedImport.payload.duplicate_revision_count,
      restored_preferred_packet_count: 0,
      diverged_packet_count: 0,
    };
  }

  const preferredSnapshots = await snapshotPreferredHeads({
    services: input.services,
    packetIds: analyzedImport.affectedPacketIds,
  });
  const importResult = await input.services.packetStore.importBundle(
    analyzedImport.normalizedBundleText
  );
  const preferredRepair = await repairPreferredHeadsAfterImport({
    services: input.services,
    packetIdsWithNewRevisions: analyzedImport.packetIdsWithNewRevisions,
    snapshots: preferredSnapshots,
  });

  return {
    ...analyzedImport.payload,
    committed: true,
    imported_revision_count: importResult.revision_count,
    skipped_duplicate_count: analyzedImport.payload.duplicate_revision_count,
    restored_preferred_packet_count:
      preferredRepair.restoredPreferredPacketCount,
    diverged_packet_count: preferredRepair.divergedPacketCount,
  };
}

export async function getNexusPacketExplorerImportPreview(
  requestBody: NexusPacketExplorerImportRequest
): Promise<NexusPacketExplorerImportPreviewPayload> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerImportPreview({
    services,
    requestBody,
  });
}

export async function getNexusPacketExplorerImportCommit(
  requestBody: NexusPacketExplorerImportRequest
): Promise<NexusPacketExplorerImportCommitPayload> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerImportCommit({
    services,
    requestBody,
  });
}
