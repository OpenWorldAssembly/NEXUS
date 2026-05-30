/**
 * File: preference-runtime-connectors.ts
 * Description: Runtime connector handlers for manifest-backed Preference.element actions.
 */

import { z } from 'zod';

import { createPacketRef, createPacketRevisionRef } from '@core/packets/builders';
import type { ShellChromePreferenceValue } from '@core/packets/definitions/preference.ts';
import {
  buildElementPreferenceBody,
  createElementPreferencePacketId,
  elementPreferenceInterfaceProjectionsEqual,
  mergeElementPreferenceInterfacePatch,
  normalizeScopeDisplayPreferenceValue,
  normalizeShellChromePreferenceValue,
  projectElementPreferenceInterface,
  type ElementPreferenceBody,
  type ElementPreferenceInterfacePatch,
} from '@core/packets/definitions/preference-helpers.ts';
import type { PacketEnvelopeByType, PacketRevisionRef } from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  readLatestDefinitionPacketRevision,
  writeDefinitionPacketRevision,
} from '@runtime/nexus/server/definition-packet-revisions.ts';
import type { PacketRuntimeConnector } from '@runtime/nexus/server/packet-runtime-master-handler';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

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

export type ElementPreferencePacketProjection = {
  packet_id: string;
  revision_ref: PacketRevisionRef | null;
  body: ElementPreferenceBody | null;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
};

export type ElementPreferencePacketWriteResult = {
  revision_ref: PacketRevisionRef;
  wrote_revision: boolean;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
};

export type PreferenceElementInterfaceRuntimeResult = {
  packet_id: string;
  revision_id: string;
  wrote_revision: boolean;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
};

type ElementPreferencePacket = PacketEnvelopeByType['Preference'] & {
  body: ElementPreferenceBody;
};

function toScopeDisplayPayload(
  value: Partial<NexusScopeDisplayPreferencesPayload> | null | undefined
): NexusScopeDisplayPreferencesPayload {
  return normalizeScopeDisplayPreferenceValue(value);
}

function getElementPreferencePacketId(actorPacketId: string): string {
  return createElementPreferencePacketId({
    owner_ref: createPacketRef(actorPacketId),
  });
}

function asElementPreferencePacket(
  packet: PacketEnvelopeByType['Preference'] | null
): ElementPreferencePacket | null {
  return packet?.body.subtype === 'element'
    ? (packet as ElementPreferencePacket)
    : null;
}

export async function readElementPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
}): Promise<ElementPreferencePacketProjection | null> {
  const packetId = getElementPreferencePacketId(input.actorPacketId);
  const packet = asElementPreferencePacket(
    await readLatestDefinitionPacketRevision({
      packetStore: input.packetStore,
      packetId,
      packetType: 'Preference',
      packetSubtype: 'element',
    })
  );

  if (!packet) {
    return null;
  }

  const projection = projectElementPreferenceInterface(packet.body);

  return {
    packet_id: packetId,
    revision_ref: createPacketRevisionRef(
      packet.header.packet_id,
      packet.header.revision_id
    ),
    body: packet.body,
    preferences: toScopeDisplayPayload(projection.scope_display),
    shell_chrome: normalizeShellChromePreferenceValue(projection.shell_chrome),
  };
}

export async function readElementScopeDisplayPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
}): Promise<ElementPreferencePacketProjection | null> {
  return readElementPreferencePacket(input);
}

export async function writeElementPreferenceInterfacePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  patch: ElementPreferenceInterfacePatch;
  createdAt: string;
  note?: string | null;
}): Promise<ElementPreferencePacketWriteResult> {
  const packetId = getElementPreferencePacketId(input.actorPacketId);
  const current = await readElementPreferencePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
  });
  const currentProjection = projectElementPreferenceInterface(current?.body);
  const nextProjection = mergeElementPreferenceInterfacePatch({
    current: currentProjection,
    patch: input.patch,
  });

  if (
    current?.revision_ref &&
    elementPreferenceInterfaceProjectionsEqual(currentProjection, nextProjection)
  ) {
    return {
      revision_ref: current.revision_ref,
      wrote_revision: false,
      preferences: toScopeDisplayPayload(nextProjection.scope_display),
      shell_chrome: normalizeShellChromePreferenceValue(nextProjection.shell_chrome),
    };
  }

  const body = buildElementPreferenceBody({
    owner_ref: createPacketRef(input.actorPacketId),
    privacy: 'private_sync',
    context: null,
    value: nextProjection.scope_display,
    shell_chrome: nextProjection.shell_chrome,
    supersedes_ref: current?.revision_ref ?? null,
    note: input.note ?? null,
  });
  const revisionRef = await writeDefinitionPacketRevision({
    packetStore: input.packetStore,
    packetType: 'Preference',
    packetId,
    schemaVersion: '0.1.0',
    body,
    actorPacketId: input.actorPacketId,
    createdAt: input.createdAt,
    parentRevisionRef: current?.revision_ref ?? null,
    mergeStrategy: 'supersedes',
    visibility: 'private',
    metadataTags: ['preference', 'interface'],
    metadataSummary: 'Element interface preferences.',
    adapter: 'runtime.preference_interface_connector',
  });

  return {
    revision_ref: revisionRef,
    wrote_revision: true,
    preferences: toScopeDisplayPayload(nextProjection.scope_display),
    shell_chrome: normalizeShellChromePreferenceValue(nextProjection.shell_chrome),
  };
}

export async function writeElementScopeDisplayPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  preferences: Partial<NexusScopeDisplayPreferencesPayload>;
  createdAt: string;
  note?: string | null;
}): Promise<ElementPreferencePacketWriteResult> {
  return writeElementPreferenceInterfacePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
    patch: {
      scope_display: input.preferences,
    },
    createdAt: input.createdAt,
    note: input.note ?? 'Element scope-display preferences.',
  });
}

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
