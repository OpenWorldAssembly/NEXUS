/**
 * File: restore.tsx
 * Description: Renders the Nexus-shell encrypted identity bundle restore flow.
 */

import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { buildIdentityRouteHref, getIdentityReturnDestination } from '@app/components/nexus/nexus-route-utils';
import {
  IdentityField,
  IdentityInput,
  IdentityPageShell,
} from '@app/components/nexus/nexus-identity-ui';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { NexusActionButton, NexusCard } from '@app/components/nexus/ui';
import {
  validateEncryptedBundleJson,
  validatePassphrase,
} from '@runtime/nexus/identity-validation';

export default function NexusIdentityRestorePage() {
  const params = useLocalSearchParams<{
    return_to?: string | string[];
    return_scope_id?: string | string[];
  }>();
  const router = useRouter();
  const { setActiveScopeId } = useNexusShell();
  const { restoreIdentityFromBundle } = useIdentityShell();
  const [bundleJson, setBundleJson] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { returnTo, returnScopeId } = getIdentityReturnDestination({
    returnToParam: params.return_to,
    returnScopeIdParam: params.return_scope_id,
    fallback: '/nexus/identity/security',
  });

  const bundleError =
    bundleJson.length > 0
      ? validateEncryptedBundleJson(bundleJson)
      : 'Paste an encrypted identity bundle.';
  const passphraseError =
    passphrase.length > 0 ? validatePassphrase(passphrase) : 'Bundle passphrase is required.';

  const handleRestore = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await restoreIdentityFromBundle({
        encryptedBundleJson: bundleJson,
        passphrase,
      });
      if (returnScopeId) {
        setActiveScopeId(returnScopeId);
      }

      router.replace(returnTo as Href);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to restore that bundle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <IdentityPageShell
      eyebrow="Identity"
      title="Restore a claimed identity"
      description="Bring an encrypted identity bundle back onto this device. The passphrase decrypts the bundle locally before Nexus verifies the claimed actor."
    >
      <NexusCard className="gap-4">
        <IdentityField label="Encrypted identity bundle" error={bundleError ?? undefined}>
          <IdentityInput
            value={bundleJson}
            onChangeText={setBundleJson}
            placeholder="Paste encrypted identity bundle JSON"
            multiline
            style={{ minHeight: 220, textAlignVertical: 'top' }}
          />
        </IdentityField>
        <IdentityField
          label="Bundle passphrase"
          hint="This unlocks the exported bundle locally. It is not a passkey."
          error={passphraseError ?? undefined}
        >
          <IdentityInput
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Passphrase used for this bundle"
            secureTextEntry
          />
        </IdentityField>
        {errorMessage ? <Text className="text-sm text-nexus-rose">{errorMessage}</Text> : null}
        <View className="flex-row flex-wrap gap-3">
          {returnTo !== '/nexus/identity/security' ? (
            <NexusActionButton
              label="Go back"
              onPress={() => {
                if (returnScopeId) {
                  setActiveScopeId(returnScopeId);
                }

                router.push(returnTo as Href);
              }}
            />
          ) : null}
          <NexusActionButton
            label={isSubmitting ? 'Restoring identity...' : 'Restore identity bundle'}
            variant="primary"
            onPress={() => {
              void handleRestore();
            }}
            disabled={isSubmitting || Boolean(bundleError) || Boolean(passphraseError)}
          />
          <NexusActionButton
            label="Sign in instead"
            onPress={() =>
              router.push(
                buildIdentityRouteHref({
                  pathname: '/nexus/identity/sign-in',
                  returnTo:
                    returnTo !== '/nexus/identity/security' ? returnTo : null,
                  returnScopeId,
                })
              )
            }
          />
          <NexusActionButton
            label="Create new"
            onPress={() =>
              router.push(
                buildIdentityRouteHref({
                  pathname: '/nexus/identity/create',
                  returnTo:
                    returnTo !== '/nexus/identity/security' ? returnTo : null,
                  returnScopeId,
                })
              )
            }
          />
        </View>
      </NexusCard>
    </IdentityPageShell>
  );
}
