import {
  NexusAttachedTabRail,
} from '@app/components/nexus/nexus-ui';
import type { PacketExplorerPrimaryTab } from '@runtime/nexus/packet-explorer-session';

const PRIMARY_TAB_OPTIONS: {
  id: PacketExplorerPrimaryTab;
  title: string;
}[] = [
  {
    id: 'data',
    title: 'Data',
  },
  {
    id: 'lineage',
    title: 'Lineage',
  },
  {
    id: 'links',
    title: 'Links',
  },
  {
    id: 'actions',
    title: 'Actions',
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
