import { NexusTabRail } from '@app/components/nexus/ui/tabs/nexus-tabs';
import type { PacketExplorerPrimaryTab } from '@runtime/nexus/packet-explorer-session';

const PRIMARY_TAB_OPTIONS: {
  id: PacketExplorerPrimaryTab;
  label: string;
}[] = [
  {
    id: 'data',
    label: 'Data',
  },
  {
    id: 'verification',
    label: 'Validation',
  },
  {
    id: 'lineage',
    label: 'Lineage',
  },
  {
    id: 'links',
    label: 'Links',
  },
  {
    id: 'actions',
    label: 'Actions',
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
    <NexusTabRail
      activeId={activeId}
      depth={1}
      maxRows={2}
      nodes={PRIMARY_TAB_OPTIONS}
      onSelect={(primaryTabId) => onSelect(primaryTabId as PacketExplorerPrimaryTab)}
      truncate="middle"
      wrapMode="wrap"
    />
  );
}
