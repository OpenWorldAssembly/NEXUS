/**
 * File: nexus-auth-gate.tsx
 * Description: Shared modal and hook for protected Nexus auth/write gates.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

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

function getGateMessage(reason: NexusAuthGateReason): string {
  switch (reason) {
    case 'unlock_required':
      return 'Your claimed session is active, but the local signing bundle is locked. Unlock this identity before Nexus signs packets from this device.';
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
  onDismiss: () => void;
  onPrimary: () => void;
}) {
  const appearance = useNexusAppearance();

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
          {getGateMessage(input.gate.reason)}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={getPrimaryLabel(input.gate.reason)}
            variant="primary"
            onPress={input.onPrimary}
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
  openNexusAuthGateForError: (error: unknown) => boolean;
} {
  const router = useRouter();
  const {
    currentMode,
    isAuthenticated,
    isCurrentIdentityUnlocked,
    securityMode,
  } = useIdentityShell();
  const [gate, setGate] = useState<NexusAuthGateState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const openNexusAuthGate = (reason: NexusAuthGateReason) => {
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

    if (
      currentMode === 'claimed' &&
      (securityMode === 'every_write' ||
        (securityMode === 'guarded' && options.writeRisk === 'high_impact'))
    ) {
      return 'write_approval_required';
    }

    return null;
  };

  const guardNexusWrite = async (
    options: NexusAuthGateOptions,
    action: () => void | Promise<void>
  ) => {
    const requiredGate = getRequiredGate(options);

    if (requiredGate) {
      if (requiredGate === 'write_approval_required') {
        setPendingAction(() => action);
      }

      openNexusAuthGate(requiredGate);
      return;
    }

    await action();
  };

  const openNexusAuthGateForError = (error: unknown): boolean => {
    if (!isNexusAuthGateError(error)) {
      return false;
    }

    openNexusAuthGate(error.reason);
    return true;
  };

  const handleDismiss = () => {
    setGate(null);
    setPendingAction(null);
  };

  const handlePrimary = () => {
    if (!gate) {
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

    if (gate.reason === 'write_approval_required') {
      const action = pendingAction;

      setGate(null);
      setPendingAction(null);
      void action?.();
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
        onDismiss={handleDismiss}
        onPrimary={handlePrimary}
      />
    ) : null,
    guardNexusWrite,
    openNexusAuthGate,
    openNexusAuthGateForError,
  };
}
