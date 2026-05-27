/**
 * File: trust.tsx
 * Description: Renders the scoped trust workspace, including legitimacy state, association relations, and role claims.
 */

import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import {
  requiredInterfaceValue,
  useInterfaceEventCoordinator,
} from '@app/components/nexus/interface-event-coordinator';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusPreviewTargetParams } from '@app/components/nexus/preview';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusFieldActionRow,
  NexusMetricGrid,
  NexusScrollFrame,
  NexusSectionHeader,
  NexusTextInput,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type { NexusTrustPayload } from '@runtime/nexus/nexus-api-types';
import { fetchNexusTrustPayload } from '@runtime/nexus/nexus-query-api';

function formatTrustStage(stage: NexusTrustPayload['trust_stage']): string {
  return stage.replace(/_/g, ' ');
}

function formatHomeChain(scopeNames: string[]): string {
  return scopeNames.length > 0 ? scopeNames.join(' → ') : 'Global Commons';
}

export default function NexusTrustPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const interfaceEvents = useInterfaceEventCoordinator();
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
  const previewTargetParams = useNexusPreviewTargetParams();
  const highlightedPacketId =
    previewTargetParams.highlightPacketId ??
    previewTargetParams.focusPacketId ??
    previewTargetParams.packetId;
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
  const activeAssociationRelation = useMemo(
    () =>
      (trustPayload?.association_relations ?? []).find(
        (relation) =>
          relation.target_packet_id === activeScope.packetId &&
          relation.status === 'active'
      ) ?? null,
    [activeScope.packetId, trustPayload]
  );
  const associationRelations = trustPayload?.association_relations ?? [];
  const isClaimedIdentity = currentMode === 'claimed' && isAuthenticated;
  const canSetActiveScopeAsHome =
    trustPayload?.residence.can_set_active_scope ?? false;
  const isActiveScopeHomeLocality =
    trustPayload?.residence.is_active_scope ?? false;
  const activeScopeIsInHomeChain =
    trustPayload?.residence.is_active_scope_in_chain ?? false;
  const homeLocalityName = trustPayload?.residence.scope_name ?? null;
  const homeChainLabel = formatHomeChain(
    trustPayload?.residence.derived_scope_names ?? []
  );
  const isActiveScopeFollowed = followedScopes.some(
    (followedScope) => followedScope.id === activeScope.id
  );

  const handleAssociationRelation = async (value: 1 | 0) => {
    if (activeScope.level === 'personal') {
      setErrorMessage('Open a scope to update an association relation.');
      setStatusMessage(null);
      return;
    }

    const applyAssociationRelation = async () => {
      const mutationIntent =
        value === 1 ? 'relation.association.add' : 'relation.association.clear';
      const eventResult = await interfaceEvents.runEvent({
        source: {
          kind: 'form',
          surface: 'trust',
        },
        intent: {
          clientIntentId:
            value === 1 ? 'scope.association.set' : 'scope.association.clear',
          targetRoute: '/api/nexus/mutations/prepare',
          mutationIntent,
          actorPacketId: currentActorPacketId,
          payload: {
            scope_id: activeScope.id,
            target_packet_id: activeScope.packetId,
          },
        },
        loading: {
          scope: `trust:association:${activeScope.id}`,
          label: 'Updating association...',
        },
        validate: [
          requiredInterfaceValue(
            'activeScope.packetId',
            activeScope.packetId,
            'Open a scope to update an association relation.'
          ),
        ],
        dispatch: ({ headers }) =>
          runFortressMutation({
            intent: {
              kind: mutationIntent,
              target_packet_id: activeScope.packetId,
              scope_id: activeScope.id,
              ...(value === 1
                ? {
                    note:
                      associationNote.trim().length > 0
                        ? associationNote
                        : null,
                  }
                : {}),
            },
            interfaceEventHeaders: headers,
          }),
        refresh: async () => {
          const nextTrustPayload = await fetchNexusTrustPayload({
            scopeId: activeScope.id,
            actorPacketId: currentActorPacketId,
          });
          setTrustPayload(nextTrustPayload);
        },
      });

      if (eventResult.status === 'succeeded') {
        setStatusMessage(
          value === 1
            ? `Added association with ${activeScope.name}.`
            : `Cleared association with ${activeScope.name}.`
        );
        setErrorMessage(null);
        return;
      }

      const eventError = eventResult.error;

      if (eventError && openNexusAuthGateForError(eventError, applyAssociationRelation)) {
        return;
      }

      setErrorMessage(
        eventResult.validation?.issues[0]?.message ??
          (eventError instanceof Error
            ? eventError.message
            : 'Unable to update the association.')
      );
      setStatusMessage(null);
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyAssociationRelation
    );
  };

  const handleHomeLocalityChange = async (residenceScopePacketId: string | null) => {
    const applyHomeLocalityChange = async () => {
      try {
        await runFortressMutation({
          intent: {
            kind: 'relation.residence.add',
            residence_scope_packet_id: residenceScopePacketId,
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
          residenceScopePacketId
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
    const applyFollowPreference = async () => {
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
        if (openNexusAuthGateForError(error, applyFollowPreference)) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to update the follow relation.'
        );
        setStatusMessage(null);
      } finally {
        setIsUpdatingFollow(false);
      }
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyFollowPreference
    );
  };

  return (
    <View className="flex-1">
      <NexusScrollFrame>
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

        <NexusMetricGrid>
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
        </NexusMetricGrid>

        <NexusCard className="gap-4 overflow-visible">
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Scope relationship
            </Text>
            <Text className={appearance.itemBodyClass}>
              Manage this scope&apos;s home branch, sidebar bookmark, and assembly trust evidence.
            </Text>
          </View>

          <NexusCard className={`gap-4 overflow-visible p-4 ${appearance.cardInsetClass}`}>
            <View className="gap-2">
              <Text className={appearance.itemTitleClass}>Home locality</Text>
              <Text className={appearance.surfaceTitleClass}>
                {homeLocalityName ?? 'No home locality set'}
              </Text>
              <Text className={appearance.itemBodyClass}>
                Default geographic branch for community posting.
              </Text>
              <Text className={appearance.itemMetaClass}>Branch: {homeChainLabel}</Text>
              <Text className={appearance.itemMetaClass}>
                Status:{' '}
                {isActiveScopeHomeLocality
                  ? 'Current scope is your home locality.'
                  : activeScopeIsInHomeChain
                    ? 'Current scope is in your home branch.'
                    : 'Current scope is outside your home branch.'}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <NexusBadge
                label={isActiveScopeHomeLocality ? 'Home active' : 'Home branch'}
                tone={isActiveScopeHomeLocality ? 'sky' : activeScopeIsInHomeChain ? 'mint' : 'gold'}
              />
              {activeScopeIsInHomeChain && !isActiveScopeHomeLocality ? (
                <NexusBadge label="Current scope included" tone="mint" />
              ) : null}
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

          <View className="gap-4 xl:flex-row">
            <NexusCard className={`min-w-[220px] flex-1 gap-3 overflow-visible p-4 pb-6 ${appearance.cardInsetClass}`}>
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

            <NexusCard className={`min-w-[220px] flex-1 gap-3 overflow-visible p-4 pb-6 ${appearance.cardInsetClass}`}>
              <View className="gap-2">
                <Text className={appearance.itemTitleClass}>Association</Text>
                <Text className={appearance.itemBodyClass}>
                  Association records relationship, participation, or trust with
                  this scope. It does not by itself grant locality posting or
                  voting rights.
                </Text>
                <NexusBadge
                  label={activeAssociationRelation ? 'Association active' : 'No active association'}
                  tone={activeAssociationRelation ? 'mint' : 'default'}
                />
              </View>
              {activeScope.level !== 'personal' ? (
                <>
                  <NexusTextInput
                    value={associationNote}
                    onChangeText={setAssociationNote}
                    placeholder="Optional note for this association"
                  />
                  <NexusFieldActionRow>
                    <NexusActionButton
                      label={activeAssociationRelation ? 'Refresh association' : 'Add association'}
                      onPress={() => void handleAssociationRelation(1)}
                    />
                    <NexusActionButton
                      label="Clear association"
                      variant="ghost"
                      onPress={() => void handleAssociationRelation(0)}
                      disabled={!activeAssociationRelation}
                    />
                  </NexusFieldActionRow>
                </>
              ) : (
                <Text className={appearance.itemBodyClass}>
                  Open a non-personal scope to add or clear association there.
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
                  label={`Required support ${trustPayload?.policy_snapshot.role_participation_support_threshold ?? 0}`}
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
                Association evidence
              </Text>
              <Text className={appearance.itemBodyClass}>
                Current association relations and support evidence for this scope.
                Use Scope relationship above to add or clear your own
                association.
              </Text>
              {associationRelations.length === 0 ? (
                <Text className={appearance.itemBodyClass}>
                  No association relations are active in this scope yet.
                </Text>
              ) : (
                <View className="gap-3">
                  {associationRelations.map((relation) => (
                    <NexusCard
                      key={relation.relation_packet_id}
                      className={`gap-3 p-4 ${appearance.cardInsetClass} ${
                        relation.relation_packet_id === highlightedPacketId
                          ? 'border-nexus-sky/70 bg-nexus-sky/10'
                          : ''
                      }`}
                    >
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className={appearance.itemTitleClass}>
                          {relation.target_name}
                        </Text>
                        <NexusBadge
                          label={relation.status === 'active' ? 'Active relation' : 'Withdrawn'}
                          tone={relation.status === 'active' ? 'mint' : 'default'}
                        />
                        {relation.relation_packet_id === highlightedPacketId ? (
                          <NexusBadge label="Focused" tone="sky" />
                        ) : null}
                      </View>
                      <Text className={appearance.itemBodyClass}>
                        {relation.note ?? 'No note added to this association yet.'}
                      </Text>
                      <View className="flex-row flex-wrap gap-3">
                        <NexusBadge
                          label={`${relation.supported_by_other_count} outside supports`}
                          tone="sky"
                        />
                        <NexusBadge
                          label={
                            relation.is_self_issued_only
                              ? 'Self-issued only'
                              : 'Supported by others'
                          }
                          tone={relation.is_self_issued_only ? 'gold' : 'mint'}
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
                    className={`gap-3 p-4 ${appearance.cardInsetClass} ${
                      roleCard.role_packet_id === highlightedPacketId
                        ? 'border-nexus-sky/70 bg-nexus-sky/10'
                        : ''
                    }`}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className={appearance.itemTitleClass}>{roleCard.title}</Text>
                      <NexusBadge
                        label={roleCard.stage.replace(/_/g, ' ')}
                        tone={roleCard.stage === 'role_eligible' ? 'mint' : 'gold'}
                      />
                      {roleCard.role_packet_id === highlightedPacketId ? (
                        <NexusBadge label="Focused" tone="sky" />
                      ) : null}
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
      </NexusScrollFrame>
      {authGateModal}
    </View>
  );
}
