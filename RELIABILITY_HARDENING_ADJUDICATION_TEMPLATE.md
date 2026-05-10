# Reliability Hardening — Adjudication Template (PASS/FAIL)

## Purpose

The Reliability Hardening lane introduces the replay harness, fixture format, first fixture set, CI integration, and replay-level telemetry per the locked brief. It must convert observed runtime failures into permanent regression tests without altering production prompts, scoring, or evaluation passes.

If any required proof is missing or ambiguous, this PR does **not** receive partial credit; it returns for a **narrow follow-up patch**.

***

## Gate 1 — Replay harness implemented

**Question**: Does `tests/replays/harness.ts` export a deterministic runner taking a manifest path and producing a typed result object?

- [ ] PASS — Harness exists, deterministic, no live API coupling.
- [ ] FAIL — Harness missing, non-deterministic, or coupled to live API calls.

**Required evidence:**
- File path and exported function/class name.
- Test confirming deterministic re-execution given the same manifest.

**Notes:**

***

## Gate 2 — Manifest schema versioned and stable

**Question**: Does `tests/replays/manifest.types.ts` define a versioned schema with required fields?

- [ ] PASS — Schema includes `schema_version: 1` and explicit fields for manuscript fixture path, expected outputs, telemetry assertions, and failure-mode classification.
- [ ] FAIL — Schema absent, unversioned, or ambiguous.

**Required evidence:**
- TypeScript interface or JSON schema.

**Notes:**

***

## Gate 3 — First fixture set committed

**Question**: Are at least three fixture manifests committed under `tests/fixtures/replays/`?

- [ ] PASS — Three fixtures present:
  - Long-form Pass 3 truncation under high `representation_compression_ratio`
  - Dark criteria scenario (`criteria_with_zero_evidence` non-empty for long-form)
  - Chunk materialization mismatch (`ensure_chunks_returned_count != persisted_chunk_count`)
- [ ] FAIL — Fewer than three fixtures, or fixtures fail to reproduce their named failure modes.

**Required evidence:**
- Directory listing.
- Each fixture's manifest, manuscript file, and expected outputs.

**Notes:**

***

## Gate 4 — CI workflow green and blocking

**Question**: Does `.github/workflows/replay-harness.yml` block merge on fixture failures?

- [ ] PASS — Workflow runs on every PR, executes all fixtures, blocks merge on any fixture failure.
- [ ] FAIL — Workflow missing, non-blocking, or selectively skips fixtures.

**Required evidence:**
- Workflow file with `on: pull_request`.
- Required check status configured in repository settings.

**Notes:**

***

## Gate 5 — Replay-level telemetry emitted

**Question**: Does each replay run emit structured telemetry?

- [ ] PASS — Telemetry includes `replay_harness_run_count`, `replay_harness_pass_count`, `replay_harness_fail_count`, and per-fixture status records.
- [ ] FAIL — Telemetry absent, mislabeled, or only present in CI logs without structured form.

**Required evidence:**
- Sample telemetry record from a CI run.

**Notes:**

***

## Gate 6 — No production scope leakage

**Question**: Does this PR confine all changes to `tests/` and `.github/workflows/`?

- [ ] PASS — No changes to production prompts, scoring, QG, UI, SIPOC schema, or evaluation passes. Replay harness lives entirely in test/CI infrastructure.
- [ ] FAIL — Production paths modified outside the test/CI directory.

**Required evidence:**
- File-level diff summary showing changes confined to `tests/` and `.github/workflows/`.

**Notes:**

***

## Gate 7 — Existing test suites continue to pass + CI/typecheck green

**Question**: Does the system remain healthy?

- [ ] PASS — All prior tests pass; CI/typecheck/Latency PR Enforcement/Governance Enforcement/Kevlar all green.
- [ ] FAIL — Any pre-existing test red, or required CI check failing.

**Required evidence:**
- CI status summary.

**Notes:**

***

## Decision

- [ ] **PASS — Reliability Hardening architecturally complete.**
  - Harness, schema, fixtures, workflow, telemetry, scope hygiene, CI all green.

- [ ] **FAIL — Narrow follow-up patch required.**
  - One or more gates failed. Use Variant A or B from `RELIABILITY_HARDENING_PATCH_REPLY_SNIPPETS.md`.

**Adjudicator summary (1–3 sentences):**
