/**
 * File: nexus-packet-services.ts
 * Description: Boots and caches the shared Node packet store and query services for Nexus API routes.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERSONAL_SEED_PACKETS } from '@/domain/packets/seeds';
import { parsePacketEnvelope, type PacketEnvelope } from '@/domain/schema/packet-schema';
import { parseVisitorLobbyBundle } from '@/lib/nexus/visitor-lobby';
import {
  createNodeSQLiteQueryServicesAsync,
  type NodeSQLiteQueryServices,
} from '@/storage/node-sqlite-query-services';

const LEGACY_VISITOR_LOBBY_BUNDLE_PATH = join(
  process.cwd(),
  'data',
  'nexus',
  'visitor-lobby-bundle.json'
);

let cachedServicesPromise: Promise<NodeSQLiteQueryServices> | null = null;

/**
 * Inputs: a canonical packet envelope.
 * Output: writes a revision unless it already exists.
 */
async function writeRevisionIfMissing(
  services: NodeSQLiteQueryServices,
  packet: PacketEnvelope
): Promise<void> {
  try {
    await services.packetStore.writeRevision(packet);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return;
    }

    throw error;
  }
}

/**
 * Inputs: the shared packet services.
 * Output: ensures the initial personal packet tree exists in the local packet store, backfilling missing seeds.
 */
async function ensureSeedPackets(
  services: NodeSQLiteQueryServices
): Promise<void> {
  for (const seedPacket of PERSONAL_SEED_PACKETS) {
    await writeRevisionIfMissing(services, seedPacket);
  }
}

/**
 * Inputs: the shared packet services.
 * Output: imports legacy visitor-lobby packets from the prior bundle file when present.
 */
async function importLegacyVisitorLobbyBundleIfPresent(
  services: NodeSQLiteQueryServices
): Promise<void> {
  if (!existsSync(LEGACY_VISITOR_LOBBY_BUNDLE_PATH)) {
    return;
  }

  const rawBundle = readFileSync(LEGACY_VISITOR_LOBBY_BUNDLE_PATH, 'utf8');
  const parsedBundle = parseVisitorLobbyBundle(JSON.parse(rawBundle));

  for (const threadPacket of parsedBundle.threads) {
    await writeRevisionIfMissing(services, parsePacketEnvelope(threadPacket));
  }

  for (const postPacket of parsedBundle.posts) {
    await writeRevisionIfMissing(services, parsePacketEnvelope(postPacket));
  }
}

/**
 * Inputs: none.
 * Output: shared packet services with deterministic seed and migration bootstrap.
 */
export async function getNexusPacketServices(): Promise<NodeSQLiteQueryServices> {
  if (!cachedServicesPromise) {
    cachedServicesPromise = (async () => {
      const services = await createNodeSQLiteQueryServicesAsync();

      await ensureSeedPackets(services);
      await importLegacyVisitorLobbyBundleIfPresent(services);

      return services;
    })();
  }

  return cachedServicesPromise;
}
