/**
 * File: dashboard.tsx
 * Description: Renders the guest dashboard with scope totals and function preview sections.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { type NexusCardBadge } from '@app/components/nexus/action-card';
import { NexusActionList, NexusActionListItem } from '@app/components/nexus/action-list';
import { NexusPreviewPanel, NexusStatCard } from '@app/components/nexus/preview';
import { getDashboardBadges } from '@app/components/nexus/dashboard/nexus-dashboard-badges';
import {
  formatDashboardTimestamp,
  getDashboardPreviewMeta,
} from '@app/components/nexus/dashboard/nexus-dashboard-format';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@app/components/nexus/nexus-ui';
import type { NexusPacketCardProjection } from '@core/contracts';
import type { NexusDashboardPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusDashboardPayload } from '@runtime/nexus/nexus-query-api';

/**
 * Inputs: none.
 * Output: the main nexus dashboard surface for the currently selected scope.
 */
export default function NexusDashboardPage() {
  const params = useLocalSearchParams<{
    locality_created?: string | string[];
    locality_name?: string | string[];
  }>();
  const {
    activeScope,
    currentActorPacketId,
    openPacketInExplorer,
    setActiveSection,
  } = useNexusShell();
  const appearance = useNexusAppearance();
  const [dashboardPayload, setDashboardPayload] =
    useState<NexusDashboardPayload | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardPayload = async () => {
      setIsLoadingDashboard(true);
      setLoadError(null);

      try {
        const nextDashboardPayload = await fetchNexusDashboardPayload(
          activeScope.id,
          currentActorPacketId
        );

        if (!isMounted) {
          return;
        }

        setDashboardPayload(nextDashboardPayload);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load packet-backed dashboard data.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      }
    };

    void loadDashboardPayload();

    return () => {
      isMounted = false;
    };
  }, [activeScope.id, currentActorPacketId]);

  const visibleMetrics = dashboardPayload?.metrics ?? [];
  const visibleQueues = dashboardPayload?.queue ?? [];
  const discussionPreviewPackets = dashboardPayload?.discussion_preview_packets ?? [];
  const rolePreviewPackets = dashboardPayload?.role_preview_packets ?? [];
  const trustReviewPackets =
    dashboardPayload?.trust_review_packets ?? dashboardPayload?.recommended_packets ?? [];
  const votePreviewPackets = dashboardPayload?.vote_preview_packets ?? [];
  const localityCreated =
    Array.isArray(params.locality_created)
      ? params.locality_created[0] === '1'
      : params.locality_created === '1';
  const createdLocalityName =
    (Array.isArray(params.locality_name)
      ? params.locality_name[0]
      : params.locality_name) ?? activeScope.name;

  const openPacketCardInExplorer = (packet: NexusPacketCardProjection) => {
    openPacketInExplorer({
      packetId: packet.packet.packet_id,
      preferredRevisionId: packet.revision.revision_id,
      titleSnapshot: packet.title,
      seedSummary: {
        family: packet.family,
        label: packet.label,
        summary: packet.summary,
      },
    });
  };

  const getPacketBadges = (packet: NexusPacketCardProjection): NexusCardBadge[] =>
    getDashboardBadges(packet.status ?? packet.label);

  const renderPacketPreviewRow = (packet: NexusPacketCardProjection, index: number, packets: NexusPacketCardProjection[]) => {
    const packetTimestamp = formatDashboardTimestamp(packet.created_at);
    const openPacket = () => openPacketCardInExplorer(packet);

    return (
      <NexusActionListItem
        key={packet.packet.packet_id}
        accessibilityLabel={`Open ${packet.title} in Explorer`}
        actions={[
          {
            id: 'open-explorer',
            label: 'Open in Explorer',
            onSelect: openPacket,
          },
        ]}
        actionMenuAlign={index >= 2 ? 'bottom' : 'top'}
        badges={getPacketBadges(packet)}
        detail={packet.summary ?? 'No packet summary available.'}
        isLast={index === packets.length - 1}
        meta={packetTimestamp}
        onPress={openPacket}
        title={packet.title}
      />
    );
  };

  const renderPacketPreviewList = (packets: NexusPacketCardProjection[], emptyLabel: string) => {
    if (packets.length === 0) {
      return <Text className={appearance.itemBodyClass}>{emptyLabel}</Text>;
    }

    return <NexusActionList>{packets.map(renderPacketPreviewRow)}</NexusActionList>;
  };

  const renderQueuePreviewList = () => {
    if (visibleQueues.length === 0) {
      return <Text className={appearance.itemBodyClass}>No recent activity.</Text>;
    }

    return (
      <NexusActionList>
        {visibleQueues.map((queue, index) => {
          const queueTimestamp = formatDashboardTimestamp(queue.created_at);
          const openQueueInExplorer = () =>
            openPacketInExplorer({
              packetId: queue.id,
              titleSnapshot: queue.title,
              seedSummary: {
                family: null,
                label: queue.stat,
                summary: queue.detail,
              },
            });

          return (
            <NexusActionListItem
              key={queue.id}
              accessibilityLabel={`Open ${queue.title} in Explorer`}
              actions={[
                {
                  id: 'open-explorer',
                  label: 'Open in Explorer',
                  onSelect: openQueueInExplorer,
                },
              ]}
              actionMenuAlign={index >= 2 ? 'bottom' : 'top'}
              badges={getDashboardBadges(queue.stat)}
              detail={queue.detail}
              isLast={index === visibleQueues.length - 1}
              meta={queueTimestamp}
              onPress={openQueueInExplorer}
              title={queue.title}
            />
          );
        })}
      </NexusActionList>
    );
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader title={`${activeScope.name} Dashboard`} />

        {isLoadingDashboard ? (
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              Loading packet-backed dashboard data...
            </Text>
          </NexusCard>
        ) : null}

        {loadError ? (
          <NexusCard>
            <Text className="text-sm leading-6 text-nexus-rose">{loadError}</Text>
          </NexusCard>
        ) : null}

        {localityCreated ? (
          <NexusCard tone="mint">
            <Text className={appearance.itemBodyClass}>
              {createdLocalityName} is ready. Your home locality branch has been updated.
            </Text>
          </NexusCard>
        ) : null}

        <NexusCard className="gap-4">
          <View className="flex-row flex-wrap items-start justify-between gap-4">
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Scope summary
              </Text>
              <Text className={appearance.surfaceTitleClass}>{activeScope.name}</Text>
            </View>

            <View className="flex-row flex-wrap justify-end gap-2">
              <NexusBadge label={`${activeScope.level} scope`} />
              <NexusBadge label={activeScope.relationshipLabel} />
              <NexusBadge label={`${activeScope.childIds.length} child scopes`} />
              <NexusBadge label={`${activeScope.followedScopeIds.length} followed`} />
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2.5">
            {visibleMetrics.map((metric) => (
              <NexusStatCard
                key={metric.id}
                label={metric.title}
                tone={metric.tone}
                value={metric.value}
              />
            ))}
          </View>
        </NexusCard>

        <View className="flex-row flex-wrap gap-4">
          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(visibleQueues.length, 'item')}
            onOpen={() => setActiveSection('library')}
            title="Recent activity"
          >
            {renderQueuePreviewList()}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(trustReviewPackets.length, 'item')}
            onOpen={() => setActiveSection('trust')}
            title="Trust & Review"
          >
            {renderPacketPreviewList(trustReviewPackets, 'No trust review items.')}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(discussionPreviewPackets.length, 'packet')}
            onOpen={() => setActiveSection('discussions')}
            title="Discussions"
          >
            {renderPacketPreviewList(discussionPreviewPackets, 'No discussion packets.')}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(votePreviewPackets.length, 'packet')}
            onOpen={() => setActiveSection('votes')}
            title="Votes & Decisions"
          >
            {renderPacketPreviewList(votePreviewPackets, 'No vote packets.')}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(rolePreviewPackets.length, 'packet')}
            onOpen={() => setActiveSection('roles')}
            title="Roles & Claims"
          >
            {renderPacketPreviewList(rolePreviewPackets, 'No role packets.')}
          </NexusPreviewPanel>
        </View>
      </View>
    </ScrollView>
  );
}
