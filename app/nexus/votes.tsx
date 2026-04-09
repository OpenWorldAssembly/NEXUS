/**
 * File: votes.tsx
 * Description: Renders the vote floor surface with pipeline stages and proposal previews.
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
  nexusProposalPreviews,
  nexusVoteMechanics,
  nexusVoteStages,
} from '@/data/nexus/mock-nexus-data';
import { matchesScope } from '@/lib/nexus/nexus-shell';

/**
 * Inputs: none.
 * Output: the vote floor surface for the active scope, with public ballot visibility and disabled action cues.
 */
export default function NexusVotesPage() {
  const { activeScope } = useNexusShell();
  const visibleStages = nexusVoteStages.filter((stage) =>
    matchesScope(stage.scopeIds, activeScope.id),
  );
  const visibleProposals = nexusProposalPreviews.filter((proposal) =>
    matchesScope(proposal.scopeIds, activeScope.id),
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
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
          {visibleStages.map((stage) => (
            <NexusCard
              key={stage.id}
              className="min-w-[220px] flex-1"
              tone={stage.tone}
            >
              <Text className="text-sm font-semibold uppercase tracking-[2px] text-nexus-muted">
                {stage.title}
              </Text>
              <Text className="mt-3 text-4xl font-bold text-nexus-text">
                {stage.count}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-nexus-muted">
                {stage.detail}
              </Text>
            </NexusCard>
          ))}
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            {visibleProposals.map((proposal) => (
              <NexusCard key={proposal.id} className="gap-4">
                <View className="gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-2xl font-bold text-nexus-text">
                      {proposal.title}
                    </Text>
                    <NexusBadge label={proposal.stage} tone="gold" />
                  </View>
                  <Text className="text-sm leading-7 text-nexus-muted">
                    {proposal.summary}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <NexusBadge label={proposal.votingWindow} tone="rose" />
                  <NexusBadge label={proposal.lineage} tone="default" />
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
                {nexusVoteMechanics.map((mechanic) => (
                  <NexusCard
                    key={mechanic}
                    className="gap-2 bg-white/5 p-4"
                    tone="default"
                  >
                    <Text className="text-sm leading-6 text-nexus-muted">
                      {mechanic}
                    </Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Downstream effects
              </Text>
              <Text className="text-sm leading-7 text-nexus-muted">
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
