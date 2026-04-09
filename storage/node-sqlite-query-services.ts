/**
 * File: node-sqlite-query-services.ts
 * Description: Creates Node-backed packet store and query-service instances that share one SQLite database.
 */

import type { BrowserQueryService, NexusQueryService } from '@/domain/core/contracts';
import { NodeSQLitePacketStore } from '@/storage/node-sqlite-packet-store';
import {
  PacketStoreBrowserQueryService,
  PacketStoreNexusQueryService,
} from '@/storage/query-services';

export interface NodeSQLiteQueryServices {
  packetStore: NodeSQLitePacketStore;
  browserQueryService: BrowserQueryService;
  nexusQueryService: NexusQueryService;
}

/**
 * Inputs: optional node packet store.
 * Output: packet store plus browser/nexus query services bound to the same SQLite file.
 */
export async function createNodeSQLiteQueryServicesAsync(input?: {
  packetStore?: NodeSQLitePacketStore;
}): Promise<NodeSQLiteQueryServices> {
  const packetStore = input?.packetStore ?? new NodeSQLitePacketStore();

  return {
    packetStore,
    browserQueryService: new PacketStoreBrowserQueryService(packetStore),
    nexusQueryService: new PacketStoreNexusQueryService(packetStore),
  };
}
