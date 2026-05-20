import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createPersonPacket } from '@core/packets/builders';
import type { ResolvedWritePolicyDecision } from '@core/auth/write-policy';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import type { MutationPolicyGate } from './mutation-policy-gate.ts';
import {
  preparePreferenceElementFortressMutation,
  toPreferenceElementFortressResult,
} from './preference-fortress-workflow.ts';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';

async function withTemporaryPacketStore<TResult>(
  run: (packetStore: NodeSQLitePacketStore) => Promise<TResult>
): Promise<TResult> {
  const directory = mkdtempSync(join(tmpdir(), 'owa-preference-fortress-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-preference-fortress.db'),
  });

  try {
    return await run(packetStore);
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

async function createActorIdentity(): Promise<{
  actorPacket: PacketEnvelopeByType['Element'];
  privateJwk: JsonWebKey;
}> {
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: '2026-05-20T00:00:00.000Z',
  });

  const actorPacket = createPersonPacket({
    packet_id: 'nexus:element/test-actor',
    created_at: '2026-05-20T00:00:00.000Z',
    name: 'Test Actor',
    identity: {
      alias: 'Test Actor',
      claim_status: 'claimed',
      public_key_bindings: [keyBinding],
    },
  });

  return {
    actorPacket,
    privateJwk: exportedKeys.privateJwk,
  };
}

function createPolicyGate(): MutationPolicyGate {
  const decision: ResolvedWritePolicyDecision = {
    action_ids: ['preference.element.write'],
    required_proof_level: 'session',
    accepted_proof_methods: ['claimed_session'],
    source_policy_packet_ids: [],
  };

  return {
    resolveScopePolicyDecision: async () => decision,
  } as MutationPolicyGate;
}

test('Preference.element fortress prepare emits signable packet-shaped preferences', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    const { actorPacket, privateJwk } = await createActorIdentity();
    const prepared = await preparePreferenceElementFortressMutation({
      packetStore,
      policyGate: createPolicyGate(),
      actorPacket,
      intent: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/city'],
          show_associated_parent_chains: false,
          show_followed_parent_chains: true,
        },
        shell_chrome: {
          navigation_mode: 'scope',
          theme_mode: 'light',
          ui_density: 'large',
        },
        created_at: '2026-05-20T00:00:00.000Z',
      },
    });

    assert.equal(prepared.preparedMutation.kind, 'preference.element.set');
    assert.deepEqual(prepared.preparedMutation.action_ids, [
      'preference.element.write',
    ]);
    assert.equal(prepared.preparedMutation.prepared_packets.length, 1);
    assert.equal(prepared.preparedResult.wrote_revision, true);

    const signedPacket = await signPacketWithIdentity({
      packet: prepared.preparedMutation.prepared_packets[0].packet,
      signerPacketId: actorPacket.header.packet_id,
      kid: actorPacket.body.identity?.public_key_bindings[0]?.kid ?? '',
      privateKey: await importPrivateKeyFromJwk(privateJwk),
    });
    await packetStore.writeRevision(signedPacket);
    await packetStore.publishRevision({
      packet_id: signedPacket.header.packet_id,
      revision_id: signedPacket.header.revision_id,
    });
    const finalized = {
      persist_effects: [
        {
          packet: {
            packet_id: signedPacket.header.packet_id,
            revision_id: signedPacket.header.revision_id,
          },
        },
      ],
      result: toPreferenceElementFortressResult(prepared.preparedResult.plan),
    };
    const stored = await packetStore.fetchByPacket({
      packet_id: finalized.result.packet_id,
    });

    assert.equal(finalized.result.wrote_revision, true);
    assert.equal(stored?.header.family, 'Preference');
    assert.deepEqual(finalized.result.preferences, {
      main_visible_scope_packet_ids: ['nexus:element/city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
    assert.deepEqual(finalized.result.shell_chrome, {
      navigation_mode: 'scope',
      theme_mode: 'light',
      ui_density: 'large',
    });
  });
});

test('Preference.element fortress no-op prepares zero packet candidates', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    const { actorPacket, privateJwk } = await createActorIdentity();
    const first = await preparePreferenceElementFortressMutation({
      packetStore,
      policyGate: createPolicyGate(),
      actorPacket,
      intent: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/city'],
        },
        created_at: '2026-05-20T00:00:00.000Z',
      },
    });

    const signedPacket = await signPacketWithIdentity({
      packet: first.preparedMutation.prepared_packets[0].packet,
      signerPacketId: actorPacket.header.packet_id,
      kid: actorPacket.body.identity?.public_key_bindings[0]?.kid ?? '',
      privateKey: await importPrivateKeyFromJwk(privateJwk),
    });
    await packetStore.writeRevision(signedPacket);
    await packetStore.publishRevision({
      packet_id: signedPacket.header.packet_id,
      revision_id: signedPacket.header.revision_id,
    });

    const second = await preparePreferenceElementFortressMutation({
      packetStore,
      policyGate: createPolicyGate(),
      actorPacket,
      intent: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/city'],
        },
        created_at: '2026-05-20T00:01:00.000Z',
      },
    });

    assert.equal(second.preparedResult.wrote_revision, false);
    assert.equal(second.preparedMutation.prepared_packets.length, 0);
    assert.equal(
      second.preparedResult.revision_id,
      first.preparedResult.revision_id
    );
  });
});
