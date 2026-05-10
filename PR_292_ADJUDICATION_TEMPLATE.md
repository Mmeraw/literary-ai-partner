# PR #292 – Chunk-Aware Evidence Consumption
Adjudication Template (PASS/FAIL)

## Purpose
PR #292 is a representation-truth change only. It must prove that long-form evaluations downstream actually consume chunk-derived evidence in a controlled, observable, and test-proven way, while short-form behavior remains unchanged.

Allowed: packet/evidence consumption changes, provenance telemetry, non-regression proof.

Explicitly deferred: routing/source recovery (291), WAVE activation, prompt redesign, scoring/QG rewrites, UI/reporting overhauls beyond additive telemetry.

If any required proof is missing or ambiguous, this PR does not receive partial credit; it returns for a narrow follow-up patch.

## 1. Identifiable long-form packet/evidence path
**Question:**
Is there a single identifiable downstream packet/evidence construction path for long-form manuscripts that reviewers can name in code?

- **PASS** – Long-form packet/evidence path is explicitly implemented and easy to point to (e.g., specific function/module for constructing comparison packets from chunk-derived material).
- **FAIL** – Packet/evidence path is diffuse, implicit, or still mixing pre-chunk and chunk-derived representations.

**Notes:**

## 2. Runtime provenance telemetry
**Question:**
Does runtime telemetry clearly prove the source identity of the evidence/packets consumed for long-form?

- **PASS** – Telemetry includes explicit provenance fields (e.g., `packet_source`, `evidence_source`, or equivalent) that show long-form packets are built from chunk-derived, canonical long-form data after Routing/Chunking.
- **FAIL** – Telemetry only indicates `long_form` routing or chunk existence; it does not prove what evidence source the evaluator actually consumed.

**Required evidence:**
- Telemetry field names and example values from a real long-form run.
- Confirmation that short-form telemetry semantics remain unchanged.

**Notes:**

## Gate 2.5 — SIPOC Instrument Completeness

**Question:** Does runtime telemetry emit the full SIPOC coverage instrument for long-form jobs?

- [ ] **PASS** — All 12 fields present and sensible for long-form:
	- Provenance (3): `packet_source`, `packet_scope`, `packet_evidence_origin`
	- Input-side (2): `manuscript_words`, `chunks_created`
	- Output-side (7): `chunks_consumed`, `chunk_coverage_pct`, `excerpt_count`, `evidence_count_by_criterion`, `comparison_packet_chars`, `representation_compression_ratio`, `criteria_with_zero_evidence`
	- Short-form: input-side present; output-side chunk-coverage may be null where chunk-aware paths don't apply.

- [ ] **FAIL** — Any required field missing, null where it should not be, or carrying placeholder/`unknown` value.

**Required evidence:**

- Sample long-form telemetry record showing all 12 fields with concrete values.
- Sample short-form telemetry record showing input-side fields and appropriate null/non-null distribution for output-side.
- Test `long_form_emits_full_sipoc_coverage_diagnostics` green in CI.

**Notes:**

## Highest-Leverage Diagnostic Verification

Reviewer must confirm the four highest-leverage signals are interpretable:

- [ ] `chunk_coverage_pct` reflects actual chunk consumption ratio.
- [ ] `representation_compression_ratio` is interpretable as packet/source compression and falls in expected band (e.g., 0.05–0.5 for typical long-form).
- [ ] `criteria_with_zero_evidence` accurately enumerates dark criteria for the run.
- [ ] `evidence_count_by_criterion` provides per-criterion density usable downstream by Revise / TRUSTPATH / WAVE.

If any of the four cannot be interpreted from the telemetry payload, this gate FAILS regardless of field presence.

## 3. Tests proving downstream chunk-derived evidence consumption
**Question:**
Do tests prove that downstream evaluation for long-form actually consumes chunk-derived evidence, not just that chunks exist?

- **PASS** – There are tests that:
	- Construct a long-form scenario where chunk-derived evidence is expected.
	- Assert that the downstream packet/evidence structure used by evaluation is populated from chunk-derived sources (not pre-chunk text or legacy paths).
- **FAIL** – Tests only assert routing, ordering, or chunk existence; they do not assert what evidence source packets actually read from.

**Required evidence:**
- Test names and locations.
- The key assertion(s) that prove downstream evidence source.

**Notes:**

## 4. Short-form unchanged + CI/typecheck green
**Question:**
Does this PR leave short-form behavior unchanged and keep the system healthy?

- **PASS** – Short-form evaluation semantics and packet behavior are unchanged by code and tests; any telemetry additions do not alter short-form behavior. CI + typecheck are fully green.
- **FAIL** – Short-form semantics changed, or CI/typecheck show regressions.

**Required evidence:**
- Summary of short-form checks (tests or targeted runs).
- CI/typecheck status.

**Notes:**

## Decision

- **PASS** – PR #292 is architecturally complete.
	- Long-form packet/evidence path is identifiable.
	- Runtime telemetry proves consumed evidence source identity.
	- Gate 2.5 (SIPOC instrument completeness) passes.
	- Tests prove downstream chunk-derived evidence consumption.
	- All telemetry fields emit with sensible values for long-form; short-form behavior unchanged.
	- Short-form unchanged; CI/typecheck green.

- **FAIL** – Narrow follow-up patch required.
	- At least one of the four gates above failed.
	- Request a small, targeted patch limited to the missing/ambiguous proof artifacts (no scope expansion).

**Adjudicator summary (1–3 sentences):**
