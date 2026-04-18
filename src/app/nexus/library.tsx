/**
 * File: library.tsx
 * Description: Renders the packet library with typed filters and packet-native previews.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@app/components/nexus/nexus-ui';
import { PACKET_FAMILIES, type PacketFamily } from '@core/schema/packet-schema';
import type { NexusLibraryPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusLibraryPayload } from '@runtime/nexus/nexus-query-api';

type PacketFilter = 'all' | PacketFamily;

const packetFilters: PacketFilter[] = [
  'all',
  ...PACKET_FAMILIES,
];

/**
 * Inputs: none.
 * Output: the packet library view for the current scope lens.
 */
export default function NexusLibraryPage() {
  const { activeScope, currentActorPacketId } = useNexusShell();
  const appearance = useNexusAppearance();
  const [packetFilter, setPacketFilter] = useState<PacketFilter>('all');
  const [libraryPayload, setLibraryPayload] = useState<NexusLibraryPayload | null>(
    null,
  );
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLibraryPayload = async () => {
      setIsLoadingLibrary(true);
      setLoadError(null);

      try {
        const nextLibraryPayload = await fetchNexusLibraryPayload({
          scopeId: activeScope.id,
          familyFilter: packetFilter === 'all' ? null : packetFilter,
          actorPacketId: currentActorPacketId,
        });

        if (!isMounted) {
          return;
        }

        setLibraryPayload(nextLibraryPayload);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load packet-backed library data.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingLibrary(false);
        }
      }
    };

    void loadLibraryPayload();

    return () => {
      isMounted = false;
    };
  }, [activeScope.id, currentActorPacketId, packetFilter]);

  const visiblePackets = libraryPayload?.packets ?? [];

  function formatFilterLabel(filter: PacketFilter): string {
    if (filter === 'all') {
      return 'All packets';
    }

    return filter;
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Library"
          title={`${activeScope.name} Library`}
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge
                label={packetFilter === 'all' ? 'All packets' : packetFilter}
                tone="sky"
              />
              <NexusBadge label={`${visiblePackets.length} results`} tone="gold" />
            </View>
          }
        />

        <NexusCard className="gap-4">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Filters
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {packetFilters.map((filter) => {
              const isActive = packetFilter === filter;

              return (
                <NexusActionButton
                  key={filter}
                  label={formatFilterLabel(filter)}
                  onPress={() => setPacketFilter(filter)}
                  variant={isActive ? 'primary' : 'secondary'}
                />
              );
            })}
          </View>
        </NexusCard>

        {isLoadingLibrary ? (
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              Loading packet-backed library cards...
            </Text>
          </NexusCard>
        ) : null}

        {loadError ? (
          <NexusCard>
            <Text className="text-sm leading-6 text-nexus-rose">{loadError}</Text>
          </NexusCard>
        ) : null}

        <View className="gap-4">
          {visiblePackets.map((packet) => (
            <NexusCard key={packet.packet.packet_id} className="gap-4">
              <View className="gap-2 lg:flex-row lg:items-start lg:justify-between">
                <View className="flex-1 gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.surfaceTitleClass}>
                      {packet.title}
                    </Text>
                    <NexusBadge label={packet.family} tone="sky" />
                  </View>
                  <Text className={appearance.sectionBodyClass}>
                    {packet.summary ?? 'No packet summary available.'}
                  </Text>
                  <Text className={appearance.itemMetaClass}>
                    {packet.status ?? packet.label}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <NexusActionButton label="Open packet" disabled />
                  <NexusActionButton label="Fork draft" disabled />
                  <NexusActionButton label="Trace lineage" disabled />
                </View>
              </View>
            </NexusCard>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
