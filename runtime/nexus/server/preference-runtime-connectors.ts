/**
 * File: preference-runtime-connectors.ts
 * Description: Runtime connector handlers for manifest-backed Preference.element actions.
 */

import { z } from 'zod';

import type { ShellChromePreferenceValue } from '@core/packets/packet-definition-manifest';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  writeElementPreferenceInterfacePacket,
  type ElementPreferencePacketWriteResult,
} from '@runtime/nexus/server/element-preference-packets';
import type { PacketRuntimeConnector } from '@runtime/nexus/server/packet-runtime-master-handler';

const ScopeDisplayPreferencePatchSchema = z
  .object({
    main_visible_scope_packet_ids: z.array(z.string().min(1)).optional(),
    show_associated_parent_chains: z.boolean().optional(),
    show_followed_parent_chains: z.boolean().optional(),
  })
  .strict();

const ShellChromePreferencePatchSchema = z
  .object({
    navigation_mode: z.enum(['function', 'scope']).optional(),
    theme_mode: z.enum(['dark', 'light']).optional(),
    ui_density: z.enum(['small', 'large']).optional(),
  })
  .strict();

function hasDefinedPatchField(
  patch: Record<string, unknown> | undefined
): boolean {
  return Object.values(patch ?? {}).some((value) => value !== undefined);
}

const PreferenceElementInterfacePatchSchema = z
  .object({
    scope_display: ScopeDisplayPreferencePatchSchema.optional(),
    shell_chrome: ShellChromePreferencePatchSchema.optional(),
    note: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      hasDefinedPatchField(value.scope_display) ||
      hasDefinedPatchField(value.shell_chrome)
    ) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message:
        'Preference.element interface writes require at least one scope_display or shell_chrome field.',
      path: ['scope_display'],
    });
  });

export type PreferenceElementInterfaceRuntimeInput = {
  scope_display?: Partial<NexusScopeDisplayPreferencesPayload>;
  shell_chrome?: Partial<ShellChromePreferenceValue>;
  note?: string;
};

export type PreferenceElementInterfaceRuntimeResult = {
  packet_id: string;
  revision_id: string;
  wrote_revision: boolean;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
};

function toRuntimeResult(
  writeResult: ElementPreferencePacketWriteResult
): PreferenceElementInterfaceRuntimeResult {
  return {
    packet_id: writeResult.revision_ref.packet_id,
    revision_id: writeResult.revision_ref.revision_id,
    wrote_revision: writeResult.wrote_revision,
    preferences: writeResult.preferences,
    shell_chrome: writeResult.shell_chrome,
  };
}

export const preferenceElementInterfaceRuntimeConnector: PacketRuntimeConnector<PreferenceElementInterfaceRuntimeResult> = {
  connector_id: 'preference.element.interface.set',
  packet_type: 'Preference',
  packet_subtype: 'element',
  mutation_intent: 'preference.element.set',
  availability: 'definition',
  async run(input, context) {
    const parsedInput = PreferenceElementInterfacePatchSchema.parse(input);
    const writeResult = await writeElementPreferenceInterfacePacket({
      packetStore: context.packetStore,
      actorPacketId: context.actorContext.actorPacketId,
      patch: {
        scope_display: parsedInput.scope_display,
        shell_chrome: parsedInput.shell_chrome,
      },
      createdAt: context.createdAt,
      note: parsedInput.note ?? 'Element interface preferences.',
    });

    if (parsedInput.scope_display) {
      await context.packetStore.writeActorScopeDisplayPreferences({
        actor_packet_id: context.actorContext.actorPacketId,
        main_visible_scope_packet_ids:
          writeResult.preferences.main_visible_scope_packet_ids,
        show_associated_parent_chains:
          writeResult.preferences.show_associated_parent_chains,
        show_followed_parent_chains:
          writeResult.preferences.show_followed_parent_chains,
        updated_at: context.createdAt,
      });
    }

    return toRuntimeResult(writeResult);
  },
};
