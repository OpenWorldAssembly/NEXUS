/**
 * File: roles.tsx
 * Description: Renders the scoped roles workspace, including role claims, claimant review, and scoped role evidence.
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type { NexusRolesPayload } from '@runtime/nexus/nexus-api-types';
import {
  fetchNexusRolesPayload,
  setNexusRoleAttestation,
  setNexusScopedRoleClaim,
} from '@runtime/nexus/nexus-query-api';

function formatTrustStage(stage: string): string {
  return stage.replace(/_/g, ' ');
}

function formatEvidenceActor(
  actorLabel: string | null,
  actorPacketId: string | null
): string {
  if (actorLabel) {
    return actorLabel;
  }

  if (actorPacketId) {
    return actorPacketId.replace('nexus:element/', '');
  }

  return 'Unknown actor';
}

export default function NexusRolesPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const { activeScope, currentActorPacketId, currentActorLabel } = useNexusShell();
  const { createVerifiedRequestBody } = useIdentityShell();
  const [rolesPayload, setRolesPayload] = useState<NexusRolesPayload | null>(null);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [expandedEvidenceKeys, setExpandedEvidenceKeys] = useState<string[]>([]);

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

  const refreshRolesPayload = async () => {
    const nextRolesPayload = await fetchNexusRolesPayload({
      scopeId: activeScope.id,
      actorPacketId: currentActorPacketId,
    });

    setRolesPayload(nextRolesPayload);
  };

  const handleRoleClaim = async (rolePacketId: string, claimed: boolean) => {
    try {
      const requestBody = await createVerifiedRequestBody(
        '/api/nexus/trust/roles',
        'PUT',
        {
          role_packet_id: rolePacketId,
          claimed,
        }
      );

      await setNexusScopedRoleClaim({ requestBody });
      await refreshRolesPayload();
      setStatusMessage(claimed ? 'Role claimed in this scope.' : 'Role claim removed.');
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update the role claim.'
      );
      setStatusMessage(null);
    }
  };

  const handleRoleAttestation = async (input: {
    rolePacketId: string;
    claimantActorPacketId: string;
    mode: 'support' | 'dispute' | 'clear';
  }) => {
    const draftKey = `${input.rolePacketId}:${input.claimantActorPacketId}`;
    const note = noteDrafts[draftKey]?.trim() ?? '';

    if (input.mode === 'dispute' && note.length === 0) {
      setErrorMessage('Disputes require a comment.');
      setStatusMessage(null);
      return;
    }

    try {
      const requestPath = `/api/nexus/scopes/${activeScope.id}/roles/attestations`;
      const requestBody = await createVerifiedRequestBody(requestPath, 'PUT', {
        claimant_actor_packet_id: input.claimantActorPacketId,
        role_packet_id: input.rolePacketId,
        mode: input.mode,
        note: note.length > 0 ? note : null,
      });

      await setNexusRoleAttestation({
        scopeId: activeScope.id,
        requestBody,
      });
      await refreshRolesPayload();
      setStatusMessage(
        input.mode === 'clear'
          ? 'Role attestation cleared.'
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the role attestation.'
      );
      setStatusMessage(null);
    }
  };

  const totalClaimants = useMemo(
    () =>
      rolesPayload?.role_cards.reduce(
        (total, roleCard) => total + roleCard.claimants.length,
        0
      ) ?? 0,
    [rolesPayload]
  );
  const claimedRoleCount = useMemo(
    () =>
      rolesPayload?.role_cards.filter((roleCard) => roleCard.is_claimed_by_current_actor)
        .length ?? 0,
    [rolesPayload]
  );

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Roles"
          title={`${activeScope.name} Roles`}
          description="Claim roles in this scope, review who else has claimed them, and add scoped support or disputes with visible evidence."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge
                label={`${claimedRoleCount} claimed`}
                tone="mint"
              />
              <NexusBadge
                label={`${totalClaimants} visible claimants`}
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
              Review roles in this scope context and compare claimant standing.
            </Text>
          </NexusCard>
          <NexusCard className="min-w-[220px] flex-1" tone="mint">
            <Text className={appearance.metricLabelClass}>Role threshold</Text>
            <Text className={appearance.metricValueClass}>
              {rolesPayload?.policy_snapshot.role_support_threshold ?? 0}
            </Text>
            <Text className={appearance.itemBodyClass}>
              Supports needed in this scope before a role claim becomes role eligible.
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

        <View className="gap-4">
          {(rolesPayload?.role_cards ?? []).map((roleCard) => (
            <NexusCard key={roleCard.role_packet_id} className="gap-4">
              <View className="gap-3 lg:flex-row lg:items-start lg:justify-between">
                <View className="min-w-0 flex-1 gap-3">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={appearance.surfaceTitleClass}>{roleCard.title}</Text>
                    <NexusBadge label={roleCard.role_kind} tone="default" />
                    {roleCard.is_claimed_by_current_actor ? (
                      <NexusBadge label="You claimed this" tone="mint" />
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
                      roleCard.is_claimed_by_current_actor ? 'Unclaim role' : 'Claim role'
                    }
                    variant={
                      roleCard.is_claimed_by_current_actor ? 'secondary' : 'primary'
                    }
                    onPress={() =>
                      void handleRoleClaim(
                        roleCard.role_packet_id,
                        !roleCard.is_claimed_by_current_actor
                      )
                    }
                  />
                </View>
              </View>

              {roleCard.claimants.length === 0 ? (
                <Text className={appearance.itemBodyClass}>
                  Nobody in this scope has claimed the role yet.
                </Text>
              ) : (
                <View className="gap-3">
                  {roleCard.claimants.map((claimant) => {
                    const evidenceKey = `${roleCard.role_packet_id}:${claimant.actor_packet_id}`;
                    const evidenceIsExpanded =
                      expandedEvidenceKeys.includes(evidenceKey);

                    return (
                      <NexusCard
                        key={evidenceKey}
                        className={`gap-3 p-4 ${appearance.cardInsetClass}`}
                      >
                        <View className="gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <View className="min-w-0 flex-1 gap-2">
                            <View className="flex-row flex-wrap items-center gap-2">
                              <Text className={appearance.itemTitleClass}>
                                {claimant.actor_label}
                              </Text>
                              <NexusBadge
                                label={formatTrustStage(claimant.trust_stage)}
                                tone={
                                  claimant.trust_stage === 'role_eligible'
                                    ? 'mint'
                                    : claimant.trust_stage === 'recognized'
                                      ? 'sky'
                                      : 'gold'
                                }
                              />
                              <NexusBadge label={claimant.actor_kind} tone="default" />
                              {claimant.is_current_actor ? (
                                <NexusBadge label="You" tone="sky" />
                              ) : null}
                            </View>
                            <View className="flex-row flex-wrap gap-3">
                              <NexusBadge
                                label={`${claimant.support_count} supports`}
                                tone="mint"
                              />
                              <NexusBadge
                                label={`${claimant.dispute_count} disputes`}
                                tone="rose"
                              />
                              <NexusBadge
                                label={`Viewer: ${claimant.viewer_attestation}`}
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
                              claimant.viewer_attestation === 'support'
                                ? 'primary'
                                : 'secondary'
                            }
                            onPress={() =>
                              void handleRoleAttestation({
                                rolePacketId: roleCard.role_packet_id,
                                claimantActorPacketId: claimant.actor_packet_id,
                                mode: 'support',
                              })
                            }
                          />
                          <NexusActionButton
                            label="Dispute"
                            variant={
                              claimant.viewer_attestation === 'dispute'
                                ? 'primary'
                                : 'secondary'
                            }
                            onPress={() =>
                              void handleRoleAttestation({
                                rolePacketId: roleCard.role_packet_id,
                                claimantActorPacketId: claimant.actor_packet_id,
                                mode: 'dispute',
                              })
                            }
                          />
                          <NexusActionButton
                            label="Clear"
                            variant="ghost"
                            onPress={() =>
                              void handleRoleAttestation({
                                rolePacketId: roleCard.role_packet_id,
                                claimantActorPacketId: claimant.actor_packet_id,
                                mode: 'clear',
                              })
                            }
                          />
                        </View>

                        {evidenceIsExpanded ? (
                          <View className="gap-4">
                            <View className="gap-2">
                              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-mint">
                                Support evidence
                              </Text>
                              {claimant.support_edges.length === 0 ? (
                                <Text className={appearance.itemBodyClass}>
                                  No scoped support attestations yet.
                                </Text>
                              ) : (
                                <View className="gap-2">
                                  {claimant.support_edges.map((edge) => (
                                    <NexusCard
                                      key={edge.packet.packet_id}
                                      className={`gap-2 p-4 ${appearance.cardInsetClass}`}
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
                              {claimant.dispute_edges.length === 0 ? (
                                <Text className={appearance.itemBodyClass}>
                                  No scoped dispute attestations yet.
                                </Text>
                              ) : (
                                <View className="gap-2">
                                  {claimant.dispute_edges.map((edge) => (
                                    <NexusCard
                                      key={edge.packet.packet_id}
                                      className={`gap-2 p-4 ${appearance.cardInsetClass}`}
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
      </View>
    </ScrollView>
  );
}
