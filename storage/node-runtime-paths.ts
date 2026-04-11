/**
 * File: node-runtime-paths.ts
 * Description: Resolves the persisted Node runtime data directory and file paths for local and hosted deployments.
 */

import { join, resolve } from 'node:path';

export const DEFAULT_NEXUS_DATA_DIR = join(process.cwd(), 'data', 'nexus');

/**
 * Inputs: none.
 * Output: the absolute runtime data directory, honoring `NEXUS_DATA_DIR` when present.
 */
export function resolveNexusDataDirectory(): string {
  const configuredDataDirectory = process.env.NEXUS_DATA_DIR?.trim();

  if (!configuredDataDirectory) {
    return DEFAULT_NEXUS_DATA_DIR;
  }

  return resolve(configuredDataDirectory);
}

/**
 * Inputs: a filename stored inside the runtime data directory.
 * Output: the absolute file path inside the active runtime data directory.
 */
export function resolveNexusDataPath(filename: string): string {
  return join(resolveNexusDataDirectory(), filename);
}

export const NODE_PACKET_STORE_DATABASE_PATH = resolveNexusDataPath('owa-packets.db');
export const DISCUSSION_SEED_MARKER_PATH = resolveNexusDataPath(
  'discussion-seed-version.txt'
);
