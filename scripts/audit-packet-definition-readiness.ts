/**
 * File: audit-packet-definition-readiness.ts
 * Description: CLI wrapper for the packet definition readiness audit.
 */

import { createPacketDefinitionReadinessAuditReport } from '@runtime/nexus/server/readiness/packet-definition-readiness-audit.ts';

const report = createPacketDefinitionReadinessAuditReport();
const errors = report.findings.filter((finding) => finding.severity === 'error');
const warnings = report.findings.filter((finding) => finding.severity === 'warning');
const infos = report.findings.filter((finding) => finding.severity === 'info');

console.log(
  `Packet definition readiness audit: ${report.status}. ${report.entries.length} packet type(s), ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info note(s).`
);
console.log(`Buckets: ${Object.entries(report.bucket_counts).map(([key, value]) => `${key}=${value}`).join(', ')}.`);
console.log(`Layers: ${Object.entries(report.layer_counts).map(([key, value]) => `${key}=${value}`).join(', ')}.`);

for (const finding of report.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.packet_type} ${finding.code}: ${finding.message}`);
}

if (report.status === 'fail' || errors.length > 0) {
  process.exitCode = 1;
}
