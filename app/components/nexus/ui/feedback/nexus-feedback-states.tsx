/**
 * File: nexus-feedback-states.tsx
 * Description: Shared Nexus loading, empty, error, warning, status, and operation feedback states.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { NexusCard } from '../cards';
import { useNexusAppearance } from '../layout';

export type NexusFeedbackTone = 'default' | 'sky' | 'gold' | 'rose' | 'mint';

export type NexusFeedbackCardProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  tone?: NexusFeedbackTone;
};

function renderTextOrNode(
  value: ReactNode,
  className: string
): ReactNode {
  return typeof value === 'string' || typeof value === 'number' ? (
    <Text className={className}>{value}</Text>
  ) : (
    value
  );
}

function NexusFeedbackCard({
  actions,
  children,
  className,
  title,
  tone = 'default',
}: NexusFeedbackCardProps) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className={className ?? 'gap-3'} tone={tone}>
      {title ? renderTextOrNode(title, appearance.itemTitleClass) : null}
      {children ? renderTextOrNode(children, appearance.itemBodyClass) : null}
      {actions}
    </NexusCard>
  );
}

export function NexusInlineLoading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className={className ?? 'flex-row items-center gap-2'}>
      <ActivityIndicator color="#38bdf8" size="small" />
      {renderTextOrNode(children, appearance.itemMetaClass)}
    </View>
  );
}

export function NexusEmptyState(props: NexusFeedbackCardProps) {
  return <NexusFeedbackCard {...props} />;
}

export function NexusErrorState(props: Omit<NexusFeedbackCardProps, 'tone'>) {
  return <NexusFeedbackCard {...props} tone="rose" />;
}

export function NexusWarningState(props: Omit<NexusFeedbackCardProps, 'tone'>) {
  return <NexusFeedbackCard {...props} tone="gold" />;
}

export function NexusStatusState(props: NexusFeedbackCardProps) {
  return <NexusFeedbackCard {...props} />;
}

export function NexusOperationCard(props: NexusFeedbackCardProps) {
  return <NexusFeedbackCard {...props} />;
}
