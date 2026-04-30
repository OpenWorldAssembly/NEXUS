import {
  NexusAttachedTabRail,
} from '@app/components/nexus/nexus-ui';
import type { PacketExplorerPrimaryTab } from '@runtime/nexus/packet-explorer-session';

const PRIMARY_TAB_OPTIONS: {
  id: PacketExplorerPrimaryTab;
  title: string;
  detail: string;
}[] = [
  {
    id: 'data',
    title: 'Data',
    detail: 'Inspect current read lens.',
  },
  {
    id: 'lineage',
    title: 'Lineage',
    detail: 'Preferred and head revisions.',
  },
  {
    id: 'links',
    title: 'Links',
    detail: 'Incoming and outgoing edges.',
  },
  {
    id: 'actions',
    title: 'Actions',
    detail: 'Projected runtime affordances.',
  },
];

type NexusPacketExplorerPrimaryRailProps = {
  activeId: PacketExplorerPrimaryTab;
  onSelect: (primaryTab: PacketExplorerPrimaryTab) => void;
};

export function NexusPacketExplorerPrimaryRail({
  activeId,
  onSelect,
}: NexusPacketExplorerPrimaryRailProps) {
  return (
    <NexusAttachedTabRail
      compact
      tabs={PRIMARY_TAB_OPTIONS}
      activeId={activeId}
      onSelect={(primaryTabId) => onSelect(primaryTabId as PacketExplorerPrimaryTab)}
    />
  );
}
