/**
 * File: audit-trusted-coordinators.ts
 * Description: Audits trusted coordinator scaffold boundaries, public surfaces, and runtime crossing notes.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  listTrustedCoordinatorScaffoldDescriptors,
} from '@runtime/trusted_coordinators/trusted_coordinator_manifest.ts';
import {
  isKnownTrustedIssueCode,
} from '@runtime/trusted_coordinators/trusted_issue_taxonomy.ts';

type AuditFinding = {
  severity: 'warning' | 'error';
  coordinator_id: string;
  code: string;
  message: string;
};

type AuditNote = {
  code: string;
  message: string;
};

type RuntimeCrossingCategory = {
  code: string;
  patterns: readonly string[];
};

type RuntimeCrossingHit = {
  file_path: string;
  hits: string[];
};


const REMOVED_LEGACY_MUTATION_EXECUTOR_PATHS = [
  'runtime/nexus/server/fortress-finalize-handler-implementation.ts',
  'runtime/nexus/server/fortress-prepare-handler-implementation.ts',
  'runtime/nexus/server/mutation-finalize-handlers.ts',
  'runtime/nexus/server/mutation-prepare-handlers.ts',
  'runtime/nexus/server/mutation-service.ts',
  'runtime/nexus/server/signed-packet-finalizer.ts',
  'runtime/nexus/server/preference-fortress-workflow.ts',
  'runtime/nexus/server/manifest-fortress-bridge.ts',
  'runtime/nexus/server/manifest-shadow-fortress-bridge.ts',
] as const;


const REMOVED_LEGACY_IMPORT_PATTERNS = [
  'fortress-request',
  'fortress-handler-genericization-audit',
  'preference-fortress-workflow',
  'signed-packet-finalizer',
  'mutation-service',
  'fortress-prepare-handler',
  'fortress-finalize-handler',
] as const;

const REMOVED_LEGACY_IMPORT_SCAN_ROOTS = [
  'runtime/nexus/server',
  'src/app/api/nexus',
] as const;

const RUNTIME_CROSSING_CATEGORIES: readonly RuntimeCrossingCategory[] = [
  {
    code: 'direct_storage_touch',
    patterns: [
      'packetStore.importBundle(',
      'packetStore.exportBundle(',
      'packetStore.write',
      'packetStore.append',
      'packetStore.save',
      'packetStore.delete',
      'writePacketRevision',
      'new NodeSQLitePacketStore',
    ],
  },
  {
    code: 'direct_signature_verification',
    patterns: [
      'verifyPacketSignatureDetailed(',
      'verifyPacketSignature(',
      'verifySignature(',
    ],
  },
  {
    code: 'direct_packet_interpretation',
    patterns: [
      'interpretPacket(',
    ],
  },
  {
    code: 'direct_bundle_import_export',
    patterns: [
      'importBundle(',
      'exportBundle(',
      'analyzePacketImportText(',
      'commitPacketImport(',
      'exportNexusPacketBundle(',
    ],
  },
  {
    code: 'direct_packet_parse_in_api_route',
    patterns: [
      'parsePacketEnvelope(',
    ],
  },
  {
    code: 'legacy_fortress_corridor',
    patterns: [
      'fortress',
      'Fortress',
      'NexusMutationService',
      'mutationTicket',
      'MutationTicket',
    ],
  },
];

function repoPath(path: string): string {
  return join(process.cwd(), path);
}

function toRepoRelativePath(path: string): string {
  return path.replace(`${process.cwd()}${process.platform === 'win32' ? '\\' : '/'}`, '').replace(/\\/g, '/');
}

function readIfFile(path: string): string | null {
  const absolute = repoPath(path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    return null;
  }

  return readFileSync(absolute, 'utf8');
}

function publicCoordinatorFile(path: string): string {
  const folderName = path.split('/').at(-1) ?? '';
  return `${path}/${folderName}.ts`;
}

function folderContainsForbiddenPublicFunctionExport(path: string): string[] {
  const content = readIfFile(`${path}/index.ts`);
  if (!content) {
    return [];
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('./functions/') || line.includes('./trusted_') && line.includes('_registry'));
}

function publicObjectFileContainsMethod(content: string, methodName: string): boolean {
  return new RegExp(`${methodName}\\s*\\(`).test(content) || new RegExp(`${methodName}\\s*:`).test(content);
}

function expectedCoordinatorExport(path: string): string {
  if (path.endsWith('.ts')) {
    return `./${path.replace(/^runtime\/trusted_coordinators\//, '')}`;
  }

  return `./${path.replace(/^runtime\/trusted_coordinators\//, '')}/index.ts`;
}

function expectedCanonicalKind(path: string): string | null {
  const folderName = path.split('/').at(-1) ?? '';
  const match = /^trusted_(.+)_coordinator$/.exec(folderName);

  return match?.[1] ?? null;
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

      files.push(toRepoRelativePath(absolute));
    }
  }

  walk(absoluteRoot);
  return files;
}

function scanTrustedCoordinatorFolderFindings(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const root = repoPath('runtime/trusted_coordinators');
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return findings;
  }

  const manifestFolders = new Set(
    listTrustedCoordinatorScaffoldDescriptors()
      .filter((descriptor) => descriptor.structure === 'foldered_gated')
      .map((descriptor) => descriptor.runtime_path),
  );

  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry);
    if (!statSync(absolute).isDirectory() || !/^trusted_.+_coordinator$/.test(entry)) {
      continue;
    }

    const relativePath = `runtime/trusted_coordinators/${entry}`;
    if (!manifestFolders.has(relativePath)) {
      findings.push({
        severity: 'error',
        coordinator_id: 'trusted_runtime_scaffold',
        code: 'trusted_unmanifested_coordinator_folder',
        message: `${relativePath} looks like a trusted coordinator folder but is not declared in the scaffold manifest.`,
      });
    }
  }

  return findings;
}

function scanPackageScriptFindings(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const packageContent = readIfFile('package.json');
  if (!packageContent) {
    findings.push({
      severity: 'error',
      coordinator_id: 'trusted_runtime_tests',
      code: 'trusted_package_json_missing',
      message: 'package.json is required to verify trusted coordinator test scripts.',
    });
    return findings;
  }

  const packageJson = JSON.parse(packageContent) as { scripts?: Record<string, string> };
  for (const scriptName of ['test:trusted-coordinators', 'check:trusted-coordinators']) {
    if (!packageJson.scripts?.[scriptName]) {
      findings.push({
        severity: 'error',
        coordinator_id: 'trusted_runtime_tests',
        code: 'trusted_test_script_missing',
        message: `package.json must define ${scriptName}.`,
      });
    }
  }

  return findings;
}

function scanRuntimeCrossingNotes(): AuditNote[] {
  const filesToScan = [
    ...listFilesRecursively('runtime/nexus/server'),
    ...listFilesRecursively('src/app/api/nexus'),
  ].filter((path) =>
    !path.endsWith('.test.ts') &&
    !path.endsWith('.test.tsx') &&
    path !== 'runtime/nexus/server/readiness/direct-storage-touch-audit.ts'
  );

  const notes: AuditNote[] = [];

  for (const category of RUNTIME_CROSSING_CATEGORIES) {
    const hitsByFile: RuntimeCrossingHit[] = [];

    for (const filePath of filesToScan) {
      const content = readIfFile(filePath);
      if (!content) {
        continue;
      }

      const hits = category.patterns.filter((pattern) => content.includes(pattern));
      if (hits.length > 0) {
        hitsByFile.push({ file_path: filePath, hits });
      }
    }

    if (hitsByFile.length === 0) {
      continue;
    }

    const totalHits = hitsByFile.reduce((sum, entry) => sum + entry.hits.length, 0);
    const examples = hitsByFile
      .slice(0, 10)
      .map((entry) => `${entry.file_path} (${entry.hits.join(', ')})`)
      .join('; ');
    const suffix = hitsByFile.length > 10 ? `; +${hitsByFile.length - 10} more file(s)` : '';

    notes.push({
      code: category.code,
      message: `${totalHits} pattern hit(s) across ${hitsByFile.length} file(s). Examples: ${examples}${suffix}`,
    });
  }

  return notes;
}


function scanLiveMutationServiceDependencyFindings(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const serviceRegistry = readIfFile('runtime/nexus/server/nexus-packet-service-registry.ts') ?? '';
  const serviceTypes = readIfFile('runtime/nexus/server/nexus-packet-services.types.ts') ?? '';
  const prepareRoute = readIfFile('src/app/api/nexus/mutations/prepare+api.ts') ?? '';
  const finalizeRoute = readIfFile('src/app/api/nexus/mutations/finalize+api.ts') ?? '';
  const dispatchSource = readIfFile('runtime/trusted_coordinators/trusted_dispatch_coordinator/trusted_dispatch_coordinator.ts') ?? '';

  if (
    serviceRegistry.includes('NexusMutationService') ||
    serviceRegistry.includes('new MutationTicketStore') ||
    serviceRegistry.includes('mutationService')
  ) {
    findings.push({
      severity: 'error',
      coordinator_id: 'trusted_dispatch_coordinator.v0',
      code: 'trusted_live_mutation_service_dependency',
      message: 'The live Nexus packet service registry must not construct or expose NexusMutationService; Dispatch owns route-facing prepare/finalize authority.',
    });
  }

  if (serviceTypes.includes('mutationService')) {
    findings.push({
      severity: 'error',
      coordinator_id: 'trusted_dispatch_coordinator.v0',
      code: 'trusted_live_mutation_service_dependency',
      message: 'NexusPacketServices must not expose mutationService as a live runtime dependency.',
    });
  }

  for (const [routePath, routeSource] of [
    ['src/app/api/nexus/mutations/prepare+api.ts', prepareRoute],
    ['src/app/api/nexus/mutations/finalize+api.ts', finalizeRoute],
  ] as const) {
    if (
      routeSource.includes('mutationService.prepareMutation(') ||
      routeSource.includes('mutationService.finalizeMutation(') ||
      routeSource.includes('mutationService.readTicket(')
    ) {
      findings.push({
        severity: 'error',
        coordinator_id: 'trusted_dispatch_coordinator.v0',
        code: 'trusted_route_uses_legacy_mutation_service',
        message: `${routePath} must call Trusted Dispatch rather than NexusMutationService.`,
      });
    }
  }

  if (
    dispatchSource.includes('SQLiteReactionService') ||
    dispatchSource.includes('@runtime/nexus/server/reaction') ||
    dispatchSource.includes('reaction-service')
  ) {
    findings.push({
      severity: 'error',
      coordinator_id: 'trusted_dispatch_coordinator.v0',
      code: 'trusted_dispatch_product_service_dependency',
      message: 'Trusted Dispatch must not import reaction runtime services; reaction finalize response decoration belongs in the runtime adapter layer.',
    });
  }

  return findings;
}


function scanRemovedLegacyExecutorFindings(): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const removedPath of REMOVED_LEGACY_MUTATION_EXECUTOR_PATHS) {
    if (!existsSync(repoPath(removedPath))) {
      continue;
    }

    findings.push({
      severity: 'error',
      coordinator_id: 'trusted_dispatch_coordinator.v0',
      code: 'trusted_removed_legacy_executor_present',
      message: `${removedPath} was retired from the live mutation corridor and must not be restored; Dispatch owns route-facing prepare/finalize authority.`,
    });
  }

  return findings;
}


function scanRemovedLegacyImportFindings(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const filesToScan = REMOVED_LEGACY_IMPORT_SCAN_ROOTS.flatMap((rootPath) =>
    listFilesRecursively(rootPath)
  );

  for (const filePath of filesToScan) {
    const content = readIfFile(filePath);
    if (!content) {
      continue;
    }

    const matches = REMOVED_LEGACY_IMPORT_PATTERNS.filter((pattern) =>
      content.includes(pattern)
    );

    for (const pattern of matches) {
      findings.push({
        severity: 'error',
        coordinator_id: 'trusted_dispatch_coordinator.v0',
        code: 'trusted_removed_legacy_import_present',
        message: `${filePath} references retired module pattern '${pattern}'. Deleted runtime executor modules must not be restored through stale imports.`,
      });
    }
  }

  return findings;
}

function scanIssueCodeFindings(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const coordinatorRoot = repoPath('runtime/trusted_coordinators');

  function scanFile(filePath: string): void {
    if (
      filePath.endsWith('trusted_issue_taxonomy.ts') ||
      filePath.endsWith('trusted_process.ts')
    ) {
      return;
    }

    const content = readFileSync(filePath, 'utf8');
    const relativePath = toRepoRelativePath(filePath);
    const matches = Array.from(content.matchAll(/code:\s*['"]([^'"]+)['"]/g));

    for (const match of matches) {
      const code = match[1];
      if (!isKnownTrustedIssueCode(code)) {
        findings.push({
          severity: 'error',
          coordinator_id: 'trusted_runtime_issue_taxonomy',
          code: 'trusted_issue_code_unregistered',
          message: `${relativePath} uses unregistered trusted issue code '${code}'.`,
        });
      }
    }
  }

  function scanFolder(folderPath: string): void {
    for (const entry of readdirSync(folderPath)) {
      const absolute = join(folderPath, entry);
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        scanFolder(absolute);
      } else if (entry.endsWith('.ts')) {
        scanFile(absolute);
      }
    }
  }

  if (existsSync(coordinatorRoot)) {
    scanFolder(coordinatorRoot);
  }

  return findings;
}

function audit(): { findings: AuditFinding[]; notes: AuditNote[] } {
  const findings: AuditFinding[] = [];
  const notes: AuditNote[] = [];
  const barrelContent = readIfFile('runtime/trusted_coordinators/index.ts') ?? '';

  findings.push(...scanTrustedCoordinatorFolderFindings());
  findings.push(...scanPackageScriptFindings());
  findings.push(...scanLiveMutationServiceDependencyFindings());
  findings.push(...scanRemovedLegacyExecutorFindings());
  findings.push(...scanRemovedLegacyImportFindings());

  for (const descriptor of listTrustedCoordinatorScaffoldDescriptors()) {
    const pathExists = existsSync(repoPath(descriptor.runtime_path));

    if (!pathExists) {
      findings.push({
        severity: descriptor.structure === 'planned' ? 'warning' : 'error',
        coordinator_id: descriptor.coordinator_id,
        code: 'trusted_coordinator_path_missing',
        message: `${descriptor.runtime_path} does not exist.`,
      });
      continue;
    }

    if (descriptor.structure === 'foldered_gated') {
      const folderName = descriptor.runtime_path.split('/').at(-1);
      const expectedRegistry = `${descriptor.runtime_path}/${folderName?.replace('_coordinator', '_registry')}.ts`;
      const expectedTypes = `${descriptor.runtime_path}/${folderName?.replace('_coordinator', '_types')}.ts`;
      const expectedPublic = publicCoordinatorFile(descriptor.runtime_path);
      const barrelExport = expectedCoordinatorExport(descriptor.runtime_path);

      for (const requiredPath of [
        `${descriptor.runtime_path}/index.ts`,
        expectedPublic,
        expectedRegistry,
        expectedTypes,
        `${descriptor.runtime_path}/functions`,
      ]) {
        if (!existsSync(repoPath(requiredPath))) {
          findings.push({
            severity: 'error',
            coordinator_id: descriptor.coordinator_id,
            code: 'trusted_folder_scaffold_missing_part',
            message: `${requiredPath} is required for foldered trusted coordinators.`,
          });
        }
      }

      if (!barrelContent.includes(barrelExport)) {
        findings.push({
          severity: 'error',
          coordinator_id: descriptor.coordinator_id,
          code: 'trusted_top_level_barrel_missing_export',
          message: `runtime/trusted_coordinators/index.ts must export ${barrelExport}.`,
        });
      }

      for (const line of folderContainsForbiddenPublicFunctionExport(descriptor.runtime_path)) {
        findings.push({
          severity: 'error',
          coordinator_id: descriptor.coordinator_id,
          code: 'trusted_coordinator_index_exports_internal',
          message: `Public index leaks internal coordinator implementation: ${line}`,
        });
      }

      const publicContent = readIfFile(expectedPublic);
      if (!publicContent) {
        continue;
      }

      if (!publicContent.includes(`export const ${descriptor.public_object_name}`)) {
        findings.push({
          severity: 'error',
          coordinator_id: descriptor.coordinator_id,
          code: 'trusted_public_object_missing',
          message: `${expectedPublic} must export ${descriptor.public_object_name}.`,
        });
      }

      if (!publicContent.includes(`id: '${descriptor.coordinator_id}'`) && !publicContent.includes(`id: \"${descriptor.coordinator_id}\"`)) {
        findings.push({
          severity: 'error',
          coordinator_id: descriptor.coordinator_id,
          code: 'trusted_public_object_id_missing',
          message: `${descriptor.public_object_name} must expose id ${descriptor.coordinator_id}.`,
        });
      }

      for (const method of descriptor.expected_methods) {
        if (!publicObjectFileContainsMethod(publicContent, method.method_name)) {
          findings.push({
            severity: 'error',
            coordinator_id: descriptor.coordinator_id,
            code: 'trusted_public_method_missing',
            message: `${descriptor.public_object_name}.${method.method_name} is required by the trusted coordinator scaffold manifest.`,
          });
        }
      }

      const canonicalKind = expectedCanonicalKind(descriptor.runtime_path);
      if (canonicalKind && canonicalKind !== 'request') {
        const functionFolder = repoPath(`${descriptor.runtime_path}/functions`);
        const coordinatorFiles = [
          expectedPublic,
          `${descriptor.runtime_path}/${folderName?.replace('_coordinator', '_registry')}.ts`,
          ...(
            existsSync(repoPath(`${descriptor.runtime_path}/functions`)) &&
            statSync(repoPath(`${descriptor.runtime_path}/functions`)).isDirectory()
              ? readdirSync(functionFolder)
                  .filter((name: string) => name.endsWith('.ts'))
                  .map((name: string) => `${descriptor.runtime_path}/functions/${name}`)
              : []
          ),
        ];

        for (const coordinatorFile of coordinatorFiles) {
          const content = readIfFile(coordinatorFile);
          if (!content) {
            continue;
          }

          const resultKindMatches = Array.from(content.matchAll(/coordinator_kind:\s*['"]([^'"]+)['"]/g));
          for (const match of resultKindMatches) {
            const resultKind = match[1];
            if (resultKind !== canonicalKind) {
              findings.push({
                severity: 'error',
                coordinator_id: descriptor.coordinator_id,
                code: 'trusted_result_kind_drift',
                message: `${coordinatorFile} returns coordinator_kind '${resultKind}' but manifest kind is '${canonicalKind}'.`,
              });
            }
          }
        }
      }
    }

    if (descriptor.structure === 'legacy_flat') {
      findings.push({
        severity: 'warning',
        coordinator_id: descriptor.coordinator_id,
        code: 'trusted_coordinator_legacy_flat',
        message: `${descriptor.coordinator_id} is still a flat coordinator and should be foldered before it becomes a central authority seam.`,
      });
    }
  }

  notes.push(...scanRuntimeCrossingNotes());
  findings.push(...scanIssueCodeFindings());

  const runtimeCoordinatorSource = readIfFile('runtime/trusted_coordinators/trusted_runtime_coordinator.ts') ?? '';
  if (!runtimeCoordinatorSource.includes('process_chain?: TrustedProcessChain | null')) {
    findings.push({
      severity: 'error',
      coordinator_id: 'trusted_runtime_process',
      code: 'trusted_process_chain_missing_from_envelope',
      message: 'Trusted runtime coordinator results must expose optional process_chain support.',
    });
  }

  return { findings, notes };
}

const { findings, notes } = audit();
const errors = findings.filter((finding) => finding.severity === 'error');
const warnings = findings.filter((finding) => finding.severity === 'warning');

console.log(`Trusted coordinator scaffold audit: ${errors.length} error(s), ${warnings.length} warning(s).`);
for (const finding of findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.coordinator_id} ${finding.code}: ${finding.message}`);
}
for (const note of notes) {
  console.log(`[NOTE] ${note.code}: ${note.message}`);
}

if (errors.length > 0) {
  process.exitCode = 1;
}
