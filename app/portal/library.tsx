/**
 * File: library.tsx
 * Description: Renders the packet library with typed filters and packet-native previews.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import {
  PortalActionButton,
  PortalBadge,
  PortalCard,
  PortalSectionHeader,
} from '@/components/portal/portal-ui';
import { portalPacketPreviews } from '@/data/portal/mock-portal-data';
import { matchesScope } from '@/lib/portal/portal-shell';

type PacketFilter =
  | 'all'
  | 'proposal'
  | 'report'
  | 'assembly'
  | 'policy'
  | 'forum-post'
  | 'charter';

const packetFilters: PacketFilter[] = [
  'all',
  'proposal',
  'report',
  'assembly',
  'policy',
  'forum-post',
  'charter',
];

/**
 * Inputs: none.
 * Output: the packet library view for the current scope lens.
 */
export default function PortalLibraryPage() {
  const { activeScope } = usePortalShell();
  const [packetFilter, setPacketFilter] = useState<PacketFilter>('all');
  const visiblePackets = portalPacketPreviews.filter((packet) => {
    const matchesPacketType =
      packetFilter === 'all' ? true : packet.type === packetFilter;

    return matchesPacketType && matchesScope(packet.scopeIds, activeScope.id);
  });

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <PortalSectionHeader
          eyebrow="Packet library"
          title={`${activeScope.shortLabel} durable packet layer`}
          description="Every meaningful civic object should stay browsable as a packet. This first slice blocks in filtering, previews, and lineage cues without full packet detail routes yet."
        />

        <PortalCard className="gap-4">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
            Packet filters
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {packetFilters.map((filter) => {
              const isActive = packetFilter === filter;

              return (
                <PortalActionButton
                  key={filter}
                  label={filter === 'all' ? 'All packets' : filter}
                  onPress={() => setPacketFilter(filter)}
                  variant={isActive ? 'primary' : 'secondary'}
                />
              );
            })}
          </View>
        </PortalCard>

        <View className="gap-4">
          {visiblePackets.map((packet) => (
            <PortalCard key={packet.id} className="gap-4">
              <View className="gap-2 lg:flex-row lg:items-start lg:justify-between">
                <View className="flex-1 gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-2xl font-bold text-portal-text">
                      {packet.title}
                    </Text>
                    <PortalBadge label={packet.type} tone="sky" />
                  </View>
                  <Text className="text-sm leading-7 text-portal-muted">
                    {packet.summary}
                  </Text>
                  <Text className="text-xs uppercase tracking-[2px] text-portal-muted">
                    {packet.lineage}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <PortalActionButton label="Open packet" disabled />
                  <PortalActionButton label="Fork draft" disabled />
                  <PortalActionButton label="Trace lineage" disabled />
                </View>
              </View>
            </PortalCard>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
