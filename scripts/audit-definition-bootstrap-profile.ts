/**
 * File: audit-definition-bootstrap-profile.ts
 * Description: CLI wrapper for the Definition bootstrap/profile inspection audit.
 */

import {
  createDefinitionBootstrapProfileInspectionReport,
  type DefinitionBootstrapProfileInspectionArea,
  type DefinitionBootstrapProfileInspectionEntry,
} from '@runtime/nexus/server/readiness/definition-bootstrap-profile-inspection.ts';

const AREA_ORDER: DefinitionBootstrapProfileInspectionArea[] = [
  'hardcoded_definition_kernel',
  'stored_definition_packet_material',
  'definition_bundle_profile',
  'active_definition_source_resolution',
  'archive_backed_definition_loading',
  'node_profile_selection',
  'definition_component_model',
  'typescript_manifest_role',
  'runtime_execution_boundary',
];

function summarizeEntry(entry: DefinitionBootstrapProfileInspectionEntry): string {
  return [
    entry.area,
    `status=${entry.status}`,
    `sources=${entry.source_files.length}`,
    `next=${entry.next_step}`,
  ].join(' | ');
}

const report = createDefinitionBootstrapProfileInspectionReport();
const errors = report.findings.filter((finding) => finding.severity === 'error');
const warnings = report.findings.filter((finding) => finding.severity === 'warning');
const infos = report.findings.filter((finding) => finding.severity === 'info');

console.log(
  `Definition bootstrap/profile inspection: ${report.status}. ${report.entries.length} area(s), ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info note(s).`
);
console.log(
  `Locked design: kernel=${report.design_locked.kernel_authority}, definitions=${report.design_locked.definition_authority_target}, carrier=${report.design_locked.profile_carrier}, execution=${report.design_locked.executable_authority}.`
);
console.log(
  `Counts: definition_subtypes=${report.counts.definition_subtypes}, required_parts=${report.counts.required_definition_parts}, source_kinds=${report.counts.trusted_definition_source_kinds}, trust_tiers=${report.counts.trusted_definition_trust_tiers}, seed_helpers=${report.counts.generated_definition_seed_helpers}.`
);

for (const area of AREA_ORDER) {
  const entry = report.entries.find((candidate) => candidate.area === area);
  if (!entry) {
    continue;
  }

  console.log(`  - ${summarizeEntry(entry)}`);
  for (const evidence of entry.evidence) {
    console.log(`      evidence: ${evidence}`);
  }
}

for (const finding of report.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.area} ${finding.code}: ${finding.message}`);
}

if (errors.length > 0) {
  process.exitCode = 1;
}
