/**
 * File: nexus-action-card.tsx
 * Description: Composes NexusCard with badges and a reusable action menu.
 */
import { useState, type PropsWithChildren } from 'react';

import { NexusCard } from '@app/components/nexus/nexus-ui';
import type { NexusCardTone } from '@runtime/nexus/nexus-content';
import { NexusCardActionCluster, hasNexusCardActionClusterContent } from './nexus-card-action-cluster';
import type { NexusActionMenuItem, NexusCardBadge } from './nexus-card-types';

function joinClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}


export type NexusActionCardProps = PropsWithChildren<{
  accessibilityLabel?: string;
  actions?: NexusActionMenuItem[];
  actionMenuAlign?: 'top' | 'bottom';
  badges?: NexusCardBadge[];
  className?: string;
  compact?: boolean;
  contentClassName?: string;
  disabled?: boolean;
  menuAccessibilityLabel?: string;
  onPress?: () => void;
  selected?: boolean;
  tone?: NexusCardTone | 'default';
}>;

/**
 * Inputs: card content, optional action descriptors, and compact badge descriptors.
 * Output: a Nexus card with a top-right badge/menu cluster.
 */
export function NexusActionCard({
  accessibilityLabel,
  actions = [],
  actionMenuAlign = 'top',
  badges = [],
  children,
  className,
  compact = false,
  contentClassName,
  disabled = false,
  menuAccessibilityLabel,
  onPress,
  selected = false,
  tone = 'default',
}: NexusActionCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasTopRightCluster = hasNexusCardActionClusterContent({ actions, badges });

  return (
    <NexusCard
      accessibilityLabel={accessibilityLabel}
      action={
        hasTopRightCluster ? (
          <NexusCardActionCluster
            actions={actions}
            actionMenuAlign={actionMenuAlign}
            badges={badges}
            menuAccessibilityLabel={menuAccessibilityLabel}
            onMenuOpenChange={setIsMenuOpen}
          />
        ) : null
      }
      actionClassName="right-2 top-2"
      className={joinClasses('overflow-visible', isMenuOpen ? 'z-50' : undefined, className)}
      compact={compact}
      contentClassName={joinClasses(hasTopRightCluster ? 'pr-24' : undefined, contentClassName)}
      disabled={disabled}
      onPress={onPress}
      selected={selected}
      tone={tone}
    >
      {children}
    </NexusCard>
  );
}
