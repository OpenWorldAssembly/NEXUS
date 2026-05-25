/**
 * File: nexus-confirm-dialog.tsx
 * Description: Shared Nexus confirmation dialog with primary and cancel actions.
 */
import { Text, View } from 'react-native';

import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import { NexusActionButton } from '../actions/nexus-action-button';
import { useNexusAppearance } from '../layout/nexus-chrome';
import { NexusModalShell } from './nexus-modal-shell';

type NexusConfirmDialogProps = {
  body: string;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: NexusCardTone | 'default';
  title: string;
  visible: boolean;
};

export function NexusConfirmDialog({
  body,
  cancelLabel = 'Cancel',
  confirmLabel,
  onCancel,
  onConfirm,
  tone = 'default',
  title,
  visible,
}: NexusConfirmDialogProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell onClose={onCancel} tone={tone} visible={visible}>
      <View className="gap-2">
        <Text className={appearance.surfaceTitleClass}>{title}</Text>
        <Text className={appearance.itemBodyClass}>{body}</Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton
          label={confirmLabel}
          onPress={onConfirm}
          variant="primary"
        />
        <NexusActionButton
          label={cancelLabel}
          onPress={onCancel}
          variant="ghost"
        />
      </View>
    </NexusModalShell>
  );
}
