/**
 * File: nexus-dashboard-format.ts
 * Description: Provides small formatting helpers for Nexus dashboard projections.
 */
export function formatDashboardTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function getDashboardPreviewMeta(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}
