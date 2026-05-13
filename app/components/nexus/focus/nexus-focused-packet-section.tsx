/**
 * File: nexus-focused-packet-section.tsx
 * Description: Renders a compact single-packet focus section for Nexus surfaces.
 */
import { Pressable, Text, View } from 'react-native';

import {
  NexusCardActionCluster,
  hasNexusCardActionClusterContent,
  type NexusActionMenuItem,
  type NexusCardBadge,
} from '@app/components/nexus/action-card';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusAppearance } from '@app/components/nexus/nexus-ui';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type NexusFocusedPacketSectionProps = {
  actions?: NexusActionMenuItem[];
  actionMenuAlign?: 'top' | 'bottom';
  badges?: NexusCardBadge[];
  className?: string;
  detail?: string | null;
  meta?: string | null;
  onPress?: () => void;
  title: string;
};

/**
 * Inputs: focused packet presentation and optional shared packet actions.
 * Output: one compact focus panel that mirrors standard packet-card action behavior.
 */
export function NexusFocusedPacketSection({
  actions = [],
  actionMenuAlign = 'top',
  badges = [],
  className,
  detail,
  meta,
  onPress,
  title,
}: NexusFocusedPacketSectionProps) {
  const { themeMode } = useNexusShell();
  const appearance = useNexusAppearance();
  const hasActionCluster = hasNexusCardActionClusterContent({ actions, badges });

  return (
    <View
      className={joinClasses(
        'relative mb-2 min-h-[72px] overflow-visible rounded-nexus border border-nexus-sky/35 bg-nexus-sky/10',
        className,
      )}
    >
      <Pressable
        accessibilityLabel={`Open focused packet ${title}`}
        accessibilityRole={onPress ? 'button' : undefined}
        className={joinClasses(
          'min-h-[72px] px-3.5 py-3',
          onPress
            ? themeMode === 'dark'
              ? 'active:bg-white/5'
              : 'active:bg-slate-100'
            : undefined,
        )}
        disabled={!onPress}
        onPress={(event) => {
          event.stopPropagation();
          onPress?.();
        }}
      >
        <View className={joinClasses('gap-1', hasActionCluster ? 'pr-24' : undefined)}>
          <Text className="text-[10px] font-semibold uppercase tracking-[2.5px] text-nexus-sky">
            In Focus
          </Text>
          <Text className={appearance.itemTitleClass} numberOfLines={1}>
            {title}
          </Text>
          {detail || meta ? (
            <Text className={appearance.itemBodyClass} numberOfLines={1}>
              {detail ?? meta}
              {detail && meta ? (
                <Text className={appearance.itemMetaClass}> · {meta}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {hasActionCluster ? (
        <NexusCardActionCluster
          actions={actions}
          actionMenuAlign={actionMenuAlign}
          badges={badges}
          dismissAccessibilityLabel="Close focused packet actions"
          layout="absolute"
          menuAccessibilityLabel="Open focused packet actions"
          menuClassName="min-w-[170px]"
        />
      ) : null}
    </View>
  );
}
