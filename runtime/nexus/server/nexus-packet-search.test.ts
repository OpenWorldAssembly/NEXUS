import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createDiscussionForumPacket,
  createElementPacket,
} from '@core/packets/builders';
import {
  buildNexusPacketExplorerSearchPayload,
  parseNexusPacketExplorerSearchRequest,
} from '@runtime/nexus/server/nexus-packet-search';
import { createNodeSQLiteQueryServicesAsync } from '@runtime/storage/node-sqlite-query-services';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

async function createSearchTestServices(directory: string) {
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'owa-search.db'),
    }),
  });

  return {
    queryServices,
    services: queryServices,
  };
}

test('exact packet-id search returns the packet in the direct group', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-search-'));
  const { queryServices, services } = await createSearchTestServices(directory);
  const packet = createElementPacket({
    packet_id: 'nexus:element/search-root',
    revision_id: 'nexus:element/search-root@r1',
    subtype: 'service',
    name: 'Search Root',
    summary: 'Alpha packet summary.',
    tags: ['mesh-signal'],
  });

  try {
    await queryServices.packetStore.writeRevision(packet);
    await queryServices.packetStore.writePacketVerificationSummary({
      packet_id: packet.header.packet_id,
      target_revision_id: packet.header.revision_id,
      target_digest: packet.header.integrity.digest,
      latest_report_packet_id: 'nexus:report/verification-search-root',
      latest_report_revision_id: 'nexus:report/verification-search-root@r1',
      latest_report_source: 'local',
      status: 'trusted_signer',
      structural_valid: true,
      compatibility_status: 'native',
      signature_status: 'valid',
      signer_status: 'trusted',
      provenance_status: 'local',
      local_trust_status: 'trusted',
      warnings_count: 0,
      validated_at: '2026-05-12T00:00:00.000Z',
      validator_packet_id: 'nexus:element/local-validator',
    });

    const payload = await buildNexusPacketExplorerSearchPayload({
      services,
      requestBody: {
        query: packet.header.packet_id,
        scope_mode: 'all_known',
      },
    });

    const directGroup = payload.groups.find((group) => group.key === 'direct');

    assert.equal(payload.total_result_count, 1);
    assert.equal(directGroup?.count, 1);
    assert.equal(directGroup?.results[0]?.packet_id, packet.header.packet_id);
    assert.equal(directGroup?.results[0]?.match_type, 'packet_id_exact');
    assert.equal(directGroup?.results[0]?.verification?.status, 'trusted_signer');
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('exact historical revision-id search resolves the owning packet while preserving current preferred context', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-search-'));
  const { queryServices, services } = await createSearchTestServices(directory);
  const packetV1 = createElementPacket({
    packet_id: 'nexus:element/search-history',
    revision_id: 'nexus:element/search-history@r1',
    subtype: 'organization',
    name: 'Search History',
  });
  const packetV2 = createElementPacket({
    packet_id: packetV1.header.packet_id,
    revision_id: 'nexus:element/search-history@r2',
    subtype: 'organization',
    name: 'Search History Updated',
    parent_revision_refs: [
      {
        packet_id: packetV1.header.packet_id,
        revision_id: packetV1.header.revision_id,
      },
    ],
  });

  try {
    await queryServices.packetStore.writeRevision(packetV1);
    await queryServices.packetStore.writeRevision(packetV2);

    const payload = await buildNexusPacketExplorerSearchPayload({
      services,
      requestBody: {
        query: packetV1.header.revision_id,
        scope_mode: 'all_known',
      },
    });

    const directGroup = payload.groups.find((group) => group.key === 'direct');
    const match = directGroup?.results[0] ?? null;

    assert.equal(directGroup?.count, 1);
    assert.equal(match?.packet_id, packetV1.header.packet_id);
    assert.equal(match?.match_type, 'revision_id_exact');
    assert.equal(match?.matched_revision_id, packetV1.header.revision_id);
    assert.equal(match?.revision_id, packetV2.header.revision_id);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('search groups name and text matches from the preferred packet index', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-search-'));
  const { queryServices, services } = await createSearchTestServices(directory);
  const namePacket = createDiscussionForumPacket({
    packet_id: 'nexus:discussion-forum/search-beacon',
    revision_id: 'nexus:discussion-forum/search-beacon@r1',
    authority_scope_ref: { packet_id: 'nexus:element/global-commons' },
    applicable_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
    title: 'Civic Beacon',
    summary: 'Open coordination space.',
    discussion_space_ref: { packet_id: 'nexus:discussion-space/global-commons' },
    forum_kind: 'public_square',
    status: 'open',
  });
  const textPacket = createElementPacket({
    packet_id: 'nexus:element/search-signal',
    revision_id: 'nexus:element/search-signal@r1',
    subtype: 'service',
    name: 'Signal Node',
    summary: 'Community pulse and archival traffic.',
    tags: ['mesh-signal'],
  });

  try {
    await queryServices.packetStore.writeRevision(namePacket);
    await queryServices.packetStore.writeRevision(textPacket);

    const namePayload = await buildNexusPacketExplorerSearchPayload({
      services,
      requestBody: {
        query: 'beacon',
        scope_mode: 'all_known',
      },
    });
    const textPayload = await buildNexusPacketExplorerSearchPayload({
      services,
      requestBody: {
        query: 'mesh-signal',
        scope_mode: 'all_known',
      },
    });

    const nameGroup = namePayload.groups.find((group) => group.key === 'name');
    const textGroup = textPayload.groups.find((group) => group.key === 'text');

    assert.equal(nameGroup?.count, 1);
    assert.equal(nameGroup?.results[0]?.packet_id, namePacket.header.packet_id);
    assert.equal(nameGroup?.results[0]?.match_group, 'name');

    assert.equal(textGroup?.count, 1);
    assert.equal(textGroup?.results[0]?.packet_id, textPacket.header.packet_id);
    assert.equal(textGroup?.results[0]?.match_type, 'tag_contains');
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('search request parsing blocks short non-identifier text', () => {
  assert.throws(
    () =>
      parseNexusPacketExplorerSearchRequest({
        query: 'a',
      }),
    /at least 2 characters long/
  );
});

test('all-category previews stay capped while focused categories support paging', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-search-'));
  const { queryServices, services } = await createSearchTestServices(directory);

  try {
    for (let index = 0; index < 30; index += 1) {
      await queryServices.packetStore.writeRevision(
        createElementPacket({
          packet_id: `nexus:element/search-page-${index}`,
          revision_id: `nexus:element/search-page-${index}@r1`,
          subtype: 'service',
          name: `Beacon Result ${index}`,
          summary: `Beacon page result ${index}.`,
        })
      );
    }

    const previewPayload = await buildNexusPacketExplorerSearchPayload({
      services,
      requestBody: {
        query: 'beacon',
        scope_mode: 'all_known',
        active_group: 'all',
      },
    });
    const pagedPayload = await buildNexusPacketExplorerSearchPayload({
      services,
      requestBody: {
        query: 'beacon',
        scope_mode: 'all_known',
        active_group: 'name',
        page: 2,
        page_size: 25,
      },
    });

    const previewNameGroup = previewPayload.groups.find((group) => group.key === 'name');
    const pagedNameGroup = pagedPayload.groups.find((group) => group.key === 'name');

    assert.equal(previewPayload.active_group, 'all');
    assert.equal(previewNameGroup?.results.length, 8);
    assert.equal(previewNameGroup?.count, 30);
    assert.equal(pagedPayload.active_group, 'name');
    assert.equal(pagedNameGroup?.current_page, 2);
    assert.equal(pagedNameGroup?.page_size, 25);
    assert.equal(pagedNameGroup?.total_pages, 2);
    assert.equal(pagedNameGroup?.results.length, 5);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
