/**
 * File: votes.tsx
 * Description: Renders the vote floor surface with pipeline stages and proposal previews.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@/components/nexus/nexus-ui';
import {
  NEXUS_VOTE_MECHANICS,
} from '@/lib/nexus/nexus-content';
import type { NexusVotesPayload } from '@/lib/nexus/nexus-api-types';
import { fetchNexusVotesPayload } from '@/lib/nexus/nexus-query-api';

/**
 * Inputs: none.
 * Output: the vote floor surface for the active scope, with public ballot visibility and disabled action cues.
 */
export default function NexusVotesPage() {
  const { activeScope } = useNexusShell();
  const appearance = useNexusAppearance();
  const [votesPayload, setVotesPayload] = useState<NexusVotesPayload | null>(null);
  const [isLoadingVotes, setIsLoadingVotes] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVotes = async () => {
      setIsLoadingVotes(true);
      setLoadError(null);

      try {
        const nextVotesPayload = await fetchNexusVotesPayload(activeScope.id);

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
  }, [activeScope.id]);

  const stageCards = votesPayload?.stage_cards ?? [];
  const voteCards = votesPayload?.vote_cards ?? [];
  const voteMechanics = votesPayload?.mechanics ?? NEXUS_VOTE_MECHANICS;

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Vote floor"
          title={`${activeScope.shortLabel} civic voting lane`}
          description="Votes live as their own surface instead of hiding inside discussion tags. Guests can inspect public ballots, packet lineages, and visible governance mechanics."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label="Quorum visible" tone="sky" />
              <NexusBadge label="Guests cannot vote yet" tone="rose" />
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
              <NexusCard key={voteCard.packet.packet_id} className="gap-4">
                <View className="gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.surfaceTitleClass}>{voteCard.title}</Text>
                    <NexusBadge
                      label={voteCard.status ?? voteCard.family}
                      tone="gold"
                    />
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
                  <NexusActionButton label="Support petition" disabled />
                  <NexusActionButton label="Object" disabled />
                  <NexusActionButton label="Compare lineages" disabled />
                </View>
              </NexusCard>
            ))}
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Governance mechanics in view
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

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Downstream effects
              </Text>
              <Text className={appearance.sectionBodyClass}>
                Proposal detail pages in later slices should link directly into
                related discussions, mission implications, amendment history,
                objections, and scope propagation. This slice blocks those ideas in
                with visible placeholders rather than deep workflow logic.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label="Amendment history later" />
                <NexusBadge label="Delegation later" />
                <NexusBadge label="Propagation compare later" />
              </View>
            </NexusCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
