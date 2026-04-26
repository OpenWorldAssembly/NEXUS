/**
 * File: ts-paths-loader.mjs
 * Description: Resolves the repo's TypeScript path aliases for direct Node test runs.
 */

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const ALIASES = [
  ['@app/', 'app/'],
  ['@core/', 'core/'],
  ['@runtime/', 'runtime/'],
  ['@/', ''],
];
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'];

function resolveAlias(specifier) {
  const alias = ALIASES.find(([prefix]) => specifier.startsWith(prefix));

  if (!alias) {
    return null;
  }

  const [prefix, target] = alias;
  const requestedPath = resolvePath(
    ROOT,
    target,
    specifier.slice(prefix.length)
  );

  for (const extension of EXTENSIONS) {
    const candidatePath = `${requestedPath}${extension}`;

    if (existsSync(candidatePath)) {
      return pathToFileURL(candidatePath).href;
    }
  }

  return pathToFileURL(requestedPath).href;
}

export async function resolve(specifier, context, nextResolve) {
  const aliasUrl = resolveAlias(specifier);

  if (aliasUrl) {
    return {
      shortCircuit: true,
      url: aliasUrl,
    };
  }

  return nextResolve(specifier, context);
}
