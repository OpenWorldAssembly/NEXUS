/**
 * File: validate-public-docs.mjs
 * Description: Validates public docs manifest/source-of-truth rules without generating artifacts.
 */

import process from 'node:process';

import {
  loadPublicDocsManifest,
  validatePublicDocsManifest,
} from './public-docs-manifest.mjs';

async function main() {
  const repoRoot = process.cwd();
  const { manifest } = await loadPublicDocsManifest({ repoRoot });

  await validatePublicDocsManifest({ repoRoot, manifest });
  console.log(`Validated ${manifest.documents.length} public docs manifest entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
