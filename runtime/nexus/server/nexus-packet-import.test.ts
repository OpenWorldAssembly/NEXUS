import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createElementPacket,
  createRolePacket,
} from '@core/packets/builders';
import {
  buildNexusPacketExplorerExportPreview,
} from '@runtime/nexus/server/nexus-packet-export';
import {
  buildNexusPacketExplorerImportCommit,
  buildNexusPacketExplorerImportPreview,
} from '@runtime/nexus/server/nexus-packet-import';
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
    services: queryServices,
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

    assert.equal(preview.status, 'ready');
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

    const preferredRevision = await queryServices.packetStore.fetchPreferredRevision({
      packet_id: packet.header.packet_id,
    });

    assert.equal(preferredRevision?.revision_id, packet.header.revision_id);
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

    assert.equal(preview.status, 'ready');
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
