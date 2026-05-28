import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendTrustedChildResult,
  appendTrustedProcessStage,
  completeTrustedProcessChain,
  completeTrustedProcessStage,
  createTrustedProcessChain,
  createTrustedProcessReportDraft,
  flattenTrustedProcessIssues,
  getPrimaryTrustedIssue,
  startTrustedProcessStage,
  summarizeTrustedProcessChain,
} from './trusted_process.ts';
import { resolveTrustedIssueDescriptor, toCanonicalTrustedIssueCode } from './trusted_issue_taxonomy.ts';
import { createTrustedRuntimeCoordinatorResult, trustedIssue } from './trusted_runtime_coordinator.ts';

test('trusted process chain records ordered summary-only stage snapshots', () => {
  let chain = createTrustedProcessChain({
    coordinator_id: 'trusted_exchange_coordinator.v0',
    coordinator_kind: 'exchange',
    operation_name: 'commit_import',
    completion_policy: 'preserve_partial',
  });

  chain = appendTrustedProcessStage(
    chain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'exchange.import.plan_commit',
        coordinator_id: 'trusted_exchange_coordinator.v0',
        coordinator_kind: 'exchange',
        operation_name: 'plan_import_commit',
      }),
      {
        artifacts: [{
          artifact_id: 'plan:1',
          artifact_kind: 'import_commit_plan',
          label: 'Import plan.',
          count: 2,
          redacted: true,
        }],
        completed_work: [{
          work_id: 'plan',
          label: 'Planned import.',
          count: 2,
        }],
      }
    )
  );

  const completed = completeTrustedProcessChain(chain);
  const summary = summarizeTrustedProcessChain(completed);

  assert.equal(completed.stages.length, 1);
  assert.equal(completed.stages[0].artifacts[0].redacted, true);
  assert.equal(summary.completed_work_count, 1);
  assert.equal(summary.issue_count, 0);
});

test('trusted issue taxonomy maps legacy aliases to canonical dotted codes', () => {
  assert.equal(
    toCanonicalTrustedIssueCode('trusted_exchange_import_commit_blocked'),
    'exchange.import_commit_blocked'
  );
  assert.equal(resolveTrustedIssueDescriptor('exchange.import_commit_blocked')?.category, 'blocked_dependency');
});

test('trusted process helpers merge child coordinator results and pick primary issue', () => {
  const childIssue = trustedIssue({
    severity: 'error',
    code: 'trusted_archive_packet_not_found',
    path: 'packet_ref.packet_id',
    message: 'No archived packet was found.',
  });
  const childChain = completeTrustedProcessChain(
    appendTrustedProcessStage(
      createTrustedProcessChain({
        coordinator_id: 'trusted_archive_coordinator.v0',
        coordinator_kind: 'archive',
        operation_name: 'read_archived_packet',
      }),
      completeTrustedProcessStage(
        startTrustedProcessStage({
          stage_id: 'archive.packet.read',
          coordinator_id: 'trusted_archive_coordinator.v0',
          coordinator_kind: 'archive',
          operation_name: 'read_archived_packet',
        }),
        { status: 'partial', issues: [childIssue] }
      ),
      { issues: [childIssue] }
    )
  );
  const childResult = createTrustedRuntimeCoordinatorResult({
    coordinator_id: 'trusted_archive_coordinator.v0',
    coordinator_kind: 'archive',
    value: null,
    process_chain: childChain,
  });

  const parent = appendTrustedChildResult(
    createTrustedProcessChain({
      coordinator_id: 'trusted_exchange_coordinator.v0',
      coordinator_kind: 'exchange',
      operation_name: 'export_packet_set',
    }),
    childResult,
    {
      stage_id: 'exchange.export.archive_bundle',
      operation_name: 'archive_export_bundle',
    }
  );

  const issues = flattenTrustedProcessIssues(parent);
  assert.equal(issues[0].canonical_code, 'archive.packet_not_found');
  assert.equal(getPrimaryTrustedIssue(parent)?.canonical_code, 'archive.packet_not_found');
});

test('trusted process report draft is non-mutating and compact', () => {
  const chain = completeTrustedProcessChain(createTrustedProcessChain({
    coordinator_id: 'trusted_verification_coordinator.v0',
    coordinator_kind: 'verification',
    operation_name: 'verify_packet',
  }));
  const draft = createTrustedProcessReportDraft(chain);

  assert.equal(draft.report_kind, 'trusted.process_report_draft');
  assert.equal(draft.report_data.chain_id, chain.chain_id);
  assert.match(draft.summary_markdown, /Trusted process verify_packet/);
});
