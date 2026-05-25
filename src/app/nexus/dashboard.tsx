/**
 * File: dashboard.tsx
 * Description: Renders the guest dashboard with scope totals and function preview sections.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { type NexusActionMenuItem, type NexusCardBadge } from '@app/components/nexus/ui/cards/action-card';
import { NexusFocusedPacketSection } from '@app/components/nexus/focus';
import {
  createNexusPacketActionMenuItems,
  getNexusPacketActionProjectionKey,
  useNexusPacketActions,
} from '@app/components/nexus/packet-actions';
import { NexusActionList, NexusActionListItem } from '@app/components/nexus/ui/actions/action-list';
import { NexusModalShell } from '@app/components/nexus/ui/overlays';
import {
  NexusPreviewPanel,
  NexusStatCard,
  getNexusPreviewTargetForPacketProjection,
  resolveNexusPreviewTargetHref,
  type NexusPreviewTarget,
} from '@app/components/nexus/preview';
import { getDashboardBadges } from '@app/components/nexus/dashboard/nexus-dashboard-badges';
import {
  formatDashboardTimestamp,
  getDashboardPreviewMeta,
} from '@app/components/nexus/dashboard/nexus-dashboard-format';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusBadge,
  NexusCard,
  NexusActionButton,
  useNexusAppearance,
  NexusSectionHeader,
} from '@app/components/nexus/ui';
import type { NexusPacketCardProjection } from '@core/contracts';
import type {
  NexusDashboardPayload,
  NexusPacketVerificationActionPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchNexusDashboardPayload,
  runNexusPacketVerification,
} from '@runtime/nexus/nexus-query-api';

/**
 * Inputs: none.
 * Output: the main nexus dashboard surface for the currently selected scope.
 */
export default function NexusDashboardPage() {
  const params = useLocalSearchParams<{
    locality_created?: string | string[];
    locality_name?: string | string[];
  }>();
  const router = useRouter();
  const {
    activeScope,
    currentActorPacketId,
    openExplorer,
    openPacketInExplorer,
    setActiveSection,
  } = useNexusShell();
  const appearance = useNexusAppearance();
  const [dashboardPayload, setDashboardPayload] =
    useState<NexusDashboardPayload | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusedPreviewPacketIds, setFocusedPreviewPacketIds] = useState<
    Partial<Record<NexusPreviewTarget['surface'], string>>
  >({});
  const [verificationModal, setVerificationModal] =
    useState<NexusPacketVerificationActionPayload | null>(null);

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

  const {
    visibleMetrics,
    visibleQueues,
    recentActivityPackets,
    discussionPreviewPackets,
    rolePreviewPackets,
    trustReviewPackets,
    votePreviewPackets,
    allPreviewPackets,
  } = useMemo(() => {
    const metrics = dashboardPayload?.metrics ?? [];
    const queues = dashboardPayload?.queue ?? [];
    const recentPackets =
      dashboardPayload?.recent_activity_packets ?? [];
    const discussionPackets = dashboardPayload?.discussion_preview_packets ?? [];
    const rolePackets = dashboardPayload?.role_preview_packets ?? [];
    const trustPackets =
      dashboardPayload?.trust_review_packets ??
      dashboardPayload?.recommended_packets ??
      [];
    const votePackets = dashboardPayload?.vote_preview_packets ?? [];

    return {
      visibleMetrics: metrics,
      visibleQueues: queues,
      recentActivityPackets: recentPackets,
      discussionPreviewPackets: discussionPackets,
      rolePreviewPackets: rolePackets,
      trustReviewPackets: trustPackets,
      votePreviewPackets: votePackets,
      allPreviewPackets: [
        ...recentPackets,
        ...trustPackets,
        ...discussionPackets,
        ...votePackets,
        ...rolePackets,
      ],
    };
  }, [dashboardPayload]);
  const packetActionsRequest = useMemo(
    () => ({
      scope_id: activeScope.id,
      viewer_actor_packet_id: currentActorPacketId,
      surface: 'dashboard' as const,
      targets: allPreviewPackets.map((packet) => {
        const previewTarget = getNexusPreviewTargetForPacketProjection(packet);

        return {
          packet_id: packet.packet.packet_id,
          revision_id: packet.revision.revision_id,
          type: packet.type,
          label: packet.label,
          title: packet.title,
          summary: packet.summary,
          preferred_surface: previewTarget.surface,
        };
      }),
    }),
    [activeScope.id, allPreviewPackets, currentActorPacketId],
  );
  const packetActionsState = useNexusPacketActions(packetActionsRequest);
  const localityCreated =
    Array.isArray(params.locality_created)
      ? params.locality_created[0] === '1'
      : params.locality_created === '1';
  const createdLocalityName =
    (Array.isArray(params.locality_name)
      ? params.locality_name[0]
      : params.locality_name) ?? activeScope.name;

  const formatVerificationStatus = (
    status: NexusPacketVerificationActionPayload['status'] | null | undefined,
  ): string => {
    switch (status) {
      case 'trusted_signer':
        return 'Locally validated';
      case 'unknown_signer':
        return 'Signer unavailable locally';
      case 'signature_invalid':
        return 'Invalid signature';
      case 'canonicalization_mismatch':
        return 'Canonicalization mismatch';
      case 'unsigned':
        return 'Unsigned';
      case 'signature_valid':
        return 'Signature valid';
      default:
        return 'Unknown';
    }
  };

  const focusPacketInPreviewSurface = (
    surface: NexusPreviewTarget['surface'],
    packetId: string,
  ) => {
    setFocusedPreviewPacketIds((currentFocusedPacketIds) => ({
      ...currentFocusedPacketIds,
      [surface]: packetId,
    }));
  };

  const clearPacketFocusInPreviewSurface = (surface: NexusPreviewTarget['surface']) => {
    setFocusedPreviewPacketIds((currentFocusedPacketIds) => {
      if (!currentFocusedPacketIds[surface]) {
        return currentFocusedPacketIds;
      }

      const nextFocusedPacketIds = { ...currentFocusedPacketIds };
      delete nextFocusedPacketIds[surface];
      return nextFocusedPacketIds;
    });
  };

  const openPreviewTarget = (
    target: NexusPreviewTarget,
    fallbackExplorerInput?: Parameters<typeof openPacketInExplorer>[0],
  ) => {
    const targetHref = resolveNexusPreviewTargetHref(target);

    if (targetHref) {
      router.push(targetHref as Href);
      return;
    }

    if (fallbackExplorerInput) {
      openPacketInExplorer(fallbackExplorerInput);
    }
  };

  const getPacketBadges = (packet: NexusPacketCardProjection): NexusCardBadge[] =>
    getDashboardBadges({
      status: packet.status ?? packet.label,
      verification: packet.verification,
    });

  const getDashboardPacketActions = (
    packet: NexusPacketCardProjection,
    surface: NexusPreviewTarget['surface'],
    options: { isFocused?: boolean } = {},
  ): NexusActionMenuItem[] => {
    const projection =
      packetActionsState.actionsByTargetKey[
        getNexusPacketActionProjectionKey({
          packetId: packet.packet.packet_id,
          preferredSurface: surface,
        })
      ] ?? packetActionsState.actionsByPacketId[packet.packet.packet_id];

    return createNexusPacketActionMenuItems({
      packet,
      projection,
      navigateToHref: (href) => router.push(href as Href),
      openExplorer,
      openPacketInExplorer,
      onRunVerificationAction: async ({ packetId }) => {
        try {
          const payload = await runNexusPacketVerification({
            packet_id: packetId,
          });

          setVerificationModal(payload);
          const nextDashboardPayload = await fetchNexusDashboardPayload(
            activeScope.id,
            currentActorPacketId
          );

          setDashboardPayload(nextDashboardPayload);
          return payload;
        } catch (error) {
          setLoadError(
            error instanceof Error ? error.message : 'Unable to validate packet.'
          );
        }
      },
    }).map((action) => {
      if (action.id !== 'packet.focus') {
        return action;
      }

      if (options.isFocused) {
        return {
          ...action,
          label: 'Dismiss focus',
          tone: 'muted',
          onSelect: () => clearPacketFocusInPreviewSurface(surface),
        };
      }

      return {
        ...action,
        label: 'Focus here',
        onSelect: () =>
          focusPacketInPreviewSurface(surface, packet.packet.packet_id),
      };
    });
  };

  const renderPacketPreviewRow = (
    packet: NexusPacketCardProjection,
    index: number,
    packets: NexusPacketCardProjection[],
    surface?: NexusPreviewTarget['surface'],
  ) => {
    const packetTimestamp = formatDashboardTimestamp(packet.created_at);
    const previewTarget = getNexusPreviewTargetForPacketProjection(packet, { surface });
    const openPacket = () => openPreviewTarget(previewTarget, {
      packetId: packet.packet.packet_id,
      preferredRevisionId: packet.revision.revision_id,
      titleSnapshot: packet.title,
      seedSummary: {
        type: packet.type,
        label: packet.label,
        summary: packet.summary,
      },
    });

    return (
      <NexusActionListItem
        key={packet.packet.packet_id}
        accessibilityLabel={`Open ${packet.title} in ${previewTarget.surface}`}
        actions={getDashboardPacketActions(packet, previewTarget.surface)}
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

  const renderPacketPreviewList = (
    packets: NexusPacketCardProjection[],
    emptyLabel: string,
    surface: NexusPreviewTarget['surface'] = 'library',
  ) => {
    if (packets.length === 0) {
      return <Text className={appearance.itemBodyClass}>{emptyLabel}</Text>;
    }

    const focusedPacketId = focusedPreviewPacketIds[surface] ?? null;
    const focusedPacket =
      focusedPacketId === null
        ? null
        : packets.find((packet) => packet.packet.packet_id === focusedPacketId) ?? null;
    const focusedPacketTimestamp = focusedPacket
      ? formatDashboardTimestamp(focusedPacket.created_at)
      : null;
    const focusedPacketTarget = focusedPacket
      ? getNexusPreviewTargetForPacketProjection(focusedPacket, { surface })
      : null;

    return (
      <View className="gap-3">
        {focusedPacket && focusedPacketTarget ? (
          <NexusFocusedPacketSection
            actions={getDashboardPacketActions(focusedPacket, surface, {
              isFocused: true,
            })}
            badges={getPacketBadges(focusedPacket)}
            detail={focusedPacket.summary ?? 'No packet summary available.'}
            meta={focusedPacketTimestamp}
            onPress={() =>
              openPreviewTarget(focusedPacketTarget, {
                packetId: focusedPacket.packet.packet_id,
                preferredRevisionId: focusedPacket.revision.revision_id,
                titleSnapshot: focusedPacket.title,
                seedSummary: {
                  type: focusedPacket.type,
                  label: focusedPacket.label,
                  summary: focusedPacket.summary,
                },
              })
            }
            title={focusedPacket.title}
          />
        ) : null}

        <NexusActionList>
          {packets.map((packet, index, allPackets) =>
            renderPacketPreviewRow(packet, index, allPackets, surface),
          )}
        </NexusActionList>
      </View>
    );
  };

  const renderQueuePreviewList = () => {
    if (visibleQueues.length === 0) {
      return <Text className={appearance.itemBodyClass}>No recent activity.</Text>;
    }

    return (
      <NexusActionList>
        {visibleQueues.map((queue, index) => {
          const queueTimestamp = formatDashboardTimestamp(queue.created_at);
          const queueExplorerInput = {
            packetId: queue.id,
            titleSnapshot: queue.title,
            seedSummary: {
              type: null,
              label: queue.stat,
              summary: queue.detail,
            },
          };
          const openQueueInExplorer = () => openPacketInExplorer(queueExplorerInput);
          const openQueueTarget = () =>
            openPreviewTarget(
              {
                surface: 'library',
                packetId: queue.id,
                focusPacketId: queue.id,
                highlightPacketId: queue.id,
              },
              queueExplorerInput,
            );

          return (
            <NexusActionListItem
              key={queue.id}
              accessibilityLabel={`Open ${queue.title} in Library`}
              actions={[
                {
                  id: 'open-library',
                  label: 'Open in Library',
                  onSelect: openQueueTarget,
                },
                {
                  id: 'open-explorer',
                  label: 'Open in Explorer',
                  onSelect: openQueueInExplorer,
                },
              ]}
              actionMenuAlign={index >= 2 ? 'bottom' : 'top'}
              badges={getDashboardBadges({ status: queue.stat })}
              detail={queue.detail}
              isLast={index === visibleQueues.length - 1}
              meta={queueTimestamp}
              onPress={openQueueTarget}
              title={queue.title}
            />
          );
        })}
      </NexusActionList>
    );
  };

  return (
    <>
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
            meta={getDashboardPreviewMeta(
              recentActivityPackets.length || visibleQueues.length,
              'item'
            )}
            onOpen={() => setActiveSection('library')}
            title="Recent activity"
          >
            {recentActivityPackets.length > 0
              ? renderPacketPreviewList(
                  recentActivityPackets,
                  'No recent activity.',
                  'library'
                )
              : renderQueuePreviewList()}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(trustReviewPackets.length, 'item')}
            onOpen={() => setActiveSection('trust')}
            title="Trust & Review"
          >
            {renderPacketPreviewList(
              trustReviewPackets,
              'No trust review items.',
              'trust',
            )}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(discussionPreviewPackets.length, 'packet')}
            onOpen={() => setActiveSection('discussions')}
            title="Discussions"
          >
            {renderPacketPreviewList(
              discussionPreviewPackets,
              'No discussion packets.',
              'discussions',
            )}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(votePreviewPackets.length, 'packet')}
            onOpen={() => setActiveSection('votes')}
            title="Votes & Decisions"
          >
            {renderPacketPreviewList(
              votePreviewPackets,
              'No vote packets.',
              'votes',
            )}
          </NexusPreviewPanel>

          <NexusPreviewPanel
            meta={getDashboardPreviewMeta(rolePreviewPackets.length, 'packet')}
            onOpen={() => setActiveSection('roles')}
            title="Roles & Claims"
          >
            {renderPacketPreviewList(
              rolePreviewPackets,
              'No role packets.',
              'roles',
            )}
          </NexusPreviewPanel>
        </View>
      </View>
    </ScrollView>
    <NexusModalShell
      onClose={() => setVerificationModal(null)}
      visible={verificationModal !== null}
    >
      <Text className={appearance.surfaceTitleClass}>
        {verificationModal?.title ?? 'Packet validation'}
      </Text>
      <Text className={appearance.itemBodyClass}>
        {verificationModal?.summary ?? ''}
      </Text>
      <Text className={appearance.itemMetaClass}>
        Status: {formatVerificationStatus(verificationModal?.status)}
      </Text>
      <Text className={appearance.itemMetaClass}>
        Validated at: {verificationModal?.validated_at ?? 'unknown'}
      </Text>
      {verificationModal?.warnings.length ? (
        <View className="gap-1">
          {verificationModal.warnings.map((warning) => (
            <Text key={warning} className={appearance.itemBodyClass}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
      <View className="flex-row flex-wrap justify-end gap-3">
        <NexusActionButton
          label="Dismiss"
          variant="ghost"
          onPress={() => setVerificationModal(null)}
        />
        <NexusActionButton
          label="Open validation report"
          variant="primary"
          onPress={() => {
            if (!verificationModal) {
              return;
            }

            setVerificationModal(null);
            openPacketInExplorer({
              packetId: verificationModal.packet_id,
              activePrimaryTab: 'verification',
            });
          }}
        />
      </View>
    </NexusModalShell>
    </>
  );
}
