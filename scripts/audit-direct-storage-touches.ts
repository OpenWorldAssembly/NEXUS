/**
 * File: audit-direct-storage-touches.ts
 * Description: CLI wrapper for the direct storage-touch classification audit.
 */

import {
  createDirectStorageTouchAuditReport,
  type DirectStorageTouch,
  type DirectStorageTouchCategory,
} from '@runtime/nexus/server/readiness/direct-storage-touch-audit.ts';

function uniqueFileSummaries(touches: readonly DirectStorageTouch[]): string[] {
  const methodsByFile = new Map<string, Set<string>>();

  for (const touch of touches) {
    methodsByFile.set(
      touch.file_path,
      new Set([...(methodsByFile.get(touch.file_path) ?? []), touch.method])
    );
  }

  return [...methodsByFile.entries()]
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, methods]) => `${filePath} (${[...methods].sort().join(', ')})`);
}

const CATEGORY_ORDER: DirectStorageTouchCategory[] = [
  'needs_review',
  'needs_trusted_coordinator',
  'allowed_infrastructure',
  'allowed_read',
];

const report = createDirectStorageTouchAuditReport();

console.log(
  `Direct storage-touch audit: ${report.status}. ${report.touch_count} classified touch(es), ${report.findings.length} unclassified finding(s).`
);
console.log(
  `Counts: allowed_read=${report.category_counts.allowed_read}, allowed_infrastructure=${report.category_counts.allowed_infrastructure}, needs_trusted_coordinator=${report.category_counts.needs_trusted_coordinator}, needs_review=${report.category_counts.needs_review}.`
);

for (const category of CATEGORY_ORDER) {
  const touches = report.touches.filter((touch) => touch.category === category);
  if (touches.length === 0) {
    continue;
  }

  console.log(`[${category}] ${touches.length} touch(es)`);
  for (const summary of uniqueFileSummaries(touches).slice(0, 20)) {
    console.log(`  - ${summary}`);
  }

  const overflow = uniqueFileSummaries(touches).length - 20;
  if (overflow > 0) {
    console.log(`  - +${overflow} more file(s)`);
  }
}

for (const finding of report.findings) {
  console.log(
    `[${finding.severity.toUpperCase()}] ${finding.code}: ${finding.message}`
  );
}

if (report.findings.some((finding) => finding.severity === 'error')) {
  process.exitCode = 1;
}
