/**
 * File: audit-definition-dsl-capability.ts
 * Description: CLI wrapper for the definition DSL capability audit.
 */

import { createDefinitionDslCapabilityAuditReport } from '@runtime/nexus/server/readiness/definition-dsl-capability-audit.ts';

const report = createDefinitionDslCapabilityAuditReport();
const errors = report.findings.filter((finding) => finding.severity === 'error');
const warnings = report.findings.filter((finding) => finding.severity === 'warning');
const infos = report.findings.filter((finding) => finding.severity === 'info');

console.log(
  `Definition DSL capability audit: ${report.status}. ${report.entries.length} area(s), ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info note(s).`
);
console.log(`Counts: ${Object.entries(report.counts).map(([key, value]) => `${key}=${value}`).join(', ')}.`);

for (const entry of report.entries) {
  console.log(`  - ${entry.area}: ${entry.status} | next=${entry.next_step}`);
}

for (const finding of report.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.area} ${finding.code}: ${finding.message}`);
}

if (report.status === 'fail' || errors.length > 0) {
  process.exitCode = 1;
}
