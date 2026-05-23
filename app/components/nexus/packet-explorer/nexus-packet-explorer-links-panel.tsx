import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  NexusPacketExplorerLinkGroup,
  NexusPacketExplorerPayload,
} from '@runtime/nexus/nexus-api-types';

import {
  LINK_GROUP_INITIAL_VISIBLE_COUNT,
  formatJson,
  getLinkTitle,
  getLinksBasisLabel,
  getViewModeLabel,
} from './nexus-packet-explorer-utils';

type NexusPacketExplorerLinksPanelProps = {
  payload: NexusPacketExplorerPayload;
  onOpenPacketInNewTab: (input: {
    packetId: string;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  onOpenPacketInCurrentTab: (input: {
    packetId: string;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  onViewInLibrary: (packetId: string, type?: string | null) => void;
};

function createGroupKey(group: NexusPacketExplorerLinkGroup): string {
  return `${group.direction}:${group.packet_id}`;
}

function NexusPacketExplorerLinkDirectionSection({
  title,
  groups,
  expandedGroups,
  visibleRowsByGroup,
  onToggleGroup,
  onRevealMore,
  onOpenPacketInNewTab,
  onOpenPacketInCurrentTab,
  onViewInLibrary,
}: {
  title: string;
  groups: NexusPacketExplorerLinkGroup[];
  expandedGroups: Record<string, boolean>;
  visibleRowsByGroup: Record<string, number>;
  onToggleGroup: (groupKey: string) => void;
  onRevealMore: (groupKey: string) => void;
  onOpenPacketInNewTab: (input: {
    packetId: string;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  onOpenPacketInCurrentTab: (input: {
    packetId: string;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  onViewInLibrary: (packetId: string, type?: string | null) => void;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          {title}
        </Text>
        <NexusBadge label={`${groups.length} related packets`} tone="gold" />
      </View>

      {groups.length === 0 ? (
        <Text className={appearance.itemBodyClass}>No {title.toLowerCase()}.</Text>
      ) : (
        groups.map((group) => {
          const groupKey = createGroupKey(group);
          const isExpanded = expandedGroups[groupKey] ?? false;
          const visibleCount = visibleRowsByGroup[groupKey] ?? LINK_GROUP_INITIAL_VISIBLE_COUNT;
          const visibleRows = group.rows.slice(0, visibleCount);

          return (
            <View
              key={groupKey}
              className="gap-3 rounded-[24px] border border-nexus-line/70 bg-white/5 p-4"
            >
              <View className="gap-2">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={appearance.surfaceTitleClass}>
                    {getLinkTitle(group)}
                  </Text>
                  {group.type ? (
                    <NexusBadge label={group.type} tone="default" />
                  ) : null}
                  <NexusBadge label={`${group.total_count} link${group.total_count === 1 ? '' : 's'}`} tone="sky" />
                </View>
                <Text className={appearance.itemMetaClass}>{group.packet_id}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {group.edge_type_counts.map((edgeType) => (
                    <NexusBadge
                      key={`${groupKey}:${edgeType.edge_type}`}
                      label={`${edgeType.edge_type} (${edgeType.count})`}
                      tone="gold"
                    />
                  ))}
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <NexusActionButton
                  label={isExpanded ? 'Hide link details' : 'Show link details'}
                  onPress={() => onToggleGroup(groupKey)}
                />
                <NexusActionButton
                  label="Open in new tab"
                  variant="primary"
                  onPress={() =>
                    onOpenPacketInNewTab({
                      packetId: group.packet_id,
                      titleSnapshot: group.title ?? group.label ?? group.packet_id,
                      seedSummary: {
                        type: group.type,
                        summary: null,
                        label: group.label,
                      },
                    })
                  }
                />
                <NexusActionButton
                  label="Open in current tab"
                  onPress={() =>
                    onOpenPacketInCurrentTab({
                      packetId: group.packet_id,
                      titleSnapshot: group.title ?? group.label ?? group.packet_id,
                      seedSummary: {
                        type: group.type,
                        summary: null,
                        label: group.label,
                      },
                    })
                  }
                />
                <NexusActionButton
                  label="View in Library"
                  onPress={() => onViewInLibrary(group.packet_id, group.type)}
                />
              </View>

              {isExpanded ? (
                <View className="gap-3">
                  <Text className={appearance.itemMetaClass}>
                    Showing {visibleRows.length} of {group.rows.length} underlying links.
                  </Text>
                  <View className="gap-2">
                    {visibleRows.map((link, index) => (
                      <View
                        key={`${groupKey}:${link.edge_type}:${link.revision_id ?? 'current'}:${index}`}
                        className="gap-1 rounded-[18px] border border-nexus-line/60 px-3 py-3"
                      >
                        <View className="flex-row flex-wrap items-center gap-2">
                          <NexusBadge label={link.edge_type} tone="sky" />
                          {link.revision_id ? (
                            <Text className={appearance.itemMetaClass}>
                              Revision: {link.revision_id}
                            </Text>
                          ) : null}
                        </View>
                        {Object.keys(link.metadata).length > 0 ? (
                          <Text className={appearance.itemMetaClass} selectable>
                            {formatJson(link.metadata)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>

                  {visibleRows.length < group.rows.length ? (
                    <View className="flex-row flex-wrap gap-2">
                      <NexusActionButton
                        label={`Show ${Math.min(LINK_GROUP_INITIAL_VISIBLE_COUNT, group.rows.length - visibleRows.length)} more`}
                        onPress={() => onRevealMore(groupKey)}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </NexusCard>
  );
}

export function NexusPacketExplorerLinksPanel({
  payload,
  onOpenPacketInNewTab,
  onOpenPacketInCurrentTab,
  onViewInLibrary,
}: NexusPacketExplorerLinksPanelProps) {
  const appearance = useNexusAppearance();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [visibleRowsByGroup, setVisibleRowsByGroup] = useState<Record<string, number>>({});

  const sections = useMemo(
    () => [
      {
        title: 'Outgoing',
        groups: payload.outgoing_link_groups,
      },
      {
        title: 'Incoming',
        groups: payload.incoming_link_groups,
      },
    ],
    [payload.incoming_link_groups, payload.outgoing_link_groups]
  );

  return (
    <View className="gap-4">
      <NexusCard className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Link Basis
          </Text>
          <NexusBadge label={getViewModeLabel(payload.inspection_lens)} tone="default" />
          <NexusBadge label={getLinksBasisLabel(payload)} tone="gold" />
        </View>
        <Text className={appearance.itemBodyClass}>
          The current inspection lens is {getViewModeLabel(payload.inspection_lens)}. Link
          relationships are grouped by related packet and explained from the current
          indexed packet graph in this pass.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <NexusBadge label="By packet" tone="sky" />
          <NexusActionButton
            label="By edge type"
            disabled
            featureStatusId="explorer.links.by_edge_type"
          />
          <NexusActionButton
            label="By type"
            disabled
            featureStatusId="explorer.links.by_type"
          />
        </View>
      </NexusCard>

      {sections.map((section) => (
        <NexusPacketExplorerLinkDirectionSection
          key={section.title}
          title={section.title}
          groups={section.groups}
          expandedGroups={expandedGroups}
          visibleRowsByGroup={visibleRowsByGroup}
          onToggleGroup={(groupKey) =>
            setExpandedGroups((currentState) => ({
              ...currentState,
              [groupKey]: !currentState[groupKey],
            }))
          }
          onRevealMore={(groupKey) =>
            setVisibleRowsByGroup((currentState) => ({
              ...currentState,
              [groupKey]:
                (currentState[groupKey] ?? LINK_GROUP_INITIAL_VISIBLE_COUNT) +
                LINK_GROUP_INITIAL_VISIBLE_COUNT,
            }))
          }
          onOpenPacketInNewTab={onOpenPacketInNewTab}
          onOpenPacketInCurrentTab={onOpenPacketInCurrentTab}
          onViewInLibrary={onViewInLibrary}
        />
      ))}
    </View>
  );
}
