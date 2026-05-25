/**
 * File: nexus-modal-shell.tsx
 * Description: Shared Nexus modal chrome for backdrop, centering, and card framing.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import { NexusCard } from '../cards/nexus-card';

type NexusModalShellProps = {
  accessibilityLabel?: string;
  animationType?: 'none' | 'slide' | 'fade';
  backdropClassName?: string;
  cardClassName?: string;
  children: ReactNode;
  contentClassName?: string | null;
  containerClassName?: string;
  onClose: () => void;
  tone?: NexusCardTone | 'default';
  visible: boolean;
};

/**
 * Inputs: modal state, close handler, and already-composed modal content.
 * Output: a layout-preserving Nexus modal shell with caller-owned content.
 */
export function NexusModalShell({
  accessibilityLabel = 'Close modal',
  animationType = 'fade',
  backdropClassName = 'absolute inset-0 bg-black/55',
  cardClassName = 'w-full max-w-[520px] gap-4',
  children,
  contentClassName = 'flex-1 items-center justify-center px-4',
  containerClassName = 'flex-1',
  onClose,
  tone = 'default',
  visible,
}: NexusModalShellProps) {
  const modalCard = (
    <NexusCard className={cardClassName} tone={tone}>
      {children}
    </NexusCard>
  );

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className={containerClassName}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          className={backdropClassName}
          onPress={onClose}
        />
        {contentClassName === null ? (
          modalCard
        ) : (
          <View className={contentClassName}>{modalCard}</View>
        )}
      </View>
    </Modal>
  );
}
