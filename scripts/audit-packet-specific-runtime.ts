/**
 * File: audit-packet-specific-runtime.ts
 * Description: CLI wrapper for the packet-specific runtime boundary audit.
 */

import { createPacketSpecificRuntimeAuditReport } from '@runtime/nexus/server/readiness/packet-specific-runtime-audit.ts';

const report = createPacketSpecificRuntimeAuditReport();
const errors = report.findings.filter((finding) => finding.severity === 'error');
const warnings = report.findings.filter((finding) => finding.severity === 'warning');

console.log(
  `Packet-specific runtime audit: ${report.status}. ${report.entry_count} classified file(s), ${report.reference_count} reference(s), ${errors.length} error(s), ${warnings.length} warning(s).`
);
console.log(`Counts: ${Object.entries(report.category_counts).map(([key, value]) => `${key}=${value}`).join(', ')}.`);

for (const finding of report.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.file_path} ${finding.code}: ${finding.message}`);
}

if (report.status === 'fail' || errors.length > 0) {
  process.exitCode = 1;
}
