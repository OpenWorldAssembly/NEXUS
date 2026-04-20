/**
 * File: surfaces+api.ts
 * Description: Backfills the standard empty OWA discussion surfaces for an eligible Nexus scope.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import { toLocalitySearchLevel } from '@runtime/nexus/location-search-normalization';
import { filterClaimPackets, listClaimPackets } from '@runtime/nexus/server/claim-utils';
import { ensureDefaultDiscussionSurfaces } from '@runtime/nexus/server/default-discussion-surfaces';
import { toRouteScopeId } from '@runtime/nexus/server/discussion-service.scope';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

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

const DiscussionSurfaceInputSchema = z
  .object({
    actor_packet: z.unknown(),
    actor_assertion: ActorAssertionSchema,
    csrf_token: z.string().min(1).optional().nullable().default(null),
    reauth_token: z.string().min(1).optional().nullable().default(null),
  })
  .strict();

type ScopeNode = {
  packetId: string;
  routeId: string;
  name: string;
  level: ReturnType<typeof toLocalitySearchLevel>;
  parentPacketId: string | null;
};

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function getHomeChainPacketIds(input: {
  homeScopePacketId: string;
  scopeNodeByPacketId: Map<string, ScopeNode>;
}): Set<string> {
  const chainPacketIds = new Set<string>();
  let currentScope = input.scopeNodeByPacketId.get(input.homeScopePacketId) ?? null;

  while (currentScope) {
    chainPacketIds.add(currentScope.packetId);
    currentScope = currentScope.parentPacketId
      ? input.scopeNodeByPacketId.get(currentScope.parentPacketId) ?? null
      : null;
  }

  return chainPacketIds;
}

export const PUT: RequestHandler = async (request, params) => {
  try {
    const parsedBody = DiscussionSurfaceInputSchema.parse(await request.json());
    const services = await getNexusPacketServices();
    const actorContext = await services.authService.verifyActorMutation({
      request,
      actorPacket: parsedBody.actor_packet,
      actorAssertion: parsedBody.actor_assertion,
      method: 'PUT',
      path: '/api/nexus/scopes/[scopeId]/discussions/surfaces',
      body: {
        actor_packet: parsedBody.actor_packet,
        csrf_token: parsedBody.csrf_token,
        reauth_token: parsedBody.reauth_token,
      },
      csrfToken: parsedBody.csrf_token,
      reauthToken: parsedBody.reauth_token,
      writeRisk: 'standard',
    });

    if (actorContext.actorPacket.body.identity?.claim_status !== 'claimed') {
      return createJsonResponse(
        { error: 'Sign in to a claimed identity before adding discussion surfaces.' },
        401
      );
    }

    const elementPackets =
      (await services.packetStore.listPreferredPacketsByFamily(
        'Element'
      )) as PacketEnvelopeByType['Element'][];
    const scopeNodes = elementPackets
      .filter((packet) => packet.body.kind === 'assembly')
      .map((packet): ScopeNode => ({
        packetId: packet.header.packet_id,
        routeId: toRouteScopeId(packet.header.packet_id),
        name: packet.body.name,
        level: toLocalitySearchLevel(
          packet.body.locality?.level ?? packet.body.subtype ?? null
        ),
        parentPacketId:
          packet.header.edges.find((edge) => edge.edge_type === 'parent_scope')
            ?.target.packet_id ?? null,
      }));
    const scopeNodeByPacketId = new Map(
      scopeNodes.map((scopeNode) => [scopeNode.packetId, scopeNode])
    );
    const activeScopeNode = scopeNodes.find(
      (scopeNode) => scopeNode.routeId === params.scopeId
    );

    if (!activeScopeNode || !activeScopeNode.level) {
      return createJsonResponse(
        { error: 'Discussion surfaces can only be added to geographic assembly scopes.' },
        400
      );
    }

    const claimPackets = await listClaimPackets(services.packetStore);
    const activeHomeClaim = filterClaimPackets({
      claims: claimPackets,
      claimKind: 'home_locality',
      subjectPacketId: actorContext.actorPacket.header.packet_id,
      activeOnly: true,
    })[0];
    const homeChainPacketIds = activeHomeClaim
      ? getHomeChainPacketIds({
          homeScopePacketId: activeHomeClaim.body.target_ref.packet_id,
          scopeNodeByPacketId,
        })
      : new Set<string>();

    if (!homeChainPacketIds.has(activeScopeNode.packetId)) {
      return createJsonResponse(
        {
          error:
            'Add discussion surfaces from a scope inside your active home-locality branch.',
        },
        403
      );
    }

    const createdPackets = await ensureDefaultDiscussionSurfaces({
      packetStore: services.packetStore,
      scopePacketId: activeScopeNode.packetId,
      scopeName: activeScopeNode.name,
      applicableScopeRefs: [{ packet_id: activeScopeNode.packetId }],
    });

    await services.discussionService.syncDerivedState();

    const discussions = await services.discussionService.getForumFeed({
      scope_id: params.scopeId,
      forum_id: null,
      sort: null,
      show_hidden: false,
      viewer_actor_key: actorContext.actorKey,
    });

    return createJsonResponse({
      created_packet_refs: createdPackets.map((packet) => ({
        packet_id: packet.header.packet_id,
        revision_id: packet.header.revision_id,
      })),
      discussions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to add discussion surfaces.';
    const status = message.includes('Actor assertion') || message.includes('signature')
      ? 400
      : message.includes('Sign in')
        ? 401
        : 500;

    return createJsonResponse({ error: message }, status);
  }
};
