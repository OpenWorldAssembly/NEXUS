/**
 * File: account.tsx
 * Description: Renders the Nexus account overview, security summary, and local assembly claim workspace.
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
import type { AssemblyAssociationClaimProjection } from '@core/contracts';
import {
  createNexusAssembly,
  fetchNexusAssemblyClaims,
  setNexusAssemblyAssociationClaim,
} from '@runtime/nexus/nexus-query-api';

function getStorageLabel(storageMode: 'none' | 'session_only' | 'saved_on_device' | null) {
  if (storageMode === 'saved_on_device') {
    return 'Saved on this device';
  }

  if (storageMode === 'session_only') {
    return 'Session-only browser storage';
  }

  return 'No browser storage';
}

export default function NexusAccountPage() {
  const router = useRouter();
  const appearance = useNexusAppearance();
  const {
    activeScope,
    currentActorLabel,
    currentIdentityMode,
    followedScopes,
    refreshShellData,
    scopeSummaries,
  } = useNexusShell();
  const {
    createVerifiedRequestBody,
    currentActorPacketId,
    currentStorageMode,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    isUsingSessionCookies,
    passkeyCount,
    rememberClaimedSessions,
    securityMode,
  } = useIdentityShell();
  const [assemblyClaims, setAssemblyClaims] = useState<AssemblyAssociationClaimProjection[]>([]);
  const [assemblyClaimNote, setAssemblyClaimNote] = useState('');
  const [newAssemblyName, setNewAssemblyName] = useState('');
  const [newAssemblySubtype, setNewAssemblySubtype] = useState('');
  const [newAssemblySummary, setNewAssemblySummary] = useState('');
  const [newAssemblyLocalityLabel, setNewAssemblyLocalityLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!currentActorPacketId) {
      setAssemblyClaims([]);
      return () => {
        isMounted = false;
      };
    }

    void fetchNexusAssemblyClaims({
      actorPacketId: currentActorPacketId,
    })
      .then((payload) => {
        if (isMounted) {
          setAssemblyClaims(payload.claims);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAssemblyClaims([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentActorPacketId]);

  const claimedAssemblyIds = useMemo(
    () =>
      new Set(
        assemblyClaims
          .filter((claim) => claim.status === 'active')
          .map((claim) => claim.assembly_packet_id)
      ),
    [assemblyClaims]
  );

  const handleError = (error: unknown, fallback: string) => {
    setErrorMessage(error instanceof Error ? error.message : fallback);
    setStatusMessage(null);
  };
  const hasActiveClaimedSession =
    currentIdentityMode === 'claimed' && isAuthenticated;

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Account"
          title={`${activeScope.name} Account`}
          description="Identity creation, sign-in, restore, claim, and deeper security now live on dedicated Nexus identity routes. This page stays focused on your current actor state and local assembly continuity."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label={currentActorLabel} tone="mint" />
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

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Current actor
              </Text>
              <Text className={appearance.surfaceTitleClass}>{currentActorLabel}</Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge
                  label={currentIdentityMode === 'claimed' ? 'Claimed identity' : 'Guest actor'}
                  tone={currentIdentityMode === 'claimed' ? 'gold' : 'sky'}
                />
                <NexusBadge
                  label={isAuthenticated ? 'Claimed session active' : 'No claimed session'}
                  tone={isAuthenticated ? 'mint' : 'default'}
                />
                <NexusBadge
                  label={isCurrentIdentityUnlocked ? 'Signing key unlocked' : 'Signing key locked'}
                  tone={isCurrentIdentityUnlocked ? 'mint' : 'gold'}
                />
                <NexusBadge label={getStorageLabel(currentStorageMode)} />
                <NexusBadge label={isUsingSessionCookies ? 'Cookies active' : 'No auth cookies'} />
              </View>
              <Text className={appearance.itemBodyClass}>
                {hasActiveClaimedSession
                  ? `Remembered claimed sign-ins are currently ${
                      rememberClaimedSessions ? 'enabled' : 'disabled'
                    }, and write approval is set to ${securityMode ?? 'guest-only'}.`
                  : currentIdentityMode === 'claimed'
                    ? 'This claimed identity is saved locally, but no claimed session is active yet. Sign in again to manage passkeys or write approval.'
                    : `Current guest persistence is ${
                        currentStorageMode === 'none' ? 'temporary' : 'saved'
                      }, and remembered claimed sign-ins are currently ${
                        rememberClaimedSessions ? 'enabled' : 'disabled'
                      }.`}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label={hasActiveClaimedSession ? 'Identity security' : 'Sign in'}
                  variant="primary"
                  onPress={() =>
                    router.push(
                      hasActiveClaimedSession
                        ? '/nexus/identity/security'
                        : '/nexus/identity/sign-in'
                    )
                  }
                />
                {currentIdentityMode !== 'claimed' ? (
                  <NexusActionButton
                    label="Claim this guest"
                    onPress={() => router.push('/nexus/identity/claim')}
                  />
                ) : null}
                <NexusActionButton
                  label={hasActiveClaimedSession ? 'Sign in another identity' : 'Create fresh identity'}
                  onPress={() =>
                    router.push(
                      hasActiveClaimedSession
                        ? '/nexus/identity/sign-in'
                        : '/nexus/identity/create'
                    )
                  }
                />
              </View>
              <View className="flex-row flex-wrap gap-3">
                <NexusBadge label={`${passkeyCount} passkeys`} tone="sky" />
                <NexusBadge label={currentActorPacketId ?? 'No actor packet id'} />
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Local assembly claims
              </Text>
              <Text className={appearance.itemBodyClass}>
                These descriptive attestations say where this person claims association. They help route you into local assembly work without granting trust or authority on their own.
              </Text>
              <TextInput
                value={assemblyClaimNote}
                onChangeText={setAssemblyClaimNote}
                placeholder="Optional note for a claim"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
              />
              <View className="gap-3">
                {scopeSummaries.map((scope) => {
                  const assemblyPacketId = `nexus:element/${scope.id}`;

                  return (
                    <NexusCard
                      key={scope.id}
                      className={`gap-3 p-4 ${appearance.cardInsetClass}`}
                    >
                      <Text className={appearance.itemTitleClass}>{scope.name}</Text>
                      <Text className={appearance.itemMetaClass}>{scope.relationshipLabel}</Text>
                      <View className="flex-row flex-wrap gap-3">
                        <NexusBadge
                          label={claimedAssemblyIds.has(assemblyPacketId) ? 'Claimed here' : 'Not claimed'}
                          tone={claimedAssemblyIds.has(assemblyPacketId) ? 'mint' : 'default'}
                        />
                      </View>
                      <View className="flex-row flex-wrap gap-3">
                        <NexusActionButton
                          label={claimedAssemblyIds.has(assemblyPacketId) ? 'Refresh claim' : 'Claim association'}
                          onPress={() => {
                            void createVerifiedRequestBody('/api/nexus/assemblies/claims', 'PUT', {
                              assembly_packet_id: assemblyPacketId,
                              scope_id: scope.id,
                              note: assemblyClaimNote.trim().length > 0 ? assemblyClaimNote : null,
                              value: 1,
                            })
                              .then((requestBody) =>
                                setNexusAssemblyAssociationClaim({
                                  requestBody,
                                })
                              )
                              .then((payload) => {
                                setAssemblyClaims(payload.claims);
                                setStatusMessage(`Claimed association with ${scope.name}.`);
                                setErrorMessage(null);
                              })
                              .catch((error) =>
                                handleError(error, 'Unable to claim that assembly association.')
                              );
                          }}
                        />
                        <NexusActionButton
                          label="Clear claim"
                          onPress={() => {
                            void createVerifiedRequestBody('/api/nexus/assemblies/claims', 'PUT', {
                              assembly_packet_id: assemblyPacketId,
                              scope_id: scope.id,
                              note: null,
                              value: 0,
                            })
                              .then((requestBody) =>
                                setNexusAssemblyAssociationClaim({
                                  requestBody,
                                })
                              )
                              .then((payload) => {
                                setAssemblyClaims(payload.claims);
                                setStatusMessage(`Cleared the association claim for ${scope.name}.`);
                                setErrorMessage(null);
                              })
                              .catch((error) =>
                                handleError(error, 'Unable to clear that assembly claim.')
                              );
                          }}
                          disabled={!claimedAssemblyIds.has(assemblyPacketId)}
                        />
                      </View>
                    </NexusCard>
                  );
                })}
              </View>
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Start a local assembly
              </Text>
              <Text className={appearance.itemBodyClass}>
                If nothing nearby fits, you can start a lightweight assembly under the current scope. It gets starter discussions and your own association claim by default.
              </Text>
              <TextInput
                value={newAssemblyName}
                onChangeText={setNewAssemblyName}
                placeholder="Assembly name"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
              />
              <TextInput
                value={newAssemblySubtype}
                onChangeText={setNewAssemblySubtype}
                placeholder="Subtype"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
              />
              <TextInput
                value={newAssemblyLocalityLabel}
                onChangeText={setNewAssemblyLocalityLabel}
                placeholder="Locality label"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
              />
              <TextInput
                value={newAssemblySummary}
                onChangeText={setNewAssemblySummary}
                placeholder="Optional summary"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                multiline
                style={{ textAlignVertical: 'top', minHeight: 120 }}
                className={`rounded-[18px] border px-4 py-3 ${appearance.textInputClass}`}
              />
              <NexusActionButton
                label={`Start under ${activeScope.name}`}
                variant="primary"
                onPress={() => {
                  void createVerifiedRequestBody('/api/nexus/assemblies', 'POST', {
                    name: newAssemblyName,
                    subtype: newAssemblySubtype.trim().length > 0 ? newAssemblySubtype : null,
                    summary: newAssemblySummary.trim().length > 0 ? newAssemblySummary : null,
                    locality_label:
                      newAssemblyLocalityLabel.trim().length > 0
                        ? newAssemblyLocalityLabel
                        : null,
                    parent_scope_packet_id: `nexus:element/${activeScope.id}`,
                    seed_discussions: true,
                    claim_association: true,
                    claim_note: assemblyClaimNote.trim().length > 0 ? assemblyClaimNote : null,
                  })
                    .then((requestBody) =>
                      createNexusAssembly({
                        requestBody,
                      })
                    )
                    .then(async (payload) => {
                      setAssemblyClaims(payload.claims);
                      await refreshShellData();
                      setStatusMessage(`Created ${payload.assembly_packet.body.name}.`);
                      setErrorMessage(null);
                      setNewAssemblyName('');
                      setNewAssemblySubtype('');
                      setNewAssemblySummary('');
                      setNewAssemblyLocalityLabel('');
                    })
                    .catch((error) =>
                      handleError(error, 'Unable to create the local assembly.')
                    );
                }}
                disabled={newAssemblyName.trim().length === 0}
              />
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Followed scopes
              </Text>
              <View className="gap-3">
                {followedScopes.map((scope) => (
                  <NexusCard key={scope.id} className={`gap-2 p-4 ${appearance.cardInsetClass}`}>
                    <Text className={appearance.itemTitleClass}>{scope.name}</Text>
                    <Text className={appearance.itemMetaClass}>{scope.relationshipLabel}</Text>
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
