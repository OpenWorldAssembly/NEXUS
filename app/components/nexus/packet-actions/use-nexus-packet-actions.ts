/**
 * File: use-nexus-packet-actions.ts
 * Description: Loads runtime-projected PacketActions for packet-card menus.
 */

import { useEffect, useMemo, useState } from 'react';

import type {
  NexusPacketActionProjection,
  NexusPacketActionsBatchRequest,
} from '@runtime/nexus/nexus-api-types';
import { fetchNexusPacketActionsBatch } from '@runtime/nexus/nexus-query-api';

export type NexusPacketActionsState = {
  actionsByPacketId: Record<string, NexusPacketActionProjection>;
  actionsByTargetKey: Record<string, NexusPacketActionProjection>;
  isLoading: boolean;
  error: string | null;
};

export function getNexusPacketActionProjectionKey(input: {
  packetId: string;
  preferredSurface?: string | null;
}): string {
  return `${input.packetId}::${input.preferredSurface ?? 'auto'}`;
}

function createRequestKey(request: NexusPacketActionsBatchRequest): string {
  return JSON.stringify({
    scope_id: request.scope_id ?? null,
    viewer_actor_packet_id: request.viewer_actor_packet_id ?? null,
    surface: request.surface ?? null,
    targets: request.targets.map((target) => ({
      packet_id: target.packet_id,
      revision_id: target.revision_id ?? null,
      family: target.family ?? null,
      preferred_surface: target.preferred_surface ?? null,
    })),
  });
}

/**
 * Inputs: packet targets plus current surface context.
 * Output: packet action projections keyed by packet id.
 */
export function useNexusPacketActions(
  request: NexusPacketActionsBatchRequest | null
): NexusPacketActionsState {
  const requestKey = useMemo(
    () => (request && request.targets.length > 0 ? createRequestKey(request) : null),
    [request]
  );
  const [state, setState] = useState<NexusPacketActionsState>({
    actionsByPacketId: {},
    actionsByTargetKey: {},
    isLoading: Boolean(requestKey),
    error: null,
  });

  useEffect(() => {
    if (!request || request.targets.length === 0 || !requestKey) {
      setState({
        actionsByPacketId: {},
        actionsByTargetKey: {},
        isLoading: false,
        error: null,
      });
      return;
    }

    let isMounted = true;

    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      error: null,
    }));

    fetchNexusPacketActionsBatch(request)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setState({
          actionsByPacketId: Object.fromEntries(
            payload.projections.map((projection) => [
              projection.packet_id,
              projection,
            ])
          ),
          actionsByTargetKey: Object.fromEntries(
            payload.projections.map((projection) => [
              getNexusPacketActionProjectionKey({
                packetId: projection.packet_id,
                preferredSurface: projection.preferred_surface,
              }),
              projection,
            ])
          ),
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setState({
          actionsByPacketId: {},
          actionsByTargetKey: {},
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to load PacketActions.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [request, requestKey]);

  return state;
}
