/**
 * File: nexus-packet-services.ts
 * Description: Boots and caches the shared Node packet store and query services for Nexus API routes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  DISCUSSION_SEED_VERSION,
  PERSONAL_SEED_PACKETS,
} from '@/domain/packets/seeds';
import type { PacketEnvelope, PacketFamily } from '@/domain/schema/packet-schema';
import { NexusAuthService } from '@/lib/nexus/server/auth-service';
import { SQLiteAttestationService } from '@/lib/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@/lib/nexus/server/discussion-service';
import {
  createNodeSQLiteQueryServicesAsync,
  type NodeSQLiteQueryServices,
} from '@/storage/node-sqlite-query-services';
import {
  DISCUSSION_SEED_MARKER_PATH,
  resolveNexusDataDirectory,
} from '@/storage/node-runtime-paths';
const DISCUSSION_RESET_FAMILIES = [
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
  'Attestation',
  'PacketVote',
] as const;

export interface NexusPacketServices extends NodeSQLiteQueryServices {
  authService: NexusAuthService;
  attestationService: SQLiteAttestationService;
  discussionService: SQLiteDiscussionService;
  packetVoteService: SQLiteAttestationService;
}

let cachedServicesPromise: Promise<NexusPacketServices> | null = null;

function isEnvironmentFlagEnabled(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/**
 * Inputs: none.
 * Output: whether this runtime is allowed to perform destructive discussion reseeds.
 */
function canResetDiscussionSeedData(): boolean {
  return (
    isEnvironmentFlagEnabled(process.env.NEXUS_ALLOW_DISCUSSION_RESET) ||
    process.env.NODE_ENV === 'development'
  );
}

/**
 * Inputs: none.
 * Output: writes the current discussion seed marker into the active runtime data directory.
 */
function writeDiscussionSeedMarker(): void {
  mkdirSync(resolveNexusDataDirectory(), { recursive: true });
  writeFileSync(DISCUSSION_SEED_MARKER_PATH, DISCUSSION_SEED_VERSION, 'utf8');
}

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
 * Output: removes resettable discussion packets and derived rows for a deterministic reseed.
 */
async function resetDiscussionPackets(
  services: NodeSQLiteQueryServices
): Promise<void> {
  const database = new DatabaseSync(services.packetStore.databasePath);

  try {
    database.exec('BEGIN IMMEDIATE');

    const familyPlaceholders = DISCUSSION_RESET_FAMILIES.map(() => '?').join(', ');
    const packetRows = database
      .prepare(
        `
          SELECT packet_id
          FROM packets
          WHERE family IN (${familyPlaceholders})
        `
      )
      .all(...DISCUSSION_RESET_FAMILIES) as { packet_id: string }[];
    const packetIds = packetRows.map((row) => row.packet_id);

    database.exec('DELETE FROM attestation_index');
    database.exec('DELETE FROM attestation_tally_index');
    database.exec('DELETE FROM packet_vote_index');
    database.exec('DELETE FROM packet_vote_tally_index');
    database.exec('DELETE FROM discussion_post_index');
    database.exec('DELETE FROM discussion_actor_ledger');

    if (packetIds.length > 0) {
      const packetPlaceholders = packetIds.map(() => '?').join(', ');

      database
        .prepare(
          `
            DELETE FROM packet_edges
            WHERE source_packet_id IN (${packetPlaceholders})
               OR target_packet_id IN (${packetPlaceholders})
          `
        )
        .run(...packetIds, ...packetIds);
      database
        .prepare(
          `
            DELETE FROM packet_revisions
            WHERE packet_id IN (${packetPlaceholders})
          `
        )
        .run(...packetIds);
      database
        .prepare(
          `
            DELETE FROM packet_search_index
            WHERE packet_id IN (${packetPlaceholders})
          `
        )
        .run(...packetIds);
      database
        .prepare(
          `
            DELETE FROM packets
            WHERE packet_id IN (${packetPlaceholders})
          `
        )
        .run(...packetIds);
    }

    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

/**
 * Inputs: the shared packet services.
 * Output: ensures the dev discussion dataset matches the current reset seed version.
 */
async function ensureDiscussionSeedVersion(
  services: NodeSQLiteQueryServices
): Promise<void> {
  const currentVersion = existsSync(DISCUSSION_SEED_MARKER_PATH)
    ? readFileSync(DISCUSSION_SEED_MARKER_PATH, 'utf8').trim()
    : null;

  if (currentVersion === DISCUSSION_SEED_VERSION) {
    return;
  }

  if (!canResetDiscussionSeedData()) {
    if (currentVersion === null) {
      writeDiscussionSeedMarker();
    }

    return;
  }

  await resetDiscussionPackets(services);
  writeDiscussionSeedMarker();
}

/**
 * Inputs: none.
 * Output: shared packet services with deterministic packet-seed and discussion-reset bootstrap.
 */
export async function getNexusPacketServices(): Promise<NexusPacketServices> {
  if (!cachedServicesPromise) {
    cachedServicesPromise = (async () => {
      const services = await createNodeSQLiteQueryServicesAsync();
      const attestationService = new SQLiteAttestationService(services.packetStore);
      const discussionService = new SQLiteDiscussionService(
        services.packetStore,
        attestationService
      );
      const authService = new NexusAuthService(services.packetStore);

      await ensureDiscussionSeedVersion(services);
      await authService.ensureStorage();
      await ensureSeedPackets(services);
      await attestationService.syncDerivedState();
      await discussionService.syncDerivedState();

      return {
        ...services,
        authService,
        attestationService,
        discussionService,
        packetVoteService: attestationService,
      };
    })();
  }

  return cachedServicesPromise;
}
