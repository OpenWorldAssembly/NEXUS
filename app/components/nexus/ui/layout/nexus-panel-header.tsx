/**
 * File: nexus-panel-header.tsx
 * Description: Shared Nexus panel header with optional action slot.
 */
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { joinClasses, useNexusAppearance } from './nexus-chrome';

export type NexusPanelHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
};

function renderTextOrNode(value: ReactNode, className: string): ReactNode {
  return typeof value === 'string' || typeof value === 'number' ? (
    <Text className={className}>{value}</Text>
  ) : (
    value
  );
}

export function NexusPanelHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: NexusPanelHeaderProps) {
  const appearance = useNexusAppearance();

  return (
    <View
      className={joinClasses(
        actions ? 'flex-row flex-wrap items-start justify-between gap-4' : 'gap-2',
        className
      )}
    >
      <View className="min-w-0 flex-1 gap-2">
        {eyebrow
          ? renderTextOrNode(
              eyebrow,
              'text-xs font-semibold uppercase tracking-[3px] text-nexus-sky'
            )
          : null}
        {title ? renderTextOrNode(title, appearance.surfaceTitleClass) : null}
        {description
          ? renderTextOrNode(description, appearance.sectionBodyClass)
          : null}
      </View>
      {actions ? <View className="flex-row flex-wrap justify-end gap-2">{actions}</View> : null}
    </View>
  );
}
