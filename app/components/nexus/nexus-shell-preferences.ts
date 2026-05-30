/**
 * File: nexus-shell-preferences.ts
 * Description: Chooses the correct shell preference write corridor for claimed and guest actors.
 */

import type {
  ShellChromePreferenceValue,
} from '@core/packets/packet-definition-manifest';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';

export type NexusShellPreferenceMode =
  | 'ephemeral_guest'
  | 'persistent_guest'
  | 'claimed'
  | null;

export type PersistNexusElementPreferenceInput = {
  currentMode: NexusShellPreferenceMode;
  scopeDisplay?: Partial<NexusScopeDisplayPreferencesPayload>;
  shellChrome?: Partial<ShellChromePreferenceValue>;
  note: string;
  runDispatchMutation: <TResult = unknown>(input: {
    intent: {
      kind: 'preference.element.set';
      scope_display?: Partial<NexusScopeDisplayPreferencesPayload>;
      shell_chrome?: Partial<ShellChromePreferenceValue>;
      note?: string | null;
    };
    interfaceEventHeaders?: Record<string, string>;
  }) => Promise<{ result: TResult }>;
  updateCompatibilityPreferences: (requestBody: Record<string, unknown>) => Promise<{
    preferences: NexusScopeDisplayPreferencesPayload;
    shell_chrome?: ShellChromePreferenceValue;
  }>;
};

export type PersistNexusElementPreferenceResult = {
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome?: ShellChromePreferenceValue;
  wrote_revision?: boolean;
};

export async function persistNexusElementPreference(
  input: PersistNexusElementPreferenceInput
): Promise<PersistNexusElementPreferenceResult> {
  if (input.currentMode === 'claimed') {
    const finalized = await input.runDispatchMutation<{
      preferences: NexusScopeDisplayPreferencesPayload;
      shell_chrome: ShellChromePreferenceValue;
      wrote_revision: boolean;
    }>({
      intent: {
        kind: 'preference.element.set',
        scope_display: input.scopeDisplay,
        shell_chrome: input.shellChrome,
        note: input.note,
      },
    });

    return finalized.result;
  }

  return input.updateCompatibilityPreferences({
    ...(input.scopeDisplay ?? {}),
    ...(input.shellChrome ? { shell_chrome: input.shellChrome } : {}),
  });
}
