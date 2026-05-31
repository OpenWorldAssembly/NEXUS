import { createNodePreferenceProtocolInspectionReport } from '@runtime/nexus/server/readiness/node-preference-protocol-inspection.ts';

const report = createNodePreferenceProtocolInspectionReport();

console.log(JSON.stringify(report, null, 2));

if (report.status === 'fail') {
  process.exitCode = 1;
}
