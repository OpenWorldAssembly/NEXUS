/**
 * File: votes.tsx
 * Description: Renders the vote floor surface with pipeline stages and proposal previews.
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
  portalProposalPreviews,
  portalVoteMechanics,
  portalVoteStages,
} from '@/data/portal/mock-portal-data';
import { matchesScope } from '@/lib/portal/portal-shell';

/**
 * Inputs: none.
 * Output: the vote floor surface for the active scope, with public ballot visibility and disabled action cues.
 */
export default function PortalVotesPage() {
  const { activeScope } = usePortalShell();
  const visibleStages = portalVoteStages.filter((stage) =>
    matchesScope(stage.scopeIds, activeScope.id),
  );
  const visibleProposals = portalProposalPreviews.filter((proposal) =>
    matchesScope(proposal.scopeIds, activeScope.id),
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <PortalSectionHeader
          eyebrow="Vote floor"
          title={`${activeScope.shortLabel} civic voting lane`}
          description="Votes live as their own surface instead of hiding inside discussion tags. Guests can inspect public ballots, packet lineages, and visible governance mechanics."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <PortalBadge label="Quorum visible" tone="sky" />
              <PortalBadge label="Guests cannot vote yet" tone="rose" />
            </View>
          }
        />

        <View className="flex-row flex-wrap gap-4">
          {visibleStages.map((stage) => (
            <PortalCard
              key={stage.id}
              className="min-w-[220px] flex-1"
              tone={stage.tone}
            >
              <Text className="text-sm font-semibold uppercase tracking-[2px] text-portal-muted">
                {stage.title}
              </Text>
              <Text className="mt-3 text-4xl font-bold text-portal-text">
                {stage.count}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-portal-muted">
                {stage.detail}
              </Text>
            </PortalCard>
          ))}
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            {visibleProposals.map((proposal) => (
              <PortalCard key={proposal.id} className="gap-4">
                <View className="gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-2xl font-bold text-portal-text">
                      {proposal.title}
                    </Text>
                    <PortalBadge label={proposal.stage} tone="gold" />
                  </View>
                  <Text className="text-sm leading-7 text-portal-muted">
                    {proposal.summary}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <PortalBadge label={proposal.votingWindow} tone="rose" />
                  <PortalBadge label={proposal.lineage} tone="default" />
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <PortalActionButton label="Support petition" disabled />
                  <PortalActionButton label="Object" disabled />
                  <PortalActionButton label="Compare lineages" disabled />
                </View>
              </PortalCard>
            ))}
          </View>

          <View className="flex-1 gap-4">
            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Governance mechanics in view
              </Text>
              <View className="gap-3">
                {portalVoteMechanics.map((mechanic) => (
                  <PortalCard
                    key={mechanic}
                    className="gap-2 bg-white/5 p-4"
                    tone="default"
                  >
                    <Text className="text-sm leading-6 text-portal-muted">
                      {mechanic}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>

            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Downstream effects
              </Text>
              <Text className="text-sm leading-7 text-portal-muted">
                Proposal detail pages in later slices should link directly into
                related discussions, mission implications, amendment history,
                objections, and scope propagation. This slice blocks those ideas in
                with visible placeholders rather than deep workflow logic.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <PortalBadge label="Amendment history later" />
                <PortalBadge label="Delegation later" />
                <PortalBadge label="Propagation compare later" />
              </View>
            </PortalCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
