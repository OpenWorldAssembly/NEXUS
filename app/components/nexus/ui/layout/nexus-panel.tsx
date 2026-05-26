/**
 * File: nexus-panel.tsx
 * Description: Shared Nexus card-like panel composition.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { View } from 'react-native';

import { NexusCard } from '../cards';
import {
  NexusLoadingBoundary,
  type NexusLoadingScope,
} from '../feedback/loading';
import { joinClasses } from './nexus-chrome';
import { NexusPanelHeader } from './nexus-panel-header';

export type NexusPanelProps = PropsWithChildren<{
  actions?: ReactNode;
  bodyClassName?: string;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  loadingLabel?: string;
  loadingScope?: NexusLoadingScope;
  title?: ReactNode;
}>;

export function NexusPanel({
  actions,
  bodyClassName,
  children,
  className,
  description,
  eyebrow,
  loadingLabel,
  loadingScope,
  title,
}: NexusPanelProps) {
  const hasHeader = Boolean(eyebrow || title || description || actions);
  const body = bodyClassName ? (
    <View className={bodyClassName}>{children}</View>
  ) : (
    children
  );

  return (
    <NexusCard className={joinClasses('gap-4', className)}>
      {hasHeader ? (
        <NexusPanelHeader
          actions={actions}
          description={description}
          eyebrow={eyebrow}
          title={title}
        />
      ) : null}
      {loadingScope ? (
        <NexusLoadingBoundary label={loadingLabel} scope={loadingScope}>
          {body}
        </NexusLoadingBoundary>
      ) : (
        body
      )}
    </NexusCard>
  );
}
