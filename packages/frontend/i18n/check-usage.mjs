#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const baseResourcePath = path.join(
  repoRoot,
  'packages/frontend/i18n/src/resources/en.json'
);
const sourceDirs = [
  'packages/frontend/component/src',
  'packages/frontend/core/src',
  'packages/frontend/admin/src',
].map(dir => path.join(repoRoot, dir));
const ignoredDirs = new Set([
  '.next',
  'coverage',
  'dist',
  'lib',
  'node_modules',
]);

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function collectSourceFiles(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(entryPath, files);
    } else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function getI18nIdentifiers(source) {
  const identifiers = new Set();

  for (const match of source.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useI18n\s*\(/g
  )) {
    identifiers.add(match[1]);
  }

  for (const match of source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*['"]@affine\/i18n['"]/gs
  )) {
    for (const specifier of match[1].split(',')) {
      const trimmed = specifier.trim();
      const aliasMatch = trimmed.match(/^I18n\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (trimmed === 'I18n') {
        identifiers.add('I18n');
      } else if (aliasMatch) {
        identifiers.add(aliasMatch[1]);
      }
    }
  }

  return identifiers;
}

function lineForIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

function findStaticI18nKeys(source) {
  const keys = [];
  const identifiers = getI18nIdentifiers(source);

  for (const identifier of identifiers) {
    const escaped = escapeRegExp(identifier);
    const usages = [
      new RegExp(
        `(?<![\\w$])${escaped}\\s*\\[\\s*['"]([^'"]+)['"]\\s*\\]`,
        'g'
      ),
      new RegExp(
        `(?<![\\w$])${escaped}\\s*\\.\\s*t\\s*\\(\\s*['"]([^'"]+)['"]`,
        'g'
      ),
    ];

    for (const usage of usages) {
      let match;
      while ((match = usage.exec(source)) !== null) {
        keys.push({ key: match[1], index: match.index });
      }
    }
  }

  const jsxI18nKey =
    /i18nKey\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*['"]([^'"]+)['"]\s*\})/g;
  let jsxMatch;
  while ((jsxMatch = jsxI18nKey.exec(source)) !== null) {
    keys.push({
      key: jsxMatch[1] ?? jsxMatch[2] ?? jsxMatch[3],
      index: jsxMatch.index,
    });
  }

  return keys;
}

const baseResource = JSON.parse(await readFile(baseResourcePath, 'utf8'));
const sourceFiles = [];
for (const dir of sourceDirs) {
  await collectSourceFiles(dir, sourceFiles);
}

const missing = [];

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  if (
    !source.includes('@affine/i18n') &&
    !source.includes('useI18n') &&
    !source.includes('I18n')
  ) {
    continue;
  }

  for (const { key, index } of findStaticI18nKeys(source)) {
    if (!Object.prototype.hasOwnProperty.call(baseResource, key)) {
      missing.push({
        key,
        file: path.relative(repoRoot, file),
        line: lineForIndex(source, index),
      });
    }
  }
}

if (missing.length > 0) {
  console.error('Missing i18n keys in base resource:');
  for (const item of missing) {
    console.error(`- ${item.key} (${item.file}:${item.line})`);
  }
  process.exit(1);
}

console.log('All static i18n keys exist in en.json.');
