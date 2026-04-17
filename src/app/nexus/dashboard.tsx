/**
 * File: dashboard.tsx
 * Description: Renders the guest dashboard with scope-aware civic queues, highlights, and recommendations.
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
import type { NexusDashboardPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusDashboardPayload } from '@runtime/nexus/nexus-query-api';

/**
 * Inputs: none.
 * Output: the main nexus dashboard surface for the currently selected scope.
 */
export default function NexusDashboardPage() {
  const { activeScope, setActiveSection } = useNexusShell();
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
        const nextDashboardPayload = await fetchNexusDashboardPayload(activeScope.id);

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
  }, [activeScope.id]);

  const visibleMetrics = dashboardPayload?.metrics ?? [];
  const visibleQueues = dashboardPayload?.queue ?? [];
  const recommendedPackets = dashboardPayload?.recommended_packets ?? [];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Dashboard"
          title={`${activeScope.name} Dashboard`}
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={`${visibleMetrics.length} metrics`} tone="sky" />
              <NexusBadge label={`${visibleQueues.length} queues`} tone="mint" />
            </View>
          }
        />

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

        <View className="flex-row flex-wrap gap-4">
          {visibleMetrics.map((metric) => (
            <NexusCard
              key={metric.id}
              className="min-w-[220px] flex-1"
              tone={metric.tone}
            >
              <Text className={appearance.metricLabelClass}>{metric.title}</Text>
              <Text className={appearance.metricValueClass}>{metric.value}</Text>
              <Text className={appearance.itemBodyClass}>{metric.detail}</Text>
            </NexusCard>
          ))}
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Scope summary
                </Text>
                <Text className={appearance.surfaceTitleClass}>{activeScope.name}</Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label={`${activeScope.stats.members} members`} />
                <NexusBadge label={`${activeScope.stats.activeVotes} active votes`} />
                <NexusBadge label={`${activeScope.stats.hotDiscussions} hot discussions`} />
                <NexusBadge label={`${activeScope.stats.missions} mission signals`} />
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label="Open discussions"
                  onPress={() => setActiveSection('discussions')}
                />
                <NexusActionButton
                  label="Open vote floor"
                  onPress={() => setActiveSection('votes')}
                />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Aggregate queues
              </Text>
              <View className="gap-3">
                {visibleQueues.map((queue) => (
                  <NexusCard
                    key={queue.id}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                    tone={queue.tone}
                  >
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="flex-1 gap-1">
                        <Text className={appearance.itemTitleClass}>{queue.title}</Text>
                        <Text className={appearance.itemBodyClass}>{queue.detail}</Text>
                      </View>
                      <NexusBadge label={queue.stat} tone={queue.tone} />
                    </View>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Packet review
              </Text>
              <View className="gap-3">
                {recommendedPackets.slice(0, 4).map((packet) => (
                  <NexusCard
                    key={packet.packet.packet_id}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className={appearance.itemTitleClass}>{packet.title}</Text>
                      <NexusBadge label={packet.family} tone="default" />
                    </View>
                    <Text className={appearance.itemBodyClass}>
                      {packet.summary ?? 'No packet summary available.'}
                    </Text>
                    <Text className={appearance.itemMetaClass}>
                      {packet.status ?? packet.label}
                    </Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
