import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import test from 'node:test';

const SERVER_ROOT = join(process.cwd(), 'runtime', 'nexus', 'server');

const ALLOWLISTED_WRITERS = new Map<string, string>([
  ['mutation-service.ts', 'fortress actor-write path'],
  ['discussion-service.ts', 'fortress-internal discussion persistence helper'],
  ['attestation-service.ts', 'fortress-internal attestation persistence helper'],
  ['default-discussion-surfaces.ts', 'system discussion-surface bootstrap helper'],
  ['locality-directory-service.ts', 'system locality bootstrap helper'],
  ['auth-service.ts', 'identity bootstrap writer'],
  ['nexus-packet-service-bootstrap.ts', 'bootstrap/backfill writer'],
]);

function listTypeScriptFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);
    const entryStat = statSync(entryPath);

    if (entryStat.isDirectory()) {
      return listTypeScriptFiles(entryPath);
    }

    return entryPath.endsWith('.ts') && !entryPath.endsWith('.test.ts')
      ? [entryPath]
      : [];
  });
}

test('runtime packet writers stay explicitly classified', () => {
  const writerFiles = listTypeScriptFiles(SERVER_ROOT).filter((filePath) =>
    readFileSync(filePath, 'utf8').includes('packetStore.writeRevision(')
  );

  const unclassifiedWriters = writerFiles.filter(
    (filePath) => !ALLOWLISTED_WRITERS.has(basename(filePath))
  );

  assert.deepEqual(unclassifiedWriters, []);

  const observedAllowlistedWriters = writerFiles
    .map((filePath) => basename(filePath))
    .filter((fileName) => ALLOWLISTED_WRITERS.has(fileName))
    .sort();

  assert.deepEqual(observedAllowlistedWriters, [...ALLOWLISTED_WRITERS.keys()].sort());
});
