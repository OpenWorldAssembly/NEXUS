import type { NexusPacketExplorerPayload } from '@runtime/nexus/nexus-api-types';

export type ExplorerPacketLoadState = {
  request_key: string;
  status: 'loading' | 'loaded' | 'error';
  payload: NexusPacketExplorerPayload | null;
  error: string | null;
  last_loaded_revision_id: string | null;
};

export type ExplorerPacketStateMap = Record<string, ExplorerPacketLoadState | undefined>;
