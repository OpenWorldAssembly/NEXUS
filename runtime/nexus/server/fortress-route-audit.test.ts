import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { MUTATING_SERVICE_AUDIT_ENTRIES } from './mutating-service-audit-registry.ts';

const API_ROOT = join(process.cwd(), 'src', 'app', 'api', 'nexus');

function listApiFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);
    const entryStat = statSync(entryPath);

    if (entryStat.isDirectory()) {
      return listApiFiles(entryPath);
    }

    return entryPath.endsWith('+api.ts') ? [entryPath] : [];
  });
}

test('first-party interactive nexus routes do not directly write packets', () => {
  const offenders = listApiFiles(API_ROOT).filter((filePath) =>
    readFileSync(filePath, 'utf8').includes('packetStore.writeRevision(')
  );

  assert.deepEqual(offenders, []);
});

test('non-canonical nexus routes do not run the mutation corridor directly', () => {
  const allowedMutationRoutes = new Set([
    join(API_ROOT, 'mutations', 'prepare+api.ts'),
    join(API_ROOT, 'mutations', 'finalize+api.ts'),
  ]);
  const offenders = listApiFiles(API_ROOT).filter((filePath) => {
    if (allowedMutationRoutes.has(filePath)) {
      return false;
    }

    const source = readFileSync(filePath, 'utf8');

    return (
      source.includes('mutationService.prepareMutation(') ||
      source.includes('mutationService.finalizeMutation(')
    );
  });

  assert.deepEqual(offenders, []);
});

test('non-canonical nexus routes do not call known mutating services directly', () => {
  const allowedRoutes = new Set([
    join(API_ROOT, 'mutations', 'prepare+api.ts'),
    join(API_ROOT, 'mutations', 'finalize+api.ts'),
  ]);
  const offenders = listApiFiles(API_ROOT).filter((filePath) => {
    if (allowedRoutes.has(filePath)) {
      return false;
    }

    const source = readFileSync(filePath, 'utf8');
    return MUTATING_SERVICE_AUDIT_ENTRIES.some((entry) =>
      source.includes(entry.pattern)
    );
  });

  assert.deepEqual(offenders, []);
});
