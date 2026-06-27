/**
 * File: legacy-seed-source-inventory.ts
 * Description: Static inventory for legacy/pruned seed-source references before reseed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type LegacySeedSourceClassification =
  | 'fresh_canon'
  | 'compatibility_read_only'
  | 'test_fixture_only'
  | 'stale_seed_candidate'
  | 'remove_now';

export type LegacySeedSourceInventoryEntry = {
  classification: LegacySeedSourceClassification;
  file_path: string;
  marker: string;
  reason: string;
};

export type LegacySeedSourceInventoryReport = {
  report_kind: 'packet.legacy_seed_source_inventory';
  status: 'pass' | 'fail';
  entries: LegacySeedSourceInventoryEntry[];
  cleanup_candidates: string[];
  blockers: string[];
};

const INVENTORY_FILES = [
  'core/packets/seeds.ts',
  'core/packets/builders.ts',
  'core/packets/defaults/element-discussion-defaults.ts',
  'core/packets/discussion.ts',
  'core/packets/discussion-compat.ts',
  'runtime/nexus/server/discussion/discussion-service.ts',
  'runtime/nexus/server/discussion/default-discussion-surfaces.ts',
  'runtime/trusted_coordinators/trusted_composite_workflow_coordinator.ts',
  'runtime/trusted_coordinators/trusted_composite_workflow_adapters.ts',
  'docs/implementation-guide/packet-runtime-modernization.md',
] as const;

const MARKERS = [
  'createDiscussionThreadPacket',
  'createDiscussionPostPacket',
  'createDiscussionReplyPacket',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
  'parent_scope',
  'alpha',
  'Vote',
  'Attestation',
  'association.claim.set',
  'residence.claim.set',
] as const;

function readRepoFile(filePath: string): string {
  const absolutePath = join(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function classifyMarker(input: {
  filePath: string;
  marker: string;
}): Omit<LegacySeedSourceInventoryEntry, 'file_path' | 'marker'> {
  if (input.filePath.includes('docs/')) {
    return {
      classification: 'compatibility_read_only',
      reason: 'Documentation records pruned/compatibility semantics and should not be treated as active seed material.',
    };
  }

  if (
    input.filePath === 'core/packets/discussion-compat.ts' ||
    input.filePath.includes('trusted_composite_workflow_adapters.ts')
  ) {
    return {
      classification: 'compatibility_read_only',
      reason: 'Compatibility adapter material preserves archived alpha/discussion readability during the transition.',
    };
  }

  if (
    input.marker === 'parent_scope' &&
    input.filePath === 'core/packets/seeds.ts'
  ) {
    return {
      classification: 'stale_seed_candidate',
      reason: 'Fresh scope structure prefers packet-native relation projection, but this edge remains in current seed/composite material until the reseed graph pass replaces it.',
    };
  }

  if (
    input.marker === 'parent_scope' &&
    input.filePath.includes('trusted_composite_workflow_coordinator.ts')
  ) {
    return {
      classification: 'compatibility_read_only',
      reason: 'Composite workflow code may still read or name parent_scope compatibility inputs, but fresh writes emit packet-native ancestry relations.',
    };
  }

  if (
    input.marker.startsWith('createDiscussion') ||
    input.marker.startsWith('Discussion')
  ) {
    return {
      classification: 'fresh_canon',
      reason: 'Helpers now emit canonical Discussion packets or preserve compatible discussion projections; the old split names are helper/API names rather than active packet types.',
    };
  }

  if (input.marker === 'Vote' || input.marker === 'Attestation') {
    return {
      classification: 'compatibility_read_only',
      reason: 'Vote/attestation wording is retained for UI/API compatibility while fresh packet material uses Reaction.',
    };
  }

  if (
    input.marker === 'association.claim.set' ||
    input.marker === 'residence.claim.set'
  ) {
    return {
      classification: 'compatibility_read_only',
      reason: 'Retired mutation intents are recorded as compatibility-only legacy surfaces and are absent from live registries.',
    };
  }

  return {
    classification: 'compatibility_read_only',
    reason: 'Legacy marker is classified as transition/compatibility material, not active seed output.',
  };
}

export function createLegacySeedSourceInventoryReport(): LegacySeedSourceInventoryReport {
  const entries: LegacySeedSourceInventoryEntry[] = [];

  for (const filePath of INVENTORY_FILES) {
    const source = readRepoFile(filePath);

    if (!source) {
      continue;
    }

    for (const marker of MARKERS) {
      if (!source.includes(marker)) {
        continue;
      }

      const classification = classifyMarker({ filePath, marker });

      entries.push({
        file_path: filePath,
        marker,
        ...classification,
      });
    }
  }

  const cleanupCandidates = entries
    .filter((entry) => entry.classification === 'stale_seed_candidate')
    .map((entry) => `${entry.file_path}:${entry.marker} - ${entry.reason}`);
  const blockers = entries
    .filter((entry) => entry.classification === 'remove_now')
    .map((entry) => `${entry.file_path}:${entry.marker} must be removed before reseed.`);

  return {
    report_kind: 'packet.legacy_seed_source_inventory',
    status: blockers.length > 0 ? 'fail' : 'pass',
    entries,
    cleanup_candidates: cleanupCandidates,
    blockers,
  };
}
