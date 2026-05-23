import test from 'node:test';
import assert from 'node:assert/strict';

import { POST } from '@/src/app/api/nexus/shell-preferences+api.ts';

async function postShellPreferences(body: Record<string, unknown>) {
  const response = await POST(
    new Request('https://example.test/api/nexus/shell-preferences', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    {}
  );

  return {
    response,
    body: await response.json(),
  };
}

test('guest shell-preferences route stores scope-display and shell-chrome compatibility state', async () => {
  const { response, body } = await postShellPreferences({
    main_visible_scope_packet_ids: ['nexus:element/city'],
    show_associated_parent_chains: false,
    shell_chrome: {
      navigation_mode: 'scope',
      theme_mode: 'light',
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', /nexus_shell_preferences=/);
  assert.deepEqual(body.preferences, {
    main_visible_scope_packet_ids: ['nexus:element/city'],
    show_associated_parent_chains: false,
    show_followed_parent_chains: true,
  });
  assert.deepEqual(body.shell_chrome, {
    navigation_mode: 'scope',
    theme_mode: 'light',
    ui_density: 'small',
  });
});

test('shell-preferences route rejects claimed-write fields through strict guest schema', async () => {
  for (const claimedField of ['actor_packet', 'actor_assertion']) {
    const { response, body } = await postShellPreferences({
      [claimedField]: {},
      main_visible_scope_packet_ids: ['nexus:element/city'],
    });

    assert.equal(response.status, 400);
    assert.match(body.error, /Unrecognized key/);
  }
});
