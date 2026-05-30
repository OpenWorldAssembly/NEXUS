/**
 * File: packet-specific-runtime-audit.ts
 * Description: Static boundary audit for packet-specific logic that still lives in runtime surfaces.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

export type PacketSpecificRuntimeCategory =
  | 'definition_adapter'
  | 'projection_definition'
  | 'tool_adapter'
  | 'ui_adapter'
  | 'runtime_orchestration'
  | 'runtime_composition'
  | 'compatibility_bridge'
  | 'migration_target'
  | 'needs_boundary_review';

export type PacketSpecificReferenceKind =
  | 'packet_type_literal'
  | 'packet_subtype_literal'
  | 'mutation_intent_literal'
  | 'packet_body_type_reference'
  | 'packet_type_query'
  | 'definition_import'
  | 'packet_builder_call';

export type PacketSpecificRuntimeReference = {
  file_path: string;
  line_number: number;
  kind: PacketSpecificReferenceKind;
  token: string;
  line: string;
};

export type PacketSpecificRuntimeEntry = {
  file_path: string;
  category: PacketSpecificRuntimeCategory;
  reason: string;
  reference_count: number;
  references: PacketSpecificRuntimeReference[];
};

export type PacketSpecificRuntimeFinding = {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  file_path: string;
};

export type PacketSpecificRuntimeAuditReport = {
  report_kind: 'packet.packet_specific_runtime_audit';
  status: 'pass' | 'fail';
  scanned_roots: string[];
  entry_count: number;
  reference_count: number;
  category_counts: Record<PacketSpecificRuntimeCategory, number>;
  entries: PacketSpecificRuntimeEntry[];
  findings: PacketSpecificRuntimeFinding[];
};

const SCAN_ROOTS = [
  'runtime/nexus/server',
  'runtime/trusted_coordinators',
  'src/app/api/nexus',
] as const;

const AUDIT_FILES = new Set([
  'runtime/nexus/server/readiness/packet-specific-runtime-audit.ts',
]);

const PACKET_TYPE_TOKENS = [
  'Action',
  'Bundle',
  'Claim',
  'Decision',
  'Definition',
  'Discussion',
  'Element',
  'Location',
  'Policy',
  'Preference',
  'Proposal',
  'Reaction',
  'Relation',
  'Report',
  'Role',
  'Vote',
] as const;

const PACKET_TYPE_SET = new Set<string>(PACKET_TYPE_TOKENS);

const MUTATION_INTENT_PREFIXES = new Set([
  'actor',
  'assembly',
  'discussion',
  'home_locality',
  'locality',
  'packet',
  'preference',
  'reaction',
  'relation',
  'residence',
  'role',
]);

const ALL_CATEGORIES: PacketSpecificRuntimeCategory[] = [
  'definition_adapter',
  'projection_definition',
  'tool_adapter',
  'ui_adapter',
  'runtime_orchestration',
  'runtime_composition',
  'compatibility_bridge',
  'migration_target',
  'needs_boundary_review',
];

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
        AUDIT_FILES.has(relativePath) ||
        relativePath.endsWith('.test.ts') ||
        relativePath.endsWith('.test.tsx')
      ) {
        continue;
      }

      files.push(relativePath);
    }
  }

  walk(absoluteRoot);
  return files.sort();
}

function pushUniqueReference(
  references: PacketSpecificRuntimeReference[],
  reference: PacketSpecificRuntimeReference
): void {
  const key = `${reference.line_number}:${reference.kind}:${reference.token}`;
  if (
    references.some(
      (existing) =>
        `${existing.line_number}:${existing.kind}:${existing.token}` === key
    )
  ) {
    return;
  }

  references.push(reference);
}

function literalTokens(line: string): string[] {
  const tokens: string[] = [];
  const literalPattern = /['"`]([A-Za-z][A-Za-z0-9_:.\/-]*)['"`]/g;
  for (const match of line.matchAll(literalPattern)) {
    tokens.push(match[1]);
  }
  return tokens;
}

function scanLine(input: {
  file_path: string;
  line_number: number;
  line: string;
}): PacketSpecificRuntimeReference[] {
  const references: PacketSpecificRuntimeReference[] = [];
  const trimmed = input.line.trim();

  for (const match of trimmed.matchAll(/PacketEnvelopeByType\[['"`]([A-Za-z]+)['"`]\]/g)) {
    pushUniqueReference(references, {
      ...input,
      kind: 'packet_body_type_reference',
      token: match[1],
      line: trimmed,
    });
  }

  for (const match of trimmed.matchAll(/listPreferredPacketsByType\(['"`]([A-Za-z]+)['"`]\)/g)) {
    pushUniqueReference(references, {
      ...input,
      kind: 'packet_type_query',
      token: match[1],
      line: trimmed,
    });
  }

  if (/from ['"`]@core\/packets\/definitions\//.test(trimmed)) {
    pushUniqueReference(references, {
      ...input,
      kind: 'definition_import',
      token: trimmed.replace(/^.*from ['"`]([^'"`]+)['"`].*$/, '$1'),
      line: trimmed,
    });
  }

  if (/createPacket\s*\(/.test(trimmed)) {
    pushUniqueReference(references, {
      ...input,
      kind: 'packet_builder_call',
      token: 'createPacket',
      line: trimmed,
    });
  }

  for (const token of literalTokens(trimmed)) {
    if (PACKET_TYPE_SET.has(token)) {
      pushUniqueReference(references, {
        ...input,
        kind: 'packet_type_literal',
        token,
        line: trimmed,
      });
      continue;
    }

    const firstSegment = token.split('.')[0];
    if (token.includes('.') && MUTATION_INTENT_PREFIXES.has(firstSegment)) {
      pushUniqueReference(references, {
        ...input,
        kind: 'mutation_intent_literal',
        token,
        line: trimmed,
      });
      continue;
    }

    if (
      /\b(subtype|relationSubtype|claimKind|packet_subtype|domain)\b/.test(trimmed) &&
      /^[a-z][a-z0-9_-]+$/.test(token)
    ) {
      pushUniqueReference(references, {
        ...input,
        kind: 'packet_subtype_literal',
        token,
        line: trimmed,
      });
    }
  }

  return references;
}

function scanFile(filePath: string): PacketSpecificRuntimeReference[] {
  const lines = readFileSync(repoPath(filePath), 'utf8').split('\n');
  return lines.flatMap((line, index) =>
    scanLine({
      file_path: filePath,
      line_number: index + 1,
      line,
    })
  );
}

function classifyFile(input: {
  file_path: string;
  source: string;
}): Pick<PacketSpecificRuntimeEntry, 'category' | 'reason'> {
  const filePath = input.file_path;
  const name = basename(filePath);

  if (input.source.includes('Compatibility bridge')) {
    return {
      category: 'compatibility_bridge',
      reason: 'Bridge file preserves import compatibility while implementation lives in a more focused module.',
    };
  }

  if (filePath.startsWith('src/app/api/nexus/')) {
    return {
      category: 'ui_adapter',
      reason: 'Route adapter may name packet-specific request/response shapes but should not own core packet behavior.',
    };
  }

  if (filePath.startsWith('runtime/trusted_coordinators/')) {
    return {
      category: 'runtime_orchestration',
      reason: 'Trusted coordinators may route packet-specific workflow metadata while the audit tracks future definition-driven promotion.',
    };
  }

  if (
    filePath.includes('/readiness/') ||
    name.includes('audit') ||
    name.includes('registry') ||
    name.includes('handoff') ||
    name.includes('enrollment') ||
    name.includes('crossing-guard') ||
    name === 'prepare-mutation-intent-schema.ts' ||
    name === 'mutation-policy-gate.ts' ||
    name === 'mutation-intent-registry.ts' ||
    name === 'packet-runtime-master-handler.ts' ||
    name === 'definition-packet-revisions.ts' ||
    name === 'write-security-mode.ts'
  ) {
    return {
      category: 'runtime_orchestration',
      reason: 'Runtime audit, registry, or corridor metadata is expected to enumerate live packet-specific intents until definitions own more workflow resolution.',
    };
  }


  if (
    name.startsWith('preference-packet-') ||
    name === 'preference-runtime-connectors.ts'
  ) {
    return {
      category: 'definition_adapter',
      reason: 'Preference adapter converts runtime compatibility state and Definition metadata for the Preference packet family.',
    };
  }

  if (
    filePath.includes('/discussion/') ||
    filePath.includes('/reaction/') ||
    filePath.includes('/locality/') ||
    filePath.includes('/scope/') ||
    name.includes('discussion') ||
    name.includes('reaction') ||
    name.includes('locality') ||
    name.includes('scope') ||
    name === 'claim-utils.ts' ||
    name === 'relation-utils.ts' ||
    name === 'relation-policy.ts' ||
    name === 'elemental-scope-relations.ts' ||
    name === 'elemental-scope-relation-planner.ts'
  ) {
    return {
      category: 'projection_definition',
      reason: 'Packet-family projection/runtime helper remains behavior-preserving for now and is queued for definition-driven projection extraction.',
    };
  }

  if (
    filePath.includes('/packet-explorer/') ||
    name.startsWith('nexus-packet-') ||
    name === 'packet-action-service.ts' ||
    name === 'nexus-query-data.ts'
  ) {
    return {
      category: 'tool_adapter',
      reason: 'Packet Explorer/tooling code may inspect or label packet families but should delegate writes to trusted coordinators.',
    };
  }

  if (
    name === 'nexus-packet-service-bootstrap.ts' ||
    name === 'nexus-packet-service-registry.ts' ||
    name === 'nexus-packet-services.ts' ||
    name === 'nexus-packet-services.types.ts' ||
    name === 'auth-service.ts' ||
    name.startsWith('auth-service.') ||
    name === 'verification-service.ts' ||
    name === 'identity-search-service.ts'
  ) {
    return {
      category: 'runtime_composition',
      reason: 'Service composition/infrastructure may mention packet families to wire runtime surfaces without owning packet definitions.',
    };
  }

  if (name.includes('shell-preferences')) {
    return {
      category: 'ui_adapter',
      reason: 'Shell preference compatibility adapter is UI/runtime state around the Preference.element packet family.',
    };
  }

  return {
    category: 'needs_boundary_review',
    reason: 'Packet-specific reference lives in a file without an explicit runtime-boundary classification.',
  };
}

function createCategoryCounts(
  entries: readonly PacketSpecificRuntimeEntry[]
): Record<PacketSpecificRuntimeCategory, number> {
  return entries.reduce<Record<PacketSpecificRuntimeCategory, number>>(
    (counts, entry) => ({
      ...counts,
      [entry.category]: counts[entry.category] + 1,
    }),
    Object.fromEntries(ALL_CATEGORIES.map((category) => [category, 0])) as Record<
      PacketSpecificRuntimeCategory,
      number
    >
  );
}

export function createPacketSpecificRuntimeAuditReport(): PacketSpecificRuntimeAuditReport {
  const files = SCAN_ROOTS.flatMap((root) => listFilesRecursively(root));
  const entries: PacketSpecificRuntimeEntry[] = [];

  for (const filePath of files) {
    const references = scanFile(filePath);
    if (references.length === 0) {
      continue;
    }

    const source = readFileSync(repoPath(filePath), 'utf8');
    const classification = classifyFile({ file_path: filePath, source });

    entries.push({
      file_path: filePath,
      category: classification.category,
      reason: classification.reason,
      reference_count: references.length,
      references,
    });
  }

  const findings: PacketSpecificRuntimeFinding[] = entries
    .filter((entry) => entry.category === 'needs_boundary_review')
    .map((entry) => ({
      severity: 'error',
      code: 'packet_specific_runtime_boundary_unclassified',
      message: `${entry.file_path} has ${entry.reference_count} packet-specific reference(s) without a runtime-boundary classification.`,
      file_path: entry.file_path,
    }));

  for (const entry of entries.filter((candidate) => candidate.category === 'migration_target')) {
    findings.push({
      severity: 'warning',
      code: 'packet_specific_runtime_migration_target',
      message: `${entry.file_path} remains a definition-specific runtime helper and should be the next genericization pilot.`,
      file_path: entry.file_path,
    });
  }

  return {
    report_kind: 'packet.packet_specific_runtime_audit',
    status: findings.some((finding) => finding.severity === 'error') ? 'fail' : 'pass',
    scanned_roots: [...SCAN_ROOTS],
    entry_count: entries.length,
    reference_count: entries.reduce((total, entry) => total + entry.reference_count, 0),
    category_counts: createCategoryCounts(entries),
    entries: entries.sort((left, right) =>
      left.file_path.localeCompare(right.file_path)
    ),
    findings,
  };
}
