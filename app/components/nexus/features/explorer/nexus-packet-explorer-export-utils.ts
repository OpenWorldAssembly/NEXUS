/**
 * File: nexus-packet-explorer-export-utils.ts
 * Description: Pure helpers for Packet Explorer export panels.
 */
import type {
  NexusPacketExplorerBundleExportMode,
  NexusPacketExplorerExportRequest,
  NexusPacketExplorerSearchPayload,
  NexusPacketExplorerSearchResultRow,
} from '@runtime/nexus/nexus-api-types';

export function getVerificationLookupBadge(
  verification: NexusPacketExplorerSearchResultRow['verification']
): { label: string; tone?: 'default' | 'sky' | 'gold' | 'rose' | 'mint' } | null {
  if (!verification) {
    return null;
  }

  if (
    verification.status === 'signature_invalid' ||
    verification.status === 'canonicalization_mismatch'
  ) {
    return { label: 'Validation failed', tone: 'rose' };
  }

  if (verification.status === 'trusted_signer') {
    return { label: 'Validated locally', tone: 'mint' };
  }

  if (verification.status === 'unsigned') {
    return { label: 'Unsigned', tone: 'gold' };
  }

  if (verification.status === 'unknown_signer') {
    return { label: 'Signer unavailable locally', tone: 'gold' };
  }

  if (verification.status === 'external_report_only') {
    return { label: 'External report only', tone: 'gold' };
  }

  return { label: verification.status.replace(/_/g, ' ') };
}

export function normalizeLookupQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function flattenSearchResults(
  searchPayload: NexusPacketExplorerSearchPayload | null
): NexusPacketExplorerSearchResultRow[] {
  if (!searchPayload) {
    return [];
  }

  return searchPayload.groups
    .flatMap((group) => group.results)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return right.created_at.localeCompare(left.created_at);
    });
}

export function buildPacketExportRequest(input: {
  selectedPacketId: string;
  artifactMode: 'raw_packet' | 'bundle';
  bundleMode: NexusPacketExplorerBundleExportMode;
  title: string;
  note: string;
}): NexusPacketExplorerExportRequest {
  return {
    artifact_mode: input.artifactMode,
    root_packet_id: input.selectedPacketId,
    bundle_mode: input.artifactMode === 'bundle' ? input.bundleMode : null,
    title: input.artifactMode === 'bundle' ? input.title : null,
    note: input.artifactMode === 'bundle' ? input.note : null,
  };
}

export function buildStoreExportRequest(input: {
  title: string;
  note: string;
}): NexusPacketExplorerExportRequest {
  return {
    artifact_mode: 'bundle',
    bundle_mode: 'full_store',
    root_packet_id: null,
    title: input.title,
    note: input.note,
  };
}
