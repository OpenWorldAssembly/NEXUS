import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  NexusAttachedTabRail,
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import { NexusPacketExplorerExportPanel } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-export-panel';
import { NexusPacketExplorerImportPanel } from '@app/components/nexus/packet-explorer/nexus-packet-explorer-import-panel';
import type { PacketExplorerHomeSubtab } from '@runtime/nexus/packet-explorer-session';

type NexusPacketExplorerHomePanelProps = {
  activeHomeSubtab: PacketExplorerHomeSubtab;
  selectedPacketId: string | null;
  selectedPacketTitle: string | null;
  searchValue: string;
  onChangeSearchValue: (value: string) => void;
  onSelectHomeSubtab: (subtab: PacketExplorerHomeSubtab) => void;
  onOpenPacketInExplorer: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
};

function NexusPacketExplorerSearchPanel({
  searchValue,
  onChangeSearchValue,
  onActivateImportShortcut,
}: Pick<
  NexusPacketExplorerHomePanelProps,
  'searchValue' | 'onChangeSearchValue'
> & {
  onActivateImportShortcut: (intent: 'packet' | 'bundle') => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Packet Explorer
          </Text>
          <Text className={appearance.surfaceTitleClass}>
            Global Packet Workspace
          </Text>
          <Text className={appearance.sectionBodyClass}>
            Open packets from Library to inspect them here. Search is still
            visible as the future direct lookup seam.
          </Text>
        </View>

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          onChangeText={onChangeSearchValue}
          placeholder="Paste a packet id or revision id"
          placeholderTextColor={appearance.textInputPlaceholderColor}
          value={searchValue}
        />

        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton
            label="Search packets"
            disabled
            featureStatusId="explorer.home.search_packets"
          />
          <NexusActionButton
            label="Import packet"
            onPress={() => onActivateImportShortcut('packet')}
          />
          <NexusActionButton
            label="Import bundle"
            onPress={() => onActivateImportShortcut('bundle')}
          />
          <NexusActionButton
            label="Open recent"
            disabled
            featureStatusId="explorer.home.open_recent"
          />
        </View>
      </NexusCard>

      <NexusCard tone="gold">
        <Text className={appearance.itemBodyClass}>
          Search is still visible but not live in this phase. Use Import for
          structural JSON ingest and Export for portability workflows.
        </Text>
      </NexusCard>
    </View>
  );
}

export function NexusPacketExplorerHomePanel({
  activeHomeSubtab,
  selectedPacketId,
  selectedPacketTitle,
  searchValue,
  onChangeSearchValue,
  onSelectHomeSubtab,
  onOpenPacketInExplorer,
}: NexusPacketExplorerHomePanelProps) {
  const [importShortcutIntent, setImportShortcutIntent] = useState<
    'packet' | 'bundle' | null
  >(null);

  const handleActivateImportShortcut = (intent: 'packet' | 'bundle') => {
    setImportShortcutIntent(intent);
    onSelectHomeSubtab('import');
  };

  const handleSelectHomeSubtab = (subtab: PacketExplorerHomeSubtab) => {
    if (subtab !== 'import') {
      setImportShortcutIntent(null);
    }

    onSelectHomeSubtab(subtab);
  };

  return (
    <View className="gap-4">
      <NexusAttachedTabRail
        tabs={[
          { id: 'search', title: 'Search' },
          { id: 'import', title: 'Import' },
          { id: 'export', title: 'Export' },
        ]}
        activeId={activeHomeSubtab}
        compact
        onSelect={(tabId) =>
          handleSelectHomeSubtab(tabId as PacketExplorerHomeSubtab)
        }
      />

      {activeHomeSubtab === 'search' ? (
        <NexusPacketExplorerSearchPanel
          searchValue={searchValue}
          onChangeSearchValue={onChangeSearchValue}
          onActivateImportShortcut={handleActivateImportShortcut}
        />
      ) : activeHomeSubtab === 'import' ? (
        <NexusPacketExplorerImportPanel
          shortcutIntent={importShortcutIntent}
          onOpenPacketInExplorer={onOpenPacketInExplorer}
        />
      ) : (
        <NexusPacketExplorerExportPanel
          selectedPacketId={selectedPacketId}
          selectedPacketTitle={selectedPacketTitle}
        />
      )}
    </View>
  );
}
