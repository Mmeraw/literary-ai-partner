# Long-Form + WAVE+ Forensic Pipeline Map

**Status:** Living document — first draft  
**Purpose:** Trace one long-form manuscript (≥25,000 words) through every pipeline stage, identifying where the long-form path **diverges** from short-form. For each divergence: input artifact, output artifact, quality gates, mutation points, ownership, schema.  
**Scope:** long_form_evaluation + long_form_multi_layer_evaluation + DREAM synthesis + WAVE revision  
**Authority chain:** Canon (Volumes I–VII) > SIPOC > Spec docs > Runtime code > Telemetry

**Key difference from short-form:** Long-form adds Review Gate, full-context Story Ledger, accepted story ledger, DREAM/chunked synthesis, WAVE/Revise handoff, and multi-layer output rendering.

---

## PIPELINE SPINE (Long-Form)

```
Submission
 ↓
Phase 0 — Governance Warmup
 ↓
Phase 0.5A — Full-Context Story Ledger Seed
 ↓
Phase 0.5B — Enhanced Ledger (Pass 3A preflight + quality report)
 ↓
Phase 1A — Story Layer Extraction + Ledger Quality Report
 ↓                            ← SHORT-FORM STOPS HERE (no Review Gate)
Review Gate ← USER-FACING APPROVAL GATE (long-form only)
 ↓
Accepted Story Ledger → Phase 2 Structured Context
 ↓
Pass 1 (chunked — per-chunk scoring)
 ↓
Pass 2 (chunked — independence + enrichment)
 ↓
S06b Handoff Gate (PR #1050)
 ↓
Pass 3 — Synthesis (aggregation across chunks)
 ↓
Pass 3B — DREAM Long-Form Document (async worker)
 ↓
Pass 4 / QualityGateV2
 ↓
Canonical Artifact (evaluation_result_v2 + longform_document_v1)
 ↓
Downloads (PDF / DOCX / TXT / Webpage)
 ↓
Revise Queue → WAVE Revision Pipeline
```

---

## WHERE LONG-FORM DIVERGES FROM SHORT-FORM

| Stage | Short-Form | Long-Form | Risk |
|-------|-----------|-----------|------|
| Phase 0.5A | Full-context seed OR direct-window | ALWAYS full-context seed (mandatory) | None — stronger constraint |
| Phase 0.5B / Pass 3A | Skip or advisory only | Blocking preflight — produces ledger quality report | None — stronger gate |
| Phase 1A | Advisory Story Layer (non-blocking) | Governed Story Layer (blocking authority) | Layer starvation if extraction fails |
| Review Gate | **BYPASSED** (auto-approved) | **USER-FACING** — human must approve ledger | Evaluation blocks indefinitely if user never approves |
| Accepted Story Ledger | N/A | Required artifact — feeds into Pass 2 structured context | **BIGGEST DIVERGENCE** — starvation here starves all downstream |
| Pass 1/2 | Single-window analysis | Chunked per-manuscript-chunk analysis | Coverage gaps between chunks; chunk boundary artifacts |
| Pass 3 | Direct synthesis from 1 set of scores | Aggregation across N chunks → single criterion set | Aggregation logic can lose minority signals |
| Pass 3B / DREAM | N/A | Async 16-section DREAM document synthesis | Timeout risk (800s budget); decoupled failure path |
| WAVE/Revise | Standard revise queue | WAVE-informed revision with scene-level governance | 60-wave complexity; destruction guard false blocks |
| Multi-layer rendering | Single-mode output | Multi-layer rendering (story layers as additional output) | Layer contamination across rendering modes |

---

## STAGE-BY-STAGE: LONG-FORM DIVERGENCES

### DIVERGENCE 1: Phase 0.5A — Full-Context Story Ledger Seed

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S04_PHASE0_5A`, docs/governance/seed-phase-template-alignment-contract.md |
| **Runtime code** | `lib/evaluation/seed/fullContextStoryLedger.ts` |
| **Input** | Full manuscript text (no chunking) — single LLM call |
| **Output** | 9-layer Story Ledger seed: source_integrity, pov_structure, canonical_identity, cast_role_tier, pronoun_transitions, relationship_network, object_symbol, timeline_location_worldstate, threat_pressure_ending |
| **Schema** | `StoryLedgerSeed` type with `layers: Record<StoryLedgerLayer, object>`, `failure_conditions: CharacterEndState[]` |
| **Ownership** | RG-owned (model output). Author-derived (based on manuscript). |
| **Quality gates** | `validateLedgerStructure()` — structural completeness check; all 9 layers must be non-empty |
| **Mutation points** | LLM synthesis from raw text → structured ledger (MAJOR mutation) |
| **Malformed text entry?** | YES — LLM can produce garbled layer names, incomplete entries, hallucinated characters |

#### Short-form difference
Short-form may use `direct_window` path (no seed) or advisory-only seed. Long-form ALWAYS requires full-context ledger with `storyLedgerAuthority: 'governed'`.

#### Missing gates (long-form weak seam)
- No **prose quality** check on ledger entries — garbled entries can pass structure validation
- No check for **hallucinated entity names** vs actual manuscript entities
- Failure condition: layer contains `{ entity: "the character", end_state: "unknown" }` which is structurally valid but semantically useless

---

### DIVERGENCE 2: Phase 0.5B / Pass 3A — Ledger Quality Report

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S04b_PHASE0_5B` |
| **Runtime code** | `lib/evaluation/phase1a/buildLedgerQualityReport.ts` |
| **Input** | Story Ledger seed from Phase 0.5A |
| **Output** | Ledger quality report + Pass 3A preflight status (`done` | `degraded` | `failed`) |
| **Schema** | Quality report with per-layer scores, missing_keys, completeness metrics |
| **Quality gates** | `pass3a_gate_validity: 'gate_valid'` required for Review Gate readiness |
| **Mutation points** | NONE — read-only quality assessment |
| **Malformed text entry?** | NO — this stage reads but doesn't produce content |

#### Short-form difference
Short-form either skips this or treats it as advisory. Long-form makes `pass3a_gate_validity` a **blocking** requirement.

---

### DIVERGENCE 3: Phase 1A — Governed Story Layer Extraction

| Field | Value |
|-------|-------|
| **Canon ref** | Volume III §2, SIPOC `S05_PHASE1A` |
| **Runtime code** | `lib/evaluation/phase1a/buildStoryLayerFromLedger.ts`, `lib/evaluation/phase1a/extractStoryLayers.ts` |
| **Input** | Story Ledger seed (Phase 0.5A output) + manuscript chunks |
| **Output** | `pass1a_story_layer_v1` artifact — verified, governed Story Layer |
| **Schema** | `{ ok: true, layers: Record<string, Record<string, unknown>>, shape: 'flat' | 'wrapped', missing_keys: string[] }` |
| **Ownership** | RG-owned (generated from author's manuscript) |
| **Quality gates** | Layer extraction validation, shape detection, missing key tracking |
| **Mutation points** | LLM-verified refinement of seed → governed layer (MUTATION) |
| **Malformed text entry?** | YES — layer extraction can produce empty layers (`layers: {}`) |

#### Short-form difference
Short-form Story Layer is `advisory_internal` — failures don't block evaluation. Long-form Story Layer is `governed` — failures BLOCK at Review Gate.

#### Known failure mode (PR #1045)
The `extractStoryLayers()` function was returning `layers: {}` for valid manuscripts when the LLM response shape wasn't properly unwrapped. This caused "story-layer starvation" — the Review Gate would either:
1. Block indefinitely (correct behavior, bad UX)
2. Be auto-approved with empty layers (incorrect — violates governance)

---

### DIVERGENCE 4: Review Gate (USER-FACING APPROVAL)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S05b_REVIEW_GATE`, `modeRouting.ts:requiresUserFacingReviewGate` |
| **Runtime code** | `lib/evaluation/phase-architecture-v2/reviewGateHandoff.ts`, `lib/evaluation/phase-architecture-v2/gateValidity.ts`, `lib/evaluation/reviewGate/semanticGate.ts` |
| **Input** | Phase 1A artifacts: Story Layer + Ledger Quality Report + Pass 3A preflight |
| **Output** | `ReviewGateHandoff` or `ReviewGateBlocked` decision |
| **Schema** | `{ ok: true, handoff: ReviewGateHandoff, decision: ReviewGateDecision }` |
| **Ownership** | Split: system generates the ledger, user approves/rejects |
| **Quality gates** | `deriveReviewGateReadiness()` — checks story_layer exists, quality report exists, Pass 3A valid, no hard-fail |
| **Mutation points** | NONE — gate only passes/blocks, doesn't modify content |
| **Malformed text entry?** | NO — but malformed inputs (empty layer) can PASS if gate checks are incomplete |

#### Short-form difference
**Short-form BYPASSES this gate entirely.** `shouldBypassUserFacingReviewGate(wordCount)` returns `true` for all word counts below 25,000. This means:
- Short-form: Phase 1A → auto-approved → Phase 2 immediately
- Long-form: Phase 1A → Review Gate → user must manually approve → Phase 2

#### Missing gates
- Review Gate checks structural validity but NOT semantic quality of the ledger
- A structurally valid but semantically garbage ledger passes the gate if the user clicks "Approve"
- No system-side quality floor before user approval (should there be one?)

#### Containment mode
`lib/evaluation/reviewGate/containmentMode.ts` — handles what happens when Review Gate blocks permanently. Containment prevents the job from hanging indefinitely.

---

### DIVERGENCE 5: Accepted Story Ledger → Phase 2 Structured Context

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S06_PASS12`, Volume III §3, `buildPass2aStructuredContext.ts` |
| **Runtime code** | `lib/evaluation/pipeline/buildPass2aStructuredContext.ts`, `lib/evaluation/review-gate/storyLedgerApprovalNormalizer.ts` |
| **Input** | Approved Story Layer artifact + manuscript chunks |
| **Output** | `Pass2aStructuredContext` — chapter index, chunk metadata, ledger context block |
| **Schema** | `{ chapterIndex: ChapterIndexEntry[], contextBlock: string, chunkMetadata: ManuscriptChunkEvidence[] }` |
| **Ownership** | RG-owned (system-generated from author's approved manuscript structure) |
| **Quality gates** | Ledger approval normalizer validates format; chapter index builder validates structure |
| **Mutation points** | Transforms approved ledger into structured context block (MUTATION — summarization/formatting) |
| **Malformed text entry?** | YES — if accepted ledger has empty layers (PR #1045 bug), the context block is hollow |

#### Short-form difference
Short-form either:
- Has no ledger context at all (micro-excerpt, short-excerpt modes)
- Has advisory-only ledger that doesn't block on empty (full-short-form)

Long-form REQUIRES this context. The ledger feeds the `characterLedgerBlock` parameter into Pass 1/2 LLM calls. If it's empty, the LLM operates without manuscript-level context constraints.

#### THIS IS THE STARVATION WEAK SEAM
The `accepted_story_ledger → Pass2aStructuredContext` handoff is where PR #1045 identified the story-layer starvation bug. When `layers: {}` was accepted (either through auto-approval or manual approval of garbage), Phase 2 received:
- Empty `characterLedgerBlock` → LLM has no character constraints
- Missing `failure_conditions` → LLM can recommend impossible actions (e.g., "Billy should confront…" when Billy is dead)

---

### DIVERGENCE 6: Pass 1/2 Chunked Analysis

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S06_PASS12`, Long-Form Pipeline Success Contract §3–4 |
| **Runtime code** | `lib/evaluation/pipeline/runPipeline.ts` (lines 768–1200) |
| **Input** | `manuscriptChunks: ManuscriptChunkEvidence[]` — array of manuscript segments |
| **Output** | Per-chunk scoring: `{ criteria: CriterionResult[], chunk_id: string }[]` |
| **Schema** | Each chunk produces 13-criterion analysis independently; then aggregated |
| **Quality gates** | `validateManuscriptChunks()` — chunk integrity check; coverage threshold enforcement |
| **Mutation points** | Per-chunk LLM analysis → structured criterion results (MAJOR MUTATION per chunk) |
| **Malformed text entry?** | YES — each chunk is an independent LLM call, each can produce garbled output |

#### Short-form difference
Short-form sends entire text as one window. Long-form splits into chunks (typically 5,000–10,000 word segments) and runs Pass 1/2 independently per chunk. This creates:
- **Chunk boundary risk**: Recommendations that reference context from adjacent chunks may produce dangling references
- **Coverage gaps**: If a chunk fails, its criteria scores are missing from aggregation
- **Inconsistency risk**: Chunk A might score "narrative_drive" at 80, Chunk B at 55 — aggregation must reconcile

#### Missing gates
- No per-chunk handoff gate (S06b only runs on aggregated output, not per-chunk)
- No chunk boundary artifact detection (sentences split mid-word at chunk edge)
- No chunk-to-chunk consistency check before aggregation

---

### DIVERGENCE 7: Pass 3 Synthesis (Aggregation)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S07_PASS3`, Volume III §4 |
| **Runtime code** | `lib/evaluation/pipeline/runPass3Synthesis.ts` (lines 717, 1203, 1465) |
| **Input** | Aggregated Pass 1/2 results across all chunks |
| **Output** | `SynthesisOutput` — unified 13-criterion analysis, recommendations, executive summary |
| **Quality gates** | `runQualityGateV2()` post-synthesis; `recommendationIntegrityGate` (PR #1044) |
| **Mutation points** | Chunk aggregation → single unified document (CRITICAL MUTATION) |
| **Malformed text entry?** | YES — synthesis LLM can produce all short-form defects PLUS long-form-specific ones |

#### Short-form difference
Short-form Pass 3 synthesizes from one analysis. Long-form must aggregate across N chunks:
- Per-chunk scores → weighted average or LLM-mediated synthesis
- Per-chunk recommendations → deduplication + prioritization
- Per-chunk evidence → selection of strongest/most representative

#### Long-form-specific failure modes
- **Minority signal loss**: A problem in one chunk (10% of manuscript) gets diluted by 9 healthy chunks
- **Recommendation deduplication errors**: Same issue flagged in 5 chunks → should be 1 strong rec, not 5 weak ones
- **Cross-chunk reference corruption**: "As noted in the opening chapters" when the evidence came from chunk 7

---

### DIVERGENCE 8: Pass 3B — DREAM Long-Form Document (Async Worker)

| Field | Value |
|-------|-------|
| **Canon ref** | docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md, benchmarks/froggin-noggin-dream.md |
| **Runtime code** | `lib/evaluation/pipeline/runPass3bLongform.ts`, `app/api/workers/process-dream/route.ts` |
| **Input** | Completed evaluation_result_v2 + manuscript chunks + Pass2a context |
| **Output** | `longform_document_v1` artifact — 16-section DREAM document |
| **Schema** | `LongformDreamDocument` — executive_verdict, dream_scores, market_shelf, structural_stack, arc_map, criterion_analyses, layer_analyses, cross_layer_integration, symbolic_audit, reader_experience, revision_plan, releasability, acceptance_checks, calibration_notes, repo_summary, manuscript_integrity_issues |
| **Ownership** | RG-owned (system-generated comprehensive analysis) |
| **Quality gates** | `validateDreamDocument()` — checks all 16 sections present and non-empty |
| **Mutation points** | Synthesis of entire evaluation + manuscript into narrative document (MASSIVE MUTATION — single LLM call, 24K token output) |
| **Malformed text entry?** | YES — highest risk stage in pipeline |

#### Short-form difference
**Short-form has NO equivalent.** DREAM synthesis is long-form only (≥25,000 words). The document is produced by an async worker (`process-dream`) that:
1. Runs on a 2-minute cron cycle
2. Queries for completed long-form jobs without a `longform_document_v1` artifact
3. Loads manuscript chunks + evaluation result
4. Fires a single large LLM call (24K output tokens, GPT-5 / GPT-5.1)
5. Validates and persists the 16-section document

#### Critical failure modes
- **800s Vercel timeout**: Full-novel DREAM synthesis can take 3–8 minutes
- **JSON boundary error**: 24K token output must be valid JSON; truncation produces `JsonBoundaryError`
- **Section omission**: LLM might produce 15/16 sections (missing one) — `validateDreamDocument()` catches this
- **Stub artifacts**: Previously, failed synthesis wrote `{ _skipped: true }` stubs that blocked retry. Self-healing logic now detects and clears these.
- **Decoupled failure**: DREAM failure does NOT fail the base evaluation. The job is `complete` without DREAM. This means:
  - User sees webpage/PDF without DREAM sections
  - DREAM sections appear later when worker succeeds
  - **Gap**: No notification to user when DREAM is ready post-initial load

#### Missing gates
- No prose quality check on DREAM narrative sections (executive_verdict, revision_plan actions are raw LLM prose)
- No cross-reference validation between DREAM document and base evaluation (e.g., DREAM says score is X but base evaluation says Y)
- No confidence calibration check (DREAM `dream_scores` vs base criterion confidences)

---

### DIVERGENCE 9: Downloads — Multi-Layer Rendering

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S11_RENDERER` / `S11b_DOWNLOAD_PIPELINE` |
| **Runtime code** | `lib/evaluation/unifiedEvaluationDocument.ts`, `lib/evaluation/downloadReadTimeSanitizer.ts` |
| **Input** | `evaluation_result_v2` + `longform_document_v1` (if exists) |
| **Output** | Webpage, PDF, DOCX, TXT — each includes both base evaluation AND DREAM sections (if available) |
| **Quality gates** | `sanitizeForDownload()` → parity gate → format-specific renderer |
| **Mutation points** | Canonical artifact → format-specific rendering (formatting mutation; content must not change) |
| **Malformed text entry?** | SHOULD BE NO — but rendering bugs can truncate or mismatch |

#### Short-form difference
Short-form renders:
- 13 criteria scores + rationales
- Recommendations (max ~14)
- Executive summary, strengths, risks
- Confidence badges

Long-form renders ALL of the above PLUS:
- DREAM 16-section document (if available)
- Story Layer visualization (layer-by-layer analysis)
- Structural stack chart
- Arc map
- Revision plan with prioritized actions
- Releasability dimension table

#### Long-form-specific rendering risks
- **DREAM absent at render time**: User requests PDF before async DREAM worker finishes → PDF has no DREAM sections. Subsequent download includes DREAM. **Content drift between download attempts.**
- **Section ordering divergence**: Webpage may render DREAM sections inline; PDF may put them in appendix. No canonical ordering contract exists.
- **Multi-layer contamination**: If multiple story layers are rendered simultaneously, one layer's analysis text could bleed into another layer's section.

---

### DIVERGENCE 10: Revise Queue → WAVE Revision Pipeline

| Field | Value |
|-------|-------|
| **Canon ref** | docs/WAVE_REVISION_GUIDE_CANON.md, SIPOC `S12_REVISE_QUEUE` |
| **Runtime code** | `lib/revision/reviseAdmissionGate.ts`, `lib/revision/run-revision-pipeline.ts`, `lib/revision/governance/wave-eligibility.ts` |
| **Input** | Completed evaluation with recommendations → Revise Queue candidates |
| **Output** | WAVE-informed revision suggestions with scene-level patches |
| **Schema** | `PipelineInput` → `PipelineOutput` (runId, status, wavesExecuted, patches, governanceLogs) |
| **Ownership** | Split: recommendations are RG-owned; revision patches modify author text |
| **Quality gates** | Revise Admission Gate, Sufficiency Gate, Wave Eligibility, Destruction Guards, Patch Integrity |
| **Mutation points** | Recommendation → revision patch applied to author's manuscript (HIGHEST-STAKES MUTATION) |
| **Malformed text entry?** | YES — malformed recommendations produce malformed revision patches |

#### Short-form difference
Short-form Revise: standard admission gate → candidate generation → workbench display
Long-form Revise: adds WAVE orchestration with 60-wave governance stack:

1. **Sufficiency Gate**: Can the system revise this scene? (mode + scene type check)
2. **Wave Eligibility**: Per-wave `checkWaveEligibility()` — is this wave's failure mode present?
3. **Destruction Guards**: Pre-execution `checkDestructionGuards()` — would this patch destroy protected text?
4. **Patch Integrity**: Post-execution `checkPatchIntegrity()` — does the patch meet quality bar?

#### WAVE-specific failure modes
- **Wave ordering violation**: Early waves (structural truth) must pass before mid waves (momentum). If wave-01 blocks, wave-15 (pacing) should also block — but current code only blocks within tier.
- **Protected span violation**: Author-locked text (CHARACTER_IDENTITY, CLASS_SIGNAL, TONAL_ANCHOR, DOCTRINAL_LANGUAGE, USER_LOCKED_TEXT) must NEVER be modified by any wave.
- **Vignette escalation**: A VIGNETTE scene type must never be escalated to FULL_REWRITE mode.
- **Layer contamination**: HUMAN-layer scene must never gain REALM voice through revision.

#### Long-form WAVE handoff weak seam
The Revise Queue receives recommendations from the base evaluation. For long-form, these recommendations were:
1. Generated per-chunk (with potential chunk boundary artifacts)
2. Aggregated in Pass 3 (with potential deduplication errors)
3. Filtered by recommendation integrity gate (PR #1044)
4. Displayed in Revise Queue with Workbench cards

The WAVE pipeline then takes these cards and generates scene-level patches. If a recommendation references "this passage" without a proper `anchor_snippet`, the WAVE patch has no target — it must guess where to apply. This is the **dangling reference → WAVE failure** chain that orphaned conjunctions check (PR #1050) aims to prevent at source.

---

## LONG-FORM FAILURE TAXONOMY

### Where malformed text can ENTER (long-form only)

1. **Phase 0.5A seed generation** — LLM produces garbled layer entries (structurally valid, semantically garbage)
2. **Per-chunk Pass 1/2** — each chunk is independent LLM call; chunk boundary splits mid-sentence
3. **Pass 3 aggregation** — deduplication/merging logic can stitch incompatible recommendation fragments
4. **Pass 3B DREAM synthesis** — 24K token output with 16 mandatory sections; single largest LLM call in system
5. **WAVE patch generation** — revision patches based on potentially-garbled recommendations

### Where malformed text can SURVIVE (long-form only)

1. **Review Gate** — checks structural validity, NOT semantic quality. Garbage ledger can be user-approved.
2. **Accepted Story Ledger → Pass2a** — empty ledger (`layers: {}`) passes through if extraction failed (PR #1045)
3. **Chunk aggregation** — no per-chunk handoff gate; chunk-level garbage flows to synthesis
4. **DREAM validation** — checks section presence but not prose quality within sections
5. **WAVE sufficiency gate** — checks mode/type constraints but not recommendation quality feeding in

### Where malformed text can be RENDERED (long-form only)

1. **DREAM sections in PDF/DOCX/TXT** — no read-time sanitizer for DREAM narrative fields
2. **Multi-layer rendering** — layer contamination if rendering logic mixes layer namespaces
3. **Revision patches** — if applied, malformed patches become part of the author's manuscript
4. **Temporal rendering gap** — PDF generated before DREAM ≠ PDF generated after DREAM

---

## CANON GAPS SPECIFIC TO LONG-FORM

| Gap | Impact | Recommended Fix |
|-----|--------|----------------|
| No prose quality check on Phase 0.5A seed entries | Garbled layer entries flow to Review Gate | Add seed prose-quality gate (analogous to S06b) |
| No per-chunk S06b handoff gate | Per-chunk garbage flows directly to aggregation | Run S06b per-chunk before aggregation |
| No DREAM prose quality validation | DREAM narrative sections can contain garbled prose | Add DREAM-specific prose gate (7 checks from S06b) |
| No rendering order contract for DREAM + base | PDF ordering can differ between downloads | Define canonical rendering order in canon |
| No notification when DREAM completes post-initial-load | User may never see their DREAM document | Add user notification on DREAM artifact creation |
| Review Gate has no semantic quality floor | User can approve garbage ledger | Add system-side minimum quality before user approval |
| No chunk boundary detection | Sentences split at chunk edge produce fragments | Add chunk-overlap or sentence-boundary-aware splitting |
| WAVE doesn't validate input recommendation quality | Garbage recs → garbage patches | Add WAVE input quality check (admission gate has partial coverage) |
| Long-Form Pipeline Success Contract Clause 5 (Pass 3 timeout) doesn't cover DREAM | DREAM timeout is silent | Add DREAM-specific success clause |

---

## GOVERNANCE DOCTRINE: LONG-FORM OPERATING RULES

Based on findings above, proposed operating rules for long-form:

1. **RULE LF-1**: No empty Story Layer may pass the Review Gate. `layers: {}` is a hard fail regardless of structural validation.
2. **RULE LF-2**: The S06b Handoff Gate MUST run per-chunk (not just on aggregated output) to prevent chunk-level garbage from reaching synthesis.
3. **RULE LF-3**: DREAM document narrative fields (executive_verdict, revision_plan.actions, all string prose) MUST pass the same 7 prose-quality checks as base evaluation recommendations.
4. **RULE LF-4**: WAVE revision pipeline MUST NOT execute against recommendations that failed the recommendation integrity gate (PR #1044). Only `tier_accepted` or `tier_strong` recommendations may enter WAVE.
5. **RULE LF-5**: A long-form download MUST either include DREAM sections OR explicitly state "DREAM analysis pending" — never silently omit.
6. **RULE LF-6**: The canonical rendering order for long-form documents is: base evaluation → DREAM sections → Revise Queue cards. No platform may reorder without canon amendment.
7. **RULE LF-7**: Chunk boundary logic MUST preserve sentence boundaries. No chunk may begin or end mid-sentence.

---

## SELF-CORRECTION APPLICABILITY (Long-Form)

The Self-Correction Policy (PR #1051) applies at these long-form-specific points:

| Stage | Failure Code | Retry? | Fail-Closed? |
|-------|-------------|--------|--------------|
| Phase 0.5A seed | `LEDGER_SEED_QUALITY_FAILURE` | YES — 1 retry with explicit failure reason | YES — empty seed is hard block |
| Per-chunk Pass 1/2 | `HANDOFF_*` codes (7 checks) | YES — 1 retry per chunk | YES — chunk failures reduce coverage |
| Pass 3 aggregation | `PASS3_SYNTHESIS_FAILURE` | YES — 1 retry with full context | YES — no partial synthesis |
| Pass 3B DREAM | `DREAM_VALIDATION_FAILURE` | YES — 1 retry (self-healing stub logic) | NO — DREAM failure is non-fatal to base |
| WAVE patch | `PATCH_VALIDATION_BLOCK` | NO — patches are one-shot | YES — bad patch is never applied |

---

## COMPARISON: Short-Form vs Long-Form Gate Coverage

| Quality Gate | Short-Form | Long-Form | Gap? |
|-------------|-----------|-----------|------|
| Input validation (submission) | ✅ | ✅ | — |
| Phase 0 governance warmup | ✅ | ✅ | — |
| Seed quality check | N/A | ❌ **MISSING** | YES — need seed prose gate |
| Story Layer extraction | Advisory | Governed (blocking) | — |
| Review Gate | Bypassed | ✅ User-facing | — |
| Accepted ledger validation | N/A | ⚠️ Structural only | WEAK — need semantic floor |
| Per-chunk handoff gate (S06b) | N/A | ❌ **MISSING** | YES — S06b only runs on aggregate |
| Pass 1/2 handoff gate (S06b) | ✅ | ✅ (on aggregate) | — |
| Recommendation integrity gate | ✅ | ✅ | — |
| Quality Gate V2 | ✅ | ✅ | — |
| DREAM prose quality | N/A | ❌ **MISSING** | YES — need DREAM prose gate |
| Download sanitizer | ✅ | ✅ | — |
| Parity gate | ✅ | ✅ | — |
| WAVE input quality | N/A | ⚠️ Partial (admission gate) | WEAK — need full rec quality check |

---

## PRIORITY ORDER FOR LONG-FORM HARDENING

1. **P0**: Per-chunk S06b handoff gate — prevent per-chunk garbled output from reaching aggregation
2. **P0**: Seed prose-quality gate — prevent garbled Phase 0.5A entries from entering the system
3. **P1**: DREAM narrative prose gate — apply 7 S06b checks to DREAM free-text fields
4. **P1**: Review Gate semantic floor — system-side minimum before user approval
5. **P2**: Chunk boundary sentence preservation — eliminate chunk-edge sentence fragments
6. **P2**: DREAM completion notification — alert user when async DREAM finishes
7. **P3**: Rendering order canon — formalize long-form document section ordering
8. **P3**: WAVE input quality gate — only `tier_accepted`+ recs enter WAVE

---

## APPENDIX: File Reference Map

| Component | File | Purpose |
|-----------|------|---------|
| Mode routing | `lib/evaluation/modeRouting.ts` | Word-count → mode decision |
| Full-context ledger seed | `lib/evaluation/seed/fullContextStoryLedger.ts` | Phase 0.5A |
| Story Layer extraction | `lib/evaluation/phase1a/extractStoryLayers.ts` | Phase 1A |
| Story Layer from ledger | `lib/evaluation/phase1a/buildStoryLayerFromLedger.ts` | Phase 1A |
| Ledger quality report | `lib/evaluation/phase1a/buildLedgerQualityReport.ts` | Phase 0.5B |
| Review Gate handoff | `lib/evaluation/phase-architecture-v2/reviewGateHandoff.ts` | Review Gate |
| Gate validity | `lib/evaluation/phase-architecture-v2/gateValidity.ts` | Review Gate |
| Containment mode | `lib/evaluation/reviewGate/containmentMode.ts` | Review Gate timeout |
| Semantic gate | `lib/evaluation/reviewGate/semanticGate.ts` | Ledger semantic check |
| Pass2a structured context | `lib/evaluation/pipeline/buildPass2aStructuredContext.ts` | Accepted ledger → context |
| Ledger approval normalizer | `lib/evaluation/review-gate/storyLedgerApprovalNormalizer.ts` | Ledger format normalization |
| Main pipeline | `lib/evaluation/pipeline/runPipeline.ts` | Orchestrator (Pass 1→2→3→QG) |
| Pass 3 synthesis | `lib/evaluation/pipeline/runPass3Synthesis.ts` | Chunk aggregation + synthesis |
| Pass 3B DREAM | `lib/evaluation/pipeline/runPass3bLongform.ts` | DREAM document synthesis |
| DREAM worker | `app/api/workers/process-dream/route.ts` | Async DREAM cron worker |
| Quality Gate V2 | `lib/evaluation/pipeline/qualityGate.ts` | Post-synthesis validation |
| S06b Handoff Gate | `lib/evaluation/pipeline/pass12HandoffGate.ts` | Prose quality gate (PR #1050) |
| Recommendation integrity | `lib/evaluation/pipeline/recommendationIntegrityGate.ts` | PR #1044 |
| Download sanitizer | `lib/evaluation/downloadReadTimeSanitizer.ts` | Read-time evidence protection |
| Unified document | `lib/evaluation/unifiedEvaluationDocument.ts` | Canonical render model |
| Revise admission | `lib/revision/reviseAdmissionGate.ts` | Revise Queue entry gate |
| WAVE revision pipeline | `lib/revision/run-revision-pipeline.ts` | WAVE orchestrator |
| Wave eligibility | `lib/revision/governance/wave-eligibility.ts` | Per-wave eligibility |
| Destruction guards | `lib/revision/governance/destruction-guards.ts` | Protected span enforcement |
| Patch integrity | `lib/revision/governance/patch-integrity.ts` | Post-patch validation |
| Long-form success contract | `docs/governance/LONG_FORM_PIPELINE_SUCCESS_CONTRACT.md` | 12-clause success definition |
| Output mode contract | `docs/governance/evaluation-output-mode-contract.md` | Mode boundary definitions |
| WAVE canon | `docs/WAVE_REVISION_GUIDE_CANON.md` | WAVE revision authority |
