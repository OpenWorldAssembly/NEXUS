/**
 * File: prepare-mutation-intent-schema.ts
 * Description: Public prepare-route mutation intent validation schema kept aligned with the live mutation registry.
 */

import { z } from 'zod';

import { ShellChromePreferenceValueSchema } from '@core/packets/packet-definition-manifest';

export const ActorAssertionSchema = z
  .object({
    actor_packet_id: z.string().min(1),
    kid: z.string().min(1),
    method: z.string().min(1),
    path: z.string().min(1),
    body_digest: z.string().min(1),
    issued_at: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

const MutationIntentSchemaOptions = [
  z
    .object({
      kind: z.literal('discussion.thread_post.create'),
      scope_id: z.string().min(1),
      forum_packet_id: z.string().min(1),
      thread_title: z.string(),
      post_markdown: z.string().min(1),
      related_packet_ids: z.array(z.string().min(1)).optional().default([]),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('discussion.reply.create'),
      scope_id: z.string().min(1),
      parent_post_packet_id: z.string().min(1),
      reply_markdown: z.string().min(1),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('attestation.packet_signal.set'),
      scope_id: z.string().min(1),
      target_packet_id: z.string().min(1),
      value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('assembly.element.create'),
      name: z.string().min(1),
      parent_scope_packet_id: z.string().min(1),
      subtype: z.string().min(1).optional().nullable().default(null),
      summary: z.string().min(1).optional().nullable().default(null),
      locality_label: z.string().min(1).optional().nullable().default(null),
      seed_discussions: z.boolean().optional().default(true),
      claim_association: z.boolean().optional().default(true),
      claim_note: z.string().min(1).optional().nullable().default(null),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('assembly_association.relation.set'),
      assembly_packet_id: z.string().min(1),
      scope_id: z.string().min(1),
      note: z.string().min(1).optional().nullable().default(null),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('assembly_association.relation.clear'),
      assembly_packet_id: z.string().min(1),
      scope_id: z.string().min(1),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('home_locality.relation.set'),
      home_scope_packet_id: z.string().min(1).optional().nullable().default(null),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('follows.relation.set'),
      scope_id: z.string().min(1),
      target_scope_packet_id: z.string().min(1),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('follows.relation.clear'),
      scope_id: z.string().min(1),
      target_scope_packet_id: z.string().min(1),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('role_association.claim.set'),
      scope_id: z.string().min(1),
      role_packet_id: z.string().min(1),
      claimed: z.boolean(),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('role_association.attestation.set'),
      scope_id: z.string().min(1),
      claim_packet_id: z.string().min(1),
      mode: z.enum(['support', 'dispute', 'clear']),
      note: z.string().optional().nullable().default(null),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('locality.path.create'),
      path: z
        .array(
          z
            .object({
              level: z.enum(['nation', 'region', 'city', 'district']),
              name: z.string().trim().max(120).default(''),
              existing_scope_id: z.string().min(1).optional().nullable().default(null),
              alias_keys: z.array(z.string().min(1)).optional().default([]),
              display_aliases: z.array(z.string().min(1)).optional().default([]),
              scope_descriptor: z
                .object({
                  hierarchy_system: z.enum([
                    'planetary',
                    'administrative',
                    'electoral',
                    'postal',
                    'addressing',
                    'building',
                    'custom',
                  ]),
                  local_type_label: z.string().min(1),
                  local_type_key: z.string().min(1),
                  legacy_level: z.enum(['nation', 'region', 'city', 'district']),
                })
                .strict()
                .optional()
                .nullable()
                .default(null),
            })
            .strict()
        )
        .min(1)
        .max(4),
      create_anyway: z.boolean().optional().default(false),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('locality.graph.apply'),
      paths: z
        .array(
          z
            .array(
              z
                .object({
                  level: z.enum(['nation', 'region', 'city', 'district']),
                  name: z.string().trim().max(120).default(''),
                  existing_scope_id: z.string().min(1).optional().nullable().default(null),
                  alias_keys: z.array(z.string().min(1)).optional().default([]),
                  display_aliases: z.array(z.string().min(1)).optional().default([]),
                  scope_descriptor: z
                    .object({
                      hierarchy_system: z.enum([
                        'planetary',
                        'administrative',
                        'electoral',
                        'postal',
                        'addressing',
                        'building',
                        'custom',
                      ]),
                      local_type_label: z.string().min(1),
                      local_type_key: z.string().min(1),
                      legacy_level: z.enum(['nation', 'region', 'city', 'district']),
                    })
                    .strict()
                    .optional()
                    .nullable()
                    .default(null),
                })
                .strict()
            )
            .min(1)
            .max(4)
        )
        .min(1),
      create_anyway: z.boolean().optional().default(false),
      home_scope_packet_id: z.string().min(1).optional().nullable().default(null),
      associated_scope_packet_ids: z.array(z.string().min(1)).optional().default([]),
      followed_scope_packet_ids: z.array(z.string().min(1)).optional().default([]),
      main_visible_scope_packet_ids: z.array(z.string().min(1)).optional().default([]),
      show_associated_parent_chains: z.boolean().optional().default(true),
      show_followed_parent_chains: z.boolean().optional().default(true),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('discussion.surfaces.ensure'),
      scope_id: z.string().min(1),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('actor.write_policy.update'),
      security_mode: z.enum(['standard', 'guarded', 'every_write']),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal('preference.element.set'),
      scope_display: z
        .object({
          main_visible_scope_packet_ids: z.array(z.string().min(1)).optional(),
          show_associated_parent_chains: z.boolean().optional(),
          show_followed_parent_chains: z.boolean().optional(),
        })
        .strict()
        .optional(),
      shell_chrome: ShellChromePreferenceValueSchema.partial().optional(),
      note: z.string().trim().min(1).max(240).optional().nullable().default(null),
      created_at: z.string().optional().nullable().default(null),
      mutation_nonce: z.string().optional().nullable().default(null),
    })
    .strict(),
] as const;

export const MutationIntentSchema = z
  .discriminatedUnion('kind', MutationIntentSchemaOptions)
  .superRefine((value, context) => {
    if (value.kind !== 'preference.element.set') {
      return;
    }

    const hasScopeDisplayPatch = Object.values(value.scope_display ?? {}).some(
      (patchValue) => patchValue !== undefined
    );
    const hasShellChromePatch = Object.values(value.shell_chrome ?? {}).some(
      (patchValue) => patchValue !== undefined
    );

    if (hasScopeDisplayPatch || hasShellChromePatch) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message:
        'Preference.element interface writes require at least one scope_display or shell_chrome field.',
      path: ['scope_display'],
    });
  });

export function listPrepareMutationIntentSchemaKinds(): string[] {
  return MutationIntentSchemaOptions.map((option) => option.shape.kind.value as string)
    .sort((left, right) => left.localeCompare(right));
}

export const PrepareMutationRequestSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    intent: MutationIntentSchema,
  })
  .strict();
