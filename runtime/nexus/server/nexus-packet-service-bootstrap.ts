/**
 * File: nexus-packet-service-bootstrap.ts
 * Description: Handles runtime data-path bootstrap, seed policy, and deterministic discussion reset rules for the shared packet services.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  createAssociationClaimPacket,
  createClaimPacketId,
} from '@core/packets/claims';
import {
  createRelationPacketId,
  createScopedRelationPacket,
} from '@core/packets/relations';
import {
  CANONICAL_SEED_PACKETS,
  DISCUSSION_SEED_VERSION,
} from '@core/packets/seeds';
import type { PacketEnvelope, PacketEnvelopeByType, PacketRef } from '@core/schema/packet-schema';
import type { NodeSQLiteQueryServices } from '@runtime/storage/node-sqlite-query-services';
import {
  DISCUSSION_SEED_MARKER_PATH,
  resolveNexusDataDirectory,
} from '@runtime/storage/node-runtime-paths';

const DISCUSSION_RESET_FAMILIES = [
  'Discussion',
  'Reaction',
] as const;

function isEnvironmentFlagEnabled(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function canResetDiscussionSeedData(): boolean {
  return (
    isEnvironmentFlagEnabled(process.env.NEXUS_ALLOW_DISCUSSION_RESET) ||
    process.env.NODE_ENV === 'development'
  );
}

function writeDiscussionSeedMarker(): void {
  mkdirSync(resolveNexusDataDirectory(), { recursive: true });
  writeFileSync(DISCUSSION_SEED_MARKER_PATH, DISCUSSION_SEED_VERSION, 'utf8');
}

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

async function ensureSeedPackets(
  services: NodeSQLiteQueryServices
): Promise<void> {
  for (const seedPacket of CANONICAL_SEED_PACKETS) {
    await writeRevisionIfMissing(services, seedPacket);
  }
}

function buildApplicableScopeRefs(input: {
  scopePacketId: string;
  parentByPacketId: Map<string, string | null>;
}): PacketRef[] {
  const scopeRefs: PacketRef[] = [{ packet_id: input.scopePacketId }];
  let currentParentPacketId = input.parentByPacketId.get(input.scopePacketId) ?? null;

  while (currentParentPacketId) {
    scopeRefs.push({ packet_id: currentParentPacketId });
    currentParentPacketId = input.parentByPacketId.get(currentParentPacketId) ?? null;
  }

  return scopeRefs;
}

async function ensureLegacyClaimBackfill(
  _services: NodeSQLiteQueryServices
): Promise<void> {
  return;
}

async function resetDiscussionPackets(
  services: NodeSQLiteQueryServices
): Promise<void> {
  const database = new DatabaseSync(services.packetStore.databasePath);

  try {
    database.exec('BEGIN IMMEDIATE');

    const typePlaceholders = DISCUSSION_RESET_FAMILIES.map(() => '?').join(', ');
    const packetRows = database
      .prepare(
        `
          SELECT packet_id
          FROM packets
          WHERE type IN (${typePlaceholders})
        `
      )
      .all(...DISCUSSION_RESET_FAMILIES) as { packet_id: string }[];
    const packetIds = packetRows.map((row) => row.packet_id);

    database.exec('DELETE FROM reaction_index');
    database.exec('DELETE FROM reaction_tally_index');
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

export async function ensureNexusPacketBootstrap(
  services: NodeSQLiteQueryServices
): Promise<void> {
  await ensureDiscussionSeedVersion(services);
  await ensureSeedPackets(services);
  await ensureLegacyClaimBackfill(services);
}
