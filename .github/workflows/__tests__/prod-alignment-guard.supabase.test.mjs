// Fixture/unit tests for the read-only Supabase migration-parity decision
// mirrored from .github/workflows/prod-alignment-guard.yml. Run with:
//   node --test .github/workflows/__tests__/prod-alignment-guard.supabase.test.mjs
//
// Covers the required fail-closed cases: missing PROD_SUPABASE_DB_URL, malformed
// remote schema_migrations versions, and repo↔production drift (missing/extra).

import test from "node:test";
import assert from "node:assert/strict";

import {
  PARITY,
  deriveLocalIds,
  parseRemoteVersions,
  evaluateSupabaseParity,
} from "./prod-alignment-guard.supabase.mjs";

const DB_URL = "postgresql://user:pass@db.example.supabase.co:5432/postgres";

test("missing DB URL fails closed", () => {
  const r = evaluateSupabaseParity({ dbUrl: "", localIds: ["20260101000000"], remoteRowsText: "" });
  assert.equal(r.ok, false);
  assert.equal(r.code, PARITY.MISSING_DB_URL);
});

test("malformed remote version (non-14-digit) fails closed", () => {
  const r = evaluateSupabaseParity({
    dbUrl: DB_URL,
    localIds: ["20260101000000"],
    remoteRowsText: "20260101000000\nnot-a-version\n",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, PARITY.MALFORMED_REMOTE);
  assert.deepEqual(r.malformed, ["not-a-version"]);
});

test("production missing a repo migration fails closed", () => {
  const r = evaluateSupabaseParity({
    dbUrl: DB_URL,
    localIds: ["20260101000000", "20260102000000"],
    remoteRowsText: "20260101000000\n",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, PARITY.MISSING_MIGRATIONS);
  assert.deepEqual(r.missingRemote, ["20260102000000"]);
});

test("production has an extra remote-only migration fails closed", () => {
  const r = evaluateSupabaseParity({
    dbUrl: DB_URL,
    localIds: ["20260101000000"],
    remoteRowsText: "20260101000000\n20260109000000\n",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, PARITY.EXTRA_MIGRATIONS);
  assert.deepEqual(r.extraRemote, ["20260109000000"]);
});

test("fully aligned repo and production passes", () => {
  const r = evaluateSupabaseParity({
    dbUrl: DB_URL,
    localIds: ["20260101000000", "20260102000000"],
    remoteRowsText: "20260101000000\n20260102000000\n",
  });
  assert.equal(r.ok, true);
  assert.equal(r.code, PARITY.OK);
});

test("deriveLocalIds extracts leading 14-digit ids from sql basenames, deduped/sorted", () => {
  const ids = deriveLocalIds([
    "supabase/migrations/20260102000000_b.sql",
    "supabase/migrations/20260101000000_a.sql",
    "supabase/migrations/20260101000000_a_dup.sql",
    "supabase/migrations/README.md",
  ]);
  assert.deepEqual(ids, ["20260101000000", "20260102000000"]);
});

test("parseRemoteVersions ignores blank lines and dedupes valid ids", () => {
  const { ids, malformed } = parseRemoteVersions("\n20260101000000\n20260101000000\n\n");
  assert.deepEqual(ids, ["20260101000000"]);
  assert.deepEqual(malformed, []);
});
