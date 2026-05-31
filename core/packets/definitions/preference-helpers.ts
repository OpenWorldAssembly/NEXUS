/**
 * File: preference-helpers.ts
 * Description: Definition-mode helpers for building, projecting, and adapting canonical Preference packet bodies.
 */

import type { PacketRef, PacketRevisionRef } from '@core/schema/packet-schema';

import {
  PreferenceContextSchema,
  ElementPreferenceBuilderInputSchema,
  NodePreferenceBuilderInputSchema,
  NodePreferenceValueSchema,
  ScopeDisplayPreferenceValueSchema,
  ShellChromePreferenceValueSchema,
  type PreferenceBody,
  type ElementPreferenceBuilderInput,
  type NodePreferenceBuilderInput,
  type NodePreferenceValue,
  type ScopeDisplayPreferenceContext,
  type ScopeDisplayPreferenceValue,
  type ShellChromePreferenceValue,
} from './preference.ts';

export const DEFAULT_SCOPE_DISPLAY_PREFERENCE_CONTEXT = PreferenceContextSchema.parse({});

export const DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE =
  ScopeDisplayPreferenceValueSchema.parse({});

export const DEFAULT_SHELL_CHROME_PREFERENCE_VALUE =
  ShellChromePreferenceValueSchema.parse({});

export const DEFAULT_NODE_PREFERENCE_VALUE = NodePreferenceValueSchema.parse({});

export type ElementPreferenceBody = Extract<
  PreferenceBody,
  { subtype: 'element' }
>;

export type NodePreferenceBody = Extract<
  PreferenceBody,
  { subtype: 'node' }
>;


export type ElementPreferenceInterfacePatch = {
  scope_display?: Partial<ScopeDisplayPreferenceValue> | null;
  shell_chrome?: Partial<ShellChromePreferenceValue> | null;
};

export type ElementPreferenceInterfaceProjection = {
  scope_display: ScopeDisplayPreferenceValue;
  shell_chrome: ShellChromePreferenceValue;
};

export type ScopeDisplayPreferenceProjectionRecord = {
  body: ElementPreferenceBody;
  revision_ref?: PacketRevisionRef | null;
  recorded_at?: string | null;
};

export type ScopeDisplayPreferenceProjectionInput = {
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  records: readonly (ElementPreferenceBody | ScopeDisplayPreferenceProjectionRecord)[];
};


export type NodePreferenceProjectionRecord = {
  body: NodePreferenceBody;
  revision_ref?: PacketRevisionRef | null;
  recorded_at?: string | null;
};

export type NodePreferenceProjectionInput = {
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  records: readonly (NodePreferenceBody | NodePreferenceProjectionRecord)[];
};

export type LegacyScopeDisplayPreferenceValueV0 = {
  main_scope_ids?: readonly string[] | null;
  show_parent_chains?: boolean | null;
};

export type PreferenceCompatibilityAdaptation<TValue> = {
  value: TValue;
  loss_notes: string[];
};

function normalizeScopeIds(scopeIds: readonly string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (scopeIds ?? [])
        .map((scopeId) => scopeId.trim())
        .filter((scopeId) => scopeId.length > 0)
    )
  ).sort((leftScopeId, rightScopeId) => leftScopeId.localeCompare(rightScopeId));
}

function encodePacketIdSegment(value: string | null | undefined): string {
  if (!value) {
    return '_';
  }

  return encodeURIComponent(value).replace(/%/g, '~').replace(/\./g, '%2E');
}

function normalizeContext(
  context: Partial<ScopeDisplayPreferenceContext> | null | undefined
): ScopeDisplayPreferenceContext {
  return PreferenceContextSchema.parse({
    ...DEFAULT_SCOPE_DISPLAY_PREFERENCE_CONTEXT,
    ...(context ?? {}),
  });
}

export function normalizeScopeDisplayPreferenceValue(
  value: Partial<ScopeDisplayPreferenceValue> | null | undefined
): ScopeDisplayPreferenceValue {
  return ScopeDisplayPreferenceValueSchema.parse({
    ...DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE,
    ...(value ?? {}),
    main_visible_scope_packet_ids: normalizeScopeIds(
      value?.main_visible_scope_packet_ids ??
        DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE.main_visible_scope_packet_ids
    ),
  });
}

export function normalizeShellChromePreferenceValue(
  value: Partial<ShellChromePreferenceValue> | null | undefined
): ShellChromePreferenceValue {
  return ShellChromePreferenceValueSchema.parse({
    ...DEFAULT_SHELL_CHROME_PREFERENCE_VALUE,
    ...(value ?? {}),
  });
}

export function createPreferenceContextKey(
  context: Partial<ScopeDisplayPreferenceContext> | null | undefined
): string {
  const normalizedContext = normalizeContext(context);

  return [
    normalizedContext.namespace,
    normalizedContext.initiative_ref?.packet_id ?? '',
    normalizedContext.scope_ref?.packet_id ?? '',
    normalizedContext.surface_key ?? '',
    normalizedContext.device_key ?? '',
  ].join('|');
}

export function createElementPreferenceContextKey(
  context: Partial<ScopeDisplayPreferenceContext> | null | undefined
): string {
  return createPreferenceContextKey(context);
}

function createPreferencePacketId(input: {
  subtype: 'element' | 'node';
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
}): string {
  const contextKey = createPreferenceContextKey(input.context);

  return [
    'nexus:preference',
    input.subtype,
    encodePacketIdSegment(input.owner_ref.packet_id),
    encodePacketIdSegment(contextKey),
  ].join('/');
}

export function createElementPreferencePacketId(input: {
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
}): string {
  return createPreferencePacketId({
    subtype: 'element',
    owner_ref: input.owner_ref,
    context: input.context,
  });
}

export function createNodePreferencePacketId(input: {
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
}): string {
  return createPreferencePacketId({
    subtype: 'node',
    owner_ref: input.owner_ref,
    context: input.context,
  });
}

export function buildElementPreferenceBody(
  input: ElementPreferenceBuilderInput
): ElementPreferenceBody {
  const parsedInput = ElementPreferenceBuilderInputSchema.parse({
    ...input,
    value: normalizeScopeDisplayPreferenceValue(input.value),
    shell_chrome: normalizeShellChromePreferenceValue(input.shell_chrome),
  });

  return {
    subtype: 'element',
    owner_ref: parsedInput.owner_ref,
    status: 'active',
    privacy: parsedInput.privacy ?? 'private_sync',
    context: normalizeContext(parsedInput.context),
    supersedes_ref: parsedInput.supersedes_ref ?? null,
    note: parsedInput.note ?? null,
    value: {
      interface: {
        scope_display: normalizeScopeDisplayPreferenceValue(parsedInput.value),
        shell_chrome: normalizeShellChromePreferenceValue(parsedInput.shell_chrome),
      },
    },
  };
}


export function normalizeNodePreferenceValue(
  value: Partial<NodePreferenceValue> | null | undefined
): NodePreferenceValue {
  return NodePreferenceValueSchema.parse({
    ...DEFAULT_NODE_PREFERENCE_VALUE,
    ...(value ?? {}),
  });
}

export function buildNodePreferenceBody(
  input: NodePreferenceBuilderInput
): NodePreferenceBody {
  const parsedInput = NodePreferenceBuilderInputSchema.parse({
    ...input,
    value: normalizeNodePreferenceValue(input.value),
  });

  return {
    subtype: 'node',
    owner_ref: parsedInput.owner_ref,
    status: 'active',
    privacy: parsedInput.privacy ?? 'sealed_private',
    context: normalizeContext(parsedInput.context),
    supersedes_ref: parsedInput.supersedes_ref ?? null,
    note: parsedInput.note ?? null,
    value: normalizeNodePreferenceValue(parsedInput.value),
  };
}

function unwrapProjectionRecord(
  record: ElementPreferenceBody | ScopeDisplayPreferenceProjectionRecord,
  arrayIndex: number
): ScopeDisplayPreferenceProjectionRecord & { arrayIndex: number } {
  if ('body' in record) {
    return {
      ...record,
      arrayIndex,
    };
  }

  return {
    body: record,
    revision_ref: null,
    recorded_at: null,
    arrayIndex,
  };
}

export function projectLatestActiveScopeDisplayPreference(
  input: ScopeDisplayPreferenceProjectionInput
): ElementPreferenceBody | null {
  const targetOwnerPacketId = input.owner_ref.packet_id;
  const targetContextKey = createElementPreferenceContextKey(input.context);

  const candidates = input.records
    .map(unwrapProjectionRecord)
    .filter((record) => record.body.owner_ref.packet_id === targetOwnerPacketId)
    .filter((record) => record.body.subtype === 'element')
    .filter((record) => record.body.status === 'active')
    .filter(
      (record) => createElementPreferenceContextKey(record.body.context) === targetContextKey
    );

  if (candidates.length === 0) {
    return null;
  }

  const [latest] = candidates.sort((left, right) => {
    const leftRecordedAt = left.recorded_at ?? '';
    const rightRecordedAt = right.recorded_at ?? '';

    if (leftRecordedAt !== rightRecordedAt) {
      return rightRecordedAt.localeCompare(leftRecordedAt);
    }

    const leftRevisionId = left.revision_ref?.revision_id ?? '';
    const rightRevisionId = right.revision_ref?.revision_id ?? '';

    if (leftRevisionId !== rightRevisionId) {
      return rightRevisionId.localeCompare(leftRevisionId);
    }

    return right.arrayIndex - left.arrayIndex;
  });

  return latest.body;
}


function unwrapNodeProjectionRecord(
  record: NodePreferenceBody | NodePreferenceProjectionRecord,
  arrayIndex: number
): NodePreferenceProjectionRecord & { arrayIndex: number } {
  if ('body' in record) {
    return {
      ...record,
      arrayIndex,
    };
  }

  return {
    body: record,
    revision_ref: null,
    recorded_at: null,
    arrayIndex,
  };
}

export function projectLatestActiveNodePreference(
  input: NodePreferenceProjectionInput
): NodePreferenceBody | null {
  const targetOwnerPacketId = input.owner_ref.packet_id;
  const targetContextKey = createPreferenceContextKey(input.context);

  const candidates = input.records
    .map(unwrapNodeProjectionRecord)
    .filter((record) => record.body.owner_ref.packet_id === targetOwnerPacketId)
    .filter((record) => record.body.subtype === 'node')
    .filter((record) => record.body.status === 'active')
    .filter(
      (record) => createPreferenceContextKey(record.body.context) === targetContextKey
    );

  if (candidates.length === 0) {
    return null;
  }

  const [latest] = candidates.sort((left, right) => {
    const leftRecordedAt = left.recorded_at ?? '';
    const rightRecordedAt = right.recorded_at ?? '';

    if (leftRecordedAt !== rightRecordedAt) {
      return rightRecordedAt.localeCompare(leftRecordedAt);
    }

    const leftRevisionId = left.revision_ref?.revision_id ?? '';
    const rightRevisionId = right.revision_ref?.revision_id ?? '';

    if (leftRevisionId !== rightRevisionId) {
      return rightRevisionId.localeCompare(leftRevisionId);
    }

    return right.arrayIndex - left.arrayIndex;
  });

  return latest.body;
}


export function projectElementPreferenceInterface(
  body: ElementPreferenceBody | null | undefined
): ElementPreferenceInterfaceProjection {
  return {
    scope_display: normalizeScopeDisplayPreferenceValue(
      body?.value.interface.scope_display
    ),
    shell_chrome: normalizeShellChromePreferenceValue(
      body?.value.interface.shell_chrome
    ),
  };
}

export function mergeElementPreferenceInterfacePatch(input: {
  current?: ElementPreferenceInterfaceProjection | null;
  patch?: ElementPreferenceInterfacePatch | null;
}): ElementPreferenceInterfaceProjection {
  const current = input.current ?? projectElementPreferenceInterface(null);

  return {
    scope_display: normalizeScopeDisplayPreferenceValue({
      ...current.scope_display,
      ...(input.patch?.scope_display ?? {}),
    }),
    shell_chrome: normalizeShellChromePreferenceValue({
      ...current.shell_chrome,
      ...(input.patch?.shell_chrome ?? {}),
    }),
  };
}

function stablePreferenceJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stablePreferenceJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stablePreferenceJson(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function elementPreferenceInterfaceProjectionsEqual(
  left: ElementPreferenceInterfaceProjection,
  right: ElementPreferenceInterfaceProjection
): boolean {
  return stablePreferenceJson(left) === stablePreferenceJson(right);
}

export function upcastLegacyScopeDisplayPreferenceValueV0(
  legacyValue: LegacyScopeDisplayPreferenceValueV0
): PreferenceCompatibilityAdaptation<ScopeDisplayPreferenceValue> {
  const showParentChains = legacyValue.show_parent_chains ?? true;

  return {
    value: normalizeScopeDisplayPreferenceValue({
      main_visible_scope_packet_ids: normalizeScopeIds(legacyValue.main_scope_ids ?? []),
      show_associated_parent_chains: showParentChains,
      show_followed_parent_chains: showParentChains,
    }),
    loss_notes: [],
  };
}

export function downcastScopeDisplayPreferenceValueToLegacyV0(
  value: ScopeDisplayPreferenceValue
): PreferenceCompatibilityAdaptation<LegacyScopeDisplayPreferenceValueV0> {
  const normalizedValue = normalizeScopeDisplayPreferenceValue(value);
  const lossNotes: string[] = [];

  if (
    normalizedValue.show_associated_parent_chains !==
    normalizedValue.show_followed_parent_chains
  ) {
    lossNotes.push(
      'legacy_v0 has one show_parent_chains flag; associated/followed parent-chain preferences were collapsed.'
    );
  }

  return {
    value: {
      main_scope_ids: normalizedValue.main_visible_scope_packet_ids,
      show_parent_chains:
        normalizedValue.show_associated_parent_chains &&
        normalizedValue.show_followed_parent_chains,
    },
    loss_notes: lossNotes,
  };
}
