/**
 * File: preference-helpers.ts
 * Description: Shadow-mode helpers for building, projecting, and adapting experimental Preference packet bodies.
 */

import type { PacketRef, PacketRevisionRef } from '@core/schema/packet-schema';

import {
  PreferenceContextSchema,
  ScopeDisplayPreferenceBuilderInputSchema,
  ScopeDisplayPreferenceValueSchema,
  type PreferenceBody,
  type ScopeDisplayPreferenceBuilderInput,
  type ScopeDisplayPreferenceContext,
  type ScopeDisplayPreferenceValue,
} from './preference.ts';

export const DEFAULT_SCOPE_DISPLAY_PREFERENCE_CONTEXT = PreferenceContextSchema.parse({});

export const DEFAULT_SCOPE_DISPLAY_PREFERENCE_VALUE =
  ScopeDisplayPreferenceValueSchema.parse({});

export type ScopeDisplayPreferenceBody = Extract<
  PreferenceBody,
  { subtype: 'scope_display' }
>;

export type ScopeDisplayPreferenceProjectionRecord = {
  body: ScopeDisplayPreferenceBody;
  revision_ref?: PacketRevisionRef | null;
  recorded_at?: string | null;
};

export type ScopeDisplayPreferenceProjectionInput = {
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
  records: readonly (ScopeDisplayPreferenceBody | ScopeDisplayPreferenceProjectionRecord)[];
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

export function createScopeDisplayPreferenceContextKey(
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

export function createScopeDisplayPreferencePacketId(input: {
  owner_ref: PacketRef;
  context?: Partial<ScopeDisplayPreferenceContext> | null;
}): string {
  const contextKey = createScopeDisplayPreferenceContextKey(input.context);

  return [
    'nexus:preference',
    'scope-display',
    encodePacketIdSegment(input.owner_ref.packet_id),
    encodePacketIdSegment(contextKey),
  ].join('/');
}

export function buildScopeDisplayPreferenceBody(
  input: ScopeDisplayPreferenceBuilderInput
): ScopeDisplayPreferenceBody {
  const parsedInput = ScopeDisplayPreferenceBuilderInputSchema.parse({
    ...input,
    value: normalizeScopeDisplayPreferenceValue(input.value),
  });

  return {
    type: 'preference',
    subtype: 'scope_display',
    owner_ref: parsedInput.owner_ref,
    status: 'active',
    privacy: parsedInput.privacy ?? 'private_sync',
    context: normalizeContext(parsedInput.context),
    supersedes_ref: parsedInput.supersedes_ref ?? null,
    note: parsedInput.note ?? null,
    value: normalizeScopeDisplayPreferenceValue(parsedInput.value),
  };
}

function unwrapProjectionRecord(
  record: ScopeDisplayPreferenceBody | ScopeDisplayPreferenceProjectionRecord,
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
): ScopeDisplayPreferenceBody | null {
  const targetOwnerPacketId = input.owner_ref.packet_id;
  const targetContextKey = createScopeDisplayPreferenceContextKey(input.context);

  const candidates = input.records
    .map(unwrapProjectionRecord)
    .filter((record) => record.body.owner_ref.packet_id === targetOwnerPacketId)
    .filter((record) => record.body.subtype === 'scope_display')
    .filter((record) => record.body.status === 'active')
    .filter(
      (record) => createScopeDisplayPreferenceContextKey(record.body.context) === targetContextKey
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
