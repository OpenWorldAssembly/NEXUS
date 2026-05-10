/**
 * File: nexus-dashboard-badges.ts
 * Description: Builds temporary dashboard lifecycle/trust badges from dashboard packet projections.
 */
import type { NexusCardBadge } from '@app/components/nexus/action-card';

export type NexusDashboardLifecycleState = 'active' | 'archived' | 'withdrawn';
export type NexusDashboardTrustState = 'trusted' | 'unverified' | 'flagged';

function normalizeDashboardSignal(value: string | null | undefined): string {
  return value?.toLowerCase().trim() ?? '';
}

export function getDashboardLifecycleState(
  status: string | null | undefined,
): NexusDashboardLifecycleState {
  const normalizedStatus = normalizeDashboardSignal(status);

  if (
    normalizedStatus.includes('withdrawn') ||
    normalizedStatus.includes('revoked') ||
    normalizedStatus.includes('retracted')
  ) {
    return 'withdrawn';
  }

  if (
    normalizedStatus.includes('archived') ||
    normalizedStatus.includes('closed') ||
    normalizedStatus.includes('superseded') ||
    normalizedStatus.includes('inactive')
  ) {
    return 'archived';
  }

  return 'active';
}

function getDashboardLifecycleBadge(status: string | null | undefined): NexusCardBadge {
  const lifecycleState = getDashboardLifecycleState(status);

  if (lifecycleState === 'withdrawn') {
    return {
      id: 'lifecycle-withdrawn',
      icon: 'history',
      label: 'Withdrawn',
      tone: 'muted',
    };
  }

  if (lifecycleState === 'archived') {
    return {
      id: 'lifecycle-archived',
      icon: 'archive',
      label: 'Archived',
      tone: 'muted',
    };
  }

  return {
    id: 'lifecycle-active',
    icon: 'visibility',
    label: 'Active',
    tone: 'accent',
  };
}

export function getDashboardTrustState(
  status: string | null | undefined,
): NexusDashboardTrustState {
  const normalizedStatus = normalizeDashboardSignal(status);

  if (
    normalizedStatus.includes('flagged') ||
    normalizedStatus.includes('disputed') ||
    normalizedStatus.includes('blocked') ||
    normalizedStatus.includes('failed')
  ) {
    return 'flagged';
  }

  if (
    normalizedStatus.includes('trusted') ||
    normalizedStatus.includes('verified') ||
    normalizedStatus.includes('approved')
  ) {
    return 'trusted';
  }

  return 'unverified';
}

function getDashboardTrustBadge(status: string | null | undefined): NexusCardBadge {
  const trustState = getDashboardTrustState(status);

  if (trustState === 'flagged') {
    return {
      id: 'trust-flagged',
      icon: 'flag',
      label: 'Flagged',
      tone: 'warning',
    };
  }

  if (trustState === 'trusted') {
    return {
      id: 'trust-trusted',
      icon: 'verified',
      label: 'Trusted',
      tone: 'accent',
    };
  }

  return {
    id: 'trust-unverified',
    icon: 'signature',
    label: 'Unverified',
    tone: 'muted',
  };
}

/**
 * Inputs: temporary dashboard status text from packet projections.
 * Output: the two dashboard badge slots: lifecycle and trust.
 */
export function getDashboardBadges(status: string | null | undefined): NexusCardBadge[] {
  return [getDashboardLifecycleBadge(status), getDashboardTrustBadge(status)];
}
