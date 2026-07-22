// Fixture/unit tests for the Vercel production-alignment decision mirrored from
// .github/workflows/prod-alignment-guard.yml. Run with:
//   node --test .github/workflows/__tests__/prod-alignment-guard.vercel.test.mjs
//
// Covers the required fail-closed cases: malformed API responses, no matching
// SHA, a matching READY SHA with no production alias, and an alias that points
// to a different deployment (alias mismatch). Only the fully aligned case
// (alias -> READY deployment at the expected SHA) is allowed to pass.

import test from "node:test";
import assert from "node:assert/strict";

import { VERDICT, evaluateVercelAlignment } from "./prod-alignment-guard.vercel.mjs";

const EXPECTED_SHA = "a".repeat(40);
const PROJECT = "prj_expected";
const ALIAS = "app.example.com";

const aliasPointingTo = (deploymentId, status = 200) => ({
  status,
  body: { deployment: { id: deploymentId } },
});

const deployment = ({
  status = 200,
  readyState = "READY",
  sha = EXPECTED_SHA,
  projectId = PROJECT,
  url = "deploy.example.vercel.app",
} = {}) => ({
  status,
  body: { readyState, url, projectId, meta: { githubCommitSha: sha } },
});

test("aligned: alias -> READY deployment at expected SHA passes", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: aliasPointingTo("dpl_live"),
    deploymentResult: deployment(),
  });
  assert.equal(v.ok, true);
  assert.equal(v.code, VERDICT.OK);
  assert.equal(v.deployment.sha, EXPECTED_SHA);
});

test("malformed alias response (non-object body) fails closed", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: { status: 200, body: "not-json" },
    deploymentResult: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.MALFORMED_ALIAS);
  assert.equal(v.retryable, false);
});

test("malformed deployment response (non-object body) fails closed", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: aliasPointingTo("dpl_live"),
    deploymentResult: { status: 200, body: 12345 },
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.MALFORMED_DEPLOYMENT);
  assert.equal(v.retryable, false);
});

test("no matching SHA: alias -> READY deployment at a different SHA fails", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: aliasPointingTo("dpl_old"),
    deploymentResult: deployment({ sha: "b".repeat(40) }),
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.SHA_MISMATCH);
  assert.equal(v.retryable, true); // may converge while polling, but never passes at a wrong SHA
});

test("matching READY SHA without production alias (alias 404) fails", () => {
  // A READY deployment for the expected SHA exists somewhere, but the production
  // alias does not resolve — so nothing is live for it. Must fail closed.
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: { status: 404, body: { error: { code: "not_found" } } },
    deploymentResult: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.ALIAS_NOT_FOUND);
});

test("alias mismatch: alias points to a different (non-expected) deployment fails", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: aliasPointingTo("dpl_other"),
    deploymentResult: deployment({ sha: "c".repeat(40), url: "other.vercel.app" }),
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.SHA_MISMATCH);
});

test("alias resolves but is attached to no deployment fails", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: { status: 200, body: {} },
    deploymentResult: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.ALIAS_NO_DEPLOYMENT);
});

test("expected SHA present but deployment still BUILDING fails (not READY)", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: aliasPointingTo("dpl_building"),
    deploymentResult: deployment({ readyState: "BUILDING" }),
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.NOT_READY);
});

test("alias points to a deployment in a different project fails closed", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: aliasPointingTo("dpl_wrongproj"),
    deploymentResult: deployment({ projectId: "prj_other" }),
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.PROJECT_MISMATCH);
  assert.equal(v.retryable, false);
});

test("alias lookup HTTP error (403) fails closed with team hint", () => {
  const v = evaluateVercelAlignment({
    expectedSha: EXPECTED_SHA,
    projectId: PROJECT,
    alias: ALIAS,
    aliasResult: { status: 403, body: { error: { code: "forbidden" } } },
    deploymentResult: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.code, VERDICT.ALIAS_ERROR);
  assert.equal(v.retryable, false);
  assert.match(v.message, /VERCEL_TEAM_ID/);
});
