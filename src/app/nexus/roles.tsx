/**
 * File: roles.tsx
 * Description: Renders the scoped roles workspace, including role participation, participant review, and scoped role evidence.
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusPreviewTargetParams } from '@app/components/nexus/preview';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import { NexusTabRail, type NexusTabNode } from '@app/components/nexus/ui/tabs/nexus-tabs';
import type { NexusRolesPayload } from '@runtime/nexus/nexus-api-types';
import {
  fetchNexusRolesPayload,
} from '@runtime/nexus/nexus-query-api';

function formatRoleParticipantBadge(participantCount: number): string {
  return `${participantCount} ${participantCount === 1 ? 'participant' : 'participants'}`;
}

function formatTrustStage(stage: NexusRolesPayload['role_cards'][number]['participants'][number]['trust_stage']): string {
  return stage.replace(/_/g, ' ');
}

function formatEvidenceActor(label: string | null, packetId: string | null): string {
  return label ?? packetId ?? 'Unknown actor';
}

export default function NexusRolesPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { activeScope, currentActorPacketId, currentActorLabel } = useNexusShell();
  const { runFortressMutation } = useIdentityShell();
  const previewTargetParams = useNexusPreviewTargetParams();
  const focusedPacketId =
    previewTargetParams.focusPacketId ?? previewTargetParams.packetId;
  const highlightedPacketId =
    previewTargetParams.highlightPacketId ?? focusedPacketId;
  const [rolesPayload, setRolesPayload] = useState<NexusRolesPayload | null>(null);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [expandedEvidenceKeys, setExpandedEvidenceKeys] = useState<string[]>([]);
  const [activeRolePacketId, setActiveRolePacketId] = useState<string | null>(null);
  const { authGateModal, guardNexusWrite, openNexusAuthGateForError } =
    useNexusAuthGate({
      returnTo: '/nexus/roles',
      returnScopeId: activeScope.id,
    });

  useEffect(() => {
    let isMounted = true;

    const loadRolesPayload = async () => {
      setIsLoadingRoles(true);
      setErrorMessage(null);

      try {
        const nextRolesPayload = await fetchNexusRolesPayload({
          scopeId: activeScope.id,
          actorPacketId: currentActorPacketId,
        });

        if (!isMounted) {
          return;
        }

        setRolesPayload(nextRolesPayload);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load role data.'
        );
      } finally {
        if (isMounted) {
          setIsLoadingRoles(false);
        }
      }
    };

    void loadRolesPayload();

    return () => {
      isMounted = false;
    };
  }, [activeScope.id, currentActorPacketId]);

  useEffect(() => {
    const roleCards = rolesPayload?.role_cards ?? [];

    if (roleCards.length === 0) {
      setActiveRolePacketId(null);
      return;
    }

    setActiveRolePacketId((currentRolePacketId) =>
      currentRolePacketId &&
      roleCards.some((roleCard) => roleCard.role_packet_id === currentRolePacketId)
        ? currentRolePacketId
        : roleCards[0].role_packet_id
    );
  }, [rolesPayload?.role_cards]);


  useEffect(() => {
    if (!focusedPacketId || !rolesPayload?.role_cards.length) {
      return;
    }

    const targetedRoleCard = rolesPayload.role_cards.find((roleCard) => {
      if (roleCard.role_packet_id === focusedPacketId) {
        return true;
      }

      return roleCard.participants.some(
        (participant) =>
          participant.participation_relation_packet_id === focusedPacketId ||
          participant.support_edges.some((edge) => edge.packet.packet_id === focusedPacketId) ||
          participant.dispute_edges.some((edge) => edge.packet.packet_id === focusedPacketId)
      );
    });

    if (!targetedRoleCard) {
      return;
    }

    setActiveRolePacketId(targetedRoleCard.role_packet_id);

    const targetedParticipant = targetedRoleCard.participants.find(
      (participant) =>
        participant.participation_relation_packet_id === focusedPacketId ||
        participant.support_edges.some((edge) => edge.packet.packet_id === focusedPacketId) ||
        participant.dispute_edges.some((edge) => edge.packet.packet_id === focusedPacketId)
    );

    if (targetedParticipant) {
      setExpandedEvidenceKeys((currentKeys) =>
        currentKeys.includes(targetedParticipant.participation_relation_packet_id)
          ? currentKeys
          : [...currentKeys, targetedParticipant.participation_relation_packet_id]
      );
    }
  }, [focusedPacketId, rolesPayload?.role_cards]);

  const refreshRolesPayload = async () => {
    setIsLoadingRoles(true);

    try {
      const nextRolesPayload = await fetchNexusRolesPayload({
        scopeId: activeScope.id,
        actorPacketId: currentActorPacketId,
      });

      setRolesPayload(nextRolesPayload);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleRoleParticipation = async (rolePacketId: string, participating: boolean) => {
    const applyRoleParticipation = async () => {
      try {
        await runFortressMutation({
          intent: {
            kind: participating
              ? 'relation.participation.add'
              : 'relation.participation.clear',
            scope_id: activeScope.id,
            role_packet_id: rolePacketId,
          },
        });
        await refreshRolesPayload();
        setStatusMessage(participating ? 'Role participation recorded in this scope.' : 'Role participation removed.');
        setErrorMessage(null);
      } catch (error) {
        if (openNexusAuthGateForError(error, applyRoleParticipation)) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to update role participation.'
        );
        setStatusMessage(null);
      }
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyRoleParticipation
    );
  };

  const handleRoleAttestation = async (input: {
    relationPacketId: string;
    mode: 'support' | 'dispute' | 'clear';
  }) => {
    const draftKey = input.relationPacketId;
    const note = noteDrafts[draftKey]?.trim() ?? '';

    if (input.mode === 'dispute' && note.length === 0) {
      setErrorMessage('Disputes require a comment.');
      setStatusMessage(null);
      return;
    }

    const applyRoleAttestation = async () => {
      try {
        await runFortressMutation({
          intent: {
            kind: 'reaction.attestation.set',
            scope_id: activeScope.id,
            target_packet_id: input.relationPacketId,
            attestation_value: input.mode === 'clear' ? null : input.mode,
            note: note.length > 0 ? note : null,
          },
        });
        await refreshRolesPayload();
        setStatusMessage(
          input.mode === 'clear'
            ? 'Role participation attestation cleared.'
            : input.mode === 'support'
              ? 'Role support recorded.'
              : 'Role dispute recorded.'
        );
        setErrorMessage(null);

        if (input.mode !== 'dispute') {
          setNoteDrafts((currentDrafts) => ({
            ...currentDrafts,
            [draftKey]: '',
          }));
        }
      } catch (error) {
        if (openNexusAuthGateForError(error, applyRoleAttestation)) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to update the role participation attestation.'
        );
        setStatusMessage(null);
      }
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyRoleAttestation
    );
  };

  const totalParticipants = useMemo(
    () =>
      rolesPayload?.role_cards.reduce(
        (total, roleCard) => total + roleCard.participants.length,
        0
      ) ?? 0,
    [rolesPayload]
  );
  const participatingRoleCount = useMemo(
    () =>
      rolesPayload?.role_cards.filter((roleCard) => roleCard.is_participated_by_current_actor)
        .length ?? 0,
    [rolesPayload]
  );
  const roleCards = rolesPayload?.role_cards ?? [];
  const activeRoleCard =
    roleCards.find((roleCard) => roleCard.role_packet_id === activeRolePacketId) ??
    roleCards[0] ??
    null;
  const roleTabs = roleCards.map((roleCard) => ({
    id: roleCard.role_packet_id,
    title: roleCard.title,
    detail: roleCard.is_participated_by_current_actor
      ? 'participating'
      : `${roleCard.participants.length} participant${
          roleCard.participants.length === 1 ? '' : 's'
        }`,
  }));

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Roles"
          title={`${activeScope.name} Roles`}
          description="Participate in roles in this scope, review who else participates, and add scoped support or disputes with visible evidence."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge
                label={`${participatingRoleCount} participating`}
                tone="mint"
              />
              <NexusBadge
                label={`${totalParticipants} visible participants`}
                tone="sky"
              />
              <NexusBadge label={currentActorLabel} tone="default" />
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

        {isLoadingRoles ? (
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              Loading scoped roles...
            </Text>
          </NexusCard>
        ) : null}

        <View className="flex-row flex-wrap gap-4">
          <NexusCard className="min-w-[220px] flex-1" tone="sky">
            <Text className={appearance.metricLabelClass}>Current scope</Text>
            <Text className={appearance.metricValueClass}>
              {rolesPayload?.scope.name ?? activeScope.name}
            </Text>
            <Text className={appearance.itemBodyClass}>
              Review roles in this scope context and compare participant standing.
            </Text>
          </NexusCard>
          <NexusCard className="min-w-[220px] flex-1" tone="mint">
            <Text className={appearance.metricLabelClass}>Required support</Text>
            <Text className={appearance.metricValueClass}>
              {rolesPayload?.policy_snapshot.role_participation_support_threshold ?? 0}
            </Text>
            <Text className={appearance.itemBodyClass}>
              Supports needed in this scope before role participation becomes role eligible.
            </Text>
          </NexusCard>
          <NexusCard className="min-w-[220px] flex-1" tone="gold">
            <Text className={appearance.metricLabelClass}>Related trust</Text>
            <Text className={appearance.metricValueClass}>Trust</Text>
            <Text className={appearance.itemBodyClass}>
              Open the Trust workspace to review your overall trust posture in this same scope.
            </Text>
            <View className="pt-4">
              <NexusActionButton
                label="Open Trust"
                onPress={() => router.push('/nexus/trust')}
              />
            </View>
          </NexusCard>
        </View>

        {roleTabs.length > 0 ? (
          <View className="gap-0">
            <NexusTabRail
              activeId={activeRoleCard?.role_packet_id ?? null}
              maxRows={3}
              nodes={roleTabs.map(
                (tab): NexusTabNode => ({
                  id: tab.id,
                  label: tab.title,
                  badge: tab.detail,
                })
              )}
              onSelect={setActiveRolePacketId}
              truncate="middle"
              wrapMode="wrap"
            />
            {[activeRoleCard]
              .filter(
                (roleCard): roleCard is NonNullable<typeof activeRoleCard> =>
                  roleCard !== null
              )
              .map((roleCard) => (
            <NexusCard
              key={roleCard.role_packet_id}
              className={`gap-4 rounded-t-none border-t-0 ${
                roleCard.role_packet_id === highlightedPacketId
                  ? 'border-nexus-sky/70 bg-nexus-sky/10'
                  : ''
              }`}
            >
              <View className="gap-3 lg:flex-row lg:items-start lg:justify-between">
                <View className="min-w-0 flex-1 gap-3">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.surfaceTitleClass}>{roleCard.title}</Text>
                    <NexusBadge label={roleCard.role_kind} tone="default" />
                    {roleCard.role_packet_id === highlightedPacketId ? (
                      <NexusBadge label="Focused" tone="sky" />
                    ) : null}
                    {roleCard.is_participated_by_current_actor ? (
                      <NexusBadge label="You participate" tone="mint" />
                    ) : null}
                  </View>
                  <Text className={appearance.itemBodyClass}>
                    {roleCard.summary ?? 'No role summary is available yet.'}
                  </Text>
                  {roleCard.responsibility_markdown ? (
                    <Text className={appearance.itemBodyClass}>
                      {roleCard.responsibility_markdown}
                    </Text>
                  ) : null}
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <NexusActionButton
                    label={
                      roleCard.is_participated_by_current_actor ? 'Stop participating' : 'Participate'
                    }
                    variant={
                      roleCard.is_participated_by_current_actor ? 'secondary' : 'primary'
                    }
                    onPress={() =>
                      void handleRoleParticipation(
                        roleCard.role_packet_id,
                        !roleCard.is_participated_by_current_actor
                      )
                    }
                  />
                </View>
              </View>

              {roleCard.participants.length === 0 ? (
                <Text className={appearance.itemBodyClass}>
                  Nobody in this scope has participated in the role yet.
                </Text>
              ) : (
                <View className="gap-3">
                  {roleCard.participants.map((participant) => {
                    const evidenceKey = participant.participation_relation_packet_id;
                    const evidenceIsExpanded =
                      expandedEvidenceKeys.includes(evidenceKey);

                    const participantIsHighlighted =
                      participant.participation_relation_packet_id === highlightedPacketId ||
                      participant.support_edges.some((edge) => edge.packet.packet_id === highlightedPacketId) ||
                      participant.dispute_edges.some((edge) => edge.packet.packet_id === highlightedPacketId);

                    return (
                      <NexusCard
                        key={evidenceKey}
                        className={`gap-3 p-4 ${appearance.cardInsetClass} ${
                          participantIsHighlighted ? 'border-nexus-sky/70 bg-nexus-sky/10' : ''
                        }`}
                      >
                        <View className="gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <View className="min-w-0 flex-1 gap-2">
                            <View className="flex-row flex-wrap items-center gap-2">
                              <Text className={appearance.itemTitleClass}>
                                {participant.actor_label}
                              </Text>
                              <NexusBadge
                                label={formatTrustStage(participant.trust_stage)}
                                tone={
                                  participant.trust_stage === 'role_eligible'
                                    ? 'mint'
                                    : participant.trust_stage === 'recognized'
                                      ? 'sky'
                                      : 'gold'
                                }
                              />
                              <NexusBadge label={participant.actor_kind} tone="default" />
                              {participantIsHighlighted ? (
                                <NexusBadge label="Focused" tone="sky" />
                              ) : null}
                              {participant.is_current_actor ? (
                                <NexusBadge label="You" tone="sky" />
                              ) : null}
                            </View>
                            <View className="flex-row flex-wrap gap-3">
                              <NexusBadge
                                label={`Scope: ${formatTrustStage(participant.scope_trust_stage)}`}
                                tone={
                                  participant.scope_trust_stage === 'recognized'
                                    ? 'sky'
                                    : participant.scope_trust_stage === 'emerging'
                                      ? 'mint'
                                      : 'gold'
                                }
                              />
                              <NexusBadge
                                label={
                                  participant.has_scope_association
                                    ? 'Associated in this scope'
                                    : 'No direct scope association'
                                }
                                tone={participant.has_scope_association ? 'mint' : 'default'}
                              />
                              <NexusBadge
                                label={`${participant.scope_association_support_count} association supports`}
                                tone="sky"
                              />
                              <NexusBadge
                                label={`${participant.support_count} supports`}
                                tone="mint"
                              />
                              <NexusBadge
                                label={`${participant.dispute_count} disputes`}
                                tone="rose"
                              />
                              <NexusBadge
                                label={`Viewer: ${participant.viewer_attestation}`}
                                tone="default"
                              />
                            </View>
                          </View>

                          <View className="flex-row flex-wrap gap-3">
                            <NexusActionButton
                              label={
                                evidenceIsExpanded ? 'Hide evidence' : 'Show evidence'
                              }
                              variant="ghost"
                              onPress={() =>
                                setExpandedEvidenceKeys((currentKeys) =>
                                  currentKeys.includes(evidenceKey)
                                    ? currentKeys.filter((currentKey) => currentKey !== evidenceKey)
                                    : [...currentKeys, evidenceKey]
                                )
                              }
                            />
                          </View>
                        </View>

                        {!participant.is_current_actor ? (
                          <>
                            <TextInput
                              value={noteDrafts[evidenceKey] ?? ''}
                              onChangeText={(value) =>
                                setNoteDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [evidenceKey]: value,
                                }))
                              }
                              placeholder="Optional support comment, required for disputes"
                              placeholderTextColor={appearance.textInputPlaceholderColor}
                              className={`min-h-[52px] rounded-2xl border px-4 py-3 ${appearance.textInputClass}`}
                              multiline
                              textAlignVertical="top"
                            />

                            <View className="flex-row flex-wrap gap-3">
                              <NexusActionButton
                                label="Support"
                                variant={
                                  participant.viewer_attestation === 'support'
                                    ? 'primary'
                                    : 'secondary'
                                }
                                onPress={() =>
                                  void handleRoleAttestation({
                                    relationPacketId: participant.participation_relation_packet_id,
                                    mode: 'support',
                                  })
                                }
                              />
                              <NexusActionButton
                                label="Dispute"
                                variant={
                                  participant.viewer_attestation === 'dispute'
                                    ? 'primary'
                                    : 'secondary'
                                }
                                onPress={() =>
                                  void handleRoleAttestation({
                                    relationPacketId: participant.participation_relation_packet_id,
                                    mode: 'dispute',
                                  })
                                }
                              />
                              <NexusActionButton
                                label="Clear"
                                variant="ghost"
                                onPress={() =>
                                  void handleRoleAttestation({
                                    relationPacketId: participant.participation_relation_packet_id,
                                    mode: 'clear',
                                  })
                                }
                              />
                            </View>
                          </>
                        ) : (
                          <Text className={appearance.itemBodyClass}>
                            Participate or stop participating in this role for yourself from the role card above. Support and dispute controls are only available for other listed participants.
                          </Text>
                        )}

                        {evidenceIsExpanded ? (
                          <View className="gap-4">
                            <View className="gap-2">
                              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-mint">
                                Support evidence
                              </Text>
                              {participant.support_edges.length === 0 ? (
                                <Text className={appearance.itemBodyClass}>
                                  No scoped support attestations yet.
                                </Text>
                              ) : (
                                <View className="gap-2">
                                  {participant.support_edges.map((edge) => (
                                    <NexusCard
                                      key={edge.packet.packet_id}
                                      className={`gap-2 p-4 ${appearance.cardInsetClass} ${
                                        edge.packet.packet_id === highlightedPacketId
                                          ? 'border-nexus-sky/70 bg-nexus-sky/10'
                                          : ''
                                      }`}
                                    >
                                      <Text className={appearance.itemTitleClass}>
                                        {formatEvidenceActor(
                                          edge.source_actor_label,
                                          edge.source_actor_packet_id
                                        )}
                                      </Text>
                                      <Text className={appearance.itemMetaClass}>
                                        {new Date(edge.created_at).toLocaleString()}
                                      </Text>
                                      <Text className={appearance.itemBodyClass}>
                                        {edge.note ?? 'No comment added.'}
                                      </Text>
                                    </NexusCard>
                                  ))}
                                </View>
                              )}
                            </View>

                            <View className="gap-2">
                              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-rose">
                                Dispute evidence
                              </Text>
                              {participant.dispute_edges.length === 0 ? (
                                <Text className={appearance.itemBodyClass}>
                                  No scoped dispute attestations yet.
                                </Text>
                              ) : (
                                <View className="gap-2">
                                  {participant.dispute_edges.map((edge) => (
                                    <NexusCard
                                      key={edge.packet.packet_id}
                                      className={`gap-2 p-4 ${appearance.cardInsetClass} ${
                                        edge.packet.packet_id === highlightedPacketId
                                          ? 'border-nexus-sky/70 bg-nexus-sky/10'
                                          : ''
                                      }`}
                                    >
                                      <Text className={appearance.itemTitleClass}>
                                        {formatEvidenceActor(
                                          edge.source_actor_label,
                                          edge.source_actor_packet_id
                                        )}
                                      </Text>
                                      <Text className={appearance.itemMetaClass}>
                                        {new Date(edge.created_at).toLocaleString()}
                                      </Text>
                                      <Text className={appearance.itemBodyClass}>
                                        {edge.note ?? 'No comment added.'}
                                      </Text>
                                    </NexusCard>
                                  ))}
                                </View>
                              )}
                            </View>
                          </View>
                        ) : null}
                      </NexusCard>
                    );
                  })}
                </View>
              )}
            </NexusCard>
            ))}
          </View>
        ) : !isLoadingRoles ? (
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              No roles are available in this scope yet.
            </Text>
          </NexusCard>
        ) : null}
        </View>
      </ScrollView>

      {authGateModal}
    </View>
  );
}
