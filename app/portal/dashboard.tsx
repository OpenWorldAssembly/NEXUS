/**
 * File: dashboard.tsx
 * Description: Renders the guest dashboard with scope-aware civic queues, highlights, and recommendations.
 */
import { ScrollView, Text, View } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import {
  PortalActionButton,
  PortalBadge,
  PortalCard,
  PortalSectionHeader,
} from '@/components/portal/portal-ui';
import {
  portalDashboardMetrics,
  portalDashboardQueues,
  portalPacketPreviews,
} from '@/data/portal/mock-portal-data';
import { matchesScope } from '@/lib/portal/portal-shell';

/**
 * Inputs: none.
 * Output: the main portal dashboard surface for the currently selected scope.
 */
export default function PortalDashboardPage() {
  const { activeScope, navigationMode, setActiveSection } = usePortalShell();
  const visibleMetrics = portalDashboardMetrics.filter((metric) =>
    matchesScope(metric.scopeIds, activeScope.id),
  );
  const visibleQueues = portalDashboardQueues.filter((queue) =>
    matchesScope(queue.scopeIds, activeScope.id),
  );
  const recommendedPackets = portalPacketPreviews.filter((packet) =>
    matchesScope(packet.scopeIds, activeScope.id),
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <PortalSectionHeader
          eyebrow="Global guest dashboard"
          title={`${activeScope.shortLabel} civic control panel`}
          description={`This first portal slice keeps the same routes in both navigation modes. You are currently in ${navigationMode}-first view, looking through the ${activeScope.name} lens.`}
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <PortalBadge label={activeScope.badge} tone="sky" />
              <PortalBadge label={activeScope.publicLobbyLabel} tone="mint" />
            </View>
          }
        />

        <View className="flex-row flex-wrap gap-4">
          {visibleMetrics.map((metric) => (
            <PortalCard
              key={metric.id}
              className="min-w-[220px] flex-1"
              tone={metric.tone}
            >
              <Text className="text-sm font-semibold uppercase tracking-[2px] text-portal-muted">
                {metric.title}
              </Text>
              <Text className="mt-3 text-4xl font-bold text-portal-text">
                {metric.value}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-portal-muted">
                {metric.detail}
              </Text>
            </PortalCard>
          ))}
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <PortalCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                  Current scope summary
                </Text>
                <Text className="text-2xl font-bold text-portal-text">
                  {activeScope.name}
                </Text>
                <Text className="text-sm leading-6 text-portal-muted">
                  {activeScope.description}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-3">
                <PortalBadge label={`${activeScope.stats.members} members`} />
                <PortalBadge label={`${activeScope.stats.activeVotes} active votes`} />
                <PortalBadge label={`${activeScope.stats.hotDiscussions} hot discussions`} />
                <PortalBadge label={`${activeScope.stats.missions} mission signals`} />
              </View>

              <View className="flex-row flex-wrap gap-3">
                <PortalActionButton
                  label="Open discussions"
                  onPress={() => setActiveSection('discussions')}
                />
                <PortalActionButton
                  label="Open vote floor"
                  onPress={() => setActiveSection('votes')}
                />
              </View>
            </PortalCard>

            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Aggregate queues
              </Text>
              <View className="gap-3">
                {visibleQueues.map((queue) => (
                  <PortalCard
                    key={queue.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={queue.tone}
                  >
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="flex-1 gap-1">
                        <Text className="text-base font-semibold text-portal-text">
                          {queue.title}
                        </Text>
                        <Text className="text-sm leading-6 text-portal-muted">
                          {queue.detail}
                        </Text>
                      </View>
                      <PortalBadge label={queue.stat} tone={queue.tone} />
                    </View>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>
          </View>

          <View className="flex-1 gap-4">
            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Recommended packet review
              </Text>
              <View className="gap-3">
                {recommendedPackets.slice(0, 4).map((packet) => (
                  <PortalCard key={packet.id} className="gap-2 bg-white/5 p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-base font-semibold text-portal-text">
                        {packet.title}
                      </Text>
                      <PortalBadge label={packet.type} tone="default" />
                    </View>
                    <Text className="text-sm leading-6 text-portal-muted">
                      {packet.summary}
                    </Text>
                    <Text className="text-xs uppercase tracking-[2px] text-portal-muted">
                      {packet.lineage}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>

            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Rollout boundary
              </Text>
              <Text className="text-sm leading-7 text-portal-muted">
                This first portal block focuses on dashboard, discussions, votes,
                library, and account. Assemblies, map browsing, full chat, and
                protected spaces remain visible in the shell as deferred surfaces.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <PortalBadge label="Guest-default portal" tone="sky" />
                <PortalBadge label="Visitor lobby posting only" tone="mint" />
                <PortalBadge label="No auth yet" tone="gold" />
              </View>
            </PortalCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
