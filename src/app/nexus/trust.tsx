/**
 * File: trust.tsx
 * Description: Renders the scoped trust workspace, including legitimacy state, assembly claims, and role claims.
 */

import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type { NexusTrustPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusTrustPayload } from '@runtime/nexus/nexus-query-api';

function formatTrustStage(stage: NexusTrustPayload['trust_stage']): string {
  return stage.replace(/_/g, ' ');
}

export default function NexusTrustPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { activeScope, currentActorPacketId, currentActorLabel } = useNexusShell();
  const { currentMode, isAuthenticated } = useIdentityShell();
  const [trustPayload, setTrustPayload] = useState<NexusTrustPayload | null>(null);
  const [isLoadingTrust, setIsLoadingTrust] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTrustPayload = async () => {
      setIsLoadingTrust(true);
      setErrorMessage(null);

      try {
        const nextTrustPayload = await fetchNexusTrustPayload({
          scopeId: activeScope.id,
          actorPacketId: currentActorPacketId,
        });

        if (!isMounted) {
          return;
        }

        setTrustPayload(nextTrustPayload);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load trust data.'
        );
      } finally {
        if (isMounted) {
          setIsLoadingTrust(false);
        }
      }
    };

    void loadTrustPayload();

    return () => {
      isMounted = false;
    };
  }, [activeScope.id, currentActorPacketId]);

  const roleCards = trustPayload?.role_cards ?? [];
  const assemblyClaims = trustPayload?.assembly_claims ?? [];
  const isClaimedIdentity = currentMode === 'claimed' && isAuthenticated;

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Trust"
          title={`${activeScope.name} Trust`}
          description="Trust is scoped, inspectable, and evidence-based. This surface shows legitimacy posture, association evidence, and claimed roles for the current scope lens."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge
                label={
                  trustPayload
                    ? formatTrustStage(trustPayload.trust_stage)
                    : 'loading'
                }
                tone="mint"
              />
              <NexusBadge label={currentActorLabel} tone="sky" />
            </View>
          }
        />

        {errorMessage ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>{errorMessage}</Text>
          </NexusCard>
        ) : null}

        {isLoadingTrust ? (
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              Loading scoped trust posture...
            </Text>
          </NexusCard>
        ) : null}

        <View className="flex-row flex-wrap gap-4">
          <NexusCard className="min-w-[220px] flex-1" tone="mint">
            <Text className={appearance.metricLabelClass}>Trust stage</Text>
            <Text className={appearance.metricValueClass}>
              {trustPayload ? formatTrustStage(trustPayload.trust_stage) : '-'}
            </Text>
            <Text className={appearance.itemBodyClass}>
              Derived from scope-local association evidence, claimed roles, and role-support thresholds.
            </Text>
          </NexusCard>
          <NexusCard className="min-w-[220px] flex-1" tone="sky">
            <Text className={appearance.metricLabelClass}>Posting gate</Text>
            <Text className={appearance.metricValueClass}>
              {trustPayload?.policy_snapshot.posting_gate.replace(/_/g, ' ') ?? '-'}
            </Text>
            <Text className={appearance.itemBodyClass}>
              Posting is currently {trustPayload?.can_post ? 'available' : 'restricted'} for this scope lens.
            </Text>
          </NexusCard>
          <NexusCard className="min-w-[220px] flex-1" tone="gold">
            <Text className={appearance.metricLabelClass}>Voting gate</Text>
            <Text className={appearance.metricValueClass}>
              {trustPayload?.policy_snapshot.voting_gate.replace(/_/g, ' ') ?? '-'}
            </Text>
            <Text className={appearance.itemBodyClass}>
              Voting is currently {trustPayload?.can_vote ? 'available' : 'restricted'} for this scope lens.
            </Text>
          </NexusCard>
        </View>

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Scope posture
              </Text>
              <Text className={appearance.surfaceTitleClass}>
                {trustPayload?.scope.name ?? activeScope.name}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge
                  label={`Association threshold ${trustPayload?.policy_snapshot.association_support_threshold ?? 0}`}
                />
                <NexusBadge
                  label={`Role threshold ${trustPayload?.policy_snapshot.role_support_threshold ?? 0}`}
                />
                <NexusBadge
                  label={trustPayload?.scope.level === 'personal' ? 'Personal scope' : 'Assembly scope'}
                  tone="default"
                />
              </View>
              <Text className={appearance.itemBodyClass}>
                {trustPayload?.scope.description ?? activeScope.description}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label={isClaimedIdentity ? 'Identity security' : 'Sign in'}
                  variant="primary"
                  onPress={() =>
                    router.push(
                      isClaimedIdentity
                        ? '/nexus/identity/security'
                        : '/nexus/identity/sign-in'
                    )
                  }
                />
                <NexusActionButton
                  label="Open account tools"
                  onPress={() => router.push('/nexus/account')}
                />
                <NexusActionButton
                  label="Open roles"
                  onPress={() => router.push('/nexus/roles' as Href)}
                />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Assembly association evidence
              </Text>
              {assemblyClaims.length === 0 ? (
                <Text className={appearance.itemBodyClass}>
                  No assembly association claims are active in this scope yet.
                </Text>
              ) : (
                <View className="gap-3">
                  {assemblyClaims.map((claim) => (
                    <NexusCard
                      key={claim.claim_packet_id}
                      className={`gap-3 p-4 ${appearance.cardInsetClass}`}
                    >
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className={appearance.itemTitleClass}>
                          {claim.assembly_name}
                        </Text>
                        <NexusBadge
                          label={claim.status === 'active' ? 'Active claim' : 'Cleared'}
                          tone={claim.status === 'active' ? 'mint' : 'default'}
                        />
                      </View>
                      <Text className={appearance.itemBodyClass}>
                        {claim.note ?? 'No note added to this claim yet.'}
                      </Text>
                      <View className="flex-row flex-wrap gap-3">
                        <NexusBadge
                          label={`${claim.supported_by_other_count} outside supports`}
                          tone="sky"
                        />
                        <NexusBadge
                          label={
                            claim.is_self_issued_only
                              ? 'Self-issued only'
                              : 'Supported by others'
                          }
                          tone={claim.is_self_issued_only ? 'gold' : 'mint'}
                        />
                      </View>
                    </NexusCard>
                  ))}
                </View>
              )}
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Claimed roles
              </Text>
              <Text className={appearance.itemBodyClass}>
                Roles are reviewed from the dedicated Roles workspace. Trust keeps the actor-centric summary here.
              </Text>
              <View className="gap-3">
                {roleCards.map((roleCard) => (
                  <NexusCard
                    key={roleCard.role_packet_id}
                    className={`gap-3 p-4 ${appearance.cardInsetClass}`}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>{roleCard.title}</Text>
                      <NexusBadge
                        label={roleCard.stage.replace(/_/g, ' ')}
                        tone={roleCard.stage === 'role_eligible' ? 'mint' : 'gold'}
                      />
                    </View>
                    <Text className={appearance.itemBodyClass}>
                      {roleCard.summary ?? 'No summary available yet.'}
                    </Text>
                    {roleCard.responsibility_markdown ? (
                      <Text className={appearance.itemBodyClass}>
                        {roleCard.responsibility_markdown}
                      </Text>
                    ) : null}
                    <View className="flex-row flex-wrap gap-3">
                      <NexusBadge
                        label={`${roleCard.support_count} supports`}
                        tone="mint"
                      />
                      <NexusBadge
                        label={`${roleCard.dispute_count} disputes`}
                        tone="rose"
                      />
                      <NexusBadge label={roleCard.role_kind} tone="default" />
                      <NexusBadge
                        label={roleCard.is_claimed ? 'Claimed by you' : 'Not claimed'}
                        tone={roleCard.is_claimed ? 'mint' : 'default'}
                      />
                    </View>
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
