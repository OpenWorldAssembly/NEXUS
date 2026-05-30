/**
 * File: element-preference-packets.ts
 * Description: Bridges live element preferences into Preference.element packets while preserving the legacy runtime table as a compatibility cache.
 */

import { createHash } from 'node:crypto';

import { createPacket } from '@core/packets/builders';
import {
  buildElementPreferenceBody,
  createElementPreferencePacketId,
  normalizeScopeDisplayPreferenceValue,
  normalizeShellChromePreferenceValue,
  type ElementPreferenceBody,
  type ShellChromePreferenceValue,
} from '@core/packets/packet-definition-manifest';
import type {
  PacketEnvelopeByType,
  PacketRevisionRef,
} from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  preferenceBodyToRuntimeScopeDisplayPreferences,
  runtimeScopeDisplayPreferencesToPreferenceBody,
} from '@runtime/nexus/server/preference-packet-definition';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { trustedExchangeCoordinator } from '@runtime/trusted_coordinators/trusted_exchange_coordinator/index.ts';

type ElementPreferencePacket = PacketEnvelopeByType['Preference'];

export type ElementPreferenceInterfacePatch = {
  scope_display?: Partial<NexusScopeDisplayPreferencesPayload> | null;
  shell_chrome?: Partial<ShellChromePreferenceValue> | null;
};

export type ElementPreferencePacketWriteResult = {
  packet: ElementPreferencePacket;
  revision_ref: PacketRevisionRef;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
  wrote_revision: boolean;
};

export type ElementPreferencePacketPlan = ElementPreferencePacketWriteResult & {
  parent_revision_ref: PacketRevisionRef | null;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function createElementPreferenceRevisionId(input: {
  packetId: string;
  body: ElementPreferenceBody;
  parentRevisionRef?: PacketRevisionRef | null;
  createdAt: string;
}): string {
  const digest = createHash('sha256')
    .update(
      stableJson({
        packet_id: input.packetId,
        type: 'Preference',
        schema_version: '0.1.0',
        created_at: input.createdAt,
        parent_revision_ref: input.parentRevisionRef ?? null,
        body: input.body,
      })
    )
    .digest('hex')
    .slice(0, 24);

  return `${input.packetId}@r-${digest}`;
}

function isElementPreferencePacket(
  packet: unknown
): packet is ElementPreferencePacket {
  return (
    typeof packet === 'object' &&
    packet !== null &&
    (packet as ElementPreferencePacket).header?.type === 'Preference' &&
    (packet as ElementPreferencePacket).body?.subtype === 'element'
  );
}

function getPreferencePacketProjection(
  packet: ElementPreferencePacket
): NexusScopeDisplayPreferencesPayload | null {
  if (packet.body.status !== 'active') {
    return null;
  }

  return preferenceBodyToRuntimeScopeDisplayPreferences(packet.body);
}

function getPreferencePacketShellChrome(
  packet: ElementPreferencePacket
): ShellChromePreferenceValue | null {
  if (packet.body.status !== 'active') {
    return null;
  }

  return normalizeShellChromePreferenceValue(
    packet.body.value.interface.shell_chrome
  );
}

function preferencesAreEqual(
  left: NexusScopeDisplayPreferencesPayload,
  right: NexusScopeDisplayPreferencesPayload
): boolean {
  return (
    stableJson(normalizeScopeDisplayPreferenceValue(left)) ===
    stableJson(normalizeScopeDisplayPreferenceValue(right))
  );
}

function shellChromePreferencesAreEqual(
  left: ShellChromePreferenceValue,
  right: ShellChromePreferenceValue
): boolean {
  return (
    stableJson(normalizeShellChromePreferenceValue(left)) ===
    stableJson(normalizeShellChromePreferenceValue(right))
  );
}

function mergeDefined<TValue extends object>(
  currentValue: TValue,
  patchValue: Partial<TValue> | null | undefined
): TValue {
  const definedPatch = Object.fromEntries(
    Object.entries(patchValue ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<TValue>;

  return {
    ...currentValue,
    ...definedPatch,
  } as TValue;
}

export async function readElementPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
}): Promise<{
  packet: ElementPreferencePacket;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
} | null> {
  const packetId = createElementPreferencePacketId({
    owner_ref: { packet_id: input.actorPacketId },
  });
  const packet = await input.packetStore.fetchByPacket({ packet_id: packetId });

  if (!isElementPreferencePacket(packet)) {
    return null;
  }

  const preferences = getPreferencePacketProjection(packet);
  const shellChrome = getPreferencePacketShellChrome(packet);

  if (!preferences || !shellChrome) {
    return null;
  }

  return {
    packet,
    preferences,
    shell_chrome: shellChrome,
  };
}

export async function readElementScopeDisplayPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
}): Promise<{
  packet: ElementPreferencePacket;
  preferences: NexusScopeDisplayPreferencesPayload;
} | null> {
  const projection = await readElementPreferencePacket(input);

  if (!projection) {
    return null;
  }

  return {
    packet: projection.packet,
    preferences: projection.preferences,
  };
}

export async function createElementPreferenceInterfacePacketPlan(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  patch: ElementPreferenceInterfacePatch;
  createdAt?: string | null;
  note?: string | null;
}): Promise<ElementPreferencePacketPlan> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const currentProjection = await readElementPreferencePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
  });
  const currentScopeDisplay = normalizeScopeDisplayPreferenceValue(
    currentProjection?.preferences ?? null
  );
  const currentShellChrome = normalizeShellChromePreferenceValue(
    currentProjection?.shell_chrome ?? null
  );
  const nextScopeDisplay = normalizeScopeDisplayPreferenceValue(
    mergeDefined(currentScopeDisplay, input.patch.scope_display)
  );
  const nextShellChrome = normalizeShellChromePreferenceValue(
    mergeDefined(currentShellChrome, input.patch.shell_chrome)
  );
  const parentRevisionRef = currentProjection
    ? {
        packet_id: currentProjection.packet.header.packet_id,
        revision_id: currentProjection.packet.header.revision_id,
      }
    : null;
  const body = buildElementPreferenceBody({
    owner_ref: { packet_id: input.actorPacketId },
    value: nextScopeDisplay,
    shell_chrome: nextShellChrome,
    supersedes_ref: parentRevisionRef,
    note: input.note ?? 'Element interface preferences.',
  });
  const nextPreferences = preferenceBodyToRuntimeScopeDisplayPreferences(body);
  const nextChrome = normalizeShellChromePreferenceValue(
    body.value.interface.shell_chrome
  );

  if (
    currentProjection &&
    preferencesAreEqual(currentProjection.preferences, nextPreferences) &&
    shellChromePreferencesAreEqual(currentProjection.shell_chrome, nextChrome)
  ) {
    return {
      packet: currentProjection.packet,
      revision_ref: {
        packet_id: currentProjection.packet.header.packet_id,
        revision_id: currentProjection.packet.header.revision_id,
      },
      preferences: currentProjection.preferences,
      shell_chrome: currentProjection.shell_chrome,
      wrote_revision: false,
      parent_revision_ref: parentRevisionRef,
    };
  }

  const packetId = createElementPreferencePacketId({
    owner_ref: { packet_id: input.actorPacketId },
    context: body.context,
  });
  const packet = createPacket({
    type: 'Preference',
    packet_id: packetId,
    revision_id: createElementPreferenceRevisionId({
      packetId,
      body,
      parentRevisionRef,
      createdAt,
    }),
    schema_version: '0.1.0',
    created_at: createdAt,
    parent_revision_refs: parentRevisionRef ? [parentRevisionRef] : [],
    merge_strategy: 'last_write_wins',
    authority_scope_ref: { packet_id: input.actorPacketId },
    applicable_scope_refs: [{ packet_id: input.actorPacketId }],
    created_by: { packet_id: input.actorPacketId },
    submitted_by: { packet_id: input.actorPacketId },
    visibility: 'private',
    metadata_tags: ['preference', 'element', 'interface', 'scope_display'],
    metadata_summary: 'Element interface preferences.',
    adapter: 'nexus-runtime',
    body,
  });
  return {
    packet,
    revision_ref: {
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    },
    preferences: nextPreferences,
    shell_chrome: nextChrome,
    wrote_revision: true,
    parent_revision_ref: parentRevisionRef,
  };
}

export async function writeElementPreferenceInterfacePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  patch: ElementPreferenceInterfacePatch;
  createdAt?: string | null;
  note?: string | null;
}): Promise<ElementPreferencePacketWriteResult> {
  const plan = await createElementPreferenceInterfacePacketPlan(input);

  if (!plan.wrote_revision) {
    return plan;
  }

  const commitResult = await trustedExchangeCoordinator.commitImport({
    packet_store: input.packetStore,
    bundle: JSON.stringify({
      bundle_version: 1,
      packets: [plan.packet],
    }),
    source_label: 'preference.element.interface.set',
    context_mode: 'normal_runtime',
    accepted_acknowledgements: [
      'needs_compatibility_acknowledgement',
      'needs_verification_acknowledgement',
    ],
    options: {
      verification_mode: 'advisory',
    },
  });

  if (commitResult.status === 'error') {
    throw new Error(
      commitResult.issues.find((issue) => issue.severity === 'error')?.message ??
        'Trusted Exchange could not commit the element preference packet.'
    );
  }

  return {
    packet: plan.packet,
    revision_ref: plan.revision_ref,
    preferences: plan.preferences,
    shell_chrome: plan.shell_chrome,
    wrote_revision: true,
  };
}

export async function writeElementScopeDisplayPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  createdAt?: string | null;
}): Promise<ElementPreferencePacketWriteResult> {
  const currentProjection = await readElementPreferencePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
  });

  if (!currentProjection) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const body = runtimeScopeDisplayPreferencesToPreferenceBody({
      actorPacketId: input.actorPacketId,
      preferences: input.preferences,
      supersedes_ref: null,
      note: 'Element scope-display preferences.',
    });

    return writeElementPreferenceInterfacePacket({
      packetStore: input.packetStore,
      actorPacketId: input.actorPacketId,
      patch: {
        scope_display: preferenceBodyToRuntimeScopeDisplayPreferences(body),
        shell_chrome: body.value.interface.shell_chrome,
      },
      createdAt,
      note: 'Element scope-display preferences.',
    });
  }

  return writeElementPreferenceInterfacePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
    patch: {
      scope_display: input.preferences,
    },
    createdAt: input.createdAt,
    note: 'Element scope-display preferences.',
  });
}
