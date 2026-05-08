/**
 * File: public-docs-manifest.mjs
 * Description: Shared manifest loading and validation helpers for public docs source documents.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const GENERATED_SOURCE_PREFIXES = [
  'app/public/generated/',
  'public/downloads/',
  'docs/public/version-records/',
];

function normalizeRelativePath(value) {
  return value.replace(/\\/g, '/');
}

function isGeneratedSourcePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return GENERATED_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function validateShellDocument({ shellFilePath, shellFileRelativePath }) {
  if (!existsSync(shellFilePath)) {
    throw new Error(`Public docs shell file is missing: ${shellFileRelativePath}`);
  }

  const shellMarkdown = await readFile(shellFilePath, 'utf8');

  if (/^###\s+/m.test(shellMarkdown)) {
    throw new Error(
      `Chaptered docs shell file must stay index-level only and may not contain level-3 headings: ${shellFileRelativePath}`
    );
  }
}

export async function loadPublicDocsManifest({ repoRoot }) {
  const manifestPath = path.join(repoRoot, 'docs/public/public-docs.manifest.json');
  const manifest = await readJson(manifestPath);

  return {
    manifestPath,
    manifest,
  };
}

export async function validatePublicDocsManifest({ repoRoot, manifest }) {
  if (!manifest || !Array.isArray(manifest.documents)) {
    throw new Error('Public docs manifest must contain a documents array.');
  }

  const seenSlugs = new Set();

  for (const documentConfig of manifest.documents) {
    if (!documentConfig.slug || !documentConfig.title || !documentConfig.outputBaseName) {
      throw new Error('Every public docs manifest entry needs slug, title, and outputBaseName.');
    }

    if (seenSlugs.has(documentConfig.slug)) {
      throw new Error(`Duplicate public docs slug in manifest: ${documentConfig.slug}`);
    }
    seenSlugs.add(documentConfig.slug);

    const sourceFiles = Array.isArray(documentConfig.sourceFiles)
      ? documentConfig.sourceFiles.map(normalizeRelativePath)
      : [];
    const sourceDir = typeof documentConfig.sourceDir === 'string'
      ? normalizeRelativePath(documentConfig.sourceDir)
      : null;

    if (sourceDir) {
      if (isGeneratedSourcePath(sourceDir)) {
        throw new Error(
          `Public docs manifest entry "${documentConfig.slug}" must not use a generated artifact directory as a source input: ${sourceDir}`
        );
      }

      const absoluteSourceDir = path.join(repoRoot, sourceDir);
      if (!existsSync(absoluteSourceDir)) {
        throw new Error(
          `Public docs source directory missing for "${documentConfig.slug}": ${sourceDir}`
        );
      }
    }

    if (sourceFiles.length > 0) {
      const seenSourceFiles = new Set();

      for (const sourceFile of sourceFiles) {
        if (seenSourceFiles.has(sourceFile)) {
          throw new Error(
            `Public docs manifest entry "${documentConfig.slug}" contains duplicate source file: ${sourceFile}`
          );
        }
        seenSourceFiles.add(sourceFile);

        if (isGeneratedSourcePath(sourceFile)) {
          throw new Error(
            `Public docs manifest entry "${documentConfig.slug}" must not use generated artifact paths as source inputs: ${sourceFile}`
          );
        }

        const absoluteSourcePath = path.join(repoRoot, sourceFile);
        if (!existsSync(absoluteSourcePath)) {
          throw new Error(
            `Public docs source file missing for "${documentConfig.slug}": ${sourceFile}`
          );
        }
      }
    }

    if (documentConfig.sourceMode === 'chapters_only') {
      if (!sourceFiles.length) {
        throw new Error(
          `Chaptered public docs entry "${documentConfig.slug}" must use ordered sourceFiles.`
        );
      }

      if (!documentConfig.shellFile || !documentConfig.chapterDir) {
        throw new Error(
          `Chaptered public docs entry "${documentConfig.slug}" needs shellFile and chapterDir metadata.`
        );
      }

      const shellFileRelativePath = normalizeRelativePath(documentConfig.shellFile);
      const chapterDirRelativePath = `${normalizeRelativePath(documentConfig.chapterDir).replace(/\/+$/, '')}/`;

      if (sourceFiles.includes(shellFileRelativePath)) {
        throw new Error(
          `Chaptered public docs entry "${documentConfig.slug}" must not include its shell file as a content source: ${shellFileRelativePath}`
        );
      }

      for (const sourceFile of sourceFiles) {
        if (!sourceFile.startsWith(chapterDirRelativePath)) {
          throw new Error(
            `Chaptered public docs entry "${documentConfig.slug}" must source only chapter files from ${chapterDirRelativePath}: ${sourceFile}`
          );
        }
      }

      await validateShellDocument({
        shellFilePath: path.join(repoRoot, shellFileRelativePath),
        shellFileRelativePath,
      });
    }
  }
}
