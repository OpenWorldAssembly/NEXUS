/**
 * File: trust.tsx
 * Description: Renders the scoped trust workspace, including legitimacy state, assembly claims, and role claims.
 */

import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
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

function formatHomeChain(scopeNames: string[]): string {
  return scopeNames.length > 0 ? scopeNames.join(' -> ') : 'Global + You only';
}

export default function NexusTrustPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const {
    activeScope,
    currentActorPacketId,
    currentActorLabel,
    followedScopes,
    refreshShellData,
    setScopeFollowed,
  } = useNexusShell();
  const { currentMode, isAuthenticated, runFortressMutation } =
    useIdentityShell();
  const { authGateModal, guardNexusWrite, openNexusAuthGateForError } =
    useNexusAuthGate({
      returnTo: '/nexus/trust',
      returnScopeId: activeScope.id,
    });
  const [trustPayload, setTrustPayload] = useState<NexusTrustPayload | null>(null);
  const [isLoadingTrust, setIsLoadingTrust] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [associationNote, setAssociationNote] = useState('');
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);

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
  const activeAssemblyClaim = useMemo(
    () =>
      (trustPayload?.assembly_claims ?? []).find(
        (claim) =>
          claim.assembly_packet_id === activeScope.packetId &&
          claim.status === 'active'
      ) ?? null,
    [activeScope.packetId, trustPayload]
  );
  const assemblyClaims = trustPayload?.assembly_claims ?? [];
  const isClaimedIdentity = currentMode === 'claimed' && isAuthenticated;
  const canSetActiveScopeAsHome =
    trustPayload?.home_locality.can_set_active_scope ?? false;
  const isActiveScopeHomeLocality =
    trustPayload?.home_locality.is_active_scope ?? false;
  const activeScopeIsInHomeChain =
    trustPayload?.home_locality.is_active_scope_in_chain ?? false;
  const homeLocalityName = trustPayload?.home_locality.scope_name ?? null;
  const homeChainLabel = formatHomeChain(
    trustPayload?.home_locality.derived_scope_names ?? []
  );
  const isActiveScopeFollowed = followedScopes.some(
    (followedScope) => followedScope.id === activeScope.id
  );

  const handleAssemblyAssociationClaim = async (value: 1 | 0) => {
    if (activeScope.level === 'personal') {
      setErrorMessage('Open an assembly scope to update an association claim.');
      setStatusMessage(null);
      return;
    }

    const applyAssociationClaim = async () => {
      try {
        await runFortressMutation({
          intent: {
            kind: 'assembly_association.claim.set',
            assembly_packet_id: activeScope.packetId,
            scope_id: activeScope.id,
            note:
              value === 1 && associationNote.trim().length > 0
                ? associationNote
                : null,
            value,
          },
        });
        const nextTrustPayload = await fetchNexusTrustPayload({
          scopeId: activeScope.id,
          actorPacketId: currentActorPacketId,
        });
        setTrustPayload(nextTrustPayload);
        setStatusMessage(
          value === 1
            ? `Claimed association with ${activeScope.name}.`
            : `Withdrew association with ${activeScope.name}.`
        );
        setErrorMessage(null);
      } catch (error) {
        if (openNexusAuthGateForError(error, applyAssociationClaim)) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to update the assembly association.'
        );
        setStatusMessage(null);
      }
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyAssociationClaim
    );
  };

  const handleHomeLocalityChange = async (homeScopePacketId: string | null) => {
    const applyHomeLocalityChange = async () => {
      try {
        await runFortressMutation({
          intent: {
            kind: 'home_locality.claim.set',
            home_scope_packet_id: homeScopePacketId,
          },
        });
        await Promise.all([
          fetchNexusTrustPayload({
            scopeId: activeScope.id,
            actorPacketId: currentActorPacketId,
          }).then((nextTrustPayload) => setTrustPayload(nextTrustPayload)),
          refreshShellData(),
        ]);
        setStatusMessage(
          homeScopePacketId
            ? `${activeScope.name} is now your home locality.`
            : 'Home locality cleared.'
        );
        setErrorMessage(null);
      } catch (error) {
        if (openNexusAuthGateForError(error, applyHomeLocalityChange)) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to update home locality.'
        );
        setStatusMessage(null);
      }
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyHomeLocalityChange
    );
  };

  const handleFollowPreference = async (isFollowed: boolean) => {
    setIsUpdatingFollow(true);

    try {
      await setScopeFollowed(activeScope.id, isFollowed);
      setStatusMessage(
        isFollowed
          ? `${activeScope.name} added to followed scopes.`
          : `${activeScope.name} removed from followed scopes.`
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the follow preference.'
      );
      setStatusMessage(null);
    } finally {
      setIsUpdatingFollow(false);
    }
  };

  return (
    <View className="flex-1">
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

        {statusMessage ? (
          <NexusCard tone="mint">
            <Text className={appearance.itemBodyClass}>{statusMessage}</Text>
          </NexusCard>
        ) : null}

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

        <NexusCard className="gap-4">
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Scope relationship
            </Text>
            <Text className={appearance.itemBodyClass}>
              Manage how this scope relates to your home branch, sidebar
              bookmarks, and assembly trust evidence.
            </Text>
          </View>

          <View className="gap-4 xl:flex-row">
            <NexusCard className={`min-w-[220px] flex-1 gap-3 p-4 ${appearance.cardInsetClass}`}>
              <View className="gap-2">
                <Text className={appearance.itemTitleClass}>Home locality</Text>
                <Text className={appearance.itemBodyClass}>
                  Current home: {homeLocalityName ?? 'Not set'}
                </Text>
                <Text className={appearance.itemBodyClass}>
                  Home locality controls the geographic branch used for
                  community posting. Ancestors are included; descendants are not.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <NexusBadge
                    label={
                      activeScopeIsInHomeChain
                        ? 'In home branch'
                        : 'Outside home branch'
                    }
                    tone={activeScopeIsInHomeChain ? 'mint' : 'gold'}
                  />
                  {isActiveScopeHomeLocality ? (
                    <NexusBadge label="Home active" tone="sky" />
                  ) : null}
                </View>
                <Text className={appearance.itemBodyClass}>
                  Derived branch: {homeChainLabel}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                {canSetActiveScopeAsHome ? (
                  <NexusActionButton
                    label={
                      isActiveScopeHomeLocality
                        ? 'Home locality active'
                        : isClaimedIdentity
                          ? 'Set as home locality'
                          : 'Sign in to set home'
                    }
                    variant={isActiveScopeHomeLocality ? 'secondary' : 'primary'}
                    disabled={isActiveScopeHomeLocality}
                    onPress={() =>
                      void handleHomeLocalityChange(activeScope.packetId)
                    }
                  />
                ) : null}
                <NexusActionButton
                  label="Find or create home"
                  onPress={() =>
                    router.push({
                      pathname: '/nexus/locality/create',
                      params: {
                        query: activeScope.name,
                        return_to: '/nexus/trust',
                        return_scope_id: activeScope.id,
                        set_home: '1',
                      },
                    } as Href)
                  }
                />
                {homeLocalityName ? (
                  <NexusActionButton
                    label="Clear home locality"
                    variant="ghost"
                    onPress={() => void handleHomeLocalityChange(null)}
                  />
                ) : null}
              </View>
            </NexusCard>

            <NexusCard className={`min-w-[220px] flex-1 gap-3 p-4 ${appearance.cardInsetClass}`}>
              <View className="gap-2">
                <Text className={appearance.itemTitleClass}>Follow</Text>
                <Text className={appearance.itemBodyClass}>
                  Following is a sidebar bookmark for returning to this scope.
                  It does not imply membership, locality, association, or trust.
                </Text>
                <NexusBadge
                  label={isActiveScopeFollowed ? 'Followed' : 'Not followed'}
                  tone={isActiveScopeFollowed ? 'mint' : 'default'}
                />
              </View>
              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label={
                    isUpdatingFollow
                      ? 'Updating...'
                      : isActiveScopeFollowed
                        ? 'Unfollow'
                        : 'Follow'
                  }
                  disabled={isUpdatingFollow || activeScope.level === 'personal'}
                  onPress={() => void handleFollowPreference(!isActiveScopeFollowed)}
                />
              </View>
            </NexusCard>

            <NexusCard className={`min-w-[220px] flex-1 gap-3 p-4 ${appearance.cardInsetClass}`}>
              <View className="gap-2">
                <Text className={appearance.itemTitleClass}>Assembly association</Text>
                <Text className={appearance.itemBodyClass}>
                  Association records relationship, participation, or trust with
                  this assembly. It does not by itself grant locality posting or
                  voting rights.
                </Text>
                <NexusBadge
                  label={activeAssemblyClaim ? 'Association active' : 'No active association'}
                  tone={activeAssemblyClaim ? 'mint' : 'default'}
                />
              </View>
              {activeScope.level !== 'personal' ? (
                <>
                  <TextInput
                    value={associationNote}
                    onChangeText={setAssociationNote}
                    placeholder="Optional note for this association"
                    placeholderTextColor={appearance.textInputPlaceholderColor}
                    className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
                  />
                  <View className="flex-row flex-wrap gap-3">
                    <NexusActionButton
                      label={activeAssemblyClaim ? 'Refresh association' : 'Claim association'}
                      onPress={() => void handleAssemblyAssociationClaim(1)}
                    />
                    <NexusActionButton
                      label="Withdraw association"
                      variant="ghost"
                      onPress={() => void handleAssemblyAssociationClaim(0)}
                      disabled={!activeAssemblyClaim}
                    />
                  </View>
                </>
              ) : (
                <Text className={appearance.itemBodyClass}>
                  Open an assembly scope to claim or withdraw association there.
                </Text>
              )}
            </NexusCard>
          </View>
        </NexusCard>

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
                  label="Open roles"
                  onPress={() => router.push('/nexus/roles' as Href)}
                />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Assembly association evidence
              </Text>
              <Text className={appearance.itemBodyClass}>
                Current association claims and support evidence for this scope.
                Use Scope relationship above to claim or withdraw your own
                association.
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
                          label={claim.status === 'active' ? 'Active claim' : 'Withdrawn'}
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
      {authGateModal}
    </View>
  );
}
