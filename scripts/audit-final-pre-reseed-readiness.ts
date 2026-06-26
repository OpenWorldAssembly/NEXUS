/**
 * File: audit-final-pre-reseed-readiness.ts
 * Description: CLI wrapper for the final pre-reseed readiness report.
 */

import { createFinalPreReseedReadinessReport } from '@runtime/nexus/server/readiness/final-pre-reseed-readiness.ts';

const report = createFinalPreReseedReadinessReport();

console.log(
  `Final pre-reseed readiness: ${report.status}. ${report.blockers.length} blocker(s), ${report.accepted_transition_notes.length} accepted transition note(s), ${report.cleanup_candidates.length} cleanup candidate(s).`
);

for (const blocker of report.blockers) {
  console.log(`[BLOCKER] ${blocker}`);
}

for (const note of report.accepted_transition_notes) {
  console.log(`[ACCEPTED] ${note}`);
}

for (const candidate of report.cleanup_candidates) {
  console.log(`[CLEANUP] ${candidate}`);
}

if (report.status === 'fail') {
  process.exitCode = 1;
}
