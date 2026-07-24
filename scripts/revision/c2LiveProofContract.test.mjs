#!/usr/bin/env node
/**
 * Contract tests for the C2 Live Proof evidence contract.
 *
 * VERIFIER-ONLY. Proves the fail-closed verdict logic — i.e. that the harness
 * CANNOT report a false PASS. Runs no network, no paid job, no server.
 *
 * Follows the repo's script-test convention (node:assert, self-executing),
 * matching scripts/jobs-smoke-real.test.mjs. Run with:
 *   node scripts/revision/c2LiveProofContract.test.mjs
 */
import assert from 'node:assert/strict';
import {
  STATUS,
  OVERALL_STATUS,
  C2_BOUNDARIES,
  createEvidenceSkeleton,
  recordBoundary,
  computeOverall,
} from './c2LiveProofContract.mjs';

function passAllRequired(evidence) {
  for (const b of C2_BOUNDARIES) {
    recordBoundary(evidence, b.key, {
      status: STATUS.PASS, executed: true, reconciled: true, detail: 'test', data: {},
    });
  }
}

async function testSkeletonStartsNotExecuted() {
  const e = createEvidenceSkeleton({});
  for (const b of C2_BOUNDARIES) {
    assert.equal(e.boundaries[b.key].status, STATUS.NOT_EXECUTED);
    assert.equal(e.boundaries[b.key].executed, false);
  }
  assert.equal(e.overall.status, STATUS.NOT_EXECUTED);
}

async function testDryRunNeverPasses() {
  const e = createEvidenceSkeleton({ mode: 'dry_run' });
  passAllRequired(e);
  const overall = computeOverall(e);
  assert.equal(overall.status, STATUS.NOT_EXECUTED, 'dry_run must never yield PASS');
  assert.match(overall.reason, /dry-run|without --live/i);
}

async function testLivePassesOnlyWhenComplete() {
  const e = createEvidenceSkeleton({ mode: 'live' });
  passAllRequired(e);
  assert.equal(computeOverall(e).status, STATUS.PASS);
}

async function testUnreconciledBlocksLivePass() {
  const e = createEvidenceSkeleton({ mode: 'live' });
  passAllRequired(e);
  recordBoundary(e, 'hydration_outcome', {
    status: STATUS.PASS, executed: true, reconciled: false, detail: 'not reconciled', data: {},
  });
  const overall = computeOverall(e);
  assert.equal(overall.status, STATUS.NOT_EXECUTED);
  assert.match(overall.reason, /hydration_outcome/);
}

async function testAnyRequiredFailIsOverallFail() {
  const e = createEvidenceSkeleton({ mode: 'live' });
  passAllRequired(e);
  recordBoundary(e, 'final_admission', {
    status: STATUS.FAIL, executed: true, reconciled: false, detail: 'no candidate admitted', data: {},
  });
  const overall = computeOverall(e);
  assert.equal(overall.status, STATUS.FAIL);
  assert.match(overall.reason, /final_admission/);
}

async function testOperatorStagesDefaultWithheld() {
  const e = createEvidenceSkeleton({ mode: 'live' });
  for (const b of C2_BOUNDARIES.filter((x) => x.stage === 'evaluation')) {
    recordBoundary(e, b.key, { status: STATUS.PASS, executed: true, reconciled: true, detail: 't', data: {} });
  }
  const overall = computeOverall(e);
  assert.equal(overall.status, STATUS.NOT_EXECUTED, 'operator stages must not be fabricated');
  assert.match(
    overall.reason,
    /candidate_generation|final_admission|workbench_visible|accept_or_customize|revised_manuscript_persist|revision_history_persist/,
  );
}

async function testShadowPassesOnlyWhenComplete() {
  const e = createEvidenceSkeleton({ mode: 'shadow' });
  passAllRequired(e);
  const overall = computeOverall(e);
  assert.equal(overall.status, OVERALL_STATUS.SHADOW_PASS, 'complete shadow run must yield SHADOW_PASS');
  assert.match(overall.reason, /pre-live|not live/i);
}

async function testShadowNeverYieldsLivePass() {
  const e = createEvidenceSkeleton({ mode: 'shadow' });
  passAllRequired(e);
  const overall = computeOverall(e);
  assert.notEqual(overall.status, STATUS.PASS, 'shadow must never emit a live PASS token');
}

async function testIncompleteShadowIsNotExecuted() {
  const e = createEvidenceSkeleton({ mode: 'shadow' });
  for (const b of C2_BOUNDARIES.filter((x) => x.stage === 'evaluation')) {
    recordBoundary(e, b.key, { status: STATUS.PASS, executed: true, reconciled: true, detail: 't', data: {} });
  }
  const overall = computeOverall(e);
  assert.equal(overall.status, STATUS.NOT_EXECUTED, 'incomplete shadow must not fabricate SHADOW_PASS');
  assert.match(overall.reason, /candidate_generation|accept_or_customize|revised_manuscript_persist/);
}

async function testShadowFailIsOverallFail() {
  const e = createEvidenceSkeleton({ mode: 'shadow' });
  passAllRequired(e);
  recordBoundary(e, 'candidate_generation', {
    status: STATUS.FAIL, executed: true, reconciled: false, detail: 'stub returned no candidates', data: {},
  });
  const overall = computeOverall(e);
  assert.equal(overall.status, STATUS.FAIL);
  assert.match(overall.reason, /candidate_generation/);
}

async function testRecordBoundaryValidates() {
  const e = createEvidenceSkeleton({ mode: 'live' });
  assert.throws(() => recordBoundary(e, 'nope', { status: STATUS.PASS, executed: true }), /Unknown/);
  assert.throws(() => recordBoundary(e, 'opportunity_supply', { status: 'MAYBE', executed: true }), /Invalid status/);
}

async function testHarnessSourceIsVerifierOnly() {
  // Guard: the harness must not import or mutate production runtime authorities
  // in a way that changes behavior. It may READ getWorkbenchQueue, but must not
  // write thresholds, admission logic, or UI.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('./c2LiveProofHarness.mjs', import.meta.url), 'utf8');
  // No invented workbench HTTP endpoint (we corrected this).
  assert.equal(src.includes('/api/revise/workbench-queue'), false, 'must not reference a non-existent endpoint');
  // Live PASS is gated on mode === live inside the contract, not the harness.
  assert.ok(src.includes("mode: args.live ? 'live' : 'dry_run'"), 'harness must set mode from --live only');
}

await testSkeletonStartsNotExecuted();
await testDryRunNeverPasses();
await testLivePassesOnlyWhenComplete();
await testUnreconciledBlocksLivePass();
await testAnyRequiredFailIsOverallFail();
await testOperatorStagesDefaultWithheld();
await testShadowPassesOnlyWhenComplete();
await testShadowNeverYieldsLivePass();
await testIncompleteShadowIsNotExecuted();
await testShadowFailIsOverallFail();
await testRecordBoundaryValidates();
await testHarnessSourceIsVerifierOnly();
console.log('c2LiveProofContract.test.mjs passed (12 checks)');
