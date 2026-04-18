/**
 * File: attestations+api.ts
 * Description: Writes scoped role support and dispute attestations for claimant actors.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  getNexusRolesPayload,
  getNexusShellPayload,
  resolveScopeIdFromShell,
} from '@runtime/nexus/server/nexus-query-data';

const ActorAssertionSchema = z
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

const RoleAttestationMutationSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    claimant_actor_packet_id: z.string().min(1),
    role_packet_id: z.string().min(1),
    mode: z.enum(['support', 'dispute', 'clear']),
    note: z.string().optional().nullable().default(null),
  })
  .strict();

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export const PUT: RequestHandler = async (request, params) => {
  try {
    const parsedBody = RoleAttestationMutationSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: `/api/nexus/scopes/${params.scopeId}/roles/attestations`,
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        claimant_actor_packet_id: parsedBody.claimant_actor_packet_id,
        role_packet_id: parsedBody.role_packet_id,
        mode: parsedBody.mode,
        note: parsedBody.note,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
    });

    const claimantPacket = await services.packetStore.fetchByPacket({
      packet_id: parsedBody.claimant_actor_packet_id,
    });
    const rolePacket = await services.packetStore.fetchByPacket({
      packet_id: parsedBody.role_packet_id,
    });

    if (!claimantPacket || claimantPacket.header.family !== 'Element') {
      return createJsonResponse({ error: 'Unknown claimant actor packet.' }, 404);
    }

    if (!rolePacket || rolePacket.header.family !== 'Role') {
      return createJsonResponse({ error: 'Unknown role packet.' }, 404);
    }

    const trimmedNote = parsedBody.note?.trim() ?? null;

    if (parsedBody.mode === 'dispute' && !trimmedNote) {
      return createJsonResponse(
        { error: 'A dispute attestation requires a comment.' },
        400
      );
    }

    const shellPayload = await getNexusShellPayload(
      actorContext.actorPacket.header.packet_id
    );
    const resolvedScopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      actorContext.actorPacket.header.packet_id
    );
    const authorityScopeId =
      resolvedScopeId === 'you'
        ? shellPayload.personal_parent_scope_id ?? shellPayload.default_scope_id
        : resolvedScopeId;

    if (parsedBody.mode === 'clear') {
      await services.attestationService.setAttestation({
        target_packet_id: parsedBody.claimant_actor_packet_id,
        actor_key: actorContext.actorKey,
        actor_class: actorContext.actorClass,
        authority_scope_id: authorityScopeId,
        value: 0,
        attestation_kind: 'role_support',
        context_packet_id: parsedBody.role_packet_id,
      });
      await services.attestationService.setAttestation({
        target_packet_id: parsedBody.claimant_actor_packet_id,
        actor_key: actorContext.actorKey,
        actor_class: actorContext.actorClass,
        authority_scope_id: authorityScopeId,
        value: 0,
        attestation_kind: 'role_dispute',
        context_packet_id: parsedBody.role_packet_id,
      });
    } else {
      const nextKind =
        parsedBody.mode === 'support' ? 'role_support' : 'role_dispute';
      const oppositeKind =
        parsedBody.mode === 'support' ? 'role_dispute' : 'role_support';
      const nextValue = parsedBody.mode === 'support' ? 1 : -1;

      await services.attestationService.setAttestation({
        target_packet_id: parsedBody.claimant_actor_packet_id,
        actor_key: actorContext.actorKey,
        actor_class: actorContext.actorClass,
        authority_scope_id: authorityScopeId,
        value: 0,
        attestation_kind: oppositeKind,
        context_packet_id: parsedBody.role_packet_id,
      });
      await services.attestationService.setAttestation({
        target_packet_id: parsedBody.claimant_actor_packet_id,
        actor_key: actorContext.actorKey,
        actor_class: actorContext.actorClass,
        authority_scope_id: authorityScopeId,
        value: nextValue,
        attestation_kind: nextKind,
        context_packet_id: parsedBody.role_packet_id,
        note: trimmedNote,
      });
    }

    const rolesPayload = await getNexusRolesPayload({
      scopeId: resolvedScopeId,
      actorPacketId: actorContext.actorPacket.header.packet_id,
    });
    const roleCard = rolesPayload.role_cards.find(
      (card) => card.role_packet_id === parsedBody.role_packet_id
    );
    const claimant = roleCard?.claimants.find(
      (candidate) =>
        candidate.actor_packet_id === parsedBody.claimant_actor_packet_id
    );

    return createJsonResponse({
      claimant_actor_packet_id: parsedBody.claimant_actor_packet_id,
      role_packet_id: parsedBody.role_packet_id,
      mode: parsedBody.mode,
      support_count: claimant?.support_count ?? 0,
      dispute_count: claimant?.dispute_count ?? 0,
      viewer_attestation: claimant?.viewer_attestation ?? 'none',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to update the role attestation.';
    const status =
      message.includes('requires a comment')
        ? 400
        : message.includes('Unknown')
          ? 404
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
