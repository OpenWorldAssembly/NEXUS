/**
 * File: preference-fortress-workflow.ts
 * Description: Trusted fortress prepare/finalize helpers for Preference.element interface writes.
 */

import { z } from 'zod';

import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import type {
  MutationActionId,
  ResolvedWritePolicyDecision,
} from '@core/auth/write-policy';
import type { PreparedMutation } from '@core/auth/mutation-corridor';
import type { ShellChromePreferenceValue } from '@core/packets/packet-definition-manifest';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  createElementPreferenceInterfacePacketPlan,
  type ElementPreferencePacketPlan,
} from '@runtime/nexus/server/element-preference-packets';
import type { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
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

export const PreferenceElementSetIntentPayloadSchema = z
  .object({
    kind: z.literal('preference.element.set').optional(),
    scope_display: ScopeDisplayPreferencePatchSchema.optional(),
    shell_chrome: ShellChromePreferencePatchSchema.optional(),
    note: z.string().trim().min(1).max(240).optional().nullable(),
    created_at: z.string().min(1).optional().nullable(),
    mutation_nonce: z.string().min(1).optional().nullable(),
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

export type PreferenceElementSetIntentPayload = z.infer<
  typeof PreferenceElementSetIntentPayloadSchema
>;

export type PreferenceElementFortressResult = {
  packet_id: string;
  revision_id: string;
  wrote_revision: boolean;
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome: ShellChromePreferenceValue;
};

export type PreparedPreferenceElementFortressResult =
  PreferenceElementFortressResult & {
    plan: ElementPreferencePacketPlan;
  };

const PREFERENCE_ELEMENT_ACTION_IDS = [
  'preference.element.write',
] as const satisfies readonly MutationActionId[];

export function toPreferenceElementFortressResult(
  plan: ElementPreferencePacketPlan
): PreferenceElementFortressResult {
  return {
    packet_id: plan.revision_ref.packet_id,
    revision_id: plan.revision_ref.revision_id,
    wrote_revision: plan.wrote_revision,
    preferences: plan.preferences,
    shell_chrome: plan.shell_chrome,
  };
}

export async function preparePreferenceElementFortressMutation(input: {
  packetStore: NodeSQLitePacketStore;
  policyGate: MutationPolicyGate;
  actorPacket: PacketEnvelopeByType['Element'];
  intent: PreferenceElementSetIntentPayload;
}): Promise<{
  preparedMutation: PreparedMutation;
  preparedResult: PreparedPreferenceElementFortressResult;
}> {
  const parsedIntent = PreferenceElementSetIntentPayloadSchema.parse(input.intent);
  const plan = await createElementPreferenceInterfacePacketPlan({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacket.header.packet_id,
    patch: {
      scope_display: parsedIntent.scope_display,
      shell_chrome: parsedIntent.shell_chrome,
    },
    createdAt: parsedIntent.created_at,
    note: parsedIntent.note ?? 'Element interface preferences.',
  });
  const policyDecision: ResolvedWritePolicyDecision =
    await input.policyGate.resolveScopePolicyDecision({
      actorPacket: input.actorPacket,
      governingScopePacket: input.actorPacket,
      actionIds: [...PREFERENCE_ELEMENT_ACTION_IDS],
    });
  const preparedPackets = plan.wrote_revision
    ? [
        {
          packet: plan.packet,
          unsigned_digest:
            (await getPacketUnsignedDigestCandidates(plan.packet))[0]?.digest ?? '',
        },
      ]
    : [];

  return {
    preparedMutation: {
      kind: 'preference.element.set',
      action_ids: [...PREFERENCE_ELEMENT_ACTION_IDS],
      required_proof_level: policyDecision.required_proof_level,
      accepted_proof_methods: policyDecision.accepted_proof_methods,
      source_policy_packet_ids: policyDecision.source_policy_packet_ids,
      governing_scope_packet_id: input.actorPacket.header.packet_id,
      prepared_packets: preparedPackets,
    },
    preparedResult: {
      ...toPreferenceElementFortressResult(plan),
      plan,
    },
  };
}
