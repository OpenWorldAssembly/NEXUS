/**
 * File: dashboard.tsx
 * Description: Renders the guest dashboard with scope-aware civic queues, highlights, and recommendations.
 */
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
} from '@/components/nexus/nexus-ui';
import {
  nexusDashboardMetrics,
  nexusDashboardQueues,
  nexusPacketPreviews,
} from '@/data/nexus/mock-nexus-data';
import { matchesScope } from '@/lib/nexus/nexus-shell';

/**
 * Inputs: none.
 * Output: the main nexus dashboard surface for the currently selected scope.
 */
export default function NexusDashboardPage() {
  const { activeScope, navigationMode, setActiveSection } = useNexusShell();
  const visibleMetrics = nexusDashboardMetrics.filter((metric) =>
    matchesScope(metric.scopeIds, activeScope.id),
  );
  const visibleQueues = nexusDashboardQueues.filter((queue) =>
    matchesScope(queue.scopeIds, activeScope.id),
  );
  const recommendedPackets = nexusPacketPreviews.filter((packet) =>
    matchesScope(packet.scopeIds, activeScope.id),
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <NexusSectionHeader
          eyebrow="Global guest dashboard"
          title={`${activeScope.shortLabel} civic control panel`}
          description={`This first nexus slice keeps the same routes in both navigation modes. You are currently in ${navigationMode}-first view, looking through the ${activeScope.name} lens.`}
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={activeScope.badge} tone="sky" />
              <NexusBadge label={activeScope.publicLobbyLabel} tone="mint" />
            </View>
          }
        />

        <View className="flex-row flex-wrap gap-4">
          {visibleMetrics.map((metric) => (
            <NexusCard
              key={metric.id}
              className="min-w-[220px] flex-1"
              tone={metric.tone}
            >
              <Text className="text-sm font-semibold uppercase tracking-[2px] text-nexus-muted">
                {metric.title}
              </Text>
              <Text className="mt-3 text-4xl font-bold text-nexus-text">
                {metric.value}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-nexus-muted">
                {metric.detail}
              </Text>
            </NexusCard>
          ))}
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Current scope summary
                </Text>
                <Text className="text-2xl font-bold text-nexus-text">
                  {activeScope.name}
                </Text>
                <Text className="text-sm leading-6 text-nexus-muted">
                  {activeScope.description}
                </Text>
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
                    className="gap-2 bg-white/5 p-4"
                    tone={queue.tone}
                  >
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="flex-1 gap-1">
                        <Text className="text-base font-semibold text-nexus-text">
                          {queue.title}
                        </Text>
                        <Text className="text-sm leading-6 text-nexus-muted">
                          {queue.detail}
                        </Text>
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
                Recommended packet review
              </Text>
              <View className="gap-3">
                {recommendedPackets.slice(0, 4).map((packet) => (
                  <NexusCard key={packet.id} className="gap-2 bg-white/5 p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-base font-semibold text-nexus-text">
                        {packet.title}
                      </Text>
                      <NexusBadge label={packet.type} tone="default" />
                    </View>
                    <Text className="text-sm leading-6 text-nexus-muted">
                      {packet.summary}
                    </Text>
                    <Text className="text-xs uppercase tracking-[2px] text-nexus-muted">
                      {packet.lineage}
                    </Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Rollout boundary
              </Text>
              <Text className="text-sm leading-7 text-nexus-muted">
                This first nexus block focuses on dashboard, discussions, votes,
                library, and account. Assemblies, map browsing, full chat, and
                protected spaces remain visible in the shell as deferred surfaces.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label="Guest-default nexus" tone="sky" />
                <NexusBadge label="Visitor lobby posting only" tone="mint" />
                <NexusBadge label="No auth yet" tone="gold" />
              </View>
            </NexusCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
