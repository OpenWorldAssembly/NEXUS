import { Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';

type NexusPacketExplorerHomePanelProps = {
  searchValue: string;
  onChangeSearchValue: (value: string) => void;
};

export function NexusPacketExplorerHomePanel({
  searchValue,
  onChangeSearchValue,
}: NexusPacketExplorerHomePanelProps) {
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
            Open packets from Library to inspect them here. Search, import, and
            bundle tools are visible now and will be wired in later passes.
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
            disabled
            featureStatusId="explorer.home.import_packet"
          />
          <NexusActionButton
            label="Import bundle"
            disabled
            featureStatusId="explorer.home.import_bundle"
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
          Search and import flows remain visible but read-only in this phase.
          Use the live Library `Open packet` action to inspect packet data now.
        </Text>
      </NexusCard>
    </View>
  );
}
