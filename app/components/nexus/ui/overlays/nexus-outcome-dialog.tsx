/**
 * File: nexus-outcome-dialog.tsx
 * Description: Shared Nexus outcome dialog built on the modal shell.
 */
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import { NexusActionButton } from '../actions/nexus-action-button';
import { useNexusAppearance } from '../layout/nexus-chrome';
import { NexusModalShell } from './nexus-modal-shell';

type NexusOutcomeDialogProps = {
  actionLabel?: string;
  body: string;
  cardClassName?: string;
  onClose: () => void;
  tone?: NexusCardTone | 'default';
  title: string;
  trailingActions?: ReactNode;
  visible: boolean;
};

export function NexusOutcomeDialog({
  actionLabel = 'Close',
  body,
  cardClassName,
  onClose,
  tone = 'default',
  title,
  trailingActions = null,
  visible,
}: NexusOutcomeDialogProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusModalShell
      cardClassName={cardClassName}
      onClose={onClose}
      tone={tone}
      visible={visible}
    >
      <Text className={appearance.surfaceTitleClass}>{title}</Text>
      <Text className={appearance.itemBodyClass}>{body}</Text>
      <View className="flex-row flex-wrap justify-end gap-3">
        {trailingActions}
        <NexusActionButton
          label={actionLabel}
          onPress={onClose}
          variant="primary"
        />
      </View>
    </NexusModalShell>
  );
}
