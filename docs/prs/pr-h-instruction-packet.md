# PR-H Instruction Packet — Two-Phase Deep Evaluation (Gold-Standard Long-Form)

**Status:** PROPOSED — ready to author
**Depends on:** PR-G merged (5f9df58 on main; weak-agreement is advisory; criterionConflicts surfaced)
**Goal:** WOW long-form output without blowing the Phase A wall-clock budget
**Branch:** `feat/phase2-deep-evaluation`
**PR Type:** evaluation (validator type `evaluation`)
**Gold-standard targets:**
- `let-the-river-decide-dream-gold-standard-evaluation.md` (825 lines)
- `froggin-noggin-dream-gold-standard-evaluation.md` (868 lines)

---

## 1. Design summary

Decouple long-form depth from the timeout-budgeted Pass 1-4 pipeline by running the gold-standard layered analysis as a **separate, deferred, parallelized worker** that fires after Phase A completes.

### Phase A — Mega Pass (existing pipeline, untouched)
- Pass 1 → Pass 2 → Pass 3 → Pass 4 → governance (PR-G) → report
- Output: 13 canonical criteria scores, rationale, evidence, criterionConflicts, lightweight Layer & Voice Map, one-paragraph Stack Diagnosis
- Wall-clock budget: ~10 min (current production budget)
- Ships immediately to user as the primary report

### Phase B — Deep Evaluation Pack (NEW worker)
- Fires after Phase A completes (auto for `multi_layer_long_form`; opt-in button for `standard_long_form`)
- Runs as its own worker with its own wall-clock budget (~15-25 min OK; no user-perception pressure because Phase A is already shipped)
- Reads Phase A artifact + manuscript text from storage; never re-tokenizes or re-chunks
- Issues parallelized layer-level calls (one prompt per detected layer) + cross-layer + canon/doctrine audit + reader-experience + revision-plan
- Attaches deep-eval artifact to the same job_id
- UI: report renders Phase A immediately; "Deep Evaluation" tab/section unlocks when Phase B completes

This means **users see the report fast** (no perception change) and the **gold-standard depth materializes as an upgrade** without ever risking a timeout on the critical path.

---

## 2. Scope (files to add / change)

### 2.1 Schema additions
**New file: `schemas/deep-evaluation.ts`**
- `LongFormOutputMode = 'short_form' | 'standard_long_form' | 'multi_layer_long_form'`
- `Confidence = 'High' | 'Moderate-High' | 'Moderate' | 'Mixed'`
- `LayerEntry` (Layer name, Era/Plane, Voice/Mode, Function, Stakes, Dependencies)
- `LayerAnalysis` (Function in the whole, Working, Weakening, Revision priorities, Evidence anchors)
- `CrossLayerIntegration` (Transitions, Echoes & Mirrors, Architectural risk)
- `SymbolicSystemAuditRow` (Element, Role, First appearance, Later obligations, Status)
- `ReaderExperience` (Strong reader / Average reader / Do not simplify away)
- `RevisionAction` (rank 1-5, action text, why-it-matters-first text)
- `ArchitecturalCriterion` keys: `layer_mode_integration`, `doctrine_glyph_integrity`, `canon_continuity_integrity`, `symbolic_system_integrity`, `witness_ownership_boundary`, `cultural_protocol_risk`
- `DeepEvaluationArtifact` (full layered output object)
- `ArchitecturalCriterionResult` extending `CrossCheckCriterionResult` with `confidence: Confidence`

### 2.2 Pipeline additions
**New file: `lib/evaluation/pipeline/runPhase2DeepEval.ts`**
- Reads Phase A artifact + manuscript text from job storage
- Detects layers via single classifier call (uses Pass 1 output + manuscript section headers)
- Fans out parallel layer-analysis prompts (one per layer; `Promise.all` with per-prompt timeout)
- Runs cross-layer / canon-audit / reader-experience / revision-plan prompts in parallel
- Writes `DeepEvaluationArtifact` to job storage
- Updates `deep_eval_status` to `complete` on success or `failed` on terminal error

**New file: `lib/evaluation/prompts/deepEvalLayerAnalysis.ts`**
- One prompt template per architectural section, instructed to emit the exact shape from `docs/benchmarks/ancient-bloodlines-longform-layered-template.md`
- Each prompt receives: relevant manuscript window for that layer, Phase A scores, lightweight Layer & Voice Map from Phase A
- Each prompt returns strict JSON matching the schema (no prose responses; validator rejects non-canonical shape)

**Modify: `lib/evaluation/processor.ts`**
- After Phase A success, if `outputMode === 'multi_layer_long_form'`, enqueue Phase B background job (do not block the user-facing response)
- If `outputMode === 'standard_long_form'`, leave Phase B as opt-in (user-triggered)

### 2.3 API additions
**New route: `app/api/eval/jobs/[id]/deep/route.ts`**
- `POST` — kicks off Phase B against an existing complete Phase A job. Idempotent: if `deep_eval_status === 'running'`, returns current state without re-firing.
- `GET` — returns `{ deep_eval_status, deep_evaluation? }` for the job

### 2.4 Storage additions
**Supabase migration: `supabase/migrations/<timestamp>_add_deep_eval_columns.sql`**
- Add columns to `evaluation_jobs`:
  - `deep_eval_status text` (`pending` | `running` | `complete` | `failed`)
  - `deep_eval_started_at timestamptz`
  - `deep_eval_completed_at timestamptz`
  - `deep_eval_artifact jsonb`
  - `deep_eval_error text`
- Backfill: existing rows get `deep_eval_status = 'pending'` (no auto-fire on old jobs)

### 2.5 UI additions
**Modify: report renderer (location TBD; likely `app/eval/[id]/page.tsx` or equivalent)**
- Render Phase A normally (no change)
- If `deep_eval_status === 'complete'`, render full Layered Analysis section: Layer & Voice Map, Stack Diagnosis, per-Layer blocks, Cross-Layer Integration, Canon Audit, Reader Experience, Top-5 Revision Plan, Acceptance Checks
- If `running`, render progress badge + ETA estimate (avg ~3 min based on parallelism)
- If `pending`, render "Generate Deep Evaluation" CTA button → `POST /api/eval/jobs/:id/deep`
- If `failed`, render retry button + error reason

### 2.6 Benchmarks
**New file: `tests/evaluation/benchmarks/froggin-noggin-deep-eval.spec.ts`**
- Asserts Phase B output for Froggin Noggin contains every section the gold-standard `.md` contains (Layer Map, Stack Diagnosis, all detected layers analyzed, Cross-Layer, Canon Audit, Reader Experience, Top-5 Revision Plan, Acceptance Checks)
- Section-by-section structural match against `/docs/benchmarks/froggin-noggin-dream-gold-standard-evaluation.md`

**New file: `tests/evaluation/benchmarks/let-the-river-decide-deep-eval.spec.ts`**
- Same structural assertions against the River Decide gold-standard

---

## 3. Phase A change (minimal — additive only)

Phase A currently emits 13 criteria. Add a single classifier step at the end of Pass 1:

**Modify: `lib/evaluation/pipeline/runPass1.ts`**
- After 13 criteria are scored, emit a lightweight `output_mode` classification: `multi_layer_long_form` if the manuscript shows ≥2 detectable structural planes / voice regimes / doctrine systems; `standard_long_form` otherwise; `short_form` if word count < 25,000.
- Emit a lightweight `layer_voice_map: LayerEntry[]` (top 5-7 layers detected; no per-layer analysis, just the table)
- Emit a one-paragraph `stack_diagnosis: string`
- Both `layer_voice_map` and `stack_diagnosis` are advisory — they ship with Phase A and seed Phase B's deeper analysis

These additions do not slow Pass 1 materially (single additional structured-output call against the same manuscript context). Latency budget unchanged.

---

## 4. Latency evidence plan

### Baseline (Pre-change)
- Source: Froggin Noggin job `b7517a74-1d36-4362-bf84-3103b54ae1ca` (post-PR-E, pre-PR-G run)
- Run 1: pass1_ms ≈ 60000, total_ms ≈ 597000 (failed at governance)
- After PR-G merge, the same job re-fired against the same manuscript: expected pass1_ms similar; total_ms ≈ same; report ships

### Post-change Runs (PR-H Phase A path)
Phase A wall-clock budget unchanged. New additive Pass 1 classifier expected to add < 5s.
- Run 1: pass1_ms = TBD, total_ms = TBD, governance overhead = same as PR-G baseline
- Run 2: pass1_ms = TBD, total_ms = TBD

### Post-change Runs (PR-H Phase B path)
Phase B runs in a separate worker; wall-clock budget independent. Targets:
- Layer detection: ~30s (single classifier call)
- 5-7 layer-analysis prompts in parallel: ~90s (max layer latency)
- Cross-layer + canon-audit + reader-exp + revision-plan in parallel: ~90s
- Validation + storage write: ~5s
- **Phase B p50 wall-clock target: 3-4 min**
- **Phase B hard timeout: 25 min**

---

## 5. Quality gate / not-reducing-intelligence

Phase A produces the same 13-criterion output and governance contract as today. PR-G's per-criterion conflict articulation is preserved. Phase A consumers (existing report UI) see no regression.

Phase B is purely additive depth. It does not re-score the 13 criteria; it produces architectural-tier analysis on top of them. The criterion scores from Phase A are the single source of truth for the numeric grade. Phase B's architectural criteria (Layer Integration, Doctrine Integrity, Canon Continuity, Symbolic System, Witness/Ownership, Cultural Protocol Risk) are reported alongside the 13 canonical criteria with `Confidence` labels, never replacing them.

**Quality gate preserved:** PASS4_CANON_INVALID still hard-blocks Phase A. Phase B failure never affects Phase A's ship state — a Phase A report ships with `deep_eval_status: 'pending'` and the user can retry Phase B independently.

---

## 6. Risks & Anomalies

- **Risk:** Phase B's parallel layer prompts could share rate-limit budget with concurrent Phase A jobs. Mitigation: per-worker rate-limit queue at OpenAI/Perplexity API layer (already in place via existing throttler).
- **Risk:** Layer detection misclassifies a manuscript as `standard_long_form` when it has hidden architectural depth. Mitigation: user can always trigger Phase B manually via the CTA button.
- **Risk:** Phase B writes large artifact (deep_evaluation jsonb) — could bloat the `evaluation_jobs` row. Mitigation: target <100KB JSON; if larger, persist to S3/Supabase storage and store URL reference.
- **Risk:** Cultural Protocol Risk criterion is sensitive — bad output could embarrass. Mitigation: explicit prompt instruction to flag "Moderate" confidence and recommend external sensitivity review when cultural content is detected; never auto-publish without that caveat.
- **No secret rotation** — production keys unchanged per project policy.

---

## 7. Execution order

1. **Phase 0 (now):** finish Froggin rerun to prove PR-G ships Phase A end-to-end with criterionConflicts surfaced. **← current step**
2. **PR-H Step 1:** schema additions + Pass 1 classifier (smallest reviewable diff; ships independently)
3. **PR-H Step 2:** Supabase migration + API route + worker stub (no real work yet, just plumbing)
4. **PR-H Step 3:** Phase B worker implementation + deepEvalLayerAnalysis prompts
5. **PR-H Step 4:** UI deep-eval section + CTA button
6. **PR-H Step 5:** benchmark spec tests against Froggin + River Decide gold standards

Each step is its own PR (5 PRs total). Step 1 and 2 are non-user-facing infrastructure and can ship same day. Step 3 is the heaviest; Steps 4-5 ride on it.

---

## 8. Acceptance criteria

- Froggin Noggin manuscript run produces Phase A in ≤10 min (no regression)
- Phase B auto-fires for `multi_layer_long_form` mode within 30s of Phase A completion
- Phase B produces a deep-eval artifact whose markdown rendering matches the structural shape of `froggin-noggin-dream-gold-standard-evaluation.md` (every section present)
- Phase B p50 wall-clock ≤ 5 min
- Phase B failure does not affect Phase A report visibility
- UI shows "Deep Evaluation" section that progressively reveals (pending → running → complete) without page reload
- Acceptance checks block in the rendered report passes all listed verifications

---

## 9. Out of scope (deferred)

- Revise-engine wiring (PR-H stops at evaluation depth; WAVE module application is the next phase)
- Cultural sensitivity reviewer integration (Phase B flags cultural risk; human reviewer pipeline is downstream)
- Author-customizable layer detection (Phase B uses auto-detected layers; manual override is a future UX feature)
- Multi-language manuscripts (current scope: English only)
- PDF export of the deep eval (the markdown renders; PDF is a follow-up UI PR)
