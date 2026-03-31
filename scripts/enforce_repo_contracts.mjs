#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const artifactsOnly = args.has('--artifacts-only');

const failures = [];

function run(cmd) {
  return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function fail(msg) {
  failures.push(msg);
}

function checkArtifactHygiene() {
  const blockedPatterns = [
    'tests/unit/benchmark-artifacts/**',
    'tests/unit/benchmark-results.json',
  ];

  let tracked = '';
  try {
    tracked = run(`git ls-files -- ${blockedPatterns.map((p) => `'${p}'`).join(' ')}`);
  } catch {
    tracked = '';
  }

  if (tracked) {
    fail(`Tracked generated benchmark artifacts are forbidden:\n${tracked}`);
  }

  const leaked = [];
  const leakedDir = path.join(cwd, 'tests/unit/benchmark-artifacts');
  const leakedFile = path.join(cwd, 'tests/unit/benchmark-results.json');
  if (fs.existsSync(leakedDir) && fs.readdirSync(leakedDir).length > 0) leaked.push('tests/unit/benchmark-artifacts/');
  if (fs.existsSync(leakedFile)) leaked.push('tests/unit/benchmark-results.json');

  if (leaked.length > 0) {
    fail(
      `Generated benchmark outputs detected in working tree: ${leaked.join(', ')}. ` +
      'Clean them before commit (they are ephemeral runtime outputs).',
    );
  }
}

function checkCanonicalFixtureWiring() {
  const fixturePath = path.join(cwd, 'tests/fixtures/benchmarks/ltrd-ch2-contrast.fixture.json');
  const manuscriptPath = path.join(cwd, 'manuscripts/let-the-river-decide-ch2.txt');

  if (!fs.existsSync(manuscriptPath)) {
    fail('Missing canonical manuscript: manuscripts/let-the-river-decide-ch2.txt');
    return;
  }

  if (!fs.existsSync(fixturePath)) {
    fail('Missing benchmark fixture: tests/fixtures/benchmarks/ltrd-ch2-contrast.fixture.json');
    return;
  }

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const configuredPath = fixture?.input?.filePath;

  if (configuredPath !== 'manuscripts/let-the-river-decide-ch2.txt') {
    fail(`Fixture input.filePath must equal manuscripts/let-the-river-decide-ch2.txt (got: ${configuredPath ?? '<missing>'})`);
    return;
  }

  const startMarker = fixture?.input?.startMarker;
  const endMarker = fixture?.input?.endMarker;

  if (!startMarker || !endMarker) {
    fail('Fixture markers missing: input.startMarker and input.endMarker are required');
    return;
  }

  const sourceText = fs.readFileSync(manuscriptPath, 'utf8');
  if (!sourceText.includes(startMarker)) {
    fail('Fixture startMarker does not resolve in canonical manuscript');
  }
  if (!sourceText.includes(endMarker)) {
    fail('Fixture endMarker does not resolve in canonical manuscript');
  }

  const sourceStatus = fixture?.source?.sourceStatus;
  if (sourceStatus && String(sourceStatus).toLowerCase().includes('canonical_source_not_found_in_repo')) {
    fail('Forbidden fallback sourceStatus detected: canonical_source_not_found_in_repo');
  }
}

try {
  checkArtifactHygiene();
  if (!artifactsOnly) {
    checkCanonicalFixtureWiring();
  }
} catch (error) {
  fail(`enforcement execution error: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  console.error('❌ Repo contract enforcement failed:');
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

console.log('✅ Repo contract enforcement passed');
