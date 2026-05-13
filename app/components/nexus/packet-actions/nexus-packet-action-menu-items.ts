/**
 * File: nexus-packet-action-menu-items.ts
 * Description: Converts runtime-projected PacketActions into generic Nexus action-menu items.
 */

import type { NexusActionState, NexusPacketCardProjection } from '@core/contracts';
import type { NexusActionMenuItem } from '@app/components/nexus/action-card';
import {
  getNexusPreviewSurfaceLabel,
  resolveNexusPreviewTargetHref,
  type NexusPreviewSurface,
  type NexusPreviewTargetIntent,
} from '@app/components/nexus/preview';
import type {
  NexusPacketActionProjection,
  NexusPacketVerificationActionPayload,
} from '@runtime/nexus/nexus-api-types';
import type {
  PacketExplorerHomeSubtab,
  PacketExplorerPrimaryTab,
  PacketExplorerViewMode,
} from '@runtime/nexus/packet-explorer-session';

type PacketExplorerSeedSummary = {
  family: string | null;
  summary: string | null;
  label: string | null;
};

type OpenPacketInExplorer = (input: {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: PacketExplorerSeedSummary | null;
  activePrimaryTab?: PacketExplorerPrimaryTab;
  selectedDataViewMode?: PacketExplorerViewMode;
}) => void;

type OpenExplorer = (input?: {
  subtab?: PacketExplorerHomeSubtab;
  packetId?: string | null;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: PacketExplorerSeedSummary | null;
}) => void;

const PACKET_ACTION_ORDER = [
  'packet.focus',
  'packet.open_surface',
  'packet.open_explorer',
  'packet.validate',
  'packet.revalidate',
  'packet.view_verification',
  'packet.view_library',
  'packet.view_raw',
  'packet.export',
  'packet.copy_id',
] as const;

const PACKET_ACTION_LABELS: Record<string, string> = {
  'packet.focus': 'Focus packet',
  'packet.open_surface': 'Open packet',
  'packet.open_explorer': 'Open in Explorer',
  'packet.validate': 'Validate packet',
  'packet.revalidate': 'Revalidate packet',
  'packet.view_verification': 'View validation',
  'packet.view_library': 'View in Library',
  'packet.view_raw': 'View raw packet',
  'packet.export': 'Export packet',
  'packet.copy_id': 'Copy packet ID',
};

function asPreviewSurface(value: string | null | undefined): NexusPreviewSurface | null {
  if (
    value === 'dashboard' ||
    value === 'discussions' ||
    value === 'votes' ||
    value === 'roles' ||
    value === 'trust' ||
    value === 'library' ||
    value === 'explorer'
  ) {
    return value;
  }

  return null;
}

function asPreviewIntent(value: string | null | undefined): NexusPreviewTargetIntent {
  return value === 'focus' ? 'focus' : 'open';
}

function getActionLabel(action: NexusActionState): string {
  if (
    (action.id === 'packet.focus' || action.id === 'packet.open_surface') &&
    action.target_surface
  ) {
    const surface = asPreviewSurface(action.target_surface);

    if (surface) {
      return action.id === 'packet.focus'
        ? `Focus in ${getNexusPreviewSurfaceLabel(surface)}`
        : `Open in ${getNexusPreviewSurfaceLabel(surface)}`;
    }
  }

  return PACKET_ACTION_LABELS[action.id] ?? action.id;
}

function getSeedSummary(input: {
  packet: NexusPacketCardProjection;
  projection: NexusPacketActionProjection;
}): PacketExplorerSeedSummary {
  return {
    family: input.projection.family ?? input.packet.family,
    label: input.projection.label ?? input.packet.label,
    summary: input.projection.summary ?? input.packet.summary,
  };
}

function copyToClipboard(value: string): void {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    void navigator.clipboard.writeText(value);
  }
}

export function createNexusPacketActionMenuItems(input: {
  packet: NexusPacketCardProjection;
  projection: NexusPacketActionProjection | null | undefined;
  navigateToHref: (href: string) => void;
  openPacketInExplorer: OpenPacketInExplorer;
  openExplorer: OpenExplorer;
  onFocusPacket?: (input: {
    packetId: string;
    revisionId: string | null;
    targetSurface: NexusPreviewSurface | null;
  }) => void;
  onRunVerificationAction?: (input: {
    packetId: string;
    actionId: 'packet.validate' | 'packet.revalidate';
  }) => Promise<NexusPacketVerificationActionPayload | void> | void;
}): NexusActionMenuItem[] {
  const projection = input.projection;

  if (!projection) {
    return [];
  }

  const packetId = projection.packet_id;
  const revisionId = projection.revision_id ?? input.packet.revision.revision_id;
  const seedSummary = getSeedSummary({ packet: input.packet, projection });
  const titleSnapshot = projection.title ?? input.packet.title;

  return PACKET_ACTION_ORDER.map((actionId) => projection.actions[actionId])
    .filter((action): action is NexusActionState => Boolean(action?.visible))
    .map((action) => ({
      id: action.id,
      label: getActionLabel(action),
      disabled: !action.enabled,
      tone:
        action.id === 'packet.focus'
          ? 'accent'
          : action.id === 'packet.copy_id'
            ? 'muted'
            : 'default',
      onSelect: () => {
        const targetSurface = asPreviewSurface(action.target_surface);

        if (action.id === 'packet.copy_id') {
          copyToClipboard(packetId);
          return;
        }

        if (action.id === 'packet.focus' && input.onFocusPacket) {
          input.onFocusPacket({
            packetId,
            revisionId,
            targetSurface,
          });
          return;
        }

        if (action.id === 'packet.open_explorer') {
          input.openPacketInExplorer({
            packetId,
            preferredRevisionId: revisionId,
            titleSnapshot,
            seedSummary,
          });
          return;
        }

        if (
          (action.id === 'packet.validate' ||
            action.id === 'packet.revalidate') &&
          input.onRunVerificationAction
        ) {
          void Promise.resolve(
            input.onRunVerificationAction({
              packetId,
              actionId: action.id,
            })
          ).catch(() => undefined);
          return;
        }

        if (action.id === 'packet.view_verification') {
          input.openPacketInExplorer({
            packetId,
            preferredRevisionId: revisionId,
            titleSnapshot,
            seedSummary,
            activePrimaryTab: 'verification',
          });
          return;
        }

        if (action.id === 'packet.view_raw') {
          input.openPacketInExplorer({
            packetId,
            preferredRevisionId: revisionId,
            titleSnapshot,
            seedSummary,
            activePrimaryTab: 'data',
            selectedDataViewMode: 'raw',
          });
          return;
        }

        if (action.id === 'packet.export') {
          input.openExplorer({
            subtab: 'export',
            packetId,
            preferredRevisionId: revisionId,
            titleSnapshot,
            seedSummary,
          });
          return;
        }

        if (!targetSurface || targetSurface === 'explorer') {
          input.openPacketInExplorer({
            packetId,
            preferredRevisionId: revisionId,
            titleSnapshot,
            seedSummary,
          });
          return;
        }

        const href = resolveNexusPreviewTargetHref({
          surface: targetSurface,
          packetId,
          revisionId,
          focusPacketId: action.target_packet_id ?? packetId,
          highlightPacketId: action.target_packet_id ?? packetId,
          intent: asPreviewIntent(action.target_intent),
          params: {
            packet_family: projection.family ?? input.packet.family,
          },
        });

        if (href) {
          input.navigateToHref(href);
        }
      },
    }));
}
