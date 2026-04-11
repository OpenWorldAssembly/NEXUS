/**
 * File: restore.tsx
 * Description: Renders the Nexus-shell encrypted identity bundle restore flow.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  IdentityField,
  IdentityInput,
  IdentityPageShell,
} from '@/components/nexus/nexus-identity-ui';
import { useIdentityShell } from '@/components/nexus/identity-shell-context';
import { NexusActionButton, NexusCard } from '@/components/nexus/nexus-ui';
import {
  validateEncryptedBundleJson,
  validatePassphrase,
} from '@/lib/nexus/identity-validation';

export default function NexusIdentityRestorePage() {
  const router = useRouter();
  const { restoreIdentityFromBundle } = useIdentityShell();
  const [bundleJson, setBundleJson] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      router.replace('/nexus/identity/security');
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
            onPress={() => router.push('/nexus/identity/sign-in')}
          />
          <NexusActionButton
            label="Create new"
            onPress={() => router.push('/nexus/identity/create')}
          />
        </View>
      </NexusCard>
    </IdentityPageShell>
  );
}
