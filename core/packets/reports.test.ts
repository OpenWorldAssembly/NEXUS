import test from 'node:test';
import assert from 'node:assert/strict';

import { createReportPacket } from './builders.ts';
import {
  parsePacketEnvelope,
  type PacketEnvelopeByType,
} from '@core/schema/packet-schema';

test('report packets round-trip with verification and import reporting fields intact', () => {
  const verificationReport = createReportPacket({
    packet_id: 'nexus:report/verification-test',
    revision_id: 'nexus:report/verification-test@r1',
    created_at: '2026-05-12T00:00:00.000Z',
    adapter: 'test',
    created_by: { packet_id: 'nexus:element/local-validator' },
    submitted_by: { packet_id: 'nexus:element/local-validator' },
    recorded_at: '2026-05-12T00:00:00.000Z',
    subtype: 'verification_report',
    status: 'active',
    target_ref: { packet_id: 'nexus:element/target-packet' },
    scope_ref: { packet_id: 'nexus:element/global-commons' },
    summary_markdown: 'Packet validated locally.',
    report_markdown: 'Detailed packet verification report.',
    supporting_refs: [{ packet_id: 'nexus:element/signer-packet' }],
    report_data: {
      status: 'trusted_signer',
      signature_status: 'valid',
    },
  });
  const parsedVerificationReport = parsePacketEnvelope(
    verificationReport
  ) as PacketEnvelopeByType['Report'];

  assert.equal(parsedVerificationReport.header.type, 'Report');
  assert.equal(parsedVerificationReport.body.subtype, 'verification_report');
  assert.equal(parsedVerificationReport.body.subtype, 'verification_report');
  assert.equal(
    parsedVerificationReport.body.target_ref?.packet_id,
    'nexus:element/target-packet'
  );
  assert.equal(
    parsedVerificationReport.body.scope_ref?.packet_id,
    'nexus:element/global-commons'
  );
  assert.deepEqual(parsedVerificationReport.body.report_data, {
    status: 'trusted_signer',
    signature_status: 'valid',
  });

  const importReport = createReportPacket({
    packet_id: 'nexus:report/import-test',
    revision_id: 'nexus:report/import-test@r1',
    created_at: '2026-05-12T00:00:00.000Z',
    adapter: 'test',
    created_by: { packet_id: 'nexus:element/local-validator' },
    submitted_by: { packet_id: 'nexus:element/local-validator' },
    recorded_at: '2026-05-12T00:00:00.000Z',
    subtype: 'import_report',
    status: 'active',
    target_ref: null,
    scope_ref: null,
    summary_markdown: 'Import report (validate before commit)',
    report_markdown: 'Detailed import verification report.',
    supporting_refs: [{ packet_id: 'nexus:report/verification-test' }],
    supersedes_ref: { packet_id: 'nexus:report/import-test' },
    report_data: {
      source_digest: 'digest',
      validation_mode: 'validate_before_commit',
    },
  });
  const parsedImportReport = parsePacketEnvelope(
    importReport
  ) as PacketEnvelopeByType['Report'];

  assert.equal(parsedImportReport.header.type, 'Report');
  assert.equal(parsedImportReport.body.subtype, 'import_report');
  assert.equal(parsedImportReport.body.target_ref, null);
  assert.equal(
    parsedImportReport.body.supersedes_ref?.packet_id,
    'nexus:report/import-test'
  );
  assert.deepEqual(parsedImportReport.body.report_data, {
    source_digest: 'digest',
    validation_mode: 'validate_before_commit',
  });

  const decisionReport = createReportPacket({
    packet_id: 'nexus:report/decision-test',
    revision_id: 'nexus:report/decision-test@r1',
    created_at: '2026-05-12T00:00:00.000Z',
    adapter: 'test',
    subtype: 'decision_report',
    status: 'active',
    target_ref: { packet_id: 'nexus:decision/example' },
    scope_ref: { packet_id: 'nexus:element/global-commons' },
    summary_markdown: 'Decision closure report.',
    report_markdown: 'Decision passed under the applicable governance policy.',
    supporting_refs: [{ packet_id: 'nexus:vote/example' }],
    report_data: {
      outcome: 'passed',
    },
  });
  const parsedDecisionReport = parsePacketEnvelope(
    decisionReport
  ) as PacketEnvelopeByType['Report'];

  assert.equal(parsedDecisionReport.header.type, 'Report');
  assert.equal(parsedDecisionReport.body.subtype, 'decision_report');
  assert.equal(
    parsedDecisionReport.body.target_ref?.packet_id,
    'nexus:decision/example'
  );
});
