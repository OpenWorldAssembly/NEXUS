import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createAssemblyPacket,
  createAttestationPacket,
  createClaimPacket,
  createDiscussionForumPacket,
  createDiscussionPostPacket,
  createDiscussionSpacePacket,
  createDiscussionThreadPacket,
} from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import type { PacketEnvelope } from '@core/schema/packet-schema';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { buildNexusPacketExplorerPayload } from '@runtime/nexus/server/nexus-packet-explorer-data';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { createNodeSQLiteQueryServicesAsync } from '@runtime/storage/node-sqlite-query-services';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

const SCOPE_PACKET_ID = 'nexus:element/global-commons';
const TEST_PUBLIC_KEY_BINDING = {
  kid: 'kid-explorer-test',
  alg: 'EdDSA',
  kty: 'OKP',
  crv: 'Ed25519',
  public_jwk: {
    kty: 'OKP',
    crv: 'Ed25519',
    x: 'nexus-explorer-test-public-key',
  },
  status: 'active' as const,
  added_at: '2026-04-29T00:00:00.000Z',
};

async function writePreferredPacket(
  packetStore: NodeSQLitePacketStore,
  packet: PacketEnvelope
) {
  await packetStore.writeRevision(packet);
  await packetStore.publishRevision({
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  });
}

async function createExplorerHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'owa-explorer-payload-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-explorer.db'),
  });
  const queryServices = await createNodeSQLiteQueryServicesAsync({ packetStore });
  const attestationService = new SQLiteAttestationService(packetStore);
  const discussionService = new SQLiteDiscussionService(
    packetStore,
    attestationService
  );
  const services = {
    packetStore,
    browserQueryService: queryServices.browserQueryService,
    discussionService,
  };

  return {
    packetStore,
    services,
    cleanup() {
      packetStore.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('explorer payload returns raw, adapted, read-model, and link data for packet families with graph edges', async () => {
  const harness = await createExplorerHarness();

  try {
    const assemblyPacket = createAssemblyPacket({
      packet_id: SCOPE_PACKET_ID,
      created_at: '2026-04-29T00:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      summary: 'Global scope.',
    });
    const actorPacket = createPersonIdentityPacket({
      packetId: 'nexus:element/test-actor',
      alias: 'Test Actor',
      createdAt: '2026-04-29T00:01:00.000Z',
      claimStatus: 'ephemeral_guest',
      publicKeyBinding: TEST_PUBLIC_KEY_BINDING,
    });
    const claimPacket = createClaimPacket({
      packet_id: 'nexus:claim/test-home-locality',
      created_at: '2026-04-29T00:02:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      created_by: { packet_id: actorPacket.header.packet_id },
      claim_kind: 'home_locality',
      subject_ref: { packet_id: actorPacket.header.packet_id },
      target_ref: { packet_id: SCOPE_PACKET_ID },
      scope_ref: { packet_id: SCOPE_PACKET_ID },
      note: 'Current home locality.',
    });
    const attestationPacket = createAttestationPacket({
      packet_id: 'nexus:attestation/test-claim-support',
      created_at: '2026-04-29T00:03:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      created_by: { packet_id: actorPacket.header.packet_id },
      target_ref: { packet_id: claimPacket.header.packet_id },
      value: 1,
      attestation_kind: 'claim_support',
    });

    await writePreferredPacket(harness.packetStore, assemblyPacket);
    await writePreferredPacket(harness.packetStore, actorPacket);
    await writePreferredPacket(harness.packetStore, claimPacket);
    await writePreferredPacket(harness.packetStore, attestationPacket);

    const payload = await buildNexusPacketExplorerPayload({
      services: harness.services,
      packetId: claimPacket.header.packet_id,
      viewerActorPacketId: actorPacket.header.packet_id,
    });

    assert.equal(payload.packet_summary.packet.packet_id, claimPacket.header.packet_id);
    assert.equal(payload.preferred_revision.revision_id, claimPacket.header.revision_id);
    assert.equal(payload.revision_state, 'linear');
    assert.equal(payload.adapted_view !== null, true);
    assert.equal(payload.read_model_view !== null, true);
    assert.equal(payload.outgoing_links.length > 0, true);
    assert.equal(
      payload.incoming_links.some((link) => link.packet_id === attestationPacket.header.packet_id),
      true
    );
    assert.equal(
      payload.adaptation_summary.stages.includes('read_model_projection'),
      true
    );
  } finally {
    harness.cleanup();
  }
});

test('explorer payload projects discussion action state for a viewer packet', async () => {
  const harness = await createExplorerHarness();

  try {
    const assemblyPacket = createAssemblyPacket({
      packet_id: SCOPE_PACKET_ID,
      created_at: '2026-04-29T01:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      summary: 'Global scope.',
    });
    const actorPacket = createPersonIdentityPacket({
      packetId: 'nexus:element/guest-explorer',
      alias: 'Guest Explorer',
      createdAt: '2026-04-29T01:01:00.000Z',
      claimStatus: 'ephemeral_guest',
      publicKeyBinding: {
        ...TEST_PUBLIC_KEY_BINDING,
        kid: 'kid-guest-explorer',
      },
    });
    const discussionSpacePacket = createDiscussionSpacePacket({
      packet_id: 'nexus:discussion-space/global-commons',
      created_at: '2026-04-29T01:02:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Global discussions',
      scope_ref: { packet_id: SCOPE_PACKET_ID },
      status: 'open',
    });
    const forumPacket = createDiscussionForumPacket({
      packet_id: 'nexus:discussion-forum/global-commons-visitor-lobby',
      created_at: '2026-04-29T01:03:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Visitor lobby',
      summary: 'Guest discussion surface.',
      discussion_space_ref: { packet_id: discussionSpacePacket.header.packet_id },
      forum_kind: 'visitor_lobby',
      status: 'open',
    });
    const threadPacket = createDiscussionThreadPacket({
      packet_id: 'nexus:discussion-thread/explorer-thread',
      created_at: '2026-04-29T01:04:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Explorer thread',
      forum_ref: { packet_id: forumPacket.header.packet_id },
      thread_kind: 'visitor_lobby',
      status: 'open',
    });
    const rootPostPacket = createDiscussionPostPacket({
      packet_id: 'nexus:discussion-post/explorer-root',
      created_at: '2026-04-29T01:05:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      created_by: { packet_id: actorPacket.header.packet_id },
      title: 'Explorer root',
      thread_ref: { packet_id: threadPacket.header.packet_id },
      post_kind: 'forum_post',
      content_markdown: 'Explorer root body.',
    });

    await writePreferredPacket(harness.packetStore, assemblyPacket);
    await writePreferredPacket(harness.packetStore, actorPacket);
    await writePreferredPacket(harness.packetStore, discussionSpacePacket);
    await writePreferredPacket(harness.packetStore, forumPacket);
    await writePreferredPacket(harness.packetStore, threadPacket);
    await writePreferredPacket(harness.packetStore, rootPostPacket);
    await harness.services.discussionService.syncDerivedState();

    const payload = await buildNexusPacketExplorerPayload({
      services: harness.services,
      packetId: rootPostPacket.header.packet_id,
      viewerActorPacketId: actorPacket.header.packet_id,
    });

    assert.equal(
      payload.action_descriptors.some(
        (descriptor) => descriptor.id === 'discussion.reply'
      ),
      true
    );
    assert.equal(payload.actions['discussion.reply']?.enabled, true);
    assert.equal(payload.actions['discussion.vote_up']?.enabled, true);
  } finally {
    harness.cleanup();
  }
});

test('explorer payload throws an unknown packet error for missing packets', async () => {
  const harness = await createExplorerHarness();

  try {
    await assert.rejects(
      () =>
        buildNexusPacketExplorerPayload({
          services: harness.services,
          packetId: 'nexus:missing/packet',
        }),
      /Unknown packet: nexus:missing\/packet/
    );
  } finally {
    harness.cleanup();
  }
});
