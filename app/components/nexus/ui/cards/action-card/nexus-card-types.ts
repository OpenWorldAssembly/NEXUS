/**
 * File: nexus-card-types.ts
 * Description: Defines generic Nexus action-card menu and badge models.
 */
import type { ReactNode } from 'react';

import type {
  NexusLoadingOptions,
  NexusLoadingScope,
} from '../../feedback/loading';

export type NexusActionMenuTone =
  | 'default'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'muted';

export type NexusCardBadgeTone =
  | 'default'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'muted';

export type NexusCardBadgeIcon =
  | 'check'
  | 'flag'
  | 'link'
  | 'lock'
  | 'warning'
  | 'history'
  | 'signature'
  | 'packet'
  | 'visibility'
  | 'archive'
  | 'verified';

export type NexusActionMenuItem = {
  id: string;
  label: string;
  description?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  hidden?: boolean;
  loadingOptions?: NexusLoadingOptions;
  loadingScope?: NexusLoadingScope;
  tone?: NexusActionMenuTone;
  onSelect?: () => void | Promise<void>;
};

export type NexusCardBadge = {
  id: string;
  label: string;
  description?: string;
  accessibilityLabel?: string;
  hidden?: boolean;
  icon?: NexusCardBadgeIcon;
  renderIcon?: ReactNode;
  tone?: NexusCardBadgeTone;
  onPress?: () => void;
};
