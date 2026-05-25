/**
 * File: nexus-popover.tsx
 * Description: Lightweight shared Nexus popover frame for caller-positioned overlays.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

type NexusPopoverProps = {
  children: ReactNode;
  className?: string;
};

export function NexusPopover({
  children,
  className = 'rounded-[22px] border border-nexus-line/70 bg-nexus-panel p-3 shadow-2xl',
}: NexusPopoverProps) {
  return <View className={className}>{children}</View>;
}
