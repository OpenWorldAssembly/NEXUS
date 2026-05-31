/**
 * File: verification-service.ts
 * Description: Owns local validator bootstrap, packet verification assessment, signed verification reports, and import reports.
 */

import { sha256Base64Url } from '@core/crypto/canonical-json';
import {
  createElementPacket,
  createInitialRevisionId,
  createReportPacket,
  type ReportPacketInput,
} from '@core/packets/builders';
import type {
  NexusPacketVerificationStatus,
  NexusPacketVerificationSummary,
} from '@core/contracts';
import type {
  PacketCompatibilityReadResult,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import type { NexusPacketVerificationActionPayload } from '@runtime/nexus/nexus-api-types';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import { trustedVerificationCoordinator } from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';

export interface PacketVerificationAssessment {
  packet_id: string;
  target_revision_id: string;
  target_digest: string | null;
  structural_valid: boolean;
  compatibility_status: NexusPacketVerificationSummary['compatibility_status'];
  signature_status: NexusPacketVerificationSummary['signature_status'];
  signer_status: NexusPacketVerificationSummary['signer_status'];
  provenance_status: NexusPacketVerificationSummary['provenance_status'];
  local_trust_status: NexusPacketVerificationSummary['local_trust_status'];
  status: NexusPacketVerificationStatus;
  warnings: string[];
  signer_packet_id: string | null;
}

type ReportHistorySummary = {
  report_packet_id: string;
  report_revision_id: string;
  source: 'local' | 'external';
  subtype: 'verification_report' | 'import_report' | 'decision_report';
  status: string;
  title: string;
  summary: string | null;
  created_at: string;
  validator_packet_id: string | null;
  report_data: Record<string, unknown>;
};

export type ImportReportHistorySummary = ReportHistorySummary & {
  subtype: 'import_report';
  source_file_name: string | null;
  source_digest: string | null;
  artifact_type: string | null;
  bundle_version: string | number | null;
  export_mode: string | null;
  validation_mode: string | null;
  imported_count: number;
  skipped_count: number;
  blocked_count: number;
  affected_packet_ids: string[];
};

type LocalValidatorIdentity = {
  packet: PacketEnvelopeByType['Element'];
  privateKey: CryptoKey;
  kid: string;
};

function createNextRevisionId(packetId: string, currentRevisionId?: string): string {
  const match = currentRevisionId?.match(/@r(\d+)$/);
  const revisionNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return createInitialRevisionId(packetId, revisionNumber);
}

function getCompatibilityStatus(
  compatibilityRead: PacketCompatibilityReadResult
): NexusPacketVerificationSummary['compatibility_status'] {
  if (compatibilityRead.status.is_lossy) {
    return 'lossy';
  }

  return compatibilityRead.status.is_exact ? 'native' : 'adapted';
}

function getSignerPacketId(packet: PacketEnvelope): string | null {
  return (
    packet.header.integrity.embedded_signatures[0]?.signer_packet_ref.packet_id ?? null
  );
}

function getPacketDigest(packet: PacketEnvelope): string | null {
  return typeof packet.header.integrity.digest === 'string'
    ? packet.header.integrity.digest
    : null;
}

function createAssessmentStatus(input: {
  signatureStatus: NexusPacketVerificationSummary['signature_status'];
  signerStatus: NexusPacketVerificationSummary['signer_status'];
}): NexusPacketVerificationStatus {
  if (input.signatureStatus === 'canonicalization_mismatch') {
    return 'canonicalization_mismatch';
  }

  if (input.signatureStatus === 'invalid') {
    return 'signature_invalid';
  }

  if (input.signatureStatus === 'missing') {
    return 'unsigned';
  }

  if (
    input.signatureStatus === 'unverifiable' ||
    input.signerStatus === 'unknown'
  ) {
    return 'unknown_signer';
  }

  return 'signature_valid';
}

function createLocalSummaryStatus(
  assessment: PacketVerificationAssessment
): NexusPacketVerificationStatus {
  if (
    assessment.status === 'canonicalization_mismatch' ||
    assessment.status === 'signature_invalid' ||
    assessment.status === 'unsigned' ||
    assessment.status === 'unknown_signer'
  ) {
    return assessment.status;
  }

  return 'trusted_signer';
}

function createVerificationSummaryMarkdown(input: {
  assessment: PacketVerificationAssessment;
  packet: PacketEnvelope;
}): { summary: string; report: string } {
  const title =
    input.assessment.status === 'trusted_signer'
      ? 'Packet verified by local validator.'
      : input.assessment.status === 'signature_invalid'
        ? 'Packet signature verification failed.'
        : input.assessment.status === 'canonicalization_mismatch'
          ? 'Packet canonicalization check failed.'
          : input.assessment.status === 'unknown_signer'
            ? 'Packet signature is present, but the signer is unknown locally.'
            : input.assessment.status === 'unsigned'
              ? 'Packet has no embedded signature.'
              : 'Packet verification completed.';
  const reportLines = [
    `- Packet: \`${input.packet.header.packet_id}\``,
    `- Revision: \`${input.packet.header.revision_id}\``,
    ...(input.assessment.target_digest
      ? [`- Digest: \`${input.assessment.target_digest}\``]
      : []),
    `- Structural validity: ${input.assessment.structural_valid ? 'valid' : 'invalid'}`,
    `- Compatibility/adaptation: ${input.assessment.compatibility_status}`,
    `- Signature: ${input.assessment.signature_status}`,
    `- Signer: ${input.assessment.signer_status}`,
    `- Provenance: ${input.assessment.provenance_status}`,
    `- Local trust: ${input.assessment.local_trust_status}`,
    ...(input.assessment.warnings.map((warning) => `- Warning: ${warning}`)),
  ];

  return {
    summary: title,
    report: [title, '', ...reportLines].join('\n'),
  };
}

function createImportSummaryMarkdown(input: {
  mode: string;
  sourceFileName: string | null;
  sourceDigest: string;
  importedRevisionCount: number;
  affectedPacketIds: string[];
  warnings: string[];
}): { summary: string; report: string } {
  const summary = `Import report (${input.mode.replace(/_/g, ' ')})`;
  const lines = [
    `- Source digest: \`${input.sourceDigest}\``,
    `- Validation mode: ${input.mode}`,
    `- Imported revisions: ${input.importedRevisionCount}`,
    `- Affected packets: ${input.affectedPacketIds.length}`,
    ...(input.sourceFileName ? [`- Source file: ${input.sourceFileName}`] : []),
    ...input.affectedPacketIds.map((packetId) => `- Packet: \`${packetId}\``),
    ...input.warnings.map((warning) => `- Warning: ${warning}`),
  ];

  return {
    summary,
    report: [summary, '', ...lines].join('\n'),
  };
}

function isVerificationReportPacket(
  packet: PacketEnvelope
): packet is PacketEnvelopeByType['Report'] {
  return (
    packet.header.type === 'Report' &&
    packet.body.subtype === 'verification_report'
  );
}

function toReportHistorySummary(input: {
  packet: PacketEnvelopeByType['Report'];
  source: 'local' | 'external';
  validatorPacketId: string | null;
}): ReportHistorySummary {
  return {
    report_packet_id: input.packet.header.packet_id,
    report_revision_id: input.packet.header.revision_id,
    source: input.source,
    subtype: input.packet.body.subtype,
    status: input.packet.body.status,
    title:
      input.packet.body.subtype === 'verification_report'
        ? 'Verification report'
        : 'Import report',
    summary: input.packet.body.summary_markdown ?? null,
    created_at: input.packet.header.created_at,
    validator_packet_id: input.validatorPacketId,
    report_data:
      (input.packet.body.report_data as Record<string, unknown> | null) ?? {},
  };
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function asNumberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toImportReportHistorySummary(
  report: ReportHistorySummary
): ImportReportHistorySummary {
  return {
    ...report,
    subtype: 'import_report',
    source_file_name: asStringOrNull(report.report_data.source_file_name),
    source_digest: asStringOrNull(report.report_data.source_digest),
    artifact_type: asStringOrNull(report.report_data.artifact_type),
    bundle_version:
      typeof report.report_data.bundle_version === 'string' ||
      typeof report.report_data.bundle_version === 'number'
        ? report.report_data.bundle_version
        : null,
    export_mode: asStringOrNull(report.report_data.export_mode),
    validation_mode: asStringOrNull(report.report_data.validation_mode),
    imported_count: asNumberOrZero(
      report.report_data.imported_revision_count ?? report.report_data.imported_count
    ),
    skipped_count: asNumberOrZero(report.report_data.skipped_duplicate_count),
    blocked_count: asNumberOrZero(report.report_data.blocked_count),
    affected_packet_ids: asStringArray(report.report_data.affected_packet_ids),
  };
}

export class NexusPacketVerificationService {
  private readonly packetStore: NodeSQLitePacketStore;

  constructor(packetStore: NodeSQLitePacketStore) {
    this.packetStore = packetStore;
  }

  async ensureLocalValidatorIdentity(): Promise<LocalValidatorIdentity> {
    const stored = await this.packetStore.readRuntimeValidatorIdentity();

    if (stored) {
      const validatorPacket = await this.packetStore.fetchByPacket({
        packet_id: stored.validator_packet_id,
      });

      if (validatorPacket && validatorPacket.header.type === 'Element') {
        return {
          packet: validatorPacket as PacketEnvelopeByType['Element'],
          privateKey: await importPrivateKeyFromJwk(stored.private_jwk),
          kid: stored.kid,
        };
      }
    }

    const createdAt = new Date().toISOString();
    const keyPair = await generateP256KeyPair();
    const jwkPair = await exportIdentityKeyPairToJwk(keyPair);
    const keyBinding = await createIdentityKeyBinding({
      publicJwk: jwkPair.publicJwk,
      addedAt: createdAt,
    });
    const packetId = `nexus:element/node/local-validator-${keyBinding.kid.slice(0, 12)}`;
    const unsignedPacket = createElementPacket({
      packet_id: packetId,
      revision_id: createInitialRevisionId(packetId),
      created_at: createdAt,
      name: 'Local Validator',
      subtype: 'node',
      summary: 'Runtime-owned packet validation identity for this Nexus node.',
      identity: {
        alias: 'Local Validator',
        claim_status: 'claimed',
        location_disclosure: null,
        public_key_bindings: [keyBinding],
      },
      tags: ['node', 'service', 'validator'],
      adapter: 'runtime_verification',
      created_by: { packet_id: packetId },
      submitted_by: { packet_id: packetId },
      recorded_at: createdAt,
    });
    const signedPacket = await signPacketWithIdentity({
      packet: unsignedPacket,
      signerPacketId: packetId,
      kid: keyBinding.kid,
      privateKey: keyPair.privateKey,
      signedAt: createdAt,
    });

    await this.packetStore.writeRevision(signedPacket);
    await this.packetStore.publishRevision({
      packet_id: signedPacket.header.packet_id,
      revision_id: signedPacket.header.revision_id,
    });
    await this.packetStore.writeRuntimeValidatorIdentity({
      validator_packet_id: packetId,
      kid: keyBinding.kid,
      public_jwk: jwkPair.publicJwk,
      private_jwk: jwkPair.privateJwk,
      created_at: createdAt,
      updated_at: createdAt,
    });

    return {
      packet: signedPacket,
      privateKey: keyPair.privateKey,
      kid: keyBinding.kid,
    };
  }

  async assessStoredPacket(packetId: string): Promise<{
    assessment: PacketVerificationAssessment;
    packet: PacketEnvelope;
    signerPacket: PacketEnvelope | null;
    compatibilityRead: PacketCompatibilityReadResult;
  }> {
    const archiveRead = await trustedArchiveCoordinator.readPacket({
      packet_store: this.packetStore,
      packet_ref: {
        packet_id: packetId,
      },
      mode: 'raw_plus_adaptation',
      context_mode: 'normal_runtime',
    });
    const compatibilityRead =
      archiveRead.value?.packet as PacketCompatibilityReadResult | null;

    if (!compatibilityRead) {
      throw new Error(`Unknown packet: ${packetId}`);
    }

    const signerPacketId = getSignerPacketId(compatibilityRead.adapted_packet);
    const signerPacket = signerPacketId
      ? await this.packetStore.fetchByPacket({ packet_id: signerPacketId })
      : null;
    const assessment = await this.assessPacket({
      rawPacket: compatibilityRead.raw_packet,
      packet: compatibilityRead.adapted_packet,
      signerPacket,
      compatibilityStatus: getCompatibilityStatus(compatibilityRead),
      provenanceStatus: compatibilityRead.adapted_packet.header.provenance
        .imported_from_revision
        ? 'imported'
        : 'local',
    });

    return {
      assessment,
      packet: compatibilityRead.adapted_packet,
      signerPacket,
      compatibilityRead,
    };
  }

  async assessPacket(input: {
    rawPacket?: unknown;
    packet: PacketEnvelope;
    signerPacket?: PacketEnvelope | null;
    compatibilityStatus?: NexusPacketVerificationSummary['compatibility_status'];
    provenanceStatus?: NexusPacketVerificationSummary['provenance_status'];
  }): Promise<PacketVerificationAssessment> {
    const verificationResult = await trustedVerificationCoordinator.verifyPacket({
      packet_store: this.packetStore,
      raw_packet: input.rawPacket,
      packet: input.packet,
      signer_packet: input.signerPacket ?? null,
      verification_mode: 'advisory',
      context_mode: 'normal_runtime',
    });
    const verification = verificationResult.value;
    const warnings = verification
      ? [...verification.warnings]
      : verificationResult.issues.map((issue) => issue.message);
    const signatureStatus: NexusPacketVerificationSummary['signature_status'] =
      verification?.signature_status === 'valid' ||
      verification?.signature_status === 'missing' ||
      verification?.signature_status === 'unverifiable' ||
      verification?.signature_status === 'invalid' ||
      verification?.signature_status === 'canonicalization_mismatch'
        ? verification.signature_status
        : verification?.signature_status === 'unknown'
          ? 'unverifiable'
          : 'missing';
    const signerStatus: NexusPacketVerificationSummary['signer_status'] =
      verification?.signer_status === 'known' ||
      verification?.signer_status === 'missing' ||
      verification?.signer_status === 'unknown'
        ? verification.signer_status
        : 'unknown';

    const status = createAssessmentStatus({
      signatureStatus,
      signerStatus,
    });

    return {
      packet_id: input.packet.header.packet_id,
      target_revision_id: input.packet.header.revision_id,
      target_digest: getPacketDigest(input.packet),
      structural_valid: true,
      compatibility_status: input.compatibilityStatus ?? 'native',
      signature_status: signatureStatus,
      signer_status: signerStatus,
      provenance_status: input.provenanceStatus ?? 'unknown',
      local_trust_status: 'unknown',
      status,
      warnings,
      signer_packet_id: input.signerPacket?.header.packet_id ?? null,
    };
  }

  private async listVerificationReportsForTarget(packetId: string): Promise<
    PacketEnvelopeByType['Report'][]
  > {
    const reports = await this.packetStore.listPreferredPacketsByType('Report');

    return reports.filter(
      (packet) =>
        isVerificationReportPacket(packet) &&
        packet.body.target_ref?.packet_id === packetId
    );
  }

  async getVerificationOverview(packetId: string): Promise<{
    verificationSummary: NexusPacketVerificationSummary | null;
    localValidatorPacketId: string | null;
    localReports: ReportHistorySummary[];
    externalReports: ReportHistorySummary[];
    hasAnyReport: boolean;
    hasLocalReport: boolean;
    hasFreshLocalReport: boolean;
  }> {
    const localValidator = await this.ensureLocalValidatorIdentity();
    const reports = await this.listVerificationReportsForTarget(packetId);
    const localReports = reports
      .filter(
        (packet) =>
          packet.header.provenance.created_by?.packet_id ===
          localValidator.packet.header.packet_id
      )
      .map((packet) =>
        toReportHistorySummary({
          packet,
          source: 'local',
          validatorPacketId: localValidator.packet.header.packet_id,
        })
      );
    const externalReports = reports
      .filter(
        (packet) =>
          packet.header.provenance.created_by?.packet_id !==
          localValidator.packet.header.packet_id
      )
      .map((packet) =>
        toReportHistorySummary({
          packet,
          source: 'external',
          validatorPacketId: packet.header.provenance.created_by?.packet_id ?? null,
        })
      );
    const currentPacket = await this.packetStore.fetchByPacket({
      packet_id: packetId,
    });
    const storedSummary = await this.packetStore.getPacketVerificationSummary({
      packet_id: packetId,
    });
    const currentSummary =
      storedSummary &&
      currentPacket &&
      storedSummary.target_revision_id === currentPacket.header.revision_id
        ? storedSummary
        : null;
    const latestExternalReport = externalReports[0] ?? null;
    const latestExternalReportData = latestExternalReport?.report_data ?? {};
    const verificationSummary =
      currentSummary ??
      (latestExternalReport
        ? {
            packet_id: packetId,
            target_revision_id: asStringOrNull(
              latestExternalReportData.target_revision_id
            ),
            target_digest: asStringOrNull(latestExternalReportData.target_digest),
            latest_report_packet_id: latestExternalReport.report_packet_id,
            latest_report_revision_id: latestExternalReport.report_revision_id,
            latest_report_source: 'external' as const,
            status: 'external_report_only' as const,
            structural_valid: true,
            compatibility_status:
              latestExternalReportData.compatibility_status === 'adapted' ||
              latestExternalReportData.compatibility_status === 'lossy' ||
              latestExternalReportData.compatibility_status === 'blocked'
                ? latestExternalReportData.compatibility_status
                : 'native',
            signature_status:
              latestExternalReportData.signature_status === 'valid' ||
              latestExternalReportData.signature_status === 'unverifiable' ||
              latestExternalReportData.signature_status === 'invalid' ||
              latestExternalReportData.signature_status ===
                'canonicalization_mismatch'
                ? latestExternalReportData.signature_status
                : 'missing',
            signer_status: 'unknown' as const,
            provenance_status: 'unknown' as const,
            local_trust_status: 'unknown' as const,
            warnings_count: asStringArray(latestExternalReportData.warnings).length,
            validated_at: latestExternalReport.created_at,
            validator_packet_id: latestExternalReport.validator_packet_id,
          }
        : null);

    return {
      verificationSummary,
      localValidatorPacketId: localValidator.packet.header.packet_id,
      localReports,
      externalReports,
      hasAnyReport: storedSummary !== null || localReports.length > 0 || externalReports.length > 0,
      hasLocalReport: localReports.length > 0,
      hasFreshLocalReport: currentSummary?.latest_report_source === 'local',
    };
  }

  async validatePacket(packetId: string): Promise<NexusPacketVerificationActionPayload> {
    const localValidator = await this.ensureLocalValidatorIdentity();
    const currentReportId = await this.getDeterministicReportPacketId({
      subtype: 'verification_report',
      targetPacketId: packetId,
      validatorPacketId: localValidator.packet.header.packet_id,
    });
    const [existingReport, packetAssessment] = await Promise.all([
      this.packetStore.fetchByPacket({ packet_id: currentReportId }),
      this.assessStoredPacket(packetId),
    ]);
    const nextCreatedAt = new Date().toISOString();
    const summaryStatus = createLocalSummaryStatus(packetAssessment.assessment);
    const summaryMarkdown = createVerificationSummaryMarkdown({
      assessment: {
        ...packetAssessment.assessment,
        local_trust_status:
          summaryStatus === 'trusted_signer' ? 'trusted' : 'untrusted',
        status: summaryStatus,
      },
      packet: packetAssessment.packet,
    });
    const reportInput: ReportPacketInput = {
      packet_id: currentReportId,
      revision_id: createNextRevisionId(
        currentReportId,
        existingReport?.header.revision_id
      ),
      created_at: nextCreatedAt,
      parent_revision_refs: existingReport
        ? [
            {
              packet_id: existingReport.header.packet_id,
              revision_id: existingReport.header.revision_id,
            },
          ]
        : [],
      adapter: 'runtime_verification',
      created_by: { packet_id: localValidator.packet.header.packet_id },
      submitted_by: { packet_id: localValidator.packet.header.packet_id },
      recorded_at: nextCreatedAt,
      subtype: 'verification_report',
      status: 'active',
      target_ref: { packet_id: packetId },
      scope_ref: packetAssessment.packet.header.authority_scope_ref ?? null,
      summary_markdown: summaryMarkdown.summary,
      report_markdown: summaryMarkdown.report,
      supporting_refs: [
        ...(packetAssessment.signerPacket
          ? [{ packet_id: packetAssessment.signerPacket.header.packet_id }]
          : []),
      ],
      supersedes_ref: null,
      report_data: {
        previous_status:
          existingReport?.header.type === 'Report'
            ? (existingReport.body as PacketEnvelopeByType['Report']['body']).report_data
                ?.status ?? null
            : null,
        status: summaryStatus,
        target_packet_id: packetAssessment.assessment.packet_id,
        target_revision_id: packetAssessment.assessment.target_revision_id,
        target_digest: packetAssessment.assessment.target_digest,
        structural_valid: packetAssessment.assessment.structural_valid,
        compatibility_status: packetAssessment.assessment.compatibility_status,
        signature_status: packetAssessment.assessment.signature_status,
        signer_status: packetAssessment.assessment.signer_status,
        provenance_status: packetAssessment.assessment.provenance_status,
        warnings: packetAssessment.assessment.warnings,
      },
    };
    const signedReport = await signPacketWithIdentity({
      packet: createReportPacket(reportInput),
      signerPacketId: localValidator.packet.header.packet_id,
      kid: localValidator.kid,
      privateKey: localValidator.privateKey,
      signedAt: nextCreatedAt,
    });

    await this.packetStore.writeRevision(signedReport);
    await this.packetStore.publishRevision({
      packet_id: signedReport.header.packet_id,
      revision_id: signedReport.header.revision_id,
    });
    await this.packetStore.writePacketVerificationSummary({
      packet_id: packetId,
      target_revision_id: packetAssessment.assessment.target_revision_id,
      target_digest: packetAssessment.assessment.target_digest,
      latest_report_packet_id: signedReport.header.packet_id,
      latest_report_revision_id: signedReport.header.revision_id,
      latest_report_source: 'local',
      status: summaryStatus,
      structural_valid: packetAssessment.assessment.structural_valid,
      compatibility_status: packetAssessment.assessment.compatibility_status,
      signature_status: packetAssessment.assessment.signature_status,
      signer_status:
        summaryStatus === 'trusted_signer'
          ? 'trusted'
          : packetAssessment.assessment.signer_status,
      provenance_status: packetAssessment.assessment.provenance_status,
      local_trust_status:
        summaryStatus === 'trusted_signer' ? 'trusted' : 'untrusted',
      warnings_count: packetAssessment.assessment.warnings.length,
      validated_at: nextCreatedAt,
      validator_packet_id: localValidator.packet.header.packet_id,
    });

    return {
      packet_id: packetId,
      report_packet_id: signedReport.header.packet_id,
      report_revision_id: signedReport.header.revision_id,
      status: summaryStatus,
      validated_at: nextCreatedAt,
      validator_packet_id: localValidator.packet.header.packet_id,
      title:
        summaryStatus === 'trusted_signer' ? 'Packet validated' : 'Validation completed',
      summary: summaryMarkdown.summary,
      warnings: packetAssessment.assessment.warnings,
    };
  }

  async writeImportReport(input: {
    sourceDigest: string;
    sourceFileName: string | null;
    artifactType: string | null;
    bundleVersion: string | number | null;
    exportMode: string | null;
    rootPacketRefs: { packet_id: string }[];
    validationMode: string;
    importedRevisionCount: number;
    skippedDuplicateCount: number;
    blockedCount: number;
    affectedPacketIds: string[];
    verificationReportPacketIds: string[];
    warnings: string[];
    errors: string[];
    initiatedByActorPacketId?: string | null;
  }): Promise<PacketEnvelopeByType['Report']> {
    const localValidator = await this.ensureLocalValidatorIdentity();
    const reportPacketId = await this.getDeterministicReportPacketId({
      subtype: 'import_report',
      validatorPacketId: localValidator.packet.header.packet_id,
      sourceDigest: input.sourceDigest,
    });
    const existingReport = await this.packetStore.fetchByPacket({
      packet_id: reportPacketId,
    });
    const createdAt = new Date().toISOString();
    const markdown = createImportSummaryMarkdown({
      mode: input.validationMode,
      sourceFileName: input.sourceFileName,
      sourceDigest: input.sourceDigest,
      importedRevisionCount: input.importedRevisionCount,
      affectedPacketIds: input.affectedPacketIds,
      warnings: input.warnings,
    });
    const report = await signPacketWithIdentity({
      packet: createReportPacket({
        packet_id: reportPacketId,
        revision_id: createNextRevisionId(
          reportPacketId,
          existingReport?.header.revision_id
        ),
        created_at: createdAt,
        parent_revision_refs: existingReport
          ? [
              {
                packet_id: existingReport.header.packet_id,
                revision_id: existingReport.header.revision_id,
              },
            ]
          : [],
        adapter: 'runtime_verification',
        created_by: { packet_id: localValidator.packet.header.packet_id },
        submitted_by: { packet_id: localValidator.packet.header.packet_id },
        recorded_at: createdAt,
        subtype: 'import_report',
        status: 'active',
        target_ref: null,
        scope_ref: null,
        summary_markdown: markdown.summary,
        report_markdown: markdown.report,
        supporting_refs: input.verificationReportPacketIds.map((packetId) => ({
          packet_id: packetId,
        })),
        supersedes_ref: null,
        report_data: {
          source_digest: input.sourceDigest,
          source_file_name: input.sourceFileName,
          artifact_type: input.artifactType,
          bundle_version: input.bundleVersion,
          export_mode: input.exportMode,
          root_packet_refs: input.rootPacketRefs,
          validation_mode: input.validationMode,
          imported_revision_count: input.importedRevisionCount,
          skipped_duplicate_count: input.skippedDuplicateCount,
          blocked_count: input.blockedCount,
          affected_packet_ids: input.affectedPacketIds,
          verification_report_packet_ids: input.verificationReportPacketIds,
          warnings: input.warnings,
          errors: input.errors,
          initiated_by_actor_packet_id: input.initiatedByActorPacketId ?? null,
        },
      }),
      signerPacketId: localValidator.packet.header.packet_id,
      kid: localValidator.kid,
      privateKey: localValidator.privateKey,
      signedAt: createdAt,
    });

    await this.packetStore.writeRevision(report);
    await this.packetStore.publishRevision({
      packet_id: report.header.packet_id,
      revision_id: report.header.revision_id,
    });

    return report;
  }

  async hasVerificationEvidence(packetId: string): Promise<boolean> {
    const storedSummary = await this.packetStore.getPacketVerificationSummary({
      packet_id: packetId,
    });

    if (storedSummary) {
      return true;
    }

    const reports = await this.listVerificationReportsForTarget(packetId);
    return reports.length > 0;
  }

  async listRecentImportReports(input: {
    limit?: number | null;
  } = {}): Promise<ImportReportHistorySummary[]> {
    const localValidator = await this.ensureLocalValidatorIdentity();
    const reports = await this.packetStore.listPreferredPacketsByType('Report');
    const limit = input.limit ?? 8;

    return reports
      .filter(
        (packet): packet is PacketEnvelopeByType['Report'] =>
          packet.header.type === 'Report' &&
          packet.body.subtype === 'import_report'
      )
      .map((packet) =>
        toImportReportHistorySummary(
          toReportHistorySummary({
            packet,
            source:
              packet.header.provenance.created_by?.packet_id ===
              localValidator.packet.header.packet_id
                ? 'local'
                : 'external',
            validatorPacketId: packet.header.provenance.created_by?.packet_id ?? null,
          })
        )
      )
      .slice(0, limit);
  }

  private async getDeterministicReportPacketId(input: {
    subtype: 'verification_report' | 'import_report';
    validatorPacketId: string;
    targetPacketId?: string;
    sourceDigest?: string;
  }): Promise<string> {
    const digest = await sha256Base64Url(
      [
        input.subtype,
        input.validatorPacketId,
        input.targetPacketId ?? '',
        input.sourceDigest ?? '',
      ].join('::')
    );

    return `nexus:report/${input.subtype}-${digest.slice(0, 24)}`;
  }
}
