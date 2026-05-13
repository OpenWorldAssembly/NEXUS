import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createElementPacket,
  createRolePacket,
} from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import {
  buildNexusPacketExplorerExportPreview,
} from '@runtime/nexus/server/nexus-packet-export';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import {
  buildNexusPacketExplorerImportCommit,
  buildNexusPacketExplorerImportHistory,
  buildNexusPacketExplorerImportPreview,
} from '@runtime/nexus/server/nexus-packet-import';
import { NexusPacketVerificationService } from '@runtime/nexus/server/verification-service';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { createNodeSQLiteQueryServicesAsync } from '@runtime/storage/node-sqlite-query-services';

async function createImportTestServices(directory: string, fileName: string) {
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, fileName),
    }),
  });

  return {
    queryServices,
    services: {
      ...queryServices,
      verificationService: new NexusPacketVerificationService(
        queryServices.packetStore
      ),
    },
  };
}

async function createSignedIdentityPacket(input: {
  packetId: string;
  alias: string;
  createdAt: string;
}) {
  const keyPair = await generateP256KeyPair();
  const jwkPair = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwkPair.publicJwk,
    addedAt: input.createdAt,
  });
  const identityPacket = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: 'claimed',
    packetId: input.packetId,
    createdAt: input.createdAt,
    publicKeyBinding: keyBinding,
  });

  return {
    keyPair,
    packet: await signPacketWithIdentity({
      packet: identityPacket,
      signerPacketId: input.packetId,
      kid: keyBinding.kid,
      privateKey: keyPair.privateKey,
      signedAt: input.createdAt,
    }),
    keyBinding,
  };
}

test('raw packet imports analyze and commit successfully', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'raw-import.db'
  );
  const packet = createElementPacket({
    packet_id: 'nexus:element/import-target',
    revision_id: 'nexus:element/import-target@r1',
    kind: 'organization',
    name: 'Import Target',
  });

  try {
    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
      },
    });

    assert.equal(preview.status, 'partial_risk');
    assert.equal(preview.artifact_type, 'raw_packet');
    assert.equal(preview.new_revision_count, 1);
    assert.equal(preview.open_packet_id, packet.header.packet_id);

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
      },
    });

    assert.equal(commit.committed, true);
    assert.equal(commit.imported_revision_count, 1);
    assert.equal(commit.created_verification_report_packet_ids.length, 1);
    assert.notEqual(commit.import_report_packet_id, null);

    const preferredRevision = await queryServices.packetStore.fetchPreferredRevision({
      packet_id: packet.header.packet_id,
    });
    const verificationSummary =
      await queryServices.packetStore.getPacketVerificationSummary({
        packet_id: packet.header.packet_id,
      });
    const importReport = await queryServices.packetStore.fetchByPacket({
      packet_id: commit.import_report_packet_id!,
    });

    assert.equal(preferredRevision?.revision_id, packet.header.revision_id);
    assert.equal(verificationSummary?.status, 'unsigned');
    assert.equal(verificationSummary?.signature_status, 'missing');
    assert.equal(importReport?.header.family, 'Report');
    assert.equal(
      (importReport?.body as { report_data?: { artifact_type?: string } }).report_data
        ?.artifact_type,
      'raw_packet'
    );
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('import history lists recent import reports with artifact metadata', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-history-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'import-history.db'
  );
  const packet = createElementPacket({
    packet_id: 'nexus:element/import-history-target',
    revision_id: 'nexus:element/import-history-target@r1',
    kind: 'organization',
    name: 'Import History Target',
  });

  try {
    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
        file_name: 'history-target.json',
      },
    });

    assert.equal(commit.committed, true);
    assert.notEqual(commit.import_report_packet_id, null);

    const history = await buildNexusPacketExplorerImportHistory({
      services,
      requestBody: {
        limit: 5,
      },
    });

    assert.equal(history.entries.length, 1);
    assert.equal(history.entries[0]?.report_packet_id, commit.import_report_packet_id);
    assert.equal(history.entries[0]?.source_file_name, 'history-target.json');
    assert.equal(history.entries[0]?.artifact_type, 'raw_packet');
    assert.equal(history.entries[0]?.validation_mode, 'validate_before_commit');
    assert.equal(history.entries[0]?.affected_packet_ids[0], packet.header.packet_id);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('dont_validate mode commits structurally safe imports without packet verification reports', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'dont-validate.db'
  );
  const packet = createElementPacket({
    packet_id: 'nexus:element/dont-validate-target',
    revision_id: 'nexus:element/dont-validate-target@r1',
    kind: 'organization',
    name: 'Dont Validate Target',
  });

  try {
    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
        validation_mode: 'dont_validate',
      },
    });

    assert.equal(preview.validation_mode, 'dont_validate');
    assert.deepEqual(preview.validation_counts, {
      trusted_signer: 0,
      signature_valid: 0,
      unknown_signer: 0,
      unsigned: 0,
      signature_invalid: 0,
      canonicalization_mismatch: 0,
    });

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
        validation_mode: 'dont_validate',
      },
    });

    assert.equal(commit.committed, true);
    assert.equal(commit.created_verification_report_packet_ids.length, 0);
    assert.notEqual(commit.import_report_packet_id, null);

    const verificationSummary =
      await queryServices.packetStore.getPacketVerificationSummary({
        packet_id: packet.header.packet_id,
      });

    assert.equal(verificationSummary, null);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('validate_after_commit imports first and then writes verification reports', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'validate-after.db'
  );
  const packet = createElementPacket({
    packet_id: 'nexus:element/validate-after-target',
    revision_id: 'nexus:element/validate-after-target@r1',
    kind: 'organization',
    name: 'Validate After Target',
  });

  try {
    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
        validation_mode: 'validate_after_commit',
      },
    });

    assert.equal(preview.validation_mode, 'validate_after_commit');
    assert.equal(preview.validation_blocked_count, 0);

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
        validation_mode: 'validate_after_commit',
      },
    });

    assert.equal(commit.committed, true);
    assert.equal(commit.created_verification_report_packet_ids.length, 1);
    assert.notEqual(commit.import_report_packet_id, null);

    const verificationSummary =
      await queryServices.packetStore.getPacketVerificationSummary({
        packet_id: packet.header.packet_id,
      });

    assert.equal(verificationSummary?.status, 'unsigned');
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('validate_before_commit blocks packets with canonicalization mismatches', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'validate-before-blocked.db'
  );
  const createdAt = '2026-05-12T00:00:00.000Z';

  try {
    const signer = await createSignedIdentityPacket({
      packetId: 'nexus:element/import-validation-signer',
      alias: 'Import Validation Signer',
      createdAt,
    });
    const unsignedPacket = createElementPacket({
      packet_id: 'nexus:element/import-validation-target',
      revision_id: 'nexus:element/import-validation-target@r1',
      created_at: createdAt,
      kind: 'organization',
      name: 'Import Validation Target',
    });
    const signedPacket = await signPacketWithIdentity({
      packet: unsignedPacket,
      signerPacketId: signer.packet.header.packet_id,
      kid: signer.keyBinding.kid,
      privateKey: signer.keyPair.privateKey,
      signedAt: createdAt,
    });
    const tamperedPacket = {
      ...signedPacket,
      body: {
        ...signedPacket.body,
        name: 'Tampered Import Validation Target',
      },
    };
    const sourceText = JSON.stringify({
      bundle_version: 1,
      packets: [signer.packet, tamperedPacket],
    });

    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: sourceText,
        validation_mode: 'validate_before_commit',
      },
    });

    assert.equal(preview.status, 'blocked');
    assert.equal(preview.validation_counts.canonicalization_mismatch, 1);
    assert.equal(preview.validation_blocked_count, 1);

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: sourceText,
        validation_mode: 'validate_before_commit',
      },
    });

    assert.equal(commit.committed, false);
    assert.equal(commit.import_report_packet_id, null);
    assert.equal(commit.created_verification_report_packet_ids.length, 0);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('exported bundle imports analyze and commit successfully', async () => {
  const sourceDirectory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-source-'));
  const targetDirectory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-target-'));
  const sourceServices = await createImportTestServices(sourceDirectory, 'source.db');
  const targetServices = await createImportTestServices(targetDirectory, 'target.db');
  const packetV1 = createElementPacket({
    packet_id: 'nexus:element/bundle-root',
    revision_id: 'nexus:element/bundle-root@r1',
    kind: 'service',
    name: 'Bundle Root',
  });
  const packetV2 = createElementPacket({
    packet_id: packetV1.header.packet_id,
    revision_id: 'nexus:element/bundle-root@r2',
    kind: 'service',
    name: 'Bundle Root v2',
    parent_revision_refs: [
      {
        packet_id: packetV1.header.packet_id,
        revision_id: packetV1.header.revision_id,
      },
    ],
  });

  try {
    await sourceServices.queryServices.packetStore.writeRevision(packetV1);
    await sourceServices.queryServices.packetStore.writeRevision(packetV2);

    const exportPreview = await buildNexusPacketExplorerExportPreview({
      services: sourceServices.services,
      requestBody: {
        artifact_mode: 'bundle',
        bundle_mode: 'packet_history',
        root_packet_id: packetV1.header.packet_id,
      },
    });

    const preview = await buildNexusPacketExplorerImportPreview({
      services: targetServices.services,
      requestBody: {
        source_text: exportPreview.preview_json ?? '',
      },
    });

    assert.equal(preview.status, 'partial_risk');
    assert.equal(preview.artifact_type, 'bundle');
    assert.equal(preview.new_revision_count, 2);

    const commit = await buildNexusPacketExplorerImportCommit({
      services: targetServices.services,
      requestBody: {
        source_text: exportPreview.preview_json ?? '',
      },
    });

    assert.equal(commit.committed, true);
    assert.equal(commit.imported_revision_count, 2);

    const preferredRevision = await targetServices.queryServices.packetStore.fetchPreferredRevision({
      packet_id: packetV1.header.packet_id,
    });

    assert.equal(preferredRevision?.revision_id, packetV2.header.revision_id);
  } finally {
    sourceServices.queryServices.packetStore.close();
    targetServices.queryServices.packetStore.close();
    rmSync(sourceDirectory, { recursive: true, force: true });
    rmSync(targetDirectory, { recursive: true, force: true });
  }
});

test('duplicate-only reimports stay non-destructive', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'duplicates.db'
  );
  const packet = createElementPacket({
    packet_id: 'nexus:element/duplicate-target',
    revision_id: 'nexus:element/duplicate-target@r1',
    kind: 'organization',
    name: 'Duplicate Target',
  });

  try {
    await queryServices.packetStore.writeRevision(packet);

    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
      },
    });

    assert.equal(preview.status, 'duplicates_only');
    assert.equal(preview.duplicate_revision_count, 1);

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
      },
    });

    assert.equal(commit.committed, true);
    assert.equal(commit.imported_revision_count, 0);
    assert.equal(commit.skipped_duplicate_count, 1);

    const preferredRevision = await queryServices.packetStore.fetchPreferredRevision({
      packet_id: packet.header.packet_id,
    });

    assert.equal(preferredRevision?.revision_id, packet.header.revision_id);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('missing parent revisions block unsafe imports', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'missing-parent.db'
  );
  const packet = createElementPacket({
    packet_id: 'nexus:element/missing-parent',
    revision_id: 'nexus:element/missing-parent@r2',
    kind: 'service',
    name: 'Missing Parent',
    parent_revision_refs: [
      {
        packet_id: 'nexus:element/missing-parent',
        revision_id: 'nexus:element/missing-parent@r1',
      },
    ],
  });

  try {
    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
      },
    });

    assert.equal(preview.status, 'blocked');
    assert.equal(preview.missing_parent_count, 1);

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(packet),
      },
    });

    assert.equal(commit.committed, false);
    assert.equal(commit.imported_revision_count, 0);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('family conflicts are detected before commit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'family-conflict.db'
  );
  const existingPacket = createElementPacket({
    packet_id: 'nexus:element/family-conflict',
    revision_id: 'nexus:element/family-conflict@r1',
    kind: 'organization',
    name: 'Family Conflict',
  });
  const conflictingPacket = createRolePacket({
    packet_id: existingPacket.header.packet_id,
    revision_id: 'nexus:element/family-conflict@r2',
    title: 'Conflicting Role',
    role_kind: 'office',
    status: 'active',
  });

  try {
    await queryServices.packetStore.writeRevision(existingPacket);

    const preview = await buildNexusPacketExplorerImportPreview({
      services,
      requestBody: {
        source_text: JSON.stringify(conflictingPacket),
      },
    });

    assert.equal(preview.status, 'blocked');
    assert.equal(preview.family_conflict_count, 1);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('divergence preserves the existing preferred head when it remains valid', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-import-'));
  const { queryServices, services } = await createImportTestServices(
    directory,
    'preferred-repair.db'
  );
  const basePacket = createElementPacket({
    packet_id: 'nexus:element/divergent-packet',
    revision_id: 'nexus:element/divergent-packet@r1',
    kind: 'service',
    name: 'Divergent Packet',
  });
  const branchAPacket = createElementPacket({
    packet_id: basePacket.header.packet_id,
    revision_id: 'nexus:element/divergent-packet@r2a',
    kind: 'service',
    name: 'Branch A',
    parent_revision_refs: [
      {
        packet_id: basePacket.header.packet_id,
        revision_id: basePacket.header.revision_id,
      },
    ],
  });
  const branchBPacket = createElementPacket({
    packet_id: basePacket.header.packet_id,
    revision_id: 'nexus:element/divergent-packet@r2b',
    kind: 'service',
    name: 'Branch B',
    parent_revision_refs: [
      {
        packet_id: basePacket.header.packet_id,
        revision_id: basePacket.header.revision_id,
      },
    ],
  });

  try {
    await queryServices.packetStore.writeRevision(basePacket);
    await queryServices.packetStore.writeRevision(branchAPacket);

    const commit = await buildNexusPacketExplorerImportCommit({
      services,
      requestBody: {
        source_text: JSON.stringify(branchBPacket),
      },
    });

    assert.equal(commit.committed, true);
    assert.equal(commit.imported_revision_count, 1);
    assert.equal(commit.restored_preferred_packet_count, 1);
    assert.equal(commit.diverged_packet_count, 0);

    const preferredRevision = await queryServices.packetStore.fetchPreferredRevision({
      packet_id: basePacket.header.packet_id,
    });
    const headStatus = await queryServices.packetStore.fetchRevisionHeads({
      packet_id: basePacket.header.packet_id,
    });

    assert.equal(preferredRevision?.revision_id, branchAPacket.header.revision_id);
    assert.equal(headStatus.head_revisions.length, 2);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
