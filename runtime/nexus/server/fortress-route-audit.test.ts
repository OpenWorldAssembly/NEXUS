import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

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
