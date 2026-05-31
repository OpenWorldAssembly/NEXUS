import assert from 'node:assert/strict';
import test from 'node:test';

import { createNodePreferenceProtocolInspectionReport } from './readiness/node-preference-protocol-inspection.ts';

test('node preference protocol inspection locks the intended carriers', () => {
  const report = createNodePreferenceProtocolInspectionReport();

  assert.equal(report.status, 'warn');
  assert.equal(report.design_locked.node_identity_carrier, 'Element.node');
  assert.equal(report.design_locked.node_preferences_carrier, 'Preference.node');
  assert.equal(
    report.design_locked.trust_ratings_authority,
    'packet_graph_attestations_and_verification_reports'
  );
  assert.ok(report.counts.preference_node_definition_parts >= 8);
  assert.ok(report.counts.node_preference_helpers >= 4);
  assert.ok(report.counts.env_private_key_paths >= 2);
  assert.ok(report.counts.default_node_preference_bootstrap_refs >= 4);
  assert.ok(report.counts.trusted_definition_node_preference_refs >= 5);
  assert.ok(report.counts.node_signer_acceptance_refs >= 1);
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'LOCAL_VALIDATOR_SECRET_STORAGE_TRANSITIONAL'
    )
  );
});
