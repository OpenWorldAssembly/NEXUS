import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  GENERIC_SHADOW_PACKET_RUNTIME_CAPABILITIES,
  type ShellChromePreferenceValue,
} from '@core/packets/packet-definition-manifest';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import {
  readElementPreferencePacket,
  writeElementPreferenceInterfacePacket,
  writeElementScopeDisplayPreferencePacket,
} from './element-preference-packets.ts';
import { runRegisteredPacketRuntimeMutation } from './packet-runtime-connectors.ts';
import type { PreferenceElementInterfaceRuntimeResult } from './preference-runtime-connectors.ts';
import {
  readScopeDisplayPreferences,
  reconcileScopeDisplayPreferences,
  writeClaimedScopeDisplayPreferences,
} from './scope-display-preferences.ts';

async function withTemporaryPacketStore<TResult>(
  run: (packetStore: NodeSQLitePacketStore) => Promise<TResult>
): Promise<TResult> {
  const directory = mkdtempSync(join(tmpdir(), 'owa-preference-packets-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-preference-packets.db'),
  });

  try {
    return await run(packetStore);
  } finally {
    packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('scope display preference reconciliation prunes stale main ids without changing toggles', () => {
  const preferences = reconcileScopeDisplayPreferences({
    preferences: {
      main_visible_scope_packet_ids: [
        'nexus:element/tempe',
        'nexus:element/stale-scope',
        'nexus:element/flagstaff',
        'nexus:element/tempe',
      ],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    },
    eligibleMainScopePacketIds: [
      'nexus:element/flagstaff',
      'nexus:element/tempe',
    ],
  });

  assert.deepEqual(preferences, {
    main_visible_scope_packet_ids: [
      'nexus:element/flagstaff',
      'nexus:element/tempe',
    ],
    show_associated_parent_chains: false,
    show_followed_parent_chains: true,
  });
});


test('scope display preference reconciliation leaves main ids alone without eligibility input', () => {
  const preferences = reconcileScopeDisplayPreferences({
    preferences: {
      main_visible_scope_packet_ids: [
        'nexus:element/tempe',
        'nexus:element/stale-scope',
      ],
    },
  });

  assert.deepEqual(preferences.main_visible_scope_packet_ids, [
    'nexus:element/stale-scope',
    'nexus:element/tempe',
  ]);
  assert.equal(preferences.show_associated_parent_chains, true);
  assert.equal(preferences.show_followed_parent_chains, true);
});

test('claimed scope display preferences are stored as Preference.element packets', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    const preferences = await writeClaimedScopeDisplayPreferences({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: ['nexus:element/city'],
        show_associated_parent_chains: false,
        show_followed_parent_chains: true,
      },
    });
    const packets = await packetStore.listPreferredPacketsByFamily('Preference');
    const readBack = await readScopeDisplayPreferences({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.deepEqual(preferences, {
      main_visible_scope_packet_ids: ['nexus:element/city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
    assert.equal(packets.length, 1);
    assert.equal(packets[0].body.subtype, 'element');
    assert.equal(packets[0].body.owner_ref.packet_id, 'nexus:element/test-actor');
    assert.deepEqual(readBack, preferences);
  });
});

test('Preference.element packet wins over legacy actor scope-display cache', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    await packetStore.writeActorScopeDisplayPreferences({
      actor_packet_id: 'nexus:element/test-actor',
      main_visible_scope_packet_ids: ['nexus:element/legacy-city'],
      show_associated_parent_chains: true,
      show_followed_parent_chains: true,
      updated_at: '2026-05-17T00:00:00.000Z',
    });

    const packetWrite = await writeElementScopeDisplayPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: ['nexus:element/packet-city'],
        show_associated_parent_chains: false,
        show_followed_parent_chains: true,
      },
      createdAt: '2026-05-17T00:01:00.000Z',
    });
    const readBack = await readScopeDisplayPreferences({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.equal(packetWrite.wrote_revision, true);
    assert.deepEqual(readBack, {
      main_visible_scope_packet_ids: ['nexus:element/packet-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
  });
});

test('legacy actor scope-display cache remains fallback when no Preference.element packet exists', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    await packetStore.writeActorScopeDisplayPreferences({
      actor_packet_id: 'nexus:element/test-actor',
      main_visible_scope_packet_ids: ['nexus:element/legacy-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: false,
      updated_at: '2026-05-17T00:00:00.000Z',
    });

    const readBack = await readScopeDisplayPreferences({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.deepEqual(readBack, {
      main_visible_scope_packet_ids: ['nexus:element/legacy-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: false,
    });
  });
});

test('Preference.element no-op writes reuse the current revision', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    const firstWrite = await writeElementScopeDisplayPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: ['nexus:element/b', 'nexus:element/a'],
        show_associated_parent_chains: true,
        show_followed_parent_chains: false,
      },
      createdAt: '2026-05-17T00:00:00.000Z',
    });
    const secondWrite = await writeElementScopeDisplayPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: [
          'nexus:element/a',
          'nexus:element/b',
          'nexus:element/a',
        ],
        show_associated_parent_chains: true,
        show_followed_parent_chains: false,
      },
      createdAt: '2026-05-17T00:02:00.000Z',
    });
    const heads = await packetStore.fetchRevisionHeads({
      packet_id: firstWrite.revision_ref.packet_id,
    });

    assert.equal(firstWrite.wrote_revision, true);
    assert.equal(secondWrite.wrote_revision, false);
    assert.deepEqual(secondWrite.revision_ref, firstWrite.revision_ref);
    assert.deepEqual(heads.head_revisions, [firstWrite.revision_ref]);
  });
});

test('Preference.element revisions supersede the previous active scope-display preference', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    const firstWrite = await writeElementScopeDisplayPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: ['nexus:element/old-city'],
        show_associated_parent_chains: true,
        show_followed_parent_chains: true,
      },
      createdAt: '2026-05-17T00:00:00.000Z',
    });
    const secondWrite = await writeElementScopeDisplayPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: ['nexus:element/new-city'],
        show_associated_parent_chains: false,
        show_followed_parent_chains: true,
      },
      createdAt: '2026-05-17T00:03:00.000Z',
    });
    const readBack = await readScopeDisplayPreferences({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.equal(secondWrite.wrote_revision, true);
    assert.notEqual(
      secondWrite.revision_ref.revision_id,
      firstWrite.revision_ref.revision_id
    );
    assert.deepEqual(secondWrite.packet.header.parent_revision_refs, [
      firstWrite.revision_ref,
    ]);
    assert.deepEqual(secondWrite.packet.body.supersedes_ref, firstWrite.revision_ref);
    assert.deepEqual(readBack, {
      main_visible_scope_packet_ids: ['nexus:element/new-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
  });
});


test('Preference.element scope-display writes preserve existing shell chrome preferences', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    await writeElementPreferenceInterfacePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      patch: {
        shell_chrome: {
          navigation_mode: 'scope',
          theme_mode: 'light',
          ui_density: 'large',
        },
      },
      createdAt: '2026-05-17T00:00:00.000Z',
    });

    await writeElementScopeDisplayPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      preferences: {
        main_visible_scope_packet_ids: ['nexus:element/new-city'],
        show_associated_parent_chains: false,
        show_followed_parent_chains: true,
      },
      createdAt: '2026-05-17T00:01:00.000Z',
    });

    const packet = await readElementPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.deepEqual(packet?.shell_chrome, {
      navigation_mode: 'scope',
      theme_mode: 'light',
      ui_density: 'large',
    });
    assert.deepEqual(packet?.preferences, {
      main_visible_scope_packet_ids: ['nexus:element/new-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
  });
});

test('packet runtime master handler dispatches Preference.element interface writes', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    const runtimeResult = await runRegisteredPacketRuntimeMutation<PreferenceElementInterfaceRuntimeResult>({
      packetStore,
      actorContext: {
        actorPacketId: 'nexus:element/test-actor',
      },
      mutationIntent: 'preference.element.set',
      input: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/city'],
          show_associated_parent_chains: false,
          show_followed_parent_chains: true,
        },
        shell_chrome: {
          navigation_mode: 'scope',
          theme_mode: 'dark',
          ui_density: 'large',
        },
      },
      createdAt: '2026-05-17T00:00:00.000Z',
    });
    const storedCache = await packetStore.readActorScopeDisplayPreferences(
      'nexus:element/test-actor'
    );

    assert.equal(runtimeResult.corridor_kind, 'packet_runtime_master_handler');
    assert.equal(runtimeResult.connector_id, 'preference.element.interface.set');
    assert.equal(runtimeResult.packet_type, 'Preference');
    assert.equal(runtimeResult.packet_subtype, 'element');
    assert.equal(runtimeResult.mutation_intent, 'preference.element.set');
    assert.equal(runtimeResult.action_plan_ready, true);
    assert.ok(runtimeResult.action_ids.includes('preference.element.revise'));
    assert.deepEqual(runtimeResult.result.preferences, {
      main_visible_scope_packet_ids: ['nexus:element/city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
    assert.deepEqual(runtimeResult.result.shell_chrome, {
      navigation_mode: 'scope',
      theme_mode: 'dark',
      ui_density: 'large',
    });
    assert.deepEqual(storedCache?.main_visible_scope_packet_ids, [
      'nexus:element/city',
    ]);
  });
});


test('Preference.element shell chrome writes preserve existing scope-display preferences', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    await writeElementPreferenceInterfacePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      patch: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/original-city'],
          show_associated_parent_chains: false,
          show_followed_parent_chains: true,
        },
      },
      createdAt: '2026-05-17T00:00:00.000Z',
    });

    await writeElementPreferenceInterfacePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      patch: {
        shell_chrome: {
          navigation_mode: 'scope',
          theme_mode: 'light',
          ui_density: 'large',
        },
      },
      createdAt: '2026-05-17T00:01:00.000Z',
    });

    const packet = await readElementPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.deepEqual(packet?.preferences, {
      main_visible_scope_packet_ids: ['nexus:element/original-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    });
    assert.deepEqual(packet?.shell_chrome, {
      navigation_mode: 'scope',
      theme_mode: 'light',
      ui_density: 'large',
    });
  });
});

test('Preference.element sparse scope-display patches ignore undefined route-style fields', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    await writeElementPreferenceInterfacePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      patch: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/original-city'],
          show_associated_parent_chains: false,
          show_followed_parent_chains: false,
        },
        shell_chrome: {
          navigation_mode: 'scope',
          theme_mode: 'light',
          ui_density: 'large',
        },
      },
      createdAt: '2026-05-17T00:00:00.000Z',
    });

    await writeElementPreferenceInterfacePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
      patch: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/new-city'],
          show_associated_parent_chains: undefined,
          show_followed_parent_chains: undefined,
        } as Partial<NexusScopeDisplayPreferencesPayload>,
        shell_chrome: {
          navigation_mode: undefined,
          theme_mode: 'dark',
          ui_density: undefined,
        } as Partial<ShellChromePreferenceValue>,
      },
      createdAt: '2026-05-17T00:01:00.000Z',
    });

    const packet = await readElementPreferencePacket({
      packetStore,
      actorPacketId: 'nexus:element/test-actor',
    });

    assert.deepEqual(packet?.preferences, {
      main_visible_scope_packet_ids: ['nexus:element/new-city'],
      show_associated_parent_chains: false,
      show_followed_parent_chains: false,
    });
    assert.deepEqual(packet?.shell_chrome, {
      navigation_mode: 'scope',
      theme_mode: 'dark',
      ui_density: 'large',
    });
  });
});

test('packet runtime master handler resolves Preference.element by mutation intent and fails closed on unsupported capabilities', async () => {
  await withTemporaryPacketStore(async (packetStore) => {
    await assert.rejects(
      runRegisteredPacketRuntimeMutation<PreferenceElementInterfaceRuntimeResult>({
        packetStore,
        actorContext: {
          actorPacketId: 'nexus:element/test-actor',
        },
        mutationIntent: 'preference.element.set',
        capabilities: {
          ...GENERIC_SHADOW_PACKET_RUNTIME_CAPABILITIES,
          builder_kinds: [],
        },
        input: {
          shell_chrome: {
            theme_mode: 'light',
          },
        },
        createdAt: '2026-05-17T00:00:00.000Z',
      }),
      /Unsupported capabilities: builder_kind:single_packet_body/
    );
  });
});
