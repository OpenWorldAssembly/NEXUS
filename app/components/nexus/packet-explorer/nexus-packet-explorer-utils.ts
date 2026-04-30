import type { NexusActionIntentDescriptor, NexusActionState } from '@core/contracts';
import type {
  NexusPacketExplorerLinkGroup,
  NexusPacketExplorerLinkRow,
  NexusPacketExplorerPayload,
} from '@runtime/nexus/nexus-api-types';
import type {
  PacketExplorerTab,
  PacketExplorerViewMode,
} from '@runtime/nexus/packet-explorer-session';

export const PACKET_FETCH_TIMEOUT_MS = 15000;
export const LINK_GROUP_INITIAL_VISIBLE_COUNT = 25;
export const EXPLORER_CLIENT_DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

export function logExplorerClientEvent(packetId: string, message: string): void {
  if (!EXPLORER_CLIENT_DEBUG_ENABLED) {
    return;
  }

  console.info(`[Packet Explorer UI] ${packetId} :: ${message}`);
}

export function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Unable to serialize this view as JSON.';
  }
}

export function getExplorerTabLabel(tab: PacketExplorerTab): string {
  if (tab.kind === 'home') {
    return 'Explorer';
  }

  return tab.title_snapshot.length > 36
    ? `${tab.title_snapshot.slice(0, 33)}...`
    : tab.title_snapshot;
}

export function getViewModeLabel(viewMode: PacketExplorerViewMode): string {
  return viewMode
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatActionLabel(actionId: string): string {
  const [, actionName = actionId] = actionId.split('.');

  return actionName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getLinkTitle(
  link: NexusPacketExplorerLinkRow | NexusPacketExplorerLinkGroup
): string {
  return link.title ?? link.label ?? link.packet_id;
}

export function getActionState(
  payload: NexusPacketExplorerPayload,
  descriptor: NexusActionIntentDescriptor
): NexusActionState | null {
  return payload.actions[descriptor.id] ?? null;
}

export function getLinksBasisLabel(
  payload: NexusPacketExplorerPayload
): string {
  if (payload.links_basis === 'current_indexed_graph') {
    return 'Current indexed packet graph';
  }

  if (payload.links_basis === 'historical_raw_packet') {
    return 'Historical raw packet';
  }

  if (payload.links_basis === 'read_model_projection') {
    return 'Read model projection';
  }

  return 'Current adapted packet';
}

export function getActionsBasisLabel(
  payload: NexusPacketExplorerPayload
): string {
  if (payload.actions_basis === 'runtime_operational') {
    return 'Operational runtime affordances';
  }

  if (payload.actions_basis === 'historical_raw_packet') {
    return 'Historical raw packet';
  }

  if (payload.actions_basis === 'read_model_projection') {
    return 'Read model projection';
  }

  return 'Current adapted packet';
}
