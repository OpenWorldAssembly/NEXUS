/**
 * File: nexus-packet-explorer-validation-dialog.tsx
 * Description: Feature-local validation outcome dialog for Packet Explorer.
 */
import { Text, View } from 'react-native';

import { NexusActionButton } from '@app/components/nexus/ui';
import { NexusModalShell } from '@app/components/nexus/ui/overlays';
import type { NexusPacketVerificationActionPayload } from '@runtime/nexus/nexus-api-types';

type NexusPacketExplorerValidationDialogProps = {
  headingTextClass: string;
  mutedTextClass: string;
  notice: NexusPacketVerificationActionPayload | null;
  error: string | null;
  onClose: () => void;
};

export function NexusPacketExplorerValidationDialog({
  headingTextClass,
  mutedTextClass,
  notice,
  error,
  onClose,
}: NexusPacketExplorerValidationDialogProps) {
  return (
    <NexusModalShell onClose={onClose} visible={notice !== null || error !== null}>
      <Text className={headingTextClass}>
        {notice?.title ?? 'Validation failed'}
      </Text>
      <Text className={mutedTextClass}>
        {notice?.summary ?? error ?? ''}
      </Text>
      {notice ? (
        <Text className={mutedTextClass}>
          Validated at: {notice.validated_at}
        </Text>
      ) : null}
      {notice?.warnings.length ? (
        <View className="gap-1">
          {notice.warnings.map((warning) => (
            <Text key={warning} className={mutedTextClass}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
      <View className="flex-row justify-end">
        <NexusActionButton
          label="Dismiss"
          variant="ghost"
          onPress={onClose}
        />
      </View>
    </NexusModalShell>
  );
}
