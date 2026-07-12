/**
 * Focused tests for resolveProofJobIdentity — the operator-nominated proof
 * identity used only by the C2 live-proof harness. Runs under a TS runtime
 * (npx tsx) so the @/-aliased import in proofJobIdentity.ts resolves.
 *
 * Every negative case must fail CLOSED (return null): flag off, bad/missing
 * bearer, missing x-proof-user-id, ownership mismatch, allowlist miss, missing
 * secrets/admin. Only the fully valid, verified-owner case returns an identity.
 */

import assert from 'node:assert/strict';
import * as proofJobIdentityModule from '@/lib/auth/proofJobIdentity';

const proofJobIdentityExports =
  proofJobIdentityModule.resolveProofJobIdentity
    ? proofJobIdentityModule
    : proofJobIdentityModule.default ?? proofJobIdentityModule['module.exports'] ?? {};
const { resolveProofJobIdentity } = proofJobIdentityExports;

assert.equal(
  typeof resolveProofJobIdentity,
  'function',
  'resolveProofJobIdentity export must be available under the local TS runtime',
);

const OWNER = '11111111-1111-1111-1111-111111111111';
const SECRET = 'cron-secret-value';
const MANUSCRIPT = 7519;

// Header bag matching the { headers: { get } } shape the route passes.
function req(headers = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { headers: { get: (name) => lower[name.toLowerCase()] ?? null } };
}

// Injectable admin factory whose single manuscript row is owned by `ownerId`.
function adminOwnedBy(ownerId) {
  return () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: MANUSCRIPT, user_id: ownerId }, error: null }),
        }),
      }),
    }),
  });
}
const adminNotFound = () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
});
const adminNull = () => null; // secrets absent

const baseEnv = { ALLOW_PROOF_JOB_IDENTITY: 'true', CRON_SECRET: SECRET };
const goodHeaders = { authorization: `Bearer ${SECRET}`, 'x-proof-user-id': OWNER };

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log('resolveProofJobIdentity fail-closed contract');

  await check('flag OFF -> null (even with valid bearer + owner)', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: { ...baseEnv, ALLOW_PROOF_JOB_IDENTITY: 'false' },
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.equal(r, null);
  });

  await check('missing bearer -> null', async () => {
    const r = await resolveProofJobIdentity(req({ 'x-proof-user-id': OWNER }), MANUSCRIPT, {
      env: baseEnv,
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.equal(r, null);
  });

  await check('wrong bearer secret -> null', async () => {
    const r = await resolveProofJobIdentity(
      req({ authorization: 'Bearer not-the-secret', 'x-proof-user-id': OWNER }),
      MANUSCRIPT,
      { env: baseEnv, createAdmin: adminOwnedBy(OWNER) }
    );
    assert.equal(r, null);
  });

  await check('missing x-proof-user-id -> null', async () => {
    const r = await resolveProofJobIdentity(req({ authorization: `Bearer ${SECRET}` }), MANUSCRIPT, {
      env: baseEnv,
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.equal(r, null);
  });

  await check('non-numeric manuscript id -> null', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), 'abc', {
      env: baseEnv,
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.equal(r, null);
  });

  await check('ownership mismatch -> null (verify, never impersonate)', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: baseEnv,
      createAdmin: adminOwnedBy('a-different-owner'),
    });
    assert.equal(r, null);
  });

  await check('manuscript not found -> null', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: baseEnv,
      createAdmin: adminNotFound,
    });
    assert.equal(r, null);
  });

  await check('admin client null (no secrets) -> null', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: baseEnv,
      createAdmin: adminNull,
    });
    assert.equal(r, null);
  });

  await check('user allowlist miss -> null', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: { ...baseEnv, PROOF_JOB_ALLOWED_USER_IDS: 'someone-else' },
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.equal(r, null);
  });

  await check('manuscript allowlist miss -> null', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: { ...baseEnv, PROOF_JOB_ALLOWED_MANUSCRIPT_IDS: '9999' },
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.equal(r, null);
  });

  await check('valid owner -> identity {userId, source}', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: baseEnv,
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.deepEqual(r, { userId: OWNER, source: 'proof_job_identity' });
  });

  await check('valid owner WITH matching allowlists -> identity', async () => {
    const r = await resolveProofJobIdentity(req(goodHeaders), MANUSCRIPT, {
      env: {
        ...baseEnv,
        PROOF_JOB_ALLOWED_USER_IDS: `x,${OWNER}`,
        PROOF_JOB_ALLOWED_MANUSCRIPT_IDS: `1,${MANUSCRIPT}`,
      },
      createAdmin: adminOwnedBy(OWNER),
    });
    assert.deepEqual(r, { userId: OWNER, source: 'proof_job_identity' });
  });

  console.log(`\nproofJobIdentity: ${passed}/${passed} checks passed`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
