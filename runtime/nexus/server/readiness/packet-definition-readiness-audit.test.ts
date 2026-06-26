/**
 * File: packet-definition-readiness-audit.test.ts
 * Description: Regression coverage for the pre-reseed packet definition readiness gate.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createPacketDefinitionReadinessAuditReport } from './packet-definition-readiness-audit.ts';

test('pre-reseed definition readiness audit classifies subtype completeness without blockers', () => {
  const report = createPacketDefinitionReadinessAuditReport();

  assert.equal(report.status, 'pass');
  assert.equal(report.findings.some((finding) => finding.severity === 'error'), false);
  assert.equal(report.findings.some((finding) => finding.severity === 'warning'), false);
  assert.ok(report.subtype_entries.length > report.checked_packet_types.length);

  for (const entry of report.subtype_entries) {
    assert.notEqual(
      entry.status,
      'blocked',
      `${entry.packet_type}.${entry.packet_subtype ?? 'null'} should not block reseed`
    );
    assert.ok(entry.projection_part_ids.length > 0);

    if (entry.packet_type === 'Bundle' && entry.packet_subtype !== 'packet_set') {
      assert.equal(entry.status, 'acceptable_minimal');
      assert.equal(entry.default_part_ids.length, 0);
      continue;
    }

    assert.ok(
      entry.default_part_ids.length > 0,
      `${entry.packet_type}.${entry.packet_subtype ?? 'null'} defaults`
    );
  }
});

test('pre-reseed definition readiness audit keeps bootstrap limitations explicit', () => {
  const report = createPacketDefinitionReadinessAuditReport();
  const acceptableMinimalEntries = report.subtype_entries.filter(
    (entry) => entry.status === 'acceptable_minimal'
  );

  assert.ok(acceptableMinimalEntries.length > 0);

  for (const entry of acceptableMinimalEntries) {
    assert.ok(
      entry.packet_type === 'Definition' || entry.packet_type === 'Bundle',
      `${entry.packet_type}.${entry.packet_subtype ?? 'null'} unexpected acceptable-minimal classification`
    );
    assert.ok(entry.issues.every((issue) => issue.severity === 'info'));
  }
});
