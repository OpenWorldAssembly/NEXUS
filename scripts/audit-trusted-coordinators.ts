/**
 * File: audit-trusted-coordinators.ts
 * Description: Audits trusted coordinator scaffold boundaries and public surfaces without importing app modules.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  listTrustedCoordinatorScaffoldDescriptors,
} from '@runtime/trusted_coordinators/trusted_coordinator_manifest.ts';

type AuditFinding = {
  severity: 'warning' | 'error';
  coordinator_id: string;
  code: string;
  message: string;
};

function repoPath(path: string): string {
  return join(process.cwd(), path);
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
    .filter((line) => line.includes("./functions/") || line.includes("./trusted_") && line.includes('_registry'));
}

function publicObjectFileContainsMethod(content: string, methodName: string): boolean {
  return new RegExp(`${methodName}\\s*\\(`).test(content) || new RegExp(`${methodName}\\s*:`).test(content);
}

function audit(): AuditFinding[] {
  const findings: AuditFinding[] = [];

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

  return findings;
}

const findings = audit();
const errors = findings.filter((finding) => finding.severity === 'error');
const warnings = findings.filter((finding) => finding.severity === 'warning');

console.log(`Trusted coordinator scaffold audit: ${errors.length} error(s), ${warnings.length} warning(s).`);
for (const finding of findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.coordinator_id} ${finding.code}: ${finding.message}`);
}

if (errors.length > 0) {
  process.exitCode = 1;
}
