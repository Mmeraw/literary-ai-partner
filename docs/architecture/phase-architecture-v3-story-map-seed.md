# Phase Architecture v3 — Story Map Seed Doctrine

Status: canonical architecture document for the Story Map Seed evaluation pathway.
Supersedes: standalone extractor path (deprecated).
Builds on: [Phase Architecture v2](./phase-architecture-v2.md).

## Why v3 exists

Phase Architecture v2 defined the concurrent preflight track and canonical lifecycle.
v3 codifies the **Story Map Seed doctrine**: the principle that story-layer truth
originates from a ChatGPT-generated seed and is verified/refined by Phase 1A,
rather than extracted de novo by Phase 1A alone.

This matters because the standalone extractor path produced artifacts that were
shape-valid but semantically unreliable. The Story Map Seed pathway replaces
blind extraction with seed-guided verification.

## Canonical truth pathway

```text
Phase 0 — Governance Warmup (calibration proof)
  ↓
Phase 0.5a — ChatGPT Story Map Seed
  → story_map_seed_v1
  → evaluation_seed_v1
  → full_context_story_ledger_v1 (when EVAL_FULL_CONTEXT_LEDGER enabled)
  ↓
Chunk Routing Manifest (depends on story_map_seed_v1)
  ↓
Track B — Phase 1A Seed Verification
  → Verify seed claims against chunked manuscript evidence
  → Refine, not extract
  → Output: pass1a_story_layer_v1, ledger_quality_report_v1
  ↓
Track C — Pass 3A Preflight Scout (MAP/AGG/REDUCE)
  → Output: pass3_preflight_draft_v1
  ↓
Review Gate
  ↓
Phase 2 — Criteria Analysis (Pass 1 + Pass 2 parallel → aggregate)
  ↓
Phase 3B — Synthesis → evaluation_result_v2
  ↓
Quality Gate (deterministic, pre-persistence)
  ↓
Gate 15 Pre-Finalization Invariant → persistEvaluationResultV2
  ↓
WAVE Revision (eligible long-form only)
  ↓
DREAM / Longform Report
  ↓
Final External Audit (long-form advisory)
  ↓
Complete
```

## Phase 0.5a — ChatGPT Story Map Seed

The Story Map Seed is the origin of story-layer truth.

It generates three artifacts from the full manuscript context:

1. **`story_map_seed_v1`** — story claims and entity names for seed-guided extraction.
2. **`evaluation_seed_v1`** — evaluation-oriented claims for downstream synthesis.
3. **`full_context_story_ledger_v1`** — deep 9-layer story ledger (gated by `EVAL_FULL_CONTEXT_LEDGER` flag).

The seed is a hypothesis, not a final answer. Phase 1A verifies and refines it.

### Runtime location

- `lib/evaluation/phase-architecture-v2/phase05aStoryMapSeed.ts`

## Phase 1A — Seed Verification (not standalone extraction)

Phase 1A consumes the Story Map Seed and verifies its claims against chunked
manuscript evidence. It does **not** extract story structure from scratch.

Responsibilities:

- Deep per-chunk ledger work guided by seed claims.
- Character and story layer verification.
- Story Layer assembly from verified evidence.
- Ledger quality assessment.

Required outputs:

- `pass1a_story_layer_v1`
- `ledger_quality_report_v1`

### Deprecated: standalone extractor path

The previous architecture allowed Phase 1A to extract story structure without a
seed. This path is **deprecated and non-canonical**. It produced artifacts that
passed shape validation but contained semantic errors:

- Groups/species counted as cast members
- Non-objects counted as holdable objects
- Collapsed ending accountability treated as reviewed
- Roles/occupations appearing in alias/name state

The Story Map Seed pathway prevents these failures by providing verifiable claims
that Phase 1A must confirm or reject against manuscript evidence.

## Pass 3A — Normalization and Preflight

Pass 3A produces a normalized view of the manuscript for Phase 3B synthesis.

When successful, it outputs `pass3_preflight_draft_v1` — a verified story layer
handoff containing normalized observations that Phase 3B can consume.

The REDUCE step must wait until all MAP chunks are complete.

### Runtime location

- `lib/evaluation/phase-architecture-v2/pass3aTrackC.ts`

## Semantic Validator Gate

The semantic validator gate ensures that story-layer artifacts are not just
shape-valid but semantically correct.

Shape validity means the JSON conforms to the expected schema.
Semantic validity means the content accurately represents the manuscript.

The semantic validator checks for:

- Entity names that are actually roles/occupations/descriptions
- Groups or species counted as individual characters
- Non-physical concepts counted as holdable objects
- Contradictory ending states left unflagged
- Single pressure agent despite multiple visible pressure sources

### Runtime location

- `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (stage definitions)
- `lib/governance/lessonsLearned/ACTIVE_RULES.ts` (LLR rules)

## Accepted Ledger Creation Rule

The accepted story ledger (`accepted_story_ledger_v1`) is created only when:

1. The Story Map Seed exists and is valid.
2. Phase 1A verification has completed.
3. The ledger quality report confirms semantic validity.

A raw `pass1a_story_layer_v1` artifact must never be treated as canonical truth.
The accepted ledger is the canonical truth after verification.

## LLR-001 Recovery Doctrine

LLR-001 ("Blur, Not Multiplicity") enforces that evaluation diagnostics do not
claim "too many ideas" without explicit boundary-evidence. This is a WARNING-level
rule, not a blocking gate.

Recovery path:

1. LLR-001 fires a warning when multiplicity framing lacks boundary evidence.
2. The evaluation continues (no guillotine behavior).
3. The warning is logged in governance diagnostics.
4. If the manuscript genuinely has boundary-blur, the evaluator can cite specific
   overlap/collision evidence to satisfy the rule.

The rule prevents lazy "overloaded premise" diagnoses that lack structural proof.

### Runtime location

- `lib/governance/lessonsLearned/ACTIVE_RULES.ts` — `llr001BlurNotMultiplicity`

## Story Ledger Diagnostic Downgrade

When the story ledger quality assessment identifies issues, the system downgrades
rather than destroying:

- `preflight_status: 'blocked'` — quarantine, not delete.
- Blocked opportunities include `admin_actions` for manual review.
- The diagnostic is preserved for audit, not silently discarded.

This is the "quarantine-not-destroy" principle from the revision candidate quality
system.

### Runtime location

- `lib/revision/opportunityLedger.ts` — `blockOpportunityByPreflight()`
- `lib/revision/candidateQuality.ts` — `introducesUnsupportedFacts()`

## Engineering Rule Block

These rules are non-negotiable for all contributors:

```text
1. Generated is not approved.
   — A seed or extracted artifact is a hypothesis until verified.

2. Populated is not complete.
   — All fields filled does not mean all fields correct.

3. Shape-valid is not semantically valid.
   — JSON conforming to schema does not mean content is accurate.

4. Raw pass1a_story_layer_v1 must never be treated as canonical truth.
   — Only the accepted ledger (post-verification) is canonical.

5. WARNING-level governance rules do not block the pipeline.
   — They log diagnostics for review, not guillotine the evaluation.

6. Quarantine, not destroy.
   — Blocked content is preserved for audit, not silently discarded.

7. Evidence is passage-level, not single-sentence.
   — Structural diagnostics require surrounding context, not isolated clauses.
```

## Migration notes

### What changed from v2

- Phase 1A is now explicitly **seed verification**, not standalone extraction.
- The standalone extractor path is formally deprecated.
- Semantic validator gate is a named gate, not an implicit assumption.
- LLR-001 recovery doctrine is documented (WARNING, not BLOCK).
- Engineering rule block is explicit and enforceable.
- Gate 15 pre-finalization invariant is part of the canonical lifecycle.
- Final External Audit is included in the lifecycle (long-form advisory).

### What did not change

- Phase 0, Phase 0.5a/0.5b, Chunk Routing, Track B/C structure.
- Review Gate conditions.
- Phase 2 criteria analysis.
- Phase 3B synthesis.
- Quality Gate (deterministic, pre-persistence).
- WAVE Revision (post-evaluation, eligible long-form).
- DREAM / Longform Report.
- Progress ladder percentages.
- Naming rules (Pass 3A ≠ Phase 0, Quality Gate ≠ WAVE, etc.).

## Hard rules (inherited from v2 + v3 additions)

- Phase 0 must complete before manuscript-reading tracks launch.
- Track B and Track C require durable chunk routing manifest.
- Track B and Track C are independently throttled.
- No unbounded concurrency.
- Pass 3A REDUCE waits for all MAP chunks.
- Review Gate requires Story Layer, ledger quality report, and Pass 3A terminal-and-gate-valid state.
- Phase 2 refuses missing, running, or half-written Pass 3A. Failed Pass 3A is a non-fatal kick-forward.
- Degraded is gate-valid only with structured proof.
- Failed is never gate-valid.
- **v3:** Raw `pass1a_story_layer_v1` is never canonical truth.
- **v3:** Shape-valid is not semantically valid.
- **v3:** Generated is not approved.
- **v3:** Quarantine, not destroy.
