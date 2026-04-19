/**
 * File: home+api.ts
 * Description: Sets or clears the actor's active home-locality claim for mounted-scope derivation.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { createAssociationClaimPacket, createClaimPacketId } from '@core/packets/claims';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';
import {
  buildApplicableScopeRefsForSummary,
  getNexusShellPayload,
  getScopeSummaryByPacketId,
} from '@runtime/nexus/server/nexus-query-data';
import { filterClaimPackets, listClaimPackets } from '@runtime/nexus/server/claim-utils';

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

const UpdateHomeLocalitySchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
    home_scope_packet_id: z.string().min(1).optional().nullable().default(null),
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

export const PUT: RequestHandler = async (request) => {
  try {
    const parsedBody = UpdateHomeLocalitySchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: '/api/nexus/locality/home',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
        home_scope_packet_id: parsedBody.home_scope_packet_id,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
    });
    const shellPayload = await getNexusShellPayload(
      actorContext.actorPacket.header.packet_id,
      request
    );
    const claimPackets = await listClaimPackets(services.packetStore);
    const actorPacketId = actorContext.actorPacket.header.packet_id;
    const activeHomeClaims = filterClaimPackets({
      claims: claimPackets,
      claimKind: 'home_locality',
      subjectPacketId: actorPacketId,
      activeOnly: true,
    });
    let homeScopeSummary = null;

    if (parsedBody.home_scope_packet_id) {
      homeScopeSummary = getScopeSummaryByPacketId(
        shellPayload.scope_summaries,
        parsedBody.home_scope_packet_id
      );

      if (!homeScopeSummary) {
        return createJsonResponse({ error: 'Unknown home locality scope.' }, 404);
      }

      if (
        !['nation', 'region', 'city', 'district'].includes(homeScopeSummary.level)
      ) {
        return createJsonResponse(
          { error: 'Choose a geographic scope to use as home locality.' },
          400
        );
      }
    }

    for (const activeHomeClaim of activeHomeClaims) {
      if (
        parsedBody.home_scope_packet_id &&
        activeHomeClaim.body.target_ref.packet_id === parsedBody.home_scope_packet_id
      ) {
        continue;
      }

      const withdrawnClaim = createAssociationClaimPacket({
        claimKind: 'home_locality',
        subjectPacketId: actorPacketId,
        targetPacketId: activeHomeClaim.body.target_ref.packet_id,
        scopePacketId: activeHomeClaim.body.scope_ref.packet_id,
        applicableScopeRefs: activeHomeClaim.header.applicable_scope_refs,
        createdByPacketId: actorPacketId,
        status: 'withdrawn',
        packetId: activeHomeClaim.header.packet_id,
        parentRevisionRefs: [
          {
            packet_id: activeHomeClaim.header.packet_id,
            revision_id: activeHomeClaim.header.revision_id,
          },
        ],
      });

      await services.packetStore.writeRevision(withdrawnClaim);
      await services.packetStore.publishRevision({
        packet_id: withdrawnClaim.header.packet_id,
        revision_id: withdrawnClaim.header.revision_id,
      });
    }

    if (!parsedBody.home_scope_packet_id || !homeScopeSummary) {
      return createJsonResponse({
        claim_packet_id: null,
        claim_status: 'withdrawn',
        home_scope_packet_id: null,
      });
    }

    const homeClaimPacketId = createClaimPacketId({
      claimKind: 'home_locality',
      subjectPacketId: actorPacketId,
      targetPacketId: homeScopeSummary.packetId,
      scopePacketId: homeScopeSummary.packetId,
    });
    const existingPreferredRevision = await services.packetStore.fetchPreferredRevision({
      packet_id: homeClaimPacketId,
    });
    const homeClaimPacket = createAssociationClaimPacket({
      claimKind: 'home_locality',
      subjectPacketId: actorPacketId,
      targetPacketId: homeScopeSummary.packetId,
      scopePacketId: homeScopeSummary.packetId,
      applicableScopeRefs: buildApplicableScopeRefsForSummary(
        homeScopeSummary,
        shellPayload.scope_summaries
      ),
      createdByPacketId: actorPacketId,
      status: 'active',
      packetId: homeClaimPacketId,
      parentRevisionRefs: existingPreferredRevision ? [existingPreferredRevision] : [],
    });

    await services.packetStore.writeRevision(homeClaimPacket);
    await services.packetStore.publishRevision({
      packet_id: homeClaimPacket.header.packet_id,
      revision_id: homeClaimPacket.header.revision_id,
    });

    return createJsonResponse({
      claim_packet_id: homeClaimPacket.header.packet_id,
      claim_status: homeClaimPacket.body.status,
      home_scope_packet_id: homeScopeSummary.packetId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to update the home locality.';
    const status =
      message.includes('Actor assertion') || message.includes('Sign in')
        ? 400
        : message.includes('Unknown')
          ? 404
          : 500;

    return createJsonResponse({ error: message }, status);
  }
};
