/**
 * File: packet-action-contract.ts
 * Description: Declares base packet action descriptors shared by runtime projections and UI bridges.
 */

import type { NexusActionIntentDescriptor } from '@core/contracts';

export const PACKET_ACTION_DESCRIPTORS: NexusActionIntentDescriptor[] = [
  {
    id: 'packet.focus',
    label: 'Focus packet',
    description: 'Open the packet in its best contextual surface with focus/highlight parameters.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.open_surface',
    label: 'Open contextual surface',
    description: 'Open the packet in the best available Nexus surface.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.open_explorer',
    label: 'Open in Explorer',
    description: 'Open the packet in the global Packet Explorer.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.validate',
    label: 'Validate packet',
    description: 'Run local packet verification and sign a verification report.',
    execution_kind: 'query',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.revalidate',
    label: 'Revalidate packet',
    description: 'Run local packet verification again and revise the existing verification report.',
    execution_kind: 'query',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.view_verification',
    label: 'View verification',
    description: 'Open the packet Explorer verification tab.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.view_library',
    label: 'View in Library',
    description: 'Open the packet in the Library surface.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.view_raw',
    label: 'View raw packet',
    description: 'Open the packet Explorer on the raw envelope view.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.export',
    label: 'Export packet',
    description: 'Open the Packet Explorer export panel with this packet selected.',
    execution_kind: 'navigation',
    requires_selection: true,
    target_kind: 'packet',
  },
  {
    id: 'packet.copy_id',
    label: 'Copy packet ID',
    description: 'Copy the packet identifier to the clipboard.',
    execution_kind: 'local',
    requires_selection: true,
    target_kind: 'packet',
  },
];

export function getPacketActionDescriptor(
  actionId: NexusActionIntentDescriptor['id']
): NexusActionIntentDescriptor | null {
  return PACKET_ACTION_DESCRIPTORS.find(
    (descriptor) => descriptor.id === actionId
  ) ?? null;
}
