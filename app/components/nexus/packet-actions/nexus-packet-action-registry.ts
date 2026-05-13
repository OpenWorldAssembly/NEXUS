/**
 * File: nexus-packet-action-registry.ts
 * Description: Builds reusable Nexus packet action menu items without binding them to a surface.
 */
import type { NexusActionMenuItem } from '@app/components/nexus/action-card';

export type NexusPacketActionInput = {
  packetId: string;
  title?: string | null;
};

export type NexusPacketActionHandlers = {
  onFocus?: (packet: NexusPacketActionInput) => void;
  onOpenInExplorer?: (packet: NexusPacketActionInput) => void;
};

export type NexusPacketActionRegistryInput = {
  packet: NexusPacketActionInput;
  handlers?: NexusPacketActionHandlers;
  includeFocus?: boolean;
  includeOpenInExplorer?: boolean;
};

/**
 * Inputs: packet identity plus surface-supplied handlers.
 * Output: generic packet actions in canonical menu order.
 */
export function getNexusPacketActions({
  packet,
  handlers,
  includeFocus = true,
  includeOpenInExplorer = true,
}: NexusPacketActionRegistryInput): NexusActionMenuItem[] {
  const actions: NexusActionMenuItem[] = [];

  if (includeFocus && handlers?.onFocus) {
    actions.push({
      id: 'focus-packet',
      label: 'Focus',
      description: 'Show this packet in the local focus section.',
      onSelect: () => handlers.onFocus?.(packet),
      tone: 'accent',
    });
  }

  if (includeOpenInExplorer && handlers?.onOpenInExplorer) {
    actions.push({
      id: 'open-explorer',
      label: 'Open in Explorer',
      description: 'Open this packet in the packet explorer.',
      onSelect: () => handlers.onOpenInExplorer?.(packet),
    });
  }

  return actions;
}
