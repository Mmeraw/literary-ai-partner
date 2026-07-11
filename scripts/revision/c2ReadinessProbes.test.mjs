#!/usr/bin/env node
/**
 * Focused tests for the C2 dry-run readiness probes (VERIFIER-ONLY).
 *
 * Convention matches scripts/*.test.mjs: self-executing node:assert, no jest.
 * All probes are exercised with INJECTED dependencies so the tests perform no
 * real network, no Supabase, and no filesystem writes.
 *
 * Required cases (per operator direction, 2026-07-11):
 *   1. unreachable base URL        -> base_url_health FAIL, not ready
 *   2. missing manuscript          -> manuscript_readable FAIL, not ready
 *   3. failed TS authority import  -> authority_resolves FAIL, not ready
 *   4. successful readiness         -> all probes PASS, ready === true, status PASS
 * Plus fail-closed guards: no-secrets NOT_EXECUTED never counts as ready; a
 * single FAIL blocks readiness.
 */

import assert from 'node:assert/strict';
import { STATUS } from './c2LiveProofContract.mjs';
import {
  probeSecrets,
  probeBaseUrlHealth,
  probeManuscriptReadable,
  probeAuthorityResolves,
  runReadiness,
} from './c2ReadinessProbes.mjs';

const GOOD_ENV = {
  CRON_SECRET: 'x',
  SUPABASE_SERVICE_ROLE_KEY: 'y',
  OPENAI_API_KEY: 'z',
  SUPABASE_URL: 'https://example.supabase.co',
  USE_SUPABASE_JOBS: 'true',
};

// --- injected fakes -------------------------------------------------------
const okHealthFetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, env: 'prod', git_sha: 'abc1234' }) });
const unreachableFetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
const notOkHealthFetch = async () => ({ ok: false, status: 503, json: async () => ({ ok: false }) });

const goodBaseUrl = async () => 'http://localhost:3000';

// admin client that finds / does not find the manuscript
const adminFound = () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 7519 }, error: null }) }) }) }),
  }),
});
const adminNotFound = () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  }),
});
const adminNull = () => ({ createAdminClient: () => null }); // secrets absent
const adminImportFails = () => { throw new Error("Cannot find module 'lib/supabase/admin.ts'"); };

const authorityOk = () => ({ getWorkbenchQueue: () => ({ ok: true }) });
const authorityMissingExport = () => ({ somethingElse: true });
const authorityImportFails = () => { throw new Error('Unknown file extension ".ts"'); };

let passed = 0;
function check(name, cond) {
  assert.ok(cond, `FAILED: ${name}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function run() {
  console.log('C2 readiness probe tests\n');

  // --- probeSecrets ---
  check('secrets PASS when all present + USE_SUPABASE_JOBS=true',
    probeSecrets(GOOD_ENV).status === STATUS.PASS);
  check('secrets FAIL when a secret missing',
    probeSecrets({ ...GOOD_ENV, OPENAI_API_KEY: '' }).status === STATUS.FAIL);
  check('secrets FAIL when USE_SUPABASE_JOBS not true',
    probeSecrets({ ...GOOD_ENV, USE_SUPABASE_JOBS: 'false' }).status === STATUS.FAIL);

  // --- probeBaseUrlHealth ---
  const health = await probeBaseUrlHealth({ getBaseUrl: goodBaseUrl, fetchImpl: okHealthFetch });
  check('base_url_health PASS on ok health', health.status === STATUS.PASS && health.data.env === 'prod');

  // CASE 1: unreachable base URL
  const unreachable = await probeBaseUrlHealth({ getBaseUrl: goodBaseUrl, fetchImpl: unreachableFetch, timeoutMs: 50 });
  check('CASE 1: unreachable base URL -> base_url_health FAIL', unreachable.status === STATUS.FAIL);
  check('CASE 1: FAIL detail mentions unreachable/timeout',
    /unreachable|timed out/i.test(unreachable.detail));

  const notOk = await probeBaseUrlHealth({ getBaseUrl: goodBaseUrl, fetchImpl: notOkHealthFetch });
  check('base_url_health FAIL on non-ok HTTP', notOk.status === STATUS.FAIL);

  // --- probeManuscriptReadable ---
  const mFound = await probeManuscriptReadable({ manuscriptId: '7519', importAdmin: adminFound });
  check('manuscript_readable PASS when row found', mFound.status === STATUS.PASS && mFound.data.found === true);

  // CASE 2: missing manuscript
  const mMissing = await probeManuscriptReadable({ manuscriptId: '7519', importAdmin: adminNotFound });
  check('CASE 2: missing manuscript -> manuscript_readable FAIL', mMissing.status === STATUS.FAIL);
  check('CASE 2: FAIL detail says not found', /not found/i.test(mMissing.detail));

  const mNoSecrets = await probeManuscriptReadable({ manuscriptId: '7519', importAdmin: adminNull });
  check('manuscript_readable NOT_EXECUTED when admin client null (no secrets)',
    mNoSecrets.status === STATUS.NOT_EXECUTED);
  const mBadId = await probeManuscriptReadable({ manuscriptId: 'abc', importAdmin: adminFound });
  check('manuscript_readable FAIL on non-numeric id', mBadId.status === STATUS.FAIL);
  const mImportFail = await probeManuscriptReadable({ manuscriptId: '7519', importAdmin: adminImportFails });
  check('manuscript_readable FAIL when admin import fails', mImportFail.status === STATUS.FAIL);

  // --- probeAuthorityResolves ---
  const aOk = await probeAuthorityResolves({ importAuthority: authorityOk });
  check('authority_resolves PASS when getWorkbenchQueue is a function', aOk.status === STATUS.PASS);
  const aMissing = await probeAuthorityResolves({ importAuthority: authorityMissingExport });
  check('authority_resolves FAIL when export missing', aMissing.status === STATUS.FAIL);

  // CASE 3: failed TS authority import
  const aFail = await probeAuthorityResolves({ importAuthority: authorityImportFails });
  check('CASE 3: failed TS authority import -> authority_resolves FAIL', aFail.status === STATUS.FAIL);
  check('CASE 3: FAIL detail suggests TS runtime (npx tsx)', /tsx|TS runtime/i.test(aFail.detail));

  // --- runReadiness (integration of injected deps) ---
  // CASE 4: successful readiness — all probes PASS
  const ready = await runReadiness({
    manuscriptId: '7519',
    getBaseUrl: goodBaseUrl,
    env: GOOD_ENV,
    deps: { fetchImpl: okHealthFetch, importAdmin: adminFound, importAuthority: authorityOk },
  });
  check('CASE 4: successful readiness -> status PASS', ready.status === STATUS.PASS);
  check('CASE 4: successful readiness -> ready === true', ready.ready === true);
  check('CASE 4: successful readiness -> not_ready empty', ready.not_ready.length === 0);

  // fail-closed: one FAIL blocks readiness
  const oneFail = await runReadiness({
    manuscriptId: '7519',
    getBaseUrl: goodBaseUrl,
    env: GOOD_ENV,
    deps: { fetchImpl: unreachableFetch, importAdmin: adminFound, importAuthority: authorityOk },
  });
  check('one FAIL probe -> overall not ready', oneFail.ready === false && oneFail.status === STATUS.FAIL);
  check('one FAIL probe -> base_url_health listed in not_ready', oneFail.not_ready.includes('base_url_health'));

  // fail-closed: NOT_EXECUTED (no secrets) never counts as ready
  const noSecrets = await runReadiness({
    manuscriptId: '7519',
    getBaseUrl: goodBaseUrl,
    env: { USE_SUPABASE_JOBS: 'false' },
    deps: { fetchImpl: okHealthFetch, importAdmin: adminNull, importAuthority: authorityOk },
  });
  check('no-secrets readiness -> ready === false', noSecrets.ready === false);
  check('no-secrets readiness -> never PASS', noSecrets.status !== STATUS.PASS);

  console.log(`\n✅ ${passed}/${passed} readiness probe checks passed`);
}

run().catch((err) => {
  console.error('\n❌ readiness probe tests failed:');
  console.error(err?.stack || String(err));
  process.exit(1);
});
