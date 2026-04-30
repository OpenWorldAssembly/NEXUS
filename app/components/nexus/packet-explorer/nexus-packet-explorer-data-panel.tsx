import { ScrollView, Text, View } from 'react-native';

import {
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type { NexusPacketExplorerPayload } from '@runtime/nexus/nexus-api-types';
import type { PacketExplorerViewMode } from '@runtime/nexus/packet-explorer-session';

import {
  formatJson,
  formatTimestamp,
  getViewModeLabel,
} from './nexus-packet-explorer-utils';

type NexusPacketExplorerDataPanelProps = {
  payload: NexusPacketExplorerPayload;
  viewMode: PacketExplorerViewMode;
  rawCodeCardClass: string;
  headingTextClass: string;
};

function renderJsonCard(input: {
  title: string;
  value: unknown;
  rawCodeCardClass: string;
  headingTextClass: string;
}) {
  return (
    <NexusCard className={`flex-1 gap-3 ${input.rawCodeCardClass}`}>
      <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
        {input.title}
      </Text>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className={`text-xs leading-6 ${input.headingTextClass}`} selectable>
          {formatJson(input.value)}
        </Text>
      </ScrollView>
    </NexusCard>
  );
}

function renderAdaptationSummary(
  payload: NexusPacketExplorerPayload,
  appearance: ReturnType<typeof useNexusAppearance>
) {
  return (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Adaptation Summary
        </Text>
        <NexusBadge
          label={payload.adaptation_summary.compatibility_mode}
          tone={
            payload.adaptation_summary.compatibility_mode === 'native'
              ? 'mint'
              : payload.adaptation_summary.compatibility_mode === 'lossy' ||
                  payload.adaptation_summary.compatibility_mode === 'blocked'
                ? 'rose'
                : 'gold'
          }
        />
        <NexusBadge label={getViewModeLabel(payload.inspection_lens)} tone="default" />
      </View>

      <Text className={appearance.itemMetaClass}>
        {payload.adaptation_summary.source_family} {payload.adaptation_summary.source_schema_version}
        {' -> '}
        {payload.adaptation_summary.target_family} {payload.adaptation_summary.target_schema_version}
      </Text>
      <Text className={appearance.itemBodyClass}>
        Stages: {payload.adaptation_summary.stages.join(', ')}
      </Text>
      <Text className={appearance.itemBodyClass}>
        Changes: {payload.adaptation_summary.changes.length} | Losses:{' '}
        {payload.adaptation_summary.losses.length}
      </Text>
      {payload.adaptation_summary.warnings.length > 0 ? (
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>Warnings</Text>
          {payload.adaptation_summary.warnings.map((warning) => (
            <Text key={warning} className={appearance.itemBodyClass}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
    </NexusCard>
  );
}

export function NexusPacketExplorerDataPanel({
  payload,
  viewMode,
  rawCodeCardClass,
  headingTextClass,
}: NexusPacketExplorerDataPanelProps) {
  const appearance = useNexusAppearance();

  if (viewMode === 'summary') {
    return (
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-4">
        <NexusCard className="gap-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={appearance.surfaceTitleClass}>
              {payload.packet_summary.title}
            </Text>
            <NexusBadge label={payload.packet_summary.family} tone="sky" />
            {payload.packet_summary.kind ? (
              <NexusBadge label={payload.packet_summary.kind} tone="default" />
            ) : null}
            <NexusBadge label={payload.revision_state} tone="gold" />
            <NexusBadge label={getViewModeLabel(viewMode)} tone="default" />
          </View>

          <Text className={appearance.sectionBodyClass}>
            {payload.packet_summary.summary ?? payload.packet_summary.label}
          </Text>

          <View className="gap-2">
            <Text className={appearance.itemMetaClass}>
              Packet ID: {payload.packet_summary.packet.packet_id}
            </Text>
            <Text className={appearance.itemMetaClass}>
              Preferred revision: {payload.preferred_revision.revision_id}
            </Text>
            <Text className={appearance.itemMetaClass}>
              Schema version: {payload.packet_summary.schema_version}
            </Text>
            <Text className={appearance.itemMetaClass}>
              Current revision timestamp:{' '}
              {formatTimestamp(payload.packet_summary.created_at)}
            </Text>
            <Text className={appearance.itemMetaClass}>
              Head revisions: {payload.head_revisions.length}
            </Text>
          </View>
        </NexusCard>

        <NexusCard className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Scope Context
          </Text>
          <Text className={appearance.itemBodyClass}>
            Authority scope:{' '}
            {payload.packet_summary.authority_scope?.label ??
              payload.packet_summary.authority_scope?.packet_id ??
              'None'}
          </Text>
          <View className="gap-2">
            <Text className={appearance.itemMetaClass}>Applicable scopes</Text>
            {payload.packet_summary.applicable_scopes.length > 0 ? (
              payload.packet_summary.applicable_scopes.map((scope) => (
                <Text key={scope.packet_id} className={appearance.itemBodyClass}>
                  {scope.label ?? scope.packet_id}
                </Text>
              ))
            ) : (
              <Text className={appearance.itemBodyClass}>No additional scopes.</Text>
            )}
          </View>
        </NexusCard>
      </ScrollView>
    );
  }

  if (viewMode === 'raw') {
    return renderJsonCard({
      title: 'Historical Raw Envelope',
      value: payload.raw_view,
      rawCodeCardClass,
      headingTextClass,
    });
  }

  if (viewMode === 'adapted') {
    return (
      <View className="flex-1 gap-4">
        {renderAdaptationSummary(payload, appearance)}
        {renderJsonCard({
          title: 'Current Adapted Packet',
          value: payload.adapted_view,
          rawCodeCardClass,
          headingTextClass,
        })}
      </View>
    );
  }

  return (
    <View className="flex-1 gap-4">
      {renderAdaptationSummary(payload, appearance)}
      {payload.read_model_view !== null ? (
        renderJsonCard({
          title: 'Read Model Projection',
          value: payload.read_model_view,
          rawCodeCardClass,
          headingTextClass,
        })
      ) : (
        <NexusCard tone="gold">
          <Text className={appearance.itemBodyClass}>
            Read model projection is not available for this packet yet.
          </Text>
        </NexusCard>
      )}
    </View>
  );
}
