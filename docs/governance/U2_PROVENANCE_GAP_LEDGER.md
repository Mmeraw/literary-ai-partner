# U2 Provenance Gap Ledger

**Created:** 2026-07-07
**Owner:** Mike Meraw
**Scope:** `lib/evaluation/pipeline/` — comparisonPacket.ts, runPass3Synthesis.ts, runPipeline.ts
**Status:** Active — G2 implementation in progress

---

## Context

A governance audit (RARA U2-004) identified a structural provenance chain between Pass 2 and Pass 3 synthesis. Pass 2 produces evidence per criterion; none of that evidence reaches the Pass 3 LLM context. This ledger tracks all identified provenance gaps, their severity, closure status, and implementation order.

**Design constraint:** Do not add Pass 2 evidence to the Pass 3 LLM prompt until live diagnostic data (G2) proves a recurring regression. Verdict C applies (see G1 history verdict 2026-07-07).

---

## Provenance Loss Map

| Stage | What Is Lost |
|-------|-------------|
| `buildComparisonPacket()` | Pass 2 `evidence[]` entirely — dropped before LLM receives context |
| `buildComparisonPacket()` | Pass 2 `recommendations[]` entirely — not in LLM context |
| `buildComparisonPacket()` | Pass 2 rationale truncated to first sentence, ≤220 chars |
| `buildComparisonPacket()` | Pass 1 evidence capped at 3 anchors — remaining anchors dropped |
| `parseEvidenceArray()` | LLM-generated evidence has no provenance chain to Pass 1/2 anchors |
| `parseRecommendations()` | `anchor_snippet` is LLM-generated — validated post-synthesis (U2-002), but original Pass 2 anchor is not referenced |
| `synthesisToEvaluationResult()` | Confidence computed on Pass 3 output only — no signal from Pass 2 evidence depth |

---

## Gap Registry

### G1 — Pass 2 evidence structurally invisible to Pass 3
**Severity:** HIGH
**Status:** VERDICT ISSUED — no implementation pending

**Finding:** `buildComparisonPacket` excludes `pass2Criterion.evidence[]` from LLM context. Pass 2's evidence — produced by an independent editorial pass — never reaches Pass 3 synthesis.

**Verdict (2026-07-07):** C — Unclear / Ambiguous. History investigation found no documented design intent that Pass 3 must not see Pass 2 evidence. The independence invariant in the codebase protects Pass 2 FROM Pass 1, not Pass 3 from Pass 2. No test asserts `pass2_evidence` absent from the packet.

**Implementation path:** Do NOT add Pass 2 evidence to the packet yet. Collect live data via G2 fidelity check first. If G2 shows consistent regression → revisit with documented evidence.

**Files touched:** None.

---

### G2 — No Pass 2 → Pass 3 evidence fidelity check
**Severity:** HIGH
**Status:** IMPLEMENTING

**Finding:** Pass 3 evidence is freshly LLM-generated with no check that it is consistent with what Pass 2 found. `propagationIntegrity.ts` measures current output health, not input-output transition fidelity.

**Implementation:** `pass3EvidenceFidelityCheck.ts` — advisory-only check, post-Pass-3, pre-QG.
- Check ID: `PASS3_EVIDENCE_DEPTH_REGRESSION`
- Fires when `pass3.criteria[k].evidence.length < pass2.criteria[k].evidence.length`
- `passed: true` always — warning only, no job failure
- `console.warn` with full per-criterion breakdown

**Files touched:**
- `lib/evaluation/pipeline/pass3EvidenceFidelityCheck.ts` (new)
- `lib/evaluation/pipeline/runPipeline.ts` (advisory call, pre-QG block)
- `__tests__/lib/evaluation/pipeline/pass3EvidenceFidelityCheck.test.ts` (new)

---

### G3 — Pass 1 evidence cap loses anchors for evidence-dense criteria
**Severity:** MEDIUM
**Status:** PENDING (after G2 lands)

**Finding:** `dedupeEvidence()` caps at `maxEvidencePerCriterion = 3`. For criteria with many Pass 1 anchors (common for `proseControl`, `dialogue`), the LLM sees at most 3. Dropped anchors are unavailable for synthesis, backfill, or fidelity checking.

**Implementation path:** Audit and emit metric — do not raise the cap yet. Emit advisory with `criteria_over_cap_count` and `total_dropped_evidence_count` per run. Use live data to decide whether to raise the cap.

**Files touched:**
- `lib/evaluation/pipeline/comparisonPacket.ts` (advisory emit only — do NOT change cap default)
- `lib/evaluation/pipeline/runPipeline.ts` (log the advisory)

---

### G4 — `criteria[].evidence[].snippet` has no post-synthesis grounding check
**Severity:** MEDIUM
**Status:** PENDING (after G2 lands)
**Carry-forward from:** U2-002 G2

**Finding:** The evidence grounding gate (U2-002) validates `recommendations[].anchor_snippet` but not `criteria[].evidence[].snippet`. Both are LLM-produced by Pass 3. Only the recommendation field is verified against the manuscript.

**Risk:** A fabricated evidence snippet in `criteria[].evidence[]` reaches the artifact without grounding classification.

**Implementation path:** Extend `evidenceGroundingGate.ts` to validate `criteria[].evidence[].snippet` using the same manuscript-grounding logic as recommendation anchors. Advisory-only during calibration, promote to blocking after live-proof.

**Files touched:**
- `lib/evaluation/pipeline/evidenceGroundingGate.ts`
- `lib/evaluation/pipeline/qualityGate.ts` (call site extension)
- Tests

---

### G5 — Spine confidence cap potentially overridden by `computeCriterionConfidence`
**Severity:** LOW-MEDIUM
**Status:** PENDING — investigation needed

**Finding:** `applyWeakDiagnosticSpineConfidenceDegrade` caps `confidence_score_0_100` at 45 in `parsePass3Response`. `synthesisToEvaluationResult` then calls `computeCriterionConfidence` on the degraded criterion. If `computeCriterionConfidence` recomputes from scratch and can exceed 45, the spine guard is not end-to-end.

**Investigation needed:** Confirm whether `computeCriterionConfidence` respects a prior cap or recomputes from scratch. If it recomputes and can exceed 45, the spine guard leaks.

**Files to inspect:** `lib/evaluation/pipeline/criterionConfidence.ts`, `lib/evaluation/pipeline/runPass3Synthesis.ts` (parsePass3Response), `lib/evaluation/pipeline/runPipeline.ts` (synthesisToEvaluationResult call)

---

### G6 — `pass12HandoffGate` is warn-only at high violation counts
**Severity:** LOW
**Status:** PENDING — lowest priority

**Finding:** `shouldPassHandoffGate()` blocks on scaffold residue and broken modals, but uses thresholds for generic language (≥3) and missing evidence anchors (≥5). Below those thresholds, violations proceed. A criterion with 4 missing evidence anchors passes the gate without blocking.

**Combined risk (G1+G2+G6):** A criterion with genuinely thin Pass 1 evidence and 4 missing anchors proceeds to synthesis with almost nothing to synthesize from. Low in isolation; compounding with G1/G2 matters.

**Implementation path:** Tighten threshold to ≥4 missing anchors (reduce from 5). Advisory emit for 3–4 range. Do NOT reduce to 1 — would block too many legitimate short-form submissions.

---

## Implementation Order

```
G2  →  G4  →  G5  →  G3  →  G6  →  [G1 if G2 proves regression]
```

Rationale:
- G2 first: provides live data that informs G1 decision and G3 threshold
- G4 next: closes the U2-002 carry-forward, highest evidence-integrity risk
- G5 next: closes the confidence cap leak (deterministic, no LLM risk)
- G3 after: audit-only, uses G2 data to decide whether to raise cap
- G6 last: lowest risk, threshold refinement only
- G1 only if G2 data proves Pass 3 systematically drops Pass 2 evidence

---

## What Is NOT Changing (by design)

- `buildComparisonPacket` — no changes to packet structure
- `ComparisonPacketCriterion` type — `pass2_evidence` field will NOT be added until G2 data justifies it
- Pass 3 LLM prompt — no Pass 2 evidence added
- Independence invariant — "Pass 2 NEVER receives Pass 1 output" — unchanged
- `pass2IndependenceGuard.ts` — unchanged
- Any retry/recovery/worker/watchdog/pipeline scoring/rendering/ViewModels/templates/Revise logic
