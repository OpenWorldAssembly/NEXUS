/**
 * File: votes.tsx
 * Description: Renders the vote floor surface with pipeline stages and proposal previews.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusPreviewTargetParams } from '@app/components/nexus/preview';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@app/components/nexus/nexus-ui';
import {
  NEXUS_VOTE_MECHANICS,
} from '@runtime/nexus/nexus-content';
import type { NexusVotesPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusVotesPayload } from '@runtime/nexus/nexus-query-api';

/**
 * Inputs: none.
 * Output: the vote floor surface for the active scope, with public ballot visibility and disabled action cues.
 */
export default function NexusVotesPage() {
  const { activeScope, currentActorPacketId } = useNexusShell();
  const appearance = useNexusAppearance();
  const previewTargetParams = useNexusPreviewTargetParams();
  const highlightedPacketId =
    previewTargetParams.highlightPacketId ??
    previewTargetParams.focusPacketId ??
    previewTargetParams.packetId;
  const [votesPayload, setVotesPayload] = useState<NexusVotesPayload | null>(null);
  const [isLoadingVotes, setIsLoadingVotes] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVotes = async () => {
      setIsLoadingVotes(true);
      setLoadError(null);

      try {
        const nextVotesPayload = await fetchNexusVotesPayload(
          activeScope.id,
          currentActorPacketId
        );

        if (!isMounted) {
          return;
        }

        setVotesPayload(nextVotesPayload);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load packet-backed vote data.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingVotes(false);
        }
      }
    };

    void loadVotes();

    return () => {
      isMounted = false;
    };
  }, [activeScope.id, currentActorPacketId]);

  const stageCards = votesPayload?.stage_cards ?? [];
  const voteCards = votesPayload?.vote_cards ?? [];
  const voteMechanics = votesPayload?.mechanics ?? NEXUS_VOTE_MECHANICS;

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Votes"
          title={`${activeScope.name} Votes`}
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={`${stageCards.length} stages`} tone="sky" />
              <NexusBadge label={`${voteCards.length} packets`} tone="gold" />
            </View>
          }
        />

        <View className="flex-row flex-wrap gap-4">
          {stageCards.map((stage) => (
            <NexusCard
              key={stage.id}
              className="min-w-[220px] flex-1"
              tone={stage.tone}
            >
              <Text className={appearance.metricLabelClass}>{stage.title}</Text>
              <Text className={appearance.metricValueClass}>{stage.count}</Text>
              <Text className={appearance.itemBodyClass}>{stage.detail}</Text>
            </NexusCard>
          ))}
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            {isLoadingVotes ? (
              <NexusCard>
                <Text className={appearance.itemBodyClass}>
                  Loading packet-backed vote lanes...
                </Text>
              </NexusCard>
            ) : null}

            {loadError ? (
              <NexusCard className="gap-3">
                <Text className="text-sm leading-6 text-nexus-rose">
                  {loadError}
                </Text>
              </NexusCard>
            ) : null}

            {voteCards.map((voteCard) => (
              <NexusCard
                key={voteCard.packet.packet_id}
                className={`gap-4 ${
                  voteCard.packet.packet_id === highlightedPacketId
                    ? 'border-nexus-sky/70 bg-nexus-sky/10'
                    : ''
                }`}
              >
                <View className="gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.surfaceTitleClass}>{voteCard.title}</Text>
                    <NexusBadge
                      label={voteCard.status ?? voteCard.type}
                      tone="gold"
                    />
                    {voteCard.packet.packet_id === highlightedPacketId ? (
                      <NexusBadge label="Focused" tone="sky" />
                    ) : null}
                  </View>
                  <Text className={appearance.sectionBodyClass}>
                    {voteCard.summary ?? 'No packet summary available.'}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <NexusBadge label={voteCard.label} tone="rose" />
                  <NexusBadge
                    label={voteCard.packet.packet_id}
                    tone="default"
                    className="max-w-full rounded-[18px] self-start"
                    textClassName="leading-4"
                  />
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <NexusActionButton
                    label="Support petition"
                    disabled
                    featureStatusId="votes.support_petition"
                  />
                  <NexusActionButton
                    label="Object"
                    disabled
                    featureStatusId="votes.object"
                  />
                  <NexusActionButton
                    label="Compare lineages"
                    disabled
                    featureStatusId="votes.compare_lineages"
                  />
                </View>
              </NexusCard>
            ))}
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Mechanics
              </Text>
              <View className="gap-3">
                {voteMechanics.map((mechanic) => (
                  <NexusCard
                    key={mechanic}
                    className={`gap-2 p-4 ${appearance.cardInsetClass}`}
                    tone="default"
                  >
                    <Text className={appearance.itemBodyClass}>{mechanic}</Text>
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
