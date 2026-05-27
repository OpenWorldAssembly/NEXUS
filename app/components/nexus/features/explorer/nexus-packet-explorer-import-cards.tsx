/**
 * File: nexus-packet-explorer-import-cards.tsx
 * Description: Feature-local Packet Explorer import result and history cards.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type {
  NexusPacketExplorerImportCommitPayload,
  NexusPacketExplorerImportHistoryEntry,
  NexusPacketExplorerImportPreviewPayload,
} from '@runtime/nexus/nexus-api-types';

type ExplorerImportOpenPacketInput = {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: {
    type: string | null;
    summary: string | null;
    label: string | null;
  } | null;
  activePrimaryTab?: 'data' | 'lineage' | 'verification' | 'links' | 'actions';
};

type ExplorerImportOpenPacketHandler = (input: ExplorerImportOpenPacketInput) => void;

function getImportStatusTone(
  status: NexusPacketExplorerImportPreviewPayload['status']
): 'sky' | 'mint' | 'gold' | 'rose' | 'default' {
  if (status === 'ready') {
    return 'mint';
  }

  if (status === 'duplicates_only' || status === 'partial_risk') {
    return 'gold';
  }

  if (status === 'blocked' || status === 'invalid_json') {
    return 'rose';
  }

  return 'default';
}

export function ImportResultCard(input: {
  result: NexusPacketExplorerImportPreviewPayload | NexusPacketExplorerImportCommitPayload;
  onOpenPacketInExplorer: ExplorerImportOpenPacketHandler;
}) {
  const appearance = useNexusAppearance();
  const [isAffectedPacketListOpen, setIsAffectedPacketListOpen] = useState(false);
  const commitResult = 'committed' in input.result ? input.result : null;
  const openLabel =
    commitResult?.committed
      ? commitResult.root_packet_refs.length === 1
        ? 'Open root packet'
        : commitResult.open_packet_id
          ? 'Open imported packet'
          : null
      : null;

  return (
    <NexusCard className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge
          label={input.result.status.replace(/_/g, ' ')}
          tone={getImportStatusTone(input.result.status)}
        />
        <NexusBadge
          label={input.result.validation_mode.replace(/_/g, ' ')}
          tone="sky"
        />
        {input.result.artifact_type ? (
          <NexusBadge
            label={input.result.artifact_type.replace(/_/g, ' ')}
            tone="sky"
          />
        ) : null}
        <NexusBadge label={`${input.result.packet_count} entries`} />
        <NexusBadge label={`${input.result.unique_packet_count} packets`} />
        <NexusBadge label={`${input.result.unique_revision_count} revisions`} />
      </View>

      {input.result.source_file_name ? (
        <View className="gap-1">
          <Text className={appearance.itemMetaClass}>Source file</Text>
          <Text className={appearance.itemBodyClass}>
            {input.result.source_file_name}
          </Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`${input.result.new_revision_count} new`} tone="mint" />
        <NexusBadge
          label={`${input.result.duplicate_revision_count} duplicates`}
          tone="gold"
        />
        <NexusBadge
          label={`${input.result.invalid_entry_count} invalid`}
          tone={input.result.invalid_entry_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.missing_parent_count} missing parents`}
          tone={input.result.missing_parent_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.type_conflict_count} type conflicts`}
          tone={input.result.type_conflict_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.validation_blocked_count} validation blocked`}
          tone={input.result.validation_blocked_count > 0 ? 'rose' : 'default'}
        />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge
          label={`${input.result.validation_counts.signature_valid} signature valid`}
          tone="mint"
        />
        <NexusBadge
          label={`${input.result.validation_counts.unknown_signer} signer unavailable locally`}
          tone="gold"
        />
        <NexusBadge
          label={`${input.result.validation_counts.unsigned} unsigned`}
          tone="gold"
        />
        <NexusBadge
          label={`${input.result.validation_counts.signature_invalid} invalid sig`}
          tone={input.result.validation_counts.signature_invalid > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.validation_counts.canonicalization_mismatch} canonical mismatch`}
          tone={
            input.result.validation_counts.canonicalization_mismatch > 0
              ? 'rose'
              : 'default'
          }
        />
      </View>

      {input.result.title || input.result.note || input.result.export_mode ? (
        <View className="gap-2">
          {input.result.title ? (
            <Text className={appearance.itemBodyClass}>
              Title: {input.result.title}
            </Text>
          ) : null}
          {input.result.note ? (
            <Text className={appearance.itemBodyClass}>
              Note: {input.result.note}
            </Text>
          ) : null}
          {input.result.export_mode ? (
            <Text className={appearance.itemBodyClass}>
              Export mode: {input.result.export_mode}
            </Text>
          ) : null}
        </View>
      ) : null}

      {input.result.blocking_errors.length > 0 ? (
        <NexusCard tone="rose" className="gap-2">
          <Text className={appearance.itemMetaClass}>Blocking errors</Text>
          {input.result.blocking_errors.map((error) => (
            <Text key={error} className={appearance.itemBodyClass}>
              {error}
            </Text>
          ))}
        </NexusCard>
      ) : null}

      {input.result.warnings.length > 0 ? (
        <NexusCard tone="gold" className="gap-2">
          <Text className={appearance.itemMetaClass}>Warnings</Text>
          {input.result.warnings.map((warning) => (
            <Text key={warning} className={appearance.itemBodyClass}>
              {warning}
            </Text>
          ))}
        </NexusCard>
      ) : null}

      {input.result.affected_packet_ids.length > 0 ? (
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className={appearance.itemMetaClass}>
              Affected packets ({input.result.affected_packet_count})
            </Text>
            <NexusActionButton
              label={isAffectedPacketListOpen ? 'Hide list' : 'Show list'}
              variant="ghost"
              onPress={() => setIsAffectedPacketListOpen((currentValue) => !currentValue)}
            />
          </View>
          {isAffectedPacketListOpen ? (
            <View className="gap-1">
              {input.result.affected_packet_ids.map((packetId) => (
                <Text key={packetId} className={appearance.itemBodyClass}>
                  {packetId}
                </Text>
              ))}
            </View>
          ) : (
            <Text className={appearance.itemBodyClass}>
              {input.result.affected_packet_count === 1
                ? '1 packet will be affected.'
                : `${input.result.affected_packet_count} packets are part of this import. Expand the list to inspect every packet id.`}
            </Text>
          )}
        </View>
      ) : null}

      {commitResult ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            <NexusBadge
              label={
                commitResult.committed
                  ? `${commitResult.imported_revision_count} imported`
                  : 'Commit blocked'
              }
              tone={commitResult.committed ? 'mint' : 'rose'}
            />
            <NexusBadge
              label={`${commitResult.skipped_duplicate_count} skipped duplicates`}
              tone="gold"
            />
            <NexusBadge
              label={`${commitResult.restored_preferred_packet_count} preferred restored`}
              tone="sky"
            />
            <NexusBadge
              label={`${commitResult.diverged_packet_count} diverged`}
              tone={commitResult.diverged_packet_count > 0 ? 'gold' : 'default'}
            />
            {commitResult.import_report_packet_id ? (
              <NexusBadge label="Import report created" tone="sky" />
            ) : null}
          </View>

          {commitResult.import_report_packet_id ? (
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label="Open import report"
                onPress={() =>
                  input.onOpenPacketInExplorer({
                    packetId: commitResult.import_report_packet_id!,
                  })
                }
              />
              {commitResult.created_verification_report_packet_ids[0] ? (
                <NexusActionButton
                  label="Open validation report"
                  variant="ghost"
                  onPress={() =>
                    input.onOpenPacketInExplorer({
                      packetId: commitResult.created_verification_report_packet_ids[0]!,
                    })
                  }
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {openLabel && commitResult?.open_packet_id ? (
        <NexusActionButton
          label={openLabel}
          variant="primary"
          onPress={() =>
            input.onOpenPacketInExplorer({
              packetId: commitResult.open_packet_id!,
            })
          }
        />
      ) : null}
    </NexusCard>
  );
}

export function ImportHistoryCard(input: {
  entry: NexusPacketExplorerImportHistoryEntry;
  onOpenPacketInExplorer: ExplorerImportOpenPacketHandler;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={input.entry.source === 'local' ? 'local report' : 'external report'} tone="sky" />
        {input.entry.validation_mode ? (
          <NexusBadge label={input.entry.validation_mode.replace(/_/g, ' ')} tone="gold" />
        ) : null}
        {input.entry.artifact_type ? (
          <NexusBadge label={input.entry.artifact_type.replace(/_/g, ' ')} />
        ) : null}
      </View>
      <Text className={appearance.surfaceTitleClass}>{input.entry.title}</Text>
      <Text className={appearance.itemMetaClass}>{input.entry.created_at}</Text>
      {input.entry.summary ? (
        <Text className={appearance.itemBodyClass}>{input.entry.summary}</Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`${input.entry.imported_count} imported`} tone="mint" />
        <NexusBadge label={`${input.entry.skipped_count} skipped`} tone="gold" />
        <NexusBadge
          label={`${input.entry.blocked_count} blocked`}
          tone={input.entry.blocked_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge label={`${input.entry.affected_packet_ids.length} packets`} />
      </View>
      {input.entry.source_file_name || input.entry.source_digest ? (
        <View className="gap-1">
          {input.entry.source_file_name ? (
            <Text className={appearance.itemBodyClass}>
              Source file: {input.entry.source_file_name}
            </Text>
          ) : null}
          {input.entry.source_digest ? (
            <Text className={appearance.itemMetaClass}>
              Digest: {input.entry.source_digest}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton
          label="Open report"
          onPress={() =>
            input.onOpenPacketInExplorer({
              packetId: input.entry.report_packet_id,
            })
          }
        />
        {input.entry.affected_packet_ids[0] ? (
          <NexusActionButton
            label="Open first packet"
            variant="ghost"
            onPress={() =>
              input.onOpenPacketInExplorer({
                packetId: input.entry.affected_packet_ids[0]!,
              })
            }
          />
        ) : null}
      </View>
    </NexusCard>
  );
}
