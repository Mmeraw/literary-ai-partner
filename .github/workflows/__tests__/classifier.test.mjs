// Unit tests for the typed-template classifier logic mirrored from
// .github/workflows/latency-pr-enforcement.yml. Run with:
//   node --test .github/workflows/__tests__/classifier.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "./classifier.mjs";

test("tests/stress/** only → infra (the bug this PR fixes)", () => {
  const files = [
    "tests/stress/queue-pressure.test.ts",
    "tests/stress/burst-load.test.ts",
    "tests/stress/README.md",
  ];
  const { type } = classify(files, []);
  assert.equal(type, "infra");
});

test("lib/evaluation/** → evaluation", () => {
  const files = ["lib/evaluation/pipeline.ts", "lib/evaluation/criteria.ts"];
  const { type } = classify(files, []);
  assert.equal(type, "evaluation");
});

test("mixed tests/stress + scripts → infra (single bucket)", () => {
  const files = [
    "tests/stress/queue-pressure.test.ts",
    "scripts/run-stress.mjs",
  ];
  const { type } = classify(files, []);
  assert.equal(type, "infra");
});

test("mixed lib/evaluation + app/admin → evaluation (any eval dominates)", () => {
  const files = ["lib/evaluation/pipeline.ts", "app/admin/page.tsx"];
  const { type } = classify(files, []);
  assert.equal(type, "evaluation");
});

test("mixed scripts + components → mixed (infra,ui)", () => {
  const files = ["scripts/build.mjs", "components/Button.tsx"];
  const { type, buckets } = classify(files, []);
  assert.equal(type, "mixed");
  assert.equal(buckets, "infra,ui");
});

test("label override pr-type:infra wins over any diff", () => {
  const files = ["lib/evaluation/pipeline.ts"];
  const { type } = classify(files, ["pr-type:infra"]);
  assert.equal(type, "infra");
});

test("invalid label pr-type:bogus + tests/stress → falls back to infra", () => {
  const files = ["tests/stress/queue-pressure.test.ts"];
  const { type } = classify(files, ["pr-type:bogus"]);
  assert.equal(type, "infra");
});

test("label override pr-type:docs wins even with code-bucket files", () => {
  const files = ["lib/auth/session.ts"];
  const { type } = classify(files, ["other-label", "pr-type:docs"]);
  assert.equal(type, "docs");
});

test("tests/canon/** still classifies as evaluation (carve-out is surgical)", () => {
  const files = ["tests/canon/authority.test.ts"];
  const { type } = classify(files, []);
  assert.equal(type, "evaluation");
});

test("dogfood: this PR's own diff → infra (or infra+docs)", () => {
  // Simulates the file set this very PR will change.
  const files = [
    ".github/workflows/latency-pr-enforcement.yml",
    ".github/workflows/__tests__/classifier.mjs",
    ".github/workflows/__tests__/classifier.test.mjs",
    "docs/PR_TEMPLATE_TYPED_SCOPE_GOVERNANCE.md",
    "docs/NPM_AUDIT_NOTES.md",
  ];
  const { type, buckets } = classify(files, []);
  // Without a label, we expect "mixed" with buckets="docs,infra".
  assert.equal(type, "mixed");
  assert.equal(buckets, "docs,infra");

  // With the belt-and-suspenders label, classification collapses to infra.
  const labeled = classify(files, ["pr-type:infra"]);
  assert.equal(labeled.type, "infra");
});
