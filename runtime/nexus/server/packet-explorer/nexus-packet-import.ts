/**
 * File: nexus-packet-import.ts
 * Description: Analyzes and commits Packet Explorer import requests over the shared packet store.
 */

import { sha256Base64Url } from '@core/crypto/canonical-json';
import {
  inspectPacketEnvelope,
  type PacketEnvelope,
  type PacketRef,
} from '@core/schema/packet-schema';
import type {
  NexusPacketValidationMode,
} from '@core/contracts';
import type {
  NexusPacketExplorerImportArtifactType,
  NexusPacketExplorerImportCommitPayload,
  NexusPacketExplorerImportHistoryPayload,
  NexusPacketExplorerImportHistoryRequest,
  NexusPacketExplorerImportPreviewPayload,
  NexusPacketExplorerImportRequest,
} from '@runtime/nexus/nexus-api-types';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';
import { trustedExchangeCoordinator } from '@runtime/trusted_coordinators/trusted_exchange_coordinator/index.ts';

type PacketImportServices = Pick<
  NexusPacketServices,
  'packetStore' | 'verificationService'
>;

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
  validationMode: NexusPacketValidationMode;
};

type ValidationCounts = NexusPacketExplorerImportPreviewPayload['validation_counts'];

function createEmptyValidationCounts(): ValidationCounts {
  return {
    trusted_signer: 0,
    signature_valid: 0,
    unknown_signer: 0,
    unsigned: 0,
    signature_invalid: 0,
    canonicalization_mismatch: 0,
  };
}

function normalizeValidationMode(
  value: NexusPacketExplorerImportRequest['validation_mode']
): NexusPacketValidationMode {
  if (
    value === 'dont_validate' ||
    value === 'validate_after_commit' ||
    value === 'validate_before_commit'
  ) {
    return value;
  }

  return 'validate_before_commit';
}

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
  validationMode: NexusPacketValidationMode;
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
    type_conflict_count: 0,
    status: input.status,
    blocking_errors: input.blockingErrors,
    warnings: [],
    open_packet_id: null,
    source_file_name: input.sourceFileName,
    validation_mode: input.validationMode,
    validation_counts: createEmptyValidationCounts(),
    validation_blocked_count: 0,
    validation_report_packet_ids: [],
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

async function assessImportVerification(input: {
  services: PacketImportServices;
  entries: NormalizedImportEntry[];
  existingRevisionPresence: Map<string, boolean>;
}): Promise<{
  validationCounts: ValidationCounts;
  validationBlockedCount: number;
  validationWarnings: string[];
}> {
  const verificationCounts = createEmptyValidationCounts();
  const validationWarnings: string[] = [];
  const signerPacketIds = new Set<string>();
  const importedSignerPacketsById = new Map<string, PacketEnvelope>();

  for (const entry of input.entries) {
    importedSignerPacketsById.set(
      entry.adaptedPacket.header.packet_id,
      entry.adaptedPacket
    );
    const signerPacketId =
      entry.adaptedPacket.header.integrity.embedded_signatures[0]?.signer_packet_ref
        .packet_id ?? null;

    if (signerPacketId) {
      signerPacketIds.add(signerPacketId);
    }
  }

  const signerPacketsById = new Map<string, PacketEnvelope | null>();

  await Promise.all(
    Array.from(signerPacketIds).map(async (packetId) => {
      if (importedSignerPacketsById.has(packetId)) {
        signerPacketsById.set(packetId, importedSignerPacketsById.get(packetId)!);
        return;
      }

      const signerPacket = await input.services.packetStore.fetchByPacket({
        packet_id: packetId,
      });
      signerPacketsById.set(packetId, signerPacket);
    })
  );

  let validationBlockedCount = 0;

  for (const entry of input.entries) {
    const revisionKey = getRevisionKey(
      entry.adaptedPacket.header.packet_id,
      entry.adaptedPacket.header.revision_id
    );

    if (input.existingRevisionPresence.get(revisionKey) === true) {
      continue;
    }

    const signerPacketId =
      entry.adaptedPacket.header.integrity.embedded_signatures[0]?.signer_packet_ref
        .packet_id ?? null;
    const assessment = await input.services.verificationService.assessPacket({
      rawPacket: entry.rawPacket,
      packet: entry.adaptedPacket,
      signerPacket: signerPacketId
        ? signerPacketsById.get(signerPacketId) ?? null
        : null,
      compatibilityStatus: 'native',
      provenanceStatus: 'imported',
    });

    switch (assessment.status) {
      case 'trusted_signer':
        verificationCounts.trusted_signer += 1;
        break;
      case 'signature_valid':
        verificationCounts.signature_valid += 1;
        break;
      case 'unknown_signer':
        verificationCounts.unknown_signer += 1;
        break;
      case 'unsigned':
        verificationCounts.unsigned += 1;
        break;
      case 'signature_invalid':
        verificationCounts.signature_invalid += 1;
        break;
      case 'canonicalization_mismatch':
        verificationCounts.canonicalization_mismatch += 1;
        break;
      default:
        break;
    }

    if (
      assessment.status === 'signature_invalid' ||
      assessment.status === 'canonicalization_mismatch'
    ) {
      validationBlockedCount += 1;
      validationWarnings.push(
        `Packet ${entry.adaptedPacket.header.packet_id} failed signature validation (${assessment.status.replace(/_/g, ' ')}).`
      );
      continue;
    }

    if (
      assessment.status === 'unsigned' ||
      assessment.status === 'unknown_signer'
    ) {
      validationWarnings.push(
        `Packet ${entry.adaptedPacket.header.packet_id} will import as untrusted (${assessment.status.replace(/_/g, ' ')}).`
      );
      continue;
    }

  }

  return {
    validationCounts: verificationCounts,
    validationBlockedCount,
    validationWarnings,
  };
}

async function analyzeImportRequest(input: {
  services: PacketImportServices;
  requestBody: NexusPacketExplorerImportRequest;
}): Promise<AnalyzedImport> {
  const sourceFileName = trimOptionalString(input.requestBody.file_name ?? null);
  const validationMode = normalizeValidationMode(
    input.requestBody.validation_mode ?? null
  );

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
        validationMode,
      }),
      normalizedBundleText: null,
      affectedPacketIds: [],
      packetIdsWithNewRevisions: [],
      validationMode,
    };
  }

  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const validEntries: NormalizedImportEntry[] = [];
  const packetIdsWithConflicts = new Set<string>();
  const packetTypesById = new Map<string, string>();

  normalizedSource.rawEntries.forEach((rawEntry, entryIndex) => {
    try {
      const compatibilityRead = inspectPacketEnvelope(rawEntry);
      const adaptedPacket = compatibilityRead.adapted_packet;
      const packetId = adaptedPacket.header.packet_id;
      const type = adaptedPacket.header.type;
      const knownType = packetTypesById.get(packetId) ?? null;

      if (knownType && knownType !== type) {
        packetIdsWithConflicts.add(packetId);
        blockingErrors.push(
          `Packet ${packetId} appears with conflicting types (${knownType} and ${type}) inside this import source.`
        );
      } else {
        packetTypesById.set(packetId, type);
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
      existingPacket.header.type !== entry.adaptedPacket.header.type
    ) {
      packetIdsWithConflicts.add(packetId);
    }
  }

  for (const packetId of packetIdsWithConflicts) {
    const existingPacket = existingPackets.get(packetId) ?? null;

    if (existingPacket) {
      blockingErrors.push(
        `Packet ${packetId} already exists locally as ${existingPacket.header.type}, which conflicts with this import source.`
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
  const typeConflictCount = packetIdsWithConflicts.size;
  const openPacketId =
    normalizedSource.exportMode === 'full_store'
      ? null
      : normalizedSource.rootPacketRefs.length === 1
        ? normalizedSource.rootPacketRefs[0]?.packet_id ?? null
        : affectedPacketIds.length === 1
          ? affectedPacketIds[0] ?? null
          : null;
  const orderedValidEntries = orderImportEntries({
    entries: validEntries,
    existingRevisionPresence,
  });
  let validationCounts = createEmptyValidationCounts();
  let validationBlockedCount = 0;

  if (validationMode === 'validate_before_commit') {
    const verificationAssessment = await assessImportVerification({
      services: input.services,
      entries: orderedValidEntries,
      existingRevisionPresence,
    });

    validationCounts = verificationAssessment.validationCounts;
    validationBlockedCount = verificationAssessment.validationBlockedCount;
    warnings.push(...verificationAssessment.validationWarnings);

    if (validationBlockedCount > 0) {
      blockingErrors.push(
        `${validationBlockedCount} packet${validationBlockedCount === 1 ? '' : 's'} failed validation and must be fixed or imported with validate-after-commit or don’t-validate mode.`
      );
    }
  }
  const status = getImportStatus({
    hasInvalidJson: false,
    blockingErrors,
    newRevisionCount,
    duplicateRevisionCount,
    warnings,
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
      type_conflict_count: typeConflictCount,
      status,
      blocking_errors: Array.from(new Set(blockingErrors)),
      warnings,
      open_packet_id: openPacketId,
      source_file_name: sourceFileName,
      validation_mode: validationMode,
      validation_counts: validationCounts,
      validation_blocked_count: validationBlockedCount,
      validation_report_packet_ids: [],
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
    validationMode,
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
    validation_mode: normalizeValidationMode(
      (candidate.validation_mode as NexusPacketValidationMode | null | undefined) ??
        null
    ),
  };
}

export function parseNexusPacketExplorerImportHistoryRequest(
  input: unknown
): NexusPacketExplorerImportHistoryRequest {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const candidate = input as Record<string, unknown>;

  return {
    limit:
      typeof candidate.limit === 'number' && Number.isFinite(candidate.limit)
        ? candidate.limit
        : null,
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
      import_report_packet_id: null,
      created_verification_report_packet_ids: [],
    };
  }

  const preferredSnapshots = await snapshotPreferredHeads({
    services: input.services,
    packetIds: analyzedImport.affectedPacketIds,
  });
  const validationMode = analyzedImport.validationMode;
  const exchangeCommit = await trustedExchangeCoordinator.commitImport({
    packet_store: input.services.packetStore,
    bundle: analyzedImport.normalizedBundleText,
    source_label: analyzedImport.payload.source_file_name,
    context_mode: 'import_preview',
    accepted_acknowledgements: [
      'needs_compatibility_acknowledgement',
      'needs_verification_acknowledgement',
    ],
    options: {
      verification_mode: 'advisory',
    },
  });
  const importedRevisionCount = exchangeCommit.value?.imported_revision_count ?? 0;

  if (exchangeCommit.status === 'error') {
    throw new Error(
      exchangeCommit.issues.find((issue) => issue.severity === 'error')?.message ??
        'Trusted Exchange could not commit the import bundle.'
    );
  }
  const preferredRepair = await repairPreferredHeadsAfterImport({
    services: input.services,
    packetIdsWithNewRevisions: analyzedImport.packetIdsWithNewRevisions,
    snapshots: preferredSnapshots,
  });
  const shouldCreateVerificationReports =
    validationMode === 'validate_before_commit' ||
    validationMode === 'validate_after_commit';
  const createdVerificationReports = shouldCreateVerificationReports
    ? await Promise.all(
        analyzedImport.affectedPacketIds.map((packetId) =>
          input.services.verificationService.validatePacket(packetId)
        )
      )
    : [];
  const sourceDigest = await sha256Base64Url(
    analyzedImport.normalizedBundleText ?? input.requestBody.source_text
  );
  const importReport = await input.services.verificationService.writeImportReport({
    sourceDigest,
    sourceFileName: analyzedImport.payload.source_file_name,
    artifactType: analyzedImport.payload.artifact_type,
    bundleVersion: analyzedImport.payload.bundle_version,
    exportMode: analyzedImport.payload.export_mode,
    rootPacketRefs: analyzedImport.payload.root_packet_refs,
    validationMode,
    importedRevisionCount,
    skippedDuplicateCount: analyzedImport.payload.duplicate_revision_count,
    blockedCount: analyzedImport.payload.validation_blocked_count,
    affectedPacketIds: analyzedImport.affectedPacketIds,
    verificationReportPacketIds: createdVerificationReports.map(
      (report) => report.report_packet_id
    ),
    warnings: analyzedImport.payload.warnings,
    errors: analyzedImport.payload.blocking_errors,
    initiatedByActorPacketId: null,
  });

  return {
    ...analyzedImport.payload,
    committed: true,
    imported_revision_count: importedRevisionCount,
    skipped_duplicate_count: analyzedImport.payload.duplicate_revision_count,
    restored_preferred_packet_count:
      preferredRepair.restoredPreferredPacketCount,
    diverged_packet_count: preferredRepair.divergedPacketCount,
    import_report_packet_id: importReport.header.packet_id,
    created_verification_report_packet_ids: createdVerificationReports.map(
      (report) => report.report_packet_id
    ),
  };
}

export async function buildNexusPacketExplorerImportHistory(input: {
  services: PacketImportServices;
  requestBody: NexusPacketExplorerImportHistoryRequest;
}): Promise<NexusPacketExplorerImportHistoryPayload> {
  const entries = await input.services.verificationService.listRecentImportReports({
    limit: input.requestBody.limit ?? 8,
  });

  return {
    entries: entries.map((entry) => ({
      report_packet_id: entry.report_packet_id,
      report_revision_id: entry.report_revision_id,
      source: entry.source,
      status: entry.status,
      title: entry.title,
      summary: entry.summary,
      created_at: entry.created_at,
      validator_packet_id: entry.validator_packet_id,
      source_file_name: entry.source_file_name,
      source_digest: entry.source_digest,
      artifact_type: entry.artifact_type,
      bundle_version: entry.bundle_version,
      export_mode: entry.export_mode,
      validation_mode: entry.validation_mode,
      imported_count: entry.imported_count,
      skipped_count: entry.skipped_count,
      blocked_count: entry.blocked_count,
      affected_packet_ids: entry.affected_packet_ids,
    })),
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

export async function getNexusPacketExplorerImportHistory(
  requestBody: NexusPacketExplorerImportHistoryRequest
): Promise<NexusPacketExplorerImportHistoryPayload> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerImportHistory({
    services,
    requestBody,
  });
}
