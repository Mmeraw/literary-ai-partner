# U2 Provenance Gap Ledger

**Created:** 2026-07-07
**Owner:** Mike Meraw
**Scope:** `lib/evaluation/pipeline/` — comparisonPacket.ts, runPass3Synthesis.ts, runPipeline.ts
**Status:** Active — G2 implementation in progress

---

## Context

A governance audit (RARA U2-004) identified a structural provenance chain break between Pass 2 and Pass 3 synthesis. Pass 2 produces evidence per criterion; none of that evidence reaches the Pass 3 LLM context. This ledger tracks all identified provenance gaps, their severity, closure status, and implementation order.

**Design constraint:** Do not add Pass 2 evidence to the Pass 3 LLM prompt until live diagnostic data (G2) proves a recurring regression. Verdict C applies (see G1 history verdict 2026-07-07).

**Scale context:** 100,000 users target — all gaps must be closed or explicitly accepted before scale.

---

## Provenance Loss Map — All 7 Breaks

Each row is a distinct provenance break in the pipeline. All are tracked in this ledger.

| # | Stage | What Is Lost | Gap | Severity |
|---|-------|-------------|-----|----------|
| PL-1 | `buildComparisonPacket()` | Pass 2 `evidence[]` entirely — dropped before LLM receives context | G1 | HIGH |
| PL-2 | `buildComparisonPacket()` | Pass 2 `recommendations[]` entirely — not in LLM context | — | MEDIUM (future gap) |
| PL-3 | `buildComparisonPacket()` | Pass 2 rationale truncated to first sentence, ≤220 chars | — | LOW (by design, may be acceptable) |
| PL-4 | `buildComparisonPacket()` | Pass 1 evidence capped at 3 anchors — remaining anchors dropped | G3 | MEDIUM |
| PL-5 | `parseEvidenceArray()` | LLM-generated evidence has no provenance chain to Pass 1/2 anchors | G2 | HIGH |
| PL-6 | `parseRecommendations()` | `anchor_snippet` is LLM-generated — original Pass 2 anchor not referenced | G4 | MEDIUM |
| PL-7 | `synthesisToEvaluationResult()` | Confidence computed on Pass 3 output only — no signal from Pass 2 evidence depth | G5 | LOW-MEDIUM |

**PL-2 and PL-3 are not yet assigned gap IDs.** They are tracked here as provenance breaks. PL-2 (Pass 2 recommendations dropped) will be assessed after G2 live data is collected. PL-3 (rationale truncation) may be intentional by design — the 220-char truncation is a context budget decision, not clearly an error.

---

## Gap Registry

### G1 — Pass 2 evidence structurally invisible to Pass 3 (PL-1)
**Severity:** HIGH
**Status:** VERDICT ISSUED — no implementation pending

**Finding:** `buildComparisonPacket` excludes `pass2Criterion.evidence[]` from LLM context. Pass 2's evidence — produced by an independent editorial pass — never reaches Pass 3 synthesis.

**Verdict (2026-07-07):** C — Unclear / Ambiguous. History investigation found no documented design intent that Pass 3 must not see Pass 2 evidence. The independence invariant in the codebase protects Pass 2 FROM Pass 1, not Pass 3 from Pass 2. No test asserts `pass2_evidence` absent from the packet.

**Implementation path:** Do NOT add Pass 2 evidence to the packet yet. Collect live data via G2 fidelity check first. If G2 shows consistent regression → revisit with documented evidence.

**Files touched:** None.

---

### G2 — No Pass 2 → Pass 3 evidence fidelity check (PL-5)
**Severity:** HIGH
**Status:** IMPLEMENTING

**Finding:** Pass 3 evidence is freshly LLM-generated with no check that it is consistent with what Pass 2 found. `propagationIntegrity.ts` measures current output health, not input-output transition fidelity.

**Metric design (extended per review 2026-07-07):**
Count alone is a weak proxy. Pass 3 may produce fewer-but-stronger anchors (count regression, not a real problem) or more-but-vaguer anchors (count stable, fidelity degraded). The check therefore tracks three dimensions:

| Dimension | What it measures | Status |
|-----------|-----------------|--------|
| Count delta | `pass2_evidence_count - pass3_evidence_count` per criterion | Implemented |
| Concept coverage | Pass 2 semantic n-grams (4-gram, ≥4-char tokens) absent from Pass 3 (`missing_pass2_concepts`); Pass 3 n-grams with no Pass 2 anchor (`new_unsupported_concepts`) | Implemented |
| Grounded snippet count | Pass 2 and Pass 3 evidence snippets verified against manuscript text | Scaffolded (null) — populated when G4 lands |

**`fidelity_intact = false`** fires when: count regression OR concept regression in any criterion.

**Implementation:**
- `lib/evaluation/pipeline/pass3EvidenceFidelityCheck.ts` (new) — pure function, deterministic
- `lib/evaluation/pipeline/runPipeline.ts` — advisory call, post-repair, pre-QG block
- `__tests__/lib/evaluation/pipeline/pass3EvidenceFidelityCheck.test.ts` — 10 cases

**What does NOT change:**
- `buildComparisonPacket` — packet structure unchanged
- `ComparisonPacketCriterion` type — no `pass2_evidence` field added
- Pass 3 LLM prompt — unchanged
- Independence boundary — unchanged

---

### G3 — Pass 1 evidence cap loses anchors for evidence-dense criteria (PL-4)
**Severity:** MEDIUM
**Status:** PENDING (after G2 lands)

**Finding:** `dedupeEvidence()` caps at `maxEvidencePerCriterion = 3`. For criteria with many Pass 1 anchors (common for `proseControl`, `dialogue`), the LLM sees at most 3. Dropped anchors are unavailable for synthesis, backfill, or fidelity checking.

**Implementation path:** Audit and emit metric — do not raise the cap yet. Emit advisory with `criteria_over_cap_count` and `total_dropped_evidence_count` per run. Use live data to decide whether to raise the cap.

**Files touched:**
- `lib/evaluation/pipeline/comparisonPacket.ts` (advisory emit only — do NOT change cap default)
- `lib/evaluation/pipeline/runPipeline.ts` (log the advisory)

---

### G4 — `criteria[].evidence[].snippet` has no post-synthesis grounding check (PL-6)
**Severity:** MEDIUM
**Status:** PENDING (after G2 lands)
**Carry-forward from:** U2-002 G2

**Finding:** The evidence grounding gate (U2-002) validates `recommendations[].anchor_snippet` but not `criteria[].evidence[].snippet`. Both are LLM-produced by Pass 3. Only the recommendation field is verified against the manuscript.

**Risk:** A fabricated evidence snippet in `criteria[].evidence[]` reaches the artifact without grounding classification.

**G2 dependency:** G4 will populate `pass2_grounded_count` and `pass3_grounded_count` in `EvidenceFidelityEntry`, completing the G2 metric's third dimension.

**Implementation path:** Extend `evidenceGroundingGate.ts` to validate `criteria[].evidence[].snippet` using the same manuscript-grounding logic as recommendation anchors. Advisory-only during calibration, promote to blocking after live-proof.

**Files touched:**
- `lib/evaluation/pipeline/evidenceGroundingGate.ts`
- `lib/evaluation/pipeline/pass3EvidenceFidelityCheck.ts` (populate grounded counts)
- `lib/evaluation/pipeline/qualityGate.ts` (call site extension)
- Tests

---

### G5 — Spine confidence cap potentially overridden by `computeCriterionConfidence` (PL-7)
**Severity:** LOW-MEDIUM
**Status:** PENDING — investigation needed

**Finding:** `applyWeakDiagnosticSpineConfidenceDegrade` caps `confidence_score_0_100` at 45 in `parsePass3Response`. `synthesisToEvaluationResult` then calls `computeCriterionConfidence` on the degraded criterion. If `computeCriterionConfidence` recomputes from scratch and can exceed 45, the spine guard is not end-to-end. Confidence also carries no signal from Pass 2 evidence depth — a criterion with strong Pass 2 evidence but weak Pass 3 evidence can report high confidence.

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

## Unassigned Provenance Breaks (PL-2, PL-3)

### PL-2 — Pass 2 recommendations[] dropped from LLM context
**Severity assessment:** MEDIUM
**Status:** Not yet a numbered gap. Pending G2 data.

Pass 2 recommendations are produced per criterion and then entirely dropped from the comparison packet. Pass 3 generates recommendations independently. Whether Pass 3 synthesis would be improved by seeing Pass 2 recommendations is unknown. This break will be assessed after G2 live data clarifies how severe the evidence loss is. If Pass 3 evidence is consistently weaker, the recommendations loss compounds it.

### PL-3 — Pass 2 rationale truncated to 220 chars
**Severity assessment:** LOW — likely acceptable by design
**Status:** Not yet a numbered gap. Accept pending review.

`toFirstSentence(pass2Criterion.rationale, 220)` is a deliberate context budget decision — the first sentence is the editorial judgment signal; the rest is supporting argument. This may be an appropriate truncation. Flag for explicit acceptance decision before scale.

---

## Implementation Order

```
G2 (in progress) → G4 → G5 → G3 → G6 → [G1 if G2 proves regression]
```

**Rationale:**
- G2 first: live data informs G1 and G3 decisions; also scaffolds the grounding dimension for G4
- G4 next: closes U2-002 carry-forward; populates G2's grounded-count scaffold; highest evidence-integrity risk before scale
- G5 next: deterministic investigation + fix; no LLM risk; confidence integrity matters at scale
- G3 after: uses G2 live data to decide whether cap should be raised
- G6 last: lowest risk, threshold refinement only
- G1 only if G2 data proves systematic evidence loss across production runs
- PL-2 (recommendations drop) assessed after G2 data; may become G7

---

## What Is NOT Changing (by design)

- `buildComparisonPacket` — no changes to packet structure
- `ComparisonPacketCriterion` type — `pass2_evidence` field will NOT be added until G2 data justifies it
- Pass 3 LLM prompt — no Pass 2 evidence added
- Independence invariant — "Pass 2 NEVER receives Pass 1 output" — unchanged
- `pass2IndependenceGuard.ts` — unchanged
- Any retry/recovery/worker/watchdog/pipeline scoring/rendering/ViewModels/templates/Revise logic
