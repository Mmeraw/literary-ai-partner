#!/usr/bin/env npx ts-node
/**
 * check-no-raw-model-calls.ts
 * CI guard: scans the codebase to ensure no direct OpenAI/model API calls
 * exist outside the approved orchestrator path.
 *
 * All model calls MUST go through run-revision-pipeline.ts → revisionOrchestrator.ts.
 * Any raw calls found outside these files cause CI failure.
 *
 * Run: npx ts-node scripts/check-no-raw-model-calls.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Patterns that indicate direct model API usage
const FORBIDDEN_PATTERNS = [
  /openai\.chat\.completions\.create/,
  /openai\.completions\.create/,
  /new OpenAI\(/,
  /\.chat\.completions/,
  /anthropic\.messages\.create/,
  /new Anthropic\(/,
];

// Files that ARE allowed to make model calls (the orchestrator path)
const ALLOWED_FILES = [
  'lib/revision/revisionOrchestrator.ts',
  'lib/revision/run-revision-pipeline.ts',
  'lib/revision/engine.ts',
  'lib/revision/diffIntelligence.ts',
  'functions/',  // Serverless functions may call models
  'scripts/',    // Scripts may call models for testing
];

function isAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWED_FILES.some((allowed) => normalized.includes(allowed));
}

const srcFiles = glob.sync('**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**', '.github/**'],
  cwd: path.resolve(__dirname, '..'),
  absolute: true,
});

let violations = 0;

for (const filePath of srcFiles) {
  const relative = path.relative(path.resolve(__dirname, '..'), filePath);

  if (isAllowed(relative)) continue;

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      console.error(`VIOLATION: ${relative} contains forbidden pattern: ${match[0]}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} raw model call(s) found outside orchestrator path.`);
  console.error('All model calls must go through run-revision-pipeline.ts.');
  process.exit(1);
} else {
  console.log('No raw model calls found outside orchestrator path.');
  process.exit(0);
}
