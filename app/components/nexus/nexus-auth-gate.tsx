/**
 * File: nexus-auth-gate.tsx
 * Description: Shared modal and hook for protected Nexus auth/write gates.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import {
  IdentityField,
  IdentityInput,
} from '@app/components/nexus/nexus-identity-ui';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import {
  isNexusAuthGateError,
  type NexusAuthGateReason,
} from '@app/components/nexus/nexus-auth-gate-types';
import { buildIdentityRouteHref } from '@app/components/nexus/nexus-route-utils';
import {
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';

type NexusAuthGateState = {
  reason: NexusAuthGateReason;
  returnTo: string;
  returnScopeId: string | null;
};

type NexusAuthGateOptions = {
  requiresClaimedIdentity?: boolean;
  writeRisk?: 'standard' | 'high_impact';
  communityClaimRequired?: boolean;
};

type PendingAction = (() => void | Promise<void>) | null;

function getGateTitle(reason: NexusAuthGateReason): string {
  switch (reason) {
    case 'unlock_required':
      return 'Unlock identity';
    case 'stale_actor_packet':
      return 'Refresh identity';
    case 'session_refresh_required':
      return 'Session refresh required';
    case 'write_approval_required':
      return 'Approve write';
    case 'community_claim_required':
      return 'Community claim required';
    case 'sign_in_required':
    default:
      return 'Sign in required';
  }
}

function getGateMessage(
  reason: NexusAuthGateReason,
  hasPendingAction: boolean
): string {
  switch (reason) {
    case 'unlock_required':
      return hasPendingAction
        ? 'Your claimed session is active, but the local signing bundle is locked. Enter the bundle passphrase once to unlock this identity, approve the pending action, and continue without losing your draft.'
        : 'Your claimed session is active, but the local signing bundle is locked. Unlock this identity before Nexus signs packets from this device.';
    case 'stale_actor_packet':
      return 'This device is holding an outdated claimed identity packet for the current session. Refresh the claimed session before writing Nexus packets.';
    case 'session_refresh_required':
      return 'Refresh or sign in to your claimed identity before writing Nexus packets.';
    case 'write_approval_required':
      return 'Your write-protection setting asks for fresh approval before this action is written.';
    case 'community_claim_required':
      return 'This forum is for people whose claimed home-locality branch includes this community. You can visit and read here, but posting belongs to the local community context.';
    case 'sign_in_required':
    default:
      return 'Sign in to a claimed identity before using this protected action.';
  }
}

function getPrimaryLabel(reason: NexusAuthGateReason): string {
  switch (reason) {
    case 'unlock_required':
      return 'Unlock identity';
    case 'stale_actor_packet':
      return 'Refresh identity';
    case 'session_refresh_required':
      return 'Sign in';
    case 'write_approval_required':
      return 'Approve write';
    case 'community_claim_required':
      return 'Claim community';
    case 'sign_in_required':
    default:
      return 'Sign in';
  }
}

function NexusAuthGateModal(input: {
  gate: NexusAuthGateState;
  currentLabel: string;
  hasAvailablePasskeyApproval: boolean;
  hasPendingAction: boolean;
  showPasswordField: boolean;
  unlockPassphrase: string;
  gateErrorMessage: string | null;
  isSubmitting: boolean;
  onChangeUnlockPassphrase: (nextValue: string) => void;
  onDismiss: () => void;
  onPrimary: () => void | Promise<void>;
  onUsePasskey: () => void | Promise<void>;
  onSetUpPasskey: () => void;
}) {
  const appearance = useNexusAppearance();
  const passwordLabel =
    input.gate.reason === 'write_approval_required'
      ? `Enter your password for ${input.currentLabel}`
      : input.gate.reason === 'sign_in_required' ||
          input.gate.reason === 'session_refresh_required' ||
          input.gate.reason === 'stale_actor_packet'
        ? `Enter your password for ${input.currentLabel}`
      : input.hasPendingAction
        ? `Enter your password for ${input.currentLabel}`
        : 'Bundle passphrase';
  const passwordHint =
    input.gate.reason === 'write_approval_required'
      ? 'Fresh password entry approves this protected write and then resumes the pending action.'
      : input.gate.reason === 'sign_in_required' ||
          input.gate.reason === 'session_refresh_required' ||
          input.gate.reason === 'stale_actor_packet'
        ? 'This signs the claimed identity back into the current session, updates the local signer state, and then resumes the pending action.'
      : input.hasPendingAction
        ? 'Fresh password entry unlocks the local bundle, satisfies this protected write, and then resumes the pending action.'
        : 'Unlock stays local to this device and does not change your claimed session.';

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/55 px-5">
      <Pressable
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={input.onDismiss}
      />
      <NexusCard tone="gold" className="z-10 w-full max-w-[560px] gap-4">
        <Text className={appearance.surfaceTitleClass}>
          {getGateTitle(input.gate.reason)}
        </Text>
        <Text className={appearance.itemBodyClass}>
          {getGateMessage(input.gate.reason, input.hasPendingAction)}
        </Text>
        {input.showPasswordField ? (
          <IdentityField
            label={passwordLabel}
            hint={passwordHint}
            error={input.gateErrorMessage ?? undefined}
          >
            <IdentityInput
              value={input.unlockPassphrase}
              onChangeText={input.onChangeUnlockPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              placeholder="Enter the bundle passphrase"
              editable={!input.isSubmitting}
              onSubmitEditing={() => {
                void input.onPrimary();
              }}
            />
          </IdentityField>
        ) : input.gateErrorMessage ? (
          <Text className="text-sm text-nexus-rose">{input.gateErrorMessage}</Text>
        ) : null}
        {input.gate.reason === 'write_approval_required' ? (
          <Pressable
            accessibilityRole="button"
            disabled={input.isSubmitting}
            onPress={() => {
              if (input.hasAvailablePasskeyApproval) {
                void input.onUsePasskey();
                return;
              }

              input.onSetUpPasskey();
            }}
          >
            <Text className="text-sm font-semibold text-nexus-sky">
              {input.hasAvailablePasskeyApproval
                ? 'Or use passkey'
                : 'Or set up passkey'}
            </Text>
          </Pressable>
        ) : null}
        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={getPrimaryLabel(input.gate.reason)}
            variant="primary"
            onPress={() => {
              void input.onPrimary();
            }}
          />
          <NexusActionButton
            label="Go back"
            variant="secondary"
            onPress={input.onDismiss}
          />
        </View>
      </NexusCard>
    </View>
  );
}

export function useNexusAuthGate(input: {
  returnTo: string;
  returnScopeId: string | null;
}): {
  authGateModal: ReactNode;
  guardNexusWrite: (
    options: NexusAuthGateOptions,
    action: () => void | Promise<void>
  ) => Promise<void>;
  openNexusAuthGate: (reason: NexusAuthGateReason) => void;
  openNexusAuthGateForError: (
    error: unknown,
    retryAction?: () => void | Promise<void>
  ) => boolean;
} {
  const router = useRouter();
  const {
    currentMode,
    currentActorPacketId,
    currentLabel,
    hasAvailablePasskeyApproval,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    approveProtectedWriteWithPassphrase,
    approveProtectedWriteWithPasskey,
    recoverClaimedSessionInPlace,
    resumeClaimedIdentitySessionWithPassphrase,
    storedIdentityPreviews,
    unlockStoredIdentity,
  } = useIdentityShell();
  const [gate, setGate] = useState<NexusAuthGateState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [gateErrorMessage, setGateErrorMessage] = useState<string | null>(null);
  const [isSubmittingGate, setIsSubmittingGate] = useState(false);
  const canUseLocalClaimedPassphraseRecovery = Boolean(
    currentMode === 'claimed' &&
      currentActorPacketId &&
      storedIdentityPreviews.some(
        (identity) =>
          identity.actor_packet_id === currentActorPacketId &&
          identity.stored_kind === 'claimed'
      )
  );

  const openNexusAuthGate = (reason: NexusAuthGateReason) => {
    setUnlockPassphrase('');
    setGateErrorMessage(null);
    setIsSubmittingGate(false);
    setGate({
      reason,
      returnTo: input.returnTo,
      returnScopeId: input.returnScopeId,
    });
  };

  const getRequiredGate = (
    options: NexusAuthGateOptions
  ): NexusAuthGateReason | null => {
    if (options.communityClaimRequired) {
      return 'community_claim_required';
    }

    if (options.requiresClaimedIdentity && currentMode !== 'claimed') {
      return 'sign_in_required';
    }

    if (currentMode === 'claimed' && !isAuthenticated) {
      return 'session_refresh_required';
    }

    if (currentMode === 'claimed' && !isCurrentIdentityUnlocked) {
      return 'unlock_required';
    }

    return null;
  };

  const guardNexusWrite = async (
    options: NexusAuthGateOptions,
    action: () => void | Promise<void>
  ) => {
    const requiredGate = getRequiredGate(options);

    if (requiredGate) {
      if (requiredGate !== 'community_claim_required') {
        setPendingAction(() => action);
      }

      openNexusAuthGate(requiredGate);
      return;
    }

    await action();
  };

  const openNexusAuthGateForError = (
    error: unknown,
    retryAction?: () => void | Promise<void>
  ): boolean => {
    if (!isNexusAuthGateError(error)) {
      return false;
    }

    if (retryAction) {
      setPendingAction(() => retryAction);
    }

    openNexusAuthGate(error.reason);
    return true;
  };

  const handleDismiss = () => {
    setGate(null);
    setPendingAction(null);
    setUnlockPassphrase('');
    setGateErrorMessage(null);
    setIsSubmittingGate(false);
  };

  const closeGateBeforeQueuedAction = () => {
    setGate(null);
    setPendingAction(null);
    setUnlockPassphrase('');
    setGateErrorMessage(null);
    setIsSubmittingGate(false);
  };

  const runQueuedActionAfterGate = async (action: PendingAction) => {
    if (!action) {
      return;
    }

    try {
      await action();
    } catch (error) {
      if (openNexusAuthGateForError(error, action)) {
        return;
      }

      setGateErrorMessage(
        error instanceof Error ? error.message : 'Unable to complete that action.'
      );
    }
  };

  const handlePrimary = async () => {
    if (!gate || isSubmittingGate) {
      return;
    }

    if (gate.reason === 'community_claim_required') {
      setGate(null);
      setPendingAction(null);
      router.push({
        pathname: '/nexus/trust',
        params: {
          return_to: gate.returnTo,
          ...(gate.returnScopeId ? { return_scope_id: gate.returnScopeId } : {}),
        },
      } as Href);
      return;
    }

    if (gate.reason === 'unlock_required') {
      if (!currentActorPacketId) {
        setGateErrorMessage('No claimed identity is active for this unlock request.');
        return;
      }

      if (!unlockPassphrase.trim()) {
        setGateErrorMessage('Enter the bundle passphrase to unlock this identity.');
        return;
      }

      setIsSubmittingGate(true);
      setGateErrorMessage(null);

      try {
        if (pendingAction) {
          await approveProtectedWriteWithPassphrase(unlockPassphrase);
        } else {
          await unlockStoredIdentity({
            actorPacketId: currentActorPacketId,
            passphrase: unlockPassphrase,
          });
        }
        const action = pendingAction;

        closeGateBeforeQueuedAction();
        await runQueuedActionAfterGate(action);
      } catch (error) {
        if (openNexusAuthGateForError(error, pendingAction ?? undefined)) {
          return;
        }
        setIsSubmittingGate(false);
        setGateErrorMessage(
          error instanceof Error ? error.message : 'Unable to unlock this identity.'
        );
      }

      return;
    }

    if (gate.reason === 'write_approval_required') {
      if (!unlockPassphrase.trim()) {
        setGateErrorMessage(`Enter the bundle passphrase for ${currentLabel}.`);
        return;
      }

      setIsSubmittingGate(true);
      setGateErrorMessage(null);
      const action = pendingAction;

      try {
        await approveProtectedWriteWithPassphrase(unlockPassphrase);
        closeGateBeforeQueuedAction();
        await runQueuedActionAfterGate(action);
      } catch (error) {
        if (openNexusAuthGateForError(error, action ?? undefined)) {
          return;
        }
        setIsSubmittingGate(false);
        setGateErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to approve this protected write.'
        );
      }

      return;
    }

    if (
      gate.reason === 'stale_actor_packet' ||
      gate.reason === 'session_refresh_required' ||
      gate.reason === 'sign_in_required'
    ) {
      setIsSubmittingGate(true);
      setGateErrorMessage(null);
      const action = pendingAction;

      try {
        const recoveredInPlace = await recoverClaimedSessionInPlace();

        if (recoveredInPlace) {
          closeGateBeforeQueuedAction();
          await runQueuedActionAfterGate(action);
          return;
        }

        if (canUseLocalClaimedPassphraseRecovery) {
          if (!unlockPassphrase.trim()) {
            setIsSubmittingGate(false);
            setGateErrorMessage(`Enter the bundle passphrase for ${currentLabel}.`);
            return;
          }

          await resumeClaimedIdentitySessionWithPassphrase(unlockPassphrase);
          closeGateBeforeQueuedAction();
          await runQueuedActionAfterGate(action);
          return;
        }
      } catch (error) {
        if (openNexusAuthGateForError(error, action ?? undefined)) {
          return;
        }

        setIsSubmittingGate(false);
        setGateErrorMessage(
          error instanceof Error ? error.message : 'Unable to refresh this identity.'
        );
        return;
      }

      setGate(null);
      setPendingAction(null);
      router.push(
        buildIdentityRouteHref({
          pathname: '/nexus/identity/sign-in',
          returnTo: gate.returnTo,
          returnScopeId: gate.returnScopeId,
        })
      );
      return;
    }

    setGate(null);
    setPendingAction(null);
    router.push(
      buildIdentityRouteHref({
        pathname: '/nexus/identity/sign-in',
        returnTo: gate.returnTo,
        returnScopeId: gate.returnScopeId,
      })
    );
  };

  return {
    authGateModal: gate ? (
      <NexusAuthGateModal
        gate={gate}
        currentLabel={currentLabel}
        hasAvailablePasskeyApproval={hasAvailablePasskeyApproval}
        hasPendingAction={Boolean(pendingAction)}
        showPasswordField={
          gate.reason === 'unlock_required' ||
          gate.reason === 'write_approval_required' ||
          ((gate.reason === 'sign_in_required' ||
            gate.reason === 'session_refresh_required' ||
            gate.reason === 'stale_actor_packet') &&
            canUseLocalClaimedPassphraseRecovery)
        }
        unlockPassphrase={unlockPassphrase}
        gateErrorMessage={gateErrorMessage}
        isSubmitting={isSubmittingGate}
        onChangeUnlockPassphrase={setUnlockPassphrase}
        onDismiss={handleDismiss}
        onPrimary={handlePrimary}
        onUsePasskey={async () => {
          const action = pendingAction;

          setIsSubmittingGate(true);
          setGateErrorMessage(null);

          try {
            await approveProtectedWriteWithPasskey();
            closeGateBeforeQueuedAction();
            await runQueuedActionAfterGate(action);
          } catch (error) {
            if (openNexusAuthGateForError(error, action ?? undefined)) {
              return;
            }
            setIsSubmittingGate(false);
            setGateErrorMessage(
              error instanceof Error
                ? error.message
                : 'Unable to approve this protected write.'
            );
          }
        }}
        onSetUpPasskey={() => {
          handleDismiss();
          router.push('/nexus/identity/security');
        }}
      />
    ) : null,
    guardNexusWrite,
    openNexusAuthGate,
    openNexusAuthGateForError,
  };
}
