/**
 * File: preference-runtime-connectors.ts
 * Description: Runtime connector handlers for manifest-backed Preference.element actions.
 */

import { z } from 'zod';

import {
  ScopeDisplayPreferenceValueSchema,
  ShellChromePreferenceValueSchema,
  type ShellChromePreferenceValue,
} from '@core/packets/packet-definition-manifest';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  writeElementPreferenceInterfacePacket,
  type ElementPreferencePacketWriteResult,
} from '@runtime/nexus/server/element-preference-packets';
import type { PacketRuntimeConnector } from '@runtime/nexus/server/packet-runtime-master-handler';

const PreferenceElementInterfacePatchSchema = z
  .object({
    scope_display: ScopeDisplayPreferenceValueSchema.partial().optional(),
    shell_chrome: ShellChromePreferenceValueSchema.partial().optional(),
    note: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

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
  availability: 'live_bridge',
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
