import test from 'node:test';
import assert from 'node:assert/strict';

import {
  persistNexusElementPreference,
  type PersistNexusElementPreferenceInput,
} from './nexus-shell-preferences.ts';

const guestPreferences = {
  main_visible_scope_packet_ids: [],
  show_associated_parent_chains: true,
  show_followed_parent_chains: true,
};

test('claimed shell preference writes use the signed Preference.element mutation corridor', async () => {
  const fortressCalls: unknown[] = [];
  const compatibilityCalls: unknown[] = [];
  const result = await persistNexusElementPreference({
    currentMode: 'claimed',
    scopeDisplay: {
      main_visible_scope_packet_ids: ['nexus:element/city'],
    },
    shellChrome: {
      navigation_mode: 'scope',
    },
    note: 'Element interface preferences.',
    runFortressMutation: async <TResult,>(
      input: Parameters<PersistNexusElementPreferenceInput['runFortressMutation']>[0]
    ) => {
      fortressCalls.push(input);
      return {
        result: {
          preferences: {
            ...guestPreferences,
            main_visible_scope_packet_ids: ['nexus:element/city'],
          },
          shell_chrome: {
            navigation_mode: 'scope',
            theme_mode: 'dark',
            ui_density: 'small',
          },
          wrote_revision: true,
        } as TResult,
      };
    },
    updateCompatibilityPreferences: async (requestBody) => {
      compatibilityCalls.push(requestBody);
      return {
        preferences: guestPreferences,
      };
    },
  });

  assert.deepEqual(fortressCalls, [
    {
      intent: {
        kind: 'preference.element.set',
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/city'],
        },
        shell_chrome: {
          navigation_mode: 'scope',
        },
        note: 'Element interface preferences.',
      },
    },
  ]);
  assert.deepEqual(compatibilityCalls, []);
  assert.equal(result.shell_chrome?.navigation_mode, 'scope');
});

test('guest shell preference writes use the compatibility shell-preferences route payload', async () => {
  const fortressCalls: unknown[] = [];
  const compatibilityCalls: unknown[] = [];

  await persistNexusElementPreference({
    currentMode: 'persistent_guest',
    scopeDisplay: {
      show_followed_parent_chains: false,
    },
    shellChrome: {
      ui_density: 'large',
    },
    note: 'Element scope-display preferences.',
    runFortressMutation: async <TResult,>(
      input: Parameters<PersistNexusElementPreferenceInput['runFortressMutation']>[0]
    ) => {
      fortressCalls.push(input);
      return {
        result: {
          preferences: guestPreferences,
          shell_chrome: {
            navigation_mode: 'function',
            theme_mode: 'dark',
            ui_density: 'small',
          },
          wrote_revision: false,
        } as TResult,
      };
    },
    updateCompatibilityPreferences: async (requestBody) => {
      compatibilityCalls.push(requestBody);
      return {
        preferences: {
          ...guestPreferences,
          show_followed_parent_chains: false,
        },
        shell_chrome: {
          navigation_mode: 'function',
          theme_mode: 'dark',
          ui_density: 'large',
        },
      };
    },
  });

  assert.deepEqual(fortressCalls, []);
  assert.deepEqual(compatibilityCalls, [
    {
      show_followed_parent_chains: false,
      shell_chrome: {
        ui_density: 'large',
      },
    },
  ]);
});
