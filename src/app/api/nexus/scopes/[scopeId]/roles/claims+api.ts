/**
 * File: claims+api.ts
 * Description: Creates or withdraws scoped role-association claims for the current actor.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { createAssociationClaimPacket, createClaimPacketId } from '@core/packets/claims';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  buildApplicableScopeRefsForSummary,
  getNexusShellPayload,
  getScopeSummaryByIdOrDefault,
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

const RoleClaimMutationSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    role_packet_id: z.string().min(1),
    claimed: z.boolean(),
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
    const parsedBody = RoleClaimMutationSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: `/api/nexus/scopes/${params.scopeId}/roles/claims`,
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        role_packet_id: parsedBody.role_packet_id,
        claimed: parsedBody.claimed,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
    });
    const rolePacket = await services.packetStore.fetchByPacket({
      packet_id: parsedBody.role_packet_id,
    });

    if (!rolePacket || rolePacket.header.family !== 'Role') {
      return createJsonResponse({ error: 'Unknown role packet.' }, 404);
    }

    const shellPayload = await getNexusShellPayload(
      actorContext.actorPacket.header.packet_id
    );
    const resolvedScopeId = resolveScopeIdFromShell(
      shellPayload,
      params.scopeId,
      actorContext.actorPacket.header.packet_id
    );
    const effectiveScopeId =
      resolvedScopeId === 'you'
        ? shellPayload.personal_parent_scope_id ?? shellPayload.default_scope_id
        : resolvedScopeId;
    const scopeSummary = getScopeSummaryByIdOrDefault(
      shellPayload.scope_summaries,
      effectiveScopeId
    );
    const claimPacketId = createClaimPacketId({
      claimKind: 'role_association',
      subjectPacketId: actorContext.actorPacket.header.packet_id,
      targetPacketId: parsedBody.role_packet_id,
      scopePacketId: scopeSummary.packetId,
    });
    const existingPreferredRevision = await services.packetStore.fetchPreferredRevision({
      packet_id: claimPacketId,
    });
    const claimPacket = createAssociationClaimPacket({
      claimKind: 'role_association',
      subjectPacketId: actorContext.actorPacket.header.packet_id,
      targetPacketId: parsedBody.role_packet_id,
      scopePacketId: scopeSummary.packetId,
      applicableScopeRefs: buildApplicableScopeRefsForSummary(
        scopeSummary,
        shellPayload.scope_summaries
      ),
      createdByPacketId: actorContext.actorPacket.header.packet_id,
      status: parsedBody.claimed ? 'active' : 'withdrawn',
      packetId: claimPacketId,
      parentRevisionRefs: existingPreferredRevision ? [existingPreferredRevision] : [],
    });

    await services.packetStore.writeRevision(claimPacket);
    await services.packetStore.publishRevision({
      packet_id: claimPacket.header.packet_id,
      revision_id: claimPacket.header.revision_id,
    });

    return createJsonResponse({
      claim_packet_id: claimPacket.header.packet_id,
      claim_status: claimPacket.body.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update the role claim.';
    const status =
      message.includes('Actor assertion') || message.includes('Sign in')
        ? 400
        : message.includes('Unknown')
          ? 404
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};

