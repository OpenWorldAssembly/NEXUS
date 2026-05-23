#!/usr/bin/env node
/**
 * File: assert-no-app-tests.mjs
 * Description: Fails if test/spec files are placed under src/app, where Expo Router
 * treats files as application/API routes and Metro may bundle Node-only test imports.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const appRoot = join(process.cwd(), 'src', 'app');
const forbiddenFilePattern = /(?:\.test|\.spec)\.[cm]?[tj]sx?$/i;
const forbiddenDirectoryNames = new Set(['__tests__', '__test__', '__specs__']);
const violations = [];

function walk(directory) {
  let entries = [];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (forbiddenDirectoryNames.has(entry.name)) {
        violations.push(relative(process.cwd(), fullPath));
        continue;
      }
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && forbiddenFilePattern.test(entry.name)) {
      violations.push(relative(process.cwd(), fullPath));
    }
  }
}

walk(appRoot);

if (violations.length > 0) {
  console.error('Test files are not allowed under src/app.');
  console.error('Expo Router treats src/app files as routes/API modules, so Node-only tests can be bundled into web builds.');
  console.error('Move these files to runtime/, core/, or a dedicated tests/ directory:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('src/app route boundary check passed: no test/spec files found.');
