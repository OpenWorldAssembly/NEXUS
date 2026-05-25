/**
 * File: library.tsx
 * Description: Renders the packet library with typed filters and packet-native previews.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusPreviewTargetParams } from '@app/components/nexus/preview';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@app/components/nexus/ui';
import { PACKET_TYPES, type PacketType } from '@core/schema/packet-schema';
import type { NexusLibraryPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusLibraryPayload } from '@runtime/nexus/nexus-query-api';

type PacketFilter = 'all' | PacketType;


/**
 * Inputs: none.
 * Output: the packet library view for the current scope lens.
 */
export default function NexusLibraryPage() {
  const { activeScope, currentActorPacketId, openPacketInExplorer } =
    useNexusShell();
  const appearance = useNexusAppearance();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const localParams = useLocalSearchParams<{
    type?: string | string[];
  }>();
  const previewTargetParams = useNexusPreviewTargetParams();
  const requestedTypeFilter =
    typeof localParams.type === 'string' &&
    PACKET_TYPES.includes(localParams.type as PacketType)
      ? (localParams.type as PacketType)
      : null;
  const highlightedPacketId =
    previewTargetParams.highlightPacketId ??
    previewTargetParams.focusPacketId ??
    previewTargetParams.packetId;
  const [packetFilter, setPacketFilter] = useState<PacketFilter>('all');
  const [libraryPayload, setLibraryPayload] = useState<NexusLibraryPayload | null>(
    null,
  );
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardOffsets, setCardOffsets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (requestedTypeFilter) {
      setPacketFilter(requestedTypeFilter);
    }
  }, [requestedTypeFilter]);

  useEffect(() => {
    setCardOffsets({});
  }, [packetFilter, activeScope.id]);

  useEffect(() => {
    let isMounted = true;

    const loadLibraryPayload = async () => {
      setIsLoadingLibrary(true);
      setLoadError(null);

      try {
        const nextLibraryPayload = await fetchNexusLibraryPayload({
          scopeId: activeScope.id,
          typeFilter: null,
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
  }, [activeScope.id, currentActorPacketId]);

  const allPackets = libraryPayload?.packets ?? [];
  const availablePacketFilters = useMemo<PacketFilter[]>(() => {
    const availableTypes = Array.from(
      new Set(allPackets.map((packet) => packet.type))
    )
      .filter((type): type is PacketType =>
        PACKET_TYPES.includes(type as PacketType)
      )
      .sort((leftType, rightType) => leftType.localeCompare(rightType));

    return ['all', ...availableTypes];
  }, [allPackets]);
  const visiblePackets =
    packetFilter === 'all'
      ? allPackets
      : allPackets.filter((packet) => packet.type === packetFilter);
  const highlightedPacketIsVisible =
    highlightedPacketId !== null &&
    visiblePackets.some((packet) => packet.packet.packet_id === highlightedPacketId);

  useEffect(() => {
    if (
      !isLoadingLibrary &&
      packetFilter !== 'all' &&
      !availablePacketFilters.includes(packetFilter)
    ) {
      setPacketFilter('all');
    }
  }, [availablePacketFilters, isLoadingLibrary, packetFilter]);

  useEffect(() => {
    if (
      !highlightedPacketId ||
      isLoadingLibrary ||
      loadError ||
      !highlightedPacketIsVisible
    ) {
      return;
    }

    const targetOffset = cardOffsets[highlightedPacketId];

    if (typeof targetOffset !== 'number') {
      return;
    }

    const timeoutHandle = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(targetOffset - 24, 0),
        animated: true,
      });
    }, 0);

    return () => clearTimeout(timeoutHandle);
  }, [
    cardOffsets,
    highlightedPacketId,
    highlightedPacketIsVisible,
    isLoadingLibrary,
    loadError,
  ]);

  function formatFilterLabel(filter: PacketFilter): string {
    if (filter === 'all') {
      return 'All packets';
    }

    return filter;
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1"
      showsVerticalScrollIndicator={false}
    >
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
            {availablePacketFilters.map((filter) => {
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
            <View
              key={packet.packet.packet_id}
              onLayout={(event) => {
                const nextOffset = event.nativeEvent.layout.y;

                setCardOffsets((currentOffsets) =>
                  currentOffsets[packet.packet.packet_id] === nextOffset
                    ? currentOffsets
                    : {
                        ...currentOffsets,
                        [packet.packet.packet_id]: nextOffset,
                      }
                );
              }}
            >
              <NexusCard
                className={`gap-4 ${
                  packet.packet.packet_id === highlightedPacketId
                    ? 'border-nexus-sky/60 bg-nexus-sky/10'
                    : ''
                }`}
              >
                <View className="gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <View className="flex-1 gap-2">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.surfaceTitleClass}>
                        {packet.title}
                      </Text>
                      <NexusBadge label={packet.type} tone="sky" />
                      {packet.packet.packet_id === highlightedPacketId ? (
                        <NexusBadge label="Focused packet" tone="gold" />
                      ) : null}
                    </View>
                    <Text className={appearance.sectionBodyClass}>
                      {packet.summary ?? 'No packet summary available.'}
                    </Text>
                    <Text className={appearance.itemMetaClass}>
                      {packet.status ?? packet.label}
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-3">
                    <NexusActionButton
                      label="Open packet"
                      onPress={() => {
                        router.setParams({
                          packet_id: packet.packet.packet_id,
                          type: packet.type,
                        });
                        openPacketInExplorer({
                          packetId: packet.packet.packet_id,
                          preferredRevisionId: packet.revision.revision_id,
                          titleSnapshot: packet.title,
                          seedSummary: {
                            type: packet.type,
                            summary: packet.summary,
                            label: packet.label,
                          },
                        });
                      }}
                    />
                    <NexusActionButton
                      label="Fork draft"
                      disabled
                      featureStatusId="library.fork_draft"
                    />
                    <NexusActionButton
                      label="Trace lineage"
                      disabled
                      featureStatusId="library.trace_lineage"
                    />
                  </View>
                </View>
              </NexusCard>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
