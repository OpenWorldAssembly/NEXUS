import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import test from 'node:test';

import { DIRECT_PACKET_WRITE_SEAMS } from './write-seam-registry.ts';

const SERVER_ROOT = join(process.cwd(), 'runtime', 'nexus', 'server');

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
    (filePath) => !Object.hasOwn(DIRECT_PACKET_WRITE_SEAMS, basename(filePath))
  );

  assert.deepEqual(unclassifiedWriters, []);

  const observedAllowlistedWriters = writerFiles
    .map((filePath) => basename(filePath))
    .filter((fileName) => Object.hasOwn(DIRECT_PACKET_WRITE_SEAMS, fileName))
    .sort();

  assert.deepEqual(
    observedAllowlistedWriters,
    Object.keys(DIRECT_PACKET_WRITE_SEAMS).sort()
  );
});

test('runtime packet writer classifications keep explicit category and reason', () => {
  Object.entries(DIRECT_PACKET_WRITE_SEAMS).forEach(([fileName, seam]) => {
    assert.match(fileName, /\.ts$/);
    assert.notEqual(seam.category.trim(), '');
    assert.notEqual(seam.reason.trim(), '');
  });
});
