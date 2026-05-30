/**
 * File: audit-nexus-write-routes.ts
 * Description: Audits Nexus API write-method routes so canonical writes stay on the trusted Dispatch corridor or explicitly deprecated surfaces.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

type RouteClassification =
  | 'dispatch_write_corridor'
  | 'deprecated_410'
  | 'auth_identity_or_session_infrastructure'
  | 'query_or_preview_post'
  | 'packet_explorer_exchange_import_export'
  | 'guest_shell_compatibility'
  | 'unclassified_write_route';

type RouteAuditEntry = {
  file_path: string;
  methods: string[];
  classification: RouteClassification;
  reason: string;
};

type RouteAuditReport = {
  checked_routes: number;
  write_method_routes: number;
  entries: RouteAuditEntry[];
};

const API_ROOT = 'src/app/api/nexus';
const WRITE_METHOD_PATTERN = /export\s+const\s+(POST|PUT|PATCH|DELETE)\s*:/g;

const QUERY_OR_PREVIEW_POST_ROUTES = new Set([
  'src/app/api/nexus/identity-search+api.ts',
  'src/app/api/nexus/location-search+api.ts',
  'src/app/api/nexus/locality-preview+api.ts',
  'src/app/api/nexus/packets/actions+api.ts',
  'src/app/api/nexus/packets/export/download+api.ts',
  'src/app/api/nexus/packets/export/preview+api.ts',
  'src/app/api/nexus/packets/verification+api.ts',
]);

function repoPath(path: string): string {
  return join(process.cwd(), path);
}

function toRepoRelativePath(path: string): string {
  return path
    .replace(`${process.cwd()}${process.platform === 'win32' ? '\\' : '/'}`, '')
    .replace(/\\/g, '/');
}

function listApiRouteFiles(): string[] {
  const root = repoPath(API_ROOT);
  const files: string[] = [];

  function walk(path: string): void {
    for (const entry of readdirSync(path)) {
      const absolute = join(path, entry);
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        walk(absolute);
      } else if (entry.endsWith('+api.ts')) {
        files.push(toRepoRelativePath(absolute));
      }
    }
  }

  if (existsSync(root)) {
    walk(root);
  }

  return files.sort();
}

function readFile(path: string): string {
  return readFileSync(repoPath(path), 'utf8');
}

function findWriteMethods(source: string): string[] {
  return [...source.matchAll(WRITE_METHOD_PATTERN)].map((match) => match[1]);
}

function classifyRoute(filePath: string, source: string): RouteAuditEntry {
  const methods = findWriteMethods(source);

  if (filePath === 'src/app/api/nexus/mutations/prepare+api.ts') {
    return {
      file_path: filePath,
      methods,
      classification: source.includes('trustedDispatchCoordinator.prepareEnrolledMutationWrite')
        ? 'dispatch_write_corridor'
        : 'unclassified_write_route',
      reason: 'Prepare is the route-facing Dispatch write-corridor entrypoint.',
    };
  }

  if (filePath === 'src/app/api/nexus/mutations/finalize+api.ts') {
    return {
      file_path: filePath,
      methods,
      classification: source.includes('trustedDispatchCoordinator.finalizeEnrolledMutationWrite')
        ? 'dispatch_write_corridor'
        : 'unclassified_write_route',
      reason: 'Finalize is the route-facing Dispatch write-corridor entrypoint.',
    };
  }

  if (source.includes(',\n    410') || source.includes(', 410') || source.includes('status = 410')) {
    return {
      file_path: filePath,
      methods,
      classification: 'deprecated_410',
      reason: 'Legacy direct write method is explicitly blocked and points callers at the shared mutation corridor.',
    };
  }

  if (filePath.startsWith('src/app/api/nexus/auth/')) {
    return {
      file_path: filePath,
      methods,
      classification: 'auth_identity_or_session_infrastructure',
      reason: 'Auth routes own identity/session/passkey infrastructure outside canonical product packet mutations.',
    };
  }

  if (filePath === 'src/app/api/nexus/packets/explorer+api.ts') {
    const callsExchangeImport = source.includes('getNexusPacketExplorerImportCommit');
    return {
      file_path: filePath,
      methods,
      classification: callsExchangeImport
        ? 'packet_explorer_exchange_import_export'
        : 'unclassified_write_route',
      reason: 'Packet Explorer POST multiplexes import/export/search actions; import commit is delegated through the Exchange-owned import helper.',
    };
  }

  if (filePath === 'src/app/api/nexus/shell-preferences+api.ts') {
    return {
      file_path: filePath,
      methods,
      classification: 'guest_shell_compatibility',
      reason: 'Guest shell compatibility state writes cookies/local compatibility state; claimed Preference.element writes use the signed mutation corridor.',
    };
  }

  if (QUERY_OR_PREVIEW_POST_ROUTES.has(filePath)) {
    return {
      file_path: filePath,
      methods,
      classification: 'query_or_preview_post',
      reason: 'POST is used for request-shape ergonomics, read-side preview, validation, or export generation rather than canonical packet mutation.',
    };
  }

  return {
    file_path: filePath,
    methods,
    classification: 'unclassified_write_route',
    reason: 'Write-method Nexus API route is not on the trusted corridor allowlist and is not explicitly deprecated.',
  };
}

export function auditNexusWriteRoutes(): RouteAuditReport {
  const entries = listApiRouteFiles()
    .map((filePath) => ({ filePath, source: readFile(filePath) }))
    .filter((entry) => findWriteMethods(entry.source).length > 0)
    .map((entry) => classifyRoute(entry.filePath, entry.source));

  return {
    checked_routes: listApiRouteFiles().length,
    write_method_routes: entries.length,
    entries,
  };
}

const report = auditNexusWriteRoutes();
const unclassified = report.entries.filter(
  (entry) => entry.classification === 'unclassified_write_route'
);

const counts = report.entries.reduce<Record<string, number>>((acc, entry) => {
  acc[entry.classification] = (acc[entry.classification] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `Nexus write-route audit: ${unclassified.length} error(s), ${report.write_method_routes} write-method route file(s).`
);
for (const [classification, count] of Object.entries(counts).sort()) {
  console.log(`[COUNT] ${classification}: ${count}`);
}
for (const entry of unclassified) {
  console.log(
    `[ERROR] ${entry.file_path} ${entry.methods.join(',')}: ${entry.reason}`
  );
}

if (unclassified.length > 0) {
  process.exitCode = 1;
}
