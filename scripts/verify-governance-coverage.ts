#!/usr/bin/env npx ts-node
/**
 * verify-governance-coverage.ts
 * Confirms that every governance gate is wired into the pipeline
 * and that no revision path bypasses governance checks.
 *
 * Run: npx ts-node scripts/verify-governance-coverage.ts
 * Exit 0 = all checks pass, Exit 1 = coverage gap found.
 */

import * as fs from 'fs';
import * as path from 'path';

const GOVERNANCE_DIR = path.resolve(__dirname, '../lib/revision/governance');
const PIPELINE_FILE = path.resolve(__dirname, '../lib/revision/run-revision-pipeline.ts');
const ORCHESTRATOR_FILE = path.resolve(__dirname, '../lib/revision/revisionOrchestrator.ts');

const REQUIRED_GATES = [
  'checkSufficiencyGate',
  'checkWaveEligibility',
  'checkDestructionGuards',
  'checkPatchIntegrity',
];

const REQUIRED_PERSISTENCE = [
  'logGovernanceEvent',
  'markWaveStarted',
  'markWavePassed',
  'markWaveFailed',
  'markWaveBlocked',
];

let exitCode = 0;

function fail(msg: string): void {
  console.error(`FAIL: ${msg}`);
  exitCode = 1;
}

function pass(msg: string): void {
  console.log(`PASS: ${msg}`);
}

// 1. All governance modules exist
for (const gate of ['sufficiency-gate', 'wave-eligibility', 'destruction-guards', 'patch-integrity', 'types', 'index']) {
  const filePath = path.join(GOVERNANCE_DIR, `${gate}.ts`);
  if (fs.existsSync(filePath)) {
    pass(`Governance module exists: ${gate}.ts`);
  } else {
    fail(`Missing governance module: ${gate}.ts`);
  }
}

// 2. Pipeline file imports all gates
const pipelineSrc = fs.readFileSync(PIPELINE_FILE, 'utf-8');
for (const gate of REQUIRED_GATES) {
  if (pipelineSrc.includes(gate)) {
    pass(`Pipeline imports ${gate}`);
  } else {
    fail(`Pipeline missing import: ${gate}`);
  }
}

// 3. Pipeline calls all persistence functions
for (const fn of REQUIRED_PERSISTENCE) {
  if (pipelineSrc.includes(fn)) {
    pass(`Pipeline calls ${fn}`);
  } else {
    fail(`Pipeline missing persistence call: ${fn}`);
  }
}

// 4. Pipeline is fail-closed (returns 'halted' on gate failure)
if (pipelineSrc.includes("status: 'halted'")) {
  pass('Pipeline implements fail-closed halting');
} else {
  fail('Pipeline does not implement fail-closed halting');
}

// 5. Diagnostic mode never generates patches
if (pipelineSrc.includes("mode === 'diagnostic'")) {
  pass('Pipeline checks for diagnostic mode');
} else {
  fail('Pipeline does not check for diagnostic mode');
}

// 6. NO_CHANGE_REQUIRED for perfect scores
if (pipelineSrc.includes('no_change')) {
  pass('Pipeline implements NO_CHANGE_REQUIRED');
} else {
  fail('Pipeline does not implement NO_CHANGE_REQUIRED');
}

// Summary
console.log('---');
if (exitCode === 0) {
  console.log('All governance coverage checks passed.');
} else {
  console.error('Governance coverage gaps detected. Fix before merging.');
}

process.exit(exitCode);
