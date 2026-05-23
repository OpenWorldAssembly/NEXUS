/**
 * File: nexus-api-types.workspaces.ts
 * Description: Votes and library workspace payloads shared across Nexus routes and clients.
 */

import type { NexusPacketCardProjection, NexusScopeLens } from '@core/contracts';
import type { PacketType } from '@core/schema/packet-schema';

export interface NexusVotesStage {
  id: string;
  title: string;
  count: number;
  detail: string;
  tone: 'sky' | 'mint' | 'gold' | 'rose';
}

export interface NexusVotesPayload {
  lens: NexusScopeLens;
  stage_cards: NexusVotesStage[];
  vote_cards: NexusPacketCardProjection[];
  mechanics: string[];
}

export interface NexusLibraryPayload {
  lens: NexusScopeLens;
  type_filter: PacketType | null;
  packets: NexusPacketCardProjection[];
}
