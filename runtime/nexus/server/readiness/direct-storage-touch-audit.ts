/**
 * File: direct-storage-touch-audit.ts
 * Description: Static classification audit for direct storage touches during trusted runtime migration.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type DirectStorageTouchCategory =
  | 'allowed_read'
  | 'allowed_infrastructure'
  | 'needs_trusted_coordinator'
  | 'needs_review';

export type DirectStorageTouchKind =
  | 'packet_read'
  | 'packet_query'
  | 'packet_write'
  | 'packet_publish'
  | 'bundle_import'
  | 'bundle_export'
  | 'derived_state_read'
  | 'derived_state_write'
  | 'storage_constructor'
  | 'raw_sqlite';

export interface DirectStorageTouch {
  file_path: string;
  line_number: number;
  method: string;
  kind: DirectStorageTouchKind;
  category: DirectStorageTouchCategory;
  reason: string;
  line: string;
}

export interface DirectStorageTouchFinding {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  file_path: string;
  line_number: number;
}

export interface DirectStorageTouchAuditReport {
  report_kind: 'packet.direct_storage_touch_audit';
  status: 'pass' | 'fail';
  scanned_roots: string[];
  touch_count: number;
  touches: DirectStorageTouch[];
  category_counts: Record<DirectStorageTouchCategory, number>;
  migration_target_count: number;
  findings: DirectStorageTouchFinding[];
}

const SCAN_ROOTS = [
  'runtime/nexus/server',
  'runtime/storage',
  'runtime/trusted_coordinators',
  'src/app/api/nexus',
] as const;

const AUDIT_FILE = 'runtime/nexus/server/readiness/direct-storage-touch-audit.ts';

const PACKET_STORE_METHOD_KINDS = {
  fetchByPacket: 'packet_read',
  fetchByRevision: 'packet_read',
  fetchPreferredRevision: 'packet_read',
  fetchRevisionHeads: 'packet_read',
  readByPacket: 'packet_read',
  readByRevision: 'packet_read',
  resolveRevisionRef: 'packet_read',
  listPreferredPacketsByType: 'packet_query',
  listPreferredPackets: 'packet_query',
  listSearchRows: 'packet_query',
  queryEdges: 'packet_query',
  writeRevision: 'packet_write',
  publishRevision: 'packet_publish',
  importBundle: 'bundle_import',
  exportBundle: 'bundle_export',
  readActorScopeDisplayPreferences: 'derived_state_read',
  writeActorScopeDisplayPreferences: 'derived_state_write',
  readRuntimeValidatorIdentity: 'derived_state_read',
  writeRuntimeValidatorIdentity: 'derived_state_write',
  getPacketVerificationSummary: 'derived_state_read',
  writePacketVerificationSummary: 'derived_state_write',
} as const satisfies Record<string, DirectStorageTouchKind>;

const PACKET_STORE_METHOD_PATTERN = new RegExp(
  `\\b(?:(?:this|input|context|services)\\.)?packetStore\\.(${Object.keys(PACKET_STORE_METHOD_KINDS).join('|')})\\s*\\(`
);

function repoPath(path: string): string {
  return join(process.cwd(), path);
}

function toRepoRelativePath(path: string): string {
  return path
    .replace(`${process.cwd()}${process.platform === 'win32' ? '\\' : '/'}`, '')
    .replace(/\\/g, '/');
}

function listFilesRecursively(rootPath: string): string[] {
  const absoluteRoot = repoPath(rootPath);
  if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) {
    return [];
  }

  const files: string[] = [];

  function walk(path: string): void {
    for (const entry of readdirSync(path)) {
      const absolute = join(path, entry);
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        walk(absolute);
        continue;
      }

      if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) {
        continue;
      }

      const relativePath = toRepoRelativePath(absolute);
      if (
        relativePath === AUDIT_FILE ||
        relativePath.endsWith('.test.ts') ||
        relativePath.endsWith('.test.tsx')
      ) {
        continue;
      }

      files.push(relativePath);
    }
  }

  walk(absoluteRoot);
  return files;
}

function lineTouchKind(line: string): { method: string; kind: DirectStorageTouchKind } | null {
  const methodMatch = PACKET_STORE_METHOD_PATTERN.exec(line);
  if (methodMatch) {
    const method = methodMatch[1] as keyof typeof PACKET_STORE_METHOD_KINDS;
    return { method, kind: PACKET_STORE_METHOD_KINDS[method] };
  }

  if (/new\s+NodeSQLitePacketStore\s*\(/.test(line)) {
    return { method: 'new NodeSQLitePacketStore', kind: 'storage_constructor' };
  }

  if (/new\s+DatabaseSync\s*\(/.test(line)) {
    return { method: 'new DatabaseSync', kind: 'raw_sqlite' };
  }

  return null;
}

function classifyStorageTouch(input: {
  file_path: string;
  kind: DirectStorageTouchKind;
  method: string;
}): Pick<DirectStorageTouch, 'category' | 'reason'> {
  const { file_path: filePath, kind, method } = input;

  if (filePath.startsWith('runtime/storage/')) {
    return {
      category: 'allowed_infrastructure',
      reason: 'Concrete storage adapters and query services are the storage layer, not callers bypassing it.',
    };
  }

  if (filePath.startsWith('runtime/trusted_coordinators/trusted_archive_coordinator/')) {
    return {
      category: 'allowed_infrastructure',
      reason: 'Trusted Archive is the coordinator-owned storage boundary for packet reads, imports, exports, and certified writes.',
    };
  }

  if (
    filePath.startsWith('runtime/trusted_coordinators/') &&
    (kind === 'packet_read' || kind === 'packet_query')
  ) {
    return {
      category: 'allowed_read',
      reason: 'Trusted coordinator read/query access is permitted while coordinator ownership is being tightened.',
    };
  }

  if (kind === 'packet_read' || kind === 'packet_query' || kind === 'derived_state_read') {
    return {
      category: 'allowed_read',
      reason: 'Read/query access does not mutate canonical packet storage.',
    };
  }

  if (kind === 'derived_state_write') {
    return {
      category: 'allowed_infrastructure',
      reason: 'Derived runtime tables and caches are infrastructure state, not canonical packet revisions.',
    };
  }

  if (kind === 'storage_constructor') {
    return {
      category: 'allowed_infrastructure',
      reason: 'Service composition may construct the concrete storage adapter at the runtime boundary.',
    };
  }

  if (
    filePath === 'runtime/nexus/server/nexus-packet-service-bootstrap.ts' ||
    filePath === 'runtime/nexus/server/discussion/default-discussion-surfaces.ts' ||
    filePath === 'runtime/nexus/server/locality/locality-directory-service.ts' ||
    filePath === 'runtime/nexus/server/identity/auth-service.ts' ||
    filePath === 'runtime/nexus/server/verification-service.ts' ||
    filePath === 'runtime/nexus/server/definition-packet-revisions.ts' ||
    filePath === 'runtime/nexus/server/nexus-reseed.ts'
  ) {
    return {
      category: 'allowed_infrastructure',
      reason: 'Classified infrastructure writer: bootstrap, identity custody, locality seed path, generic definition revision seam, local reseed maintenance, or verification report backfill.',
    };
  }

  if (
    filePath === 'runtime/nexus/server/discussion/discussion-service.ts' ||
    filePath === 'runtime/nexus/server/reaction/reaction-service.ts' ||
    filePath === 'runtime/nexus/server/preference-runtime-connectors.ts' ||
    filePath === 'runtime/nexus/server/packet-explorer/nexus-packet-import.ts'
  ) {
    return {
      category: 'needs_trusted_coordinator',
      reason: 'Canonical packet write remains in a product/service helper and should migrate fully behind Dispatch/Planning/Building/Certification/Verification/Archive.',
    };
  }

  if (kind === 'raw_sqlite') {
    return {
      category: 'allowed_infrastructure',
      reason: 'Raw SQLite access here is treated as runtime-owned local table infrastructure until a narrower derived-state store is extracted.',
    };
  }

  if (
    method === 'writeRevision' ||
    method === 'publishRevision' ||
    kind === 'packet_write' ||
    kind === 'packet_publish' ||
    kind === 'bundle_import' ||
    kind === 'bundle_export'
  ) {
    return {
      category: 'needs_review',
      reason: 'Packet storage mutation is not yet classified by this audit. Classify it before reseed work continues.',
    };
  }

  return {
    category: 'needs_review',
    reason: 'Storage touch needs explicit classification.',
  };
}

function scanDirectStorageTouches(): DirectStorageTouch[] {
  const touches: DirectStorageTouch[] = [];
  const files = SCAN_ROOTS.flatMap((root) => listFilesRecursively(root));

  for (const filePath of files) {
    const lines = readFileSync(repoPath(filePath), 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      const match = lineTouchKind(line);
      if (!match) {
        continue;
      }

      const classification = classifyStorageTouch({
        file_path: filePath,
        kind: match.kind,
        method: match.method,
      });

      touches.push({
        file_path: filePath,
        line_number: index + 1,
        method: match.method,
        kind: match.kind,
        category: classification.category,
        reason: classification.reason,
        line: line.trim(),
      });
    }
  }

  return touches.sort((left, right) =>
    left.file_path === right.file_path
      ? left.line_number - right.line_number
      : left.file_path.localeCompare(right.file_path)
  );
}

function createCategoryCounts(
  touches: readonly DirectStorageTouch[]
): Record<DirectStorageTouchCategory, number> {
  return touches.reduce<Record<DirectStorageTouchCategory, number>>(
    (counts, touch) => ({
      ...counts,
      [touch.category]: counts[touch.category] + 1,
    }),
    {
      allowed_read: 0,
      allowed_infrastructure: 0,
      needs_trusted_coordinator: 0,
      needs_review: 0,
    }
  );
}

export function createDirectStorageTouchAuditReport(): DirectStorageTouchAuditReport {
  const touches = scanDirectStorageTouches();
  const findings = touches
    .filter((touch) => touch.category === 'needs_review')
    .map<DirectStorageTouchFinding>((touch) => ({
      severity: 'error',
      code: 'direct_storage_touch_unclassified',
      message: `${touch.file_path}:${touch.line_number} calls ${touch.method} without an explicit migration classification.`,
      file_path: touch.file_path,
      line_number: touch.line_number,
    }));

  return {
    report_kind: 'packet.direct_storage_touch_audit',
    status: findings.length > 0 ? 'fail' : 'pass',
    scanned_roots: [...SCAN_ROOTS],
    touch_count: touches.length,
    touches,
    category_counts: createCategoryCounts(touches),
    migration_target_count: touches.filter(
      (touch) => touch.category === 'needs_trusted_coordinator'
    ).length,
    findings,
  };
}
