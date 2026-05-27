/**
 * File: nexus-packet-explorer-export-preview-card.tsx
 * Description: Feature-local export preview card for Packet Explorer.
 */
import { Text, View } from 'react-native';

import {
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type { NexusPacketExplorerExportPreviewPayload } from '@runtime/nexus/nexus-api-types';

export function ExportPreviewCard({
  preview,
}: {
  preview: NexusPacketExplorerExportPreviewPayload;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge
          label={preview.artifact_mode === 'raw_packet' ? 'Raw packet' : 'Bundle'}
          tone="sky"
        />
        <NexusBadge label={`${preview.packet_count} packets`} />
        <NexusBadge label={`${preview.revision_count} revisions`} />
        <NexusBadge label={`${preview.byte_count} bytes`} tone="gold" />
      </View>

      <View className="gap-2">
        <Text className={appearance.itemMetaClass}>Export mode</Text>
        <Text className={appearance.itemBodyClass}>{preview.export_mode}</Text>
      </View>

      {preview.root_packet_refs.length > 0 ? (
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>Root packet refs</Text>
          {preview.root_packet_refs.map((packetRef) => (
            <Text key={packetRef.packet_id} className={appearance.itemBodyClass}>
              {packetRef.packet_id}
            </Text>
          ))}
        </View>
      ) : null}

      {preview.preview_suppressed ? (
        <NexusCard tone="gold" className="gap-2">
          <Text className={appearance.itemBodyClass}>
            This export is too large to preview inline. Download the JSON instead.
          </Text>
        </NexusCard>
      ) : preview.preview_json ? (
        <NexusCard className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Export JSON
          </Text>
          <Text className={`text-xs leading-6 ${appearance.itemMetaClass}`} selectable>
            {preview.preview_json}
          </Text>
        </NexusCard>
      ) : null}
    </NexusCard>
  );
}
