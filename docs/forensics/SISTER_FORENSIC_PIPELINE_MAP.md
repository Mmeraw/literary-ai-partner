# Sister Forensic Pipeline Map — End-to-End Manuscript Trace

**Status:** Living document — first draft  
**Subject:** Sister evaluation (job `0fea6d6c-d971-4398-8f58-d50b93255060`)  
**Purpose:** Trace one manuscript through every pipeline stage. For each stage: input artifact, output artifact, quality gates, mutation points, ownership, schema. Then identify every place where malformed text can enter, survive, or be rendered.

**Authority chain:** Canon (Volumes I–VII) > SIPOC > Spec docs > Runtime code > Telemetry

---

## STAGE 0: SUBMISSION

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S01_INTAKE`, Volume III §2 |
| **Runtime code** | `app/api/jobs/route.ts`, `app/api/evaluate/route.ts` |
| **Input** | User uploads manuscript (text), selects evaluation type |
| **Output** | Job row with `status=queued`, `manuscript_id`, `job_type` |
| **Schema** | `manuscript_text` or `manuscript_id`, `job_type` (canonical set only) |
| **Ownership** | Author-owned: manuscript text. RG-owned: job metadata. |
| **Quality gates** | Auth check (401), field validation (400), canonical `job_type` (400), size limit (413), rate limit (429) |
| **Mutation points** | NONE — manuscript text stored as-is |
| **Malformed text entry?** | NO — text is author's manuscript, not evaluated content |

### Canon gaps
- SIPOC certification: **Partial** — input validation strong but fixture coverage pending
- No canon doc addresses manuscript text normalization (encoding, whitespace, BOM stripping)

---

## STAGE 1: QUEUE + CLAIM (S02 + S03)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S02_QUEUE`, `S03_CLAIM` |
| **Runtime code** | `lib/jobs/store.ts`, `lib/jobs/jobStore.supabase.ts`, `lib/evaluation/processor.ts` |
| **Input** | Queued job row |
| **Output** | Claimed running job with active lease |
| **Quality gates** | Canonical status transitions only, atomic claim RPC, lease enforcement |
| **Mutation points** | NONE — job metadata only |
| **Malformed text entry?** | NO — no content processing here |

### Canon status: **Proven** (both stages)
### Canon gaps: None significant — these are the most mature stages

---

## STAGE 2: PHASE 0 — GOVERNANCE WARMUP (ADJACENT_PHASE_0)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `ADJACENT_PHASE_0`, Volume III §2, Phase Architecture v2 |
| **Runtime code** | `lib/evaluation/phase-architecture-v2/phase0AuthorityProof.ts`, `checklistMatrix.ts` |
| **Input** | Canon docs, benchmark manifests, governance docs, fail-closed rules |
| **Output** | `phase0_authority_proof_v1` — warmup context with authority paths, checksums, route selection |
| **Ownership** | RG-owned (system calibration) |
| **Quality gates** | All required docs loaded and checksummed, route selected, benchmark paths present |
| **Mutation points** | NONE — reads governance docs, doesn't touch manuscript |
| **Malformed text entry?** | NO — no manuscript content at this stage |

### Canon gaps
- SIPOC certification: **Emerging**
- Phase 0 does NOT evaluate manuscript content (canon is clear on this)
- Canon doctrine loaded here determines English variant, genre expectations — but **propagation to downstream prompts is the bug PR #1048 fixes**

### DOCTRINE vs CODE gap
- **Canon says:** "Phase 0 must complete before manuscript-reading tracks launch"
- **Code does:** Enforced via `checklistMatrix.ts` phase_0 row — **COMPLIANT**
- **Canon says:** English variant loaded here
- **Code does:** Stores `english_variant` in job metadata, but **prompts in Pass 2/3/3B may not interpolate it** — PR #1048 addresses this

---

## STAGE 3: PHASE 0.5A — STORY MAP SEED + EVALUATION SEED (ADJACENT_PHASE_0_5A)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `ADJACENT_PHASE_0_5A`, Phase Architecture v2 |
| **Runtime code** | `lib/evaluation/seed/seedScaffoldFactory.ts`, `seedCompletenessGuard.ts`, `twoPassSeedValidation.ts` |
| **Input** | Phase 0 authority proof + manuscript text |
| **Output** | `story_map_seed_v1`, `evaluation_seed_v1`, `full_context_story_ledger_v1` (9 layers) |
| **Ownership** | RG-generated from manuscript (seed = RG interpretation of author text) |
| **Quality gates** | Seed completeness guard, two-pass validation, format conformance |
| **Mutation points** | LLM generates seed content from manuscript — **first point where LLM-generated text enters pipeline** |
| **Malformed text entry?** | **YES** — LLM could generate malformed seed entities, garbled layer text. Seed completeness guard catches missing layers but NOT garbled content. |

### Canon gaps
- SIPOC certification: **Emerging**
- `full_context_story_ledger_v1` has 9 canonical layers — but canon doesn't define what "well-formed" layer *content* looks like beyond "present"
- No garbled-text gate on seed output — only structural completeness check
- **This is the FIRST place where LLM hallucination could enter the pipeline**

### DOCTRINE vs CODE gap
- **Canon says:** "Seed-as-baseline-authority — Phase 1A must treat seed entities as 95%+ quality baseline"
- **Code does:** `seedCompletenessGuard.ts` validates structure, `twoPassSeedValidation.ts` validates consistency — **but neither validates prose quality of seed content**
- **Missing gate:** No "seed content quality" gate — a garbled seed propagates downstream

---

## STAGE 4: PHASE 0.5B — EDITORIAL DREAM SEED (ADJACENT_PHASE_0_5B)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `ADJACENT_PHASE_0_5B`, Phase Architecture v2 |
| **Runtime code** | Revise opportunity seed module |
| **Input** | Phase 0 authority proof + manuscript + 13 criteria canon |
| **Output** | `editorial_dream_seed_v1` (non-fatal) |
| **Ownership** | RG-generated |
| **Quality gates** | Non-fatal — failure does not block Phase 1A |
| **Mutation points** | LLM generates editorial assessment |
| **Malformed text entry?** | **YES** — but non-fatal, so garbled dream seed is downgraded, not propagated as authority |

### Canon status: **Emerging** — this is the safest LLM stage because failure is tolerated

---

## STAGE 5: ROUTING / CHUNKING (S04)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S04_ROUTING_CHUNKING`, Phase Architecture v2 |
| **Runtime code** | `lib/manuscripts/chunking.ts`, `lib/evaluation/processor.ts` |
| **Input** | Manuscript text + routing metadata |
| **Output** | Chunk manifest with deterministic boundaries |
| **Ownership** | RG-computed (deterministic chunking of author text) |
| **Quality gates** | Deterministic chunk indices, non-empty chunk set, coverage threshold |
| **Mutation points** | Text is split but NOT modified — chunking is structural, not semantic |
| **Malformed text entry?** | NO — chunks are verbatim manuscript segments |

### Canon gaps
- SIPOC certification: **Emerging** — needs fixture/harness certification
- Canon says chunking must be deterministic — **code appears compliant**

---

## STAGE 6: PHASE 1A — STORY LAYER EXTRACTION (S05 / Track B)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S05_PASS1`, `ADJACENT_SEMANTIC_GATE`, Story Layer Contract V1 |
| **Runtime code** | `lib/evaluation/pipeline/runPass1.ts`, `lib/evaluation/phase1a/` |
| **Input** | Manuscript chunks + seed entities |
| **Output** | `pass1a_story_layer_v1` (9 layers), `ledger_quality_report_v1`, `pass1a_character_ledger_v1` |
| **Schema** | 9 canonical layers: `source_integrity`, `pov_structure`, `canonical_identity`, `cast_role_tier`, `identity_pronoun`, `relationship_network`, `object_symbol`, `location_timeline_worldstate`, `threat_antagonist_ending` |
| **Ownership** | RG-generated (extracted from author's manuscript via LLM) |
| **Quality gates** | Story Layer Quality Gate (`ADJACENT_SEMANTIC_GATE`): per-layer classification, benchmark comparison, entity contamination filter |
| **Mutation points** | LLM extracts story understanding from manuscript — **major LLM content generation point** |
| **Malformed text entry?** | **YES** — LLM could generate garbled layer content, pseudo-entities, contaminated extractions |

### Canon gaps
- SIPOC says: "Entity-typing contamination suppressed before accountability checks" — **code has this: entity contamination filter active**
- SIPOC says: "Raw malformed layer NOT rendered" — **code has this: quality report blocks malformed layers**
- **KNOWN BUG (PR #1045):** Short-form auto-approval path checks `storyLayerPayload.layers` but `buildStoryLayerFromLedger()` returns flat object without `.layers` wrapper → layer starvation (128k chars of diagnostic material lost)

### DOCTRINE vs CODE gap
- **Canon says:** "pass1a_story_layer_v1 contains exactly nine story layers and nothing else" (Story Layer Contract V1)
- **Code does:** `buildStoryLayerFromLedger()` returns flat 9-key object — BUT code checking for `.layers` expects wrapped format. **PR #1045 adds `extractStoryLayers()` to handle both shapes.**
- **This is the root cause of story-layer starvation for short-form evals since PR #890**

---

## STAGE 7: PASS 3A PREFLIGHT SCOUT (Track C, parallel)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `ADJACENT_PASS_3A`, Phase Architecture v2 |
| **Runtime code** | MAP/AGG/REDUCE in processor.ts |
| **Input** | Manuscript chunks (independent of Phase 1A) |
| **Output** | `pass3_preflight_draft_v1` |
| **Quality gates** | MAP completion required before REDUCE, terminal-and-gate-valid states only |
| **Mutation points** | LLM generates preflight observations |
| **Malformed text entry?** | **YES** — but preflight is supplementary evidence, not primary authority. Degraded/failed states are tolerated (kick-forward). |

### Canon gaps
- Degraded preflight propagates as lower-confidence evidence — no garbled-text check on preflight content itself

---

## STAGE 8: REVIEW GATE (ADJACENT_REVIEW_GATE)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `ADJACENT_REVIEW_GATE`, Story Layer Contract V1 |
| **Runtime code** | `lib/evaluation/processor.ts` (Review Gate handler), `lib/evaluation/review-gate/storyLedgerApprovalNormalizer.ts` |
| **Input** | `pass1a_story_layer_v1` + `ledger_quality_report_v1` + author decisions |
| **Output** | `accepted_story_ledger_v1` |
| **Quality gates** | All visible layers reviewed, invalid status vocabulary rejected, failed layers excluded |
| **Mutation points** | Approval Normalizer transforms reviewed layers into accepted ledger — **shape transformation point** |
| **Malformed text entry?** | **CONDITIONAL** — short-form bypass means no human review. For short-form: Phase 0.5A seed quality IS the only authority. For long-form: human review catches garbled layers. |

### CRITICAL: Short-form bypass path
- **Canon says:** "Short-form jobs (<25k words) bypass Review Gate"
- **Code does:** Short-form auto-approval creates `accepted_story_ledger_v1` directly from `pass1a_story_layer_v1`
- **Risk:** If Phase 1A produces garbled layers for short-form, they go straight to Phase 2 without human review
- **This is exactly where PR #1045's bug lives** — the auto-approval path couldn't even READ the layers correctly

---

## STAGE 9: PHASE 2 — PASS 1 (STRUCTURAL) + PASS 2 (EDITORIAL) (S05 + S06)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S05_PASS1`, `S06_PASS2`, Volume III §4-5 |
| **Runtime code** | `lib/evaluation/pipeline/runPass1.ts`, `runPass2.ts`, `pass2IndependenceGuard.ts` |
| **Input** | Manuscript chunks + `accepted_story_ledger_v1` (long-form) or seed-only (short-form) |
| **Output** | `pass1_chunk_cache_v1`, `pass2_chunk_cache_v1`, `pass12_handoff_v1` |
| **Schema** | Per-chunk structural/editorial results, aggregated handoff |
| **Ownership** | RG-generated (LLM evaluation of author's manuscript) |
| **Quality gates** | Pass independence guard (Pass 2 cannot consume Pass 1 output), timeout budgets |
| **Mutation points** | **TWO LLM calls generating evaluation text** — criteria analysis, evidence collection, diagnostic findings |
| **Malformed text entry?** | **YES — THIS IS THE HIGHEST-RISK LLM GENERATION POINT** |

### Why this is high-risk
- Pass 1 + Pass 2 generate the **raw criteria analysis** that becomes recommendations
- If LLM produces garbled text here ("can nonetheless, many high-stakes beats…"), it flows to Pass 3
- No **prose quality gate** exists between Pass 2 output and Pass 3 input
- Independence guard checks for Pass 1/2 cross-contamination but NOT for garbled text

### Canon gaps
- SIPOC certification: **Partial** — independence checks exist but adversarial certification pending
- Volume III says "Each criterion must include: Structural Finding, Evidence, Structural Impact, Judgment" — but no gate validates these are well-formed sentences
- **MISSING GATE: No sentence-completeness check on Pass 1/2 output**

### DOCTRINE vs CODE gap
- **Canon says (III.P1.4):** "MUST NOT speculate, generalize, produce generic critique"
- **Code does:** `QG_EDITORIAL_GENERIC_FEEDBACK` catches generic feedback in QualityGateV2 — but this runs AFTER Pass 3, not between Pass 2 and Pass 3
- **The generic/garbled text has already been synthesized before any gate catches it**

---

## STAGE 10: PHASE 3 — PASS 3 SYNTHESIS (S07)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S07_PASS3`, Volume III §6 |
| **Runtime code** | `lib/evaluation/pipeline/runPass3Synthesis.ts` |
| **Input** | `pass12_handoff_v1` (certified Pass 1 + Pass 2 outputs) |
| **Output** | Synthesis object (criteria, recommendations, overview) |
| **Schema** | Per-criterion: score, rationale, recommendations (action, specific_fix, anchor, evidence) |
| **Ownership** | RG-generated (LLM convergence of Pass 1 + Pass 2) |
| **Quality gates** | SIPOC says "criteria/recommendation structure survives deterministic checks" |
| **Mutation points** | **THIRD AND FINAL LLM CALL** — synthesizes evaluation into author-facing text |
| **Malformed text entry?** | **YES — THIS IS WHERE MALFORMED RECOMMENDATIONS ARE BORN** |

### Why this is the critical stage
- Pass 3 takes Pass 1+2 raw analysis and produces **the text authors read**
- If Pass 1/2 fed garbled analysis, Pass 3 LLM tries to synthesize garbled input → garbled output
- Even if Pass 1/2 were clean, the Pass 3 LLM can independently generate malformed text
- **"can nonetheless, many high-stakes beats…"** — this is a Pass 3 synthesis failure

### What PR #1044 adds here
- `recommendationIntegrityGate.ts` validates **after parsing** but **before persistence**
- `runPass3Synthesis.ts` filters FAIL-tier recs after `parsePass3Response()`
- This is the first gate that checks **prose quality** of individual recommendations
- Scores: character named, scene referenced, quoted anchor, decision identified, consequence identified, reader effect explained, theme connected
- Penalties: generic workshop language (-2), missing anchor (-1 to -3)
- **FAIL tier (0-2 points) → quarantined — never reaches author**

### Canon gaps
- SIPOC certification: **High-risk** — upstream of highest-risk seam
- SIPOC says "synthesis object present" and "criteria/recommendation structure survives deterministic checks" — but does NOT define what "deterministic checks" on prose quality look like
- **Canon needs updating:** Add recommendation integrity gate to SIPOC `S07_PASS3` output acceptance metrics

---

## STAGE 11: ER2 NORMALIZATION (S08)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S08_ER2_NORMALIZATION` |
| **Runtime code** | `runPipeline.ts` (`synthesisToEvaluationResultV2`), `schemas/evaluation-result-v2.ts` |
| **Input** | Pass 3 synthesis output |
| **Output** | `EvaluationResultV2` (normalized criteria, governance/transparency fields) |
| **Quality gates** | Score/null separation, criteria count/shape coherence, canonical key preservation |
| **Mutation points** | Schema normalization — restructures synthesis output into canonical shape |
| **Malformed text entry?** | **PASS-THROUGH** — text content is not validated here, only schema shape |

### Canon gaps
- SIPOC certification: **High-risk**
- Normalization preserves whatever text Pass 3 produced — malformed recs pass through unchanged
- **MISSING: No text quality check at normalization boundary**
- Canon says "score and null never collapse" — code enforces this. But canon says nothing about text quality at this boundary.

---

## STAGE 12: QUALITY GATE V2 (S09)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S09_QUALITYGATEV2`, Volume III §8 |
| **Runtime code** | `lib/evaluation/pipeline/qualityGate.ts` |
| **Input** | `EvaluationResultV2` + synthesis diagnostics |
| **Output** | Pass/fail gate decision + diagnostics |
| **Quality gates** | ~20 deterministic checks including generic rec, duplicate rec, short/long rec, thin rationale, placeholder rationale, independence violation, editorial generic feedback, criteria scope shape mismatch |
| **Mutation points** | NONE — read-only gate, does not modify content |
| **Malformed text entry?** | **DETECTION POINT** — but current checks focus on LENGTH and PATTERN, not PROSE QUALITY |

### What QualityGateV2 catches
- `QG_GENERIC_REC` — generic recommendation language
- `QG_SHORT_REC` / `QG_LONG_REC` — length bounds
- `QG_THIN_RATIONALE` / `QG_PLACEHOLDER_RATIONALE` — weak rationale
- `QG_EDITORIAL_GENERIC_FEEDBACK` — editorial boilerplate
- `QG_INDEPENDENCE_VIOLATION` — Pass 1/2 cross-contamination

### What QualityGateV2 MISSES
- **Garbled sentences** ("can nonetheless, many high-stakes beats…") — not caught by pattern matching
- **Sentence completeness** — no check that recommendations are grammatically complete
- **Semantic coherence** — no check that a recommendation makes sense as advice
- **PR #1044 adds Check 4b** as defense-in-depth: calls `checkRecommendationIntegrity()` and warns if FAIL-tier recs survived to this point (they shouldn't, because Pass 3 now quarantines them)

### DOCTRINE vs CODE gap
- **Canon says (SIPOC Doctrine #9):** "Deterministic gates may not be bypassed by heuristic confidence"
- **Code does:** Gate is deterministic — all checks are pattern/length/count based. **COMPLIANT.**
- **But:** The gate cannot detect garbled prose because it uses structural checks, not semantic ones
- **Canon update needed:** SIPOC `S09_QUALITYGATEV2` output acceptance metrics should include "recommendation prose completeness check"

---

## STAGE 13: PERSISTENCE (S10)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S10_PERSISTENCE` |
| **Runtime code** | `lib/evaluation/persistEvaluationResultV2.ts` |
| **Input** | Quality-gate-passed `EvaluationResultV2` |
| **Output** | Persisted artifact row in `evaluation_artifacts` + terminal job status |
| **Quality gates** | No persist if gate fails, atomic persistence function |
| **Mutation points** | NONE — writes result as-is |
| **Malformed text entry?** | **PERSISTENCE POINT** — once written, malformed text is permanently stored |

### Canon gaps
- SIPOC certification: **Partial**
- **Canon says (Doctrine #2):** "No artifact persists after failed deterministic gate" — **code enforces this**
- But if the gate PASSES with malformed text inside, the malformed text is now permanently stored

---

## STAGE 14: RENDERER — WEBPAGE (S11 partial)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S11_RENDERER` |
| **Runtime code** | `app/evaluate/[jobId]/page.tsx` |
| **Input** | Persisted artifact from `evaluation_artifacts` |
| **Output** | React-rendered evaluation webpage |
| **Quality gates** | Ownership/auth check, release gate |
| **Mutation points** | `sanitizeResultForDownload()` (line 650) → cleans forbidden patterns in editorial text |
| **Ownership boundary** | Author-owned: `anchor_snippet`, `evidence_snippets` (manuscript quotes). RG-owned: all editorial fields. |
| **Malformed text entry?** | **RENDERING POINT** — malformed text that survived all gates is now visible to the author |

### What the sanitizer touches (webpage path)
- `criteria[*].recommendations[*].action` — editorial
- `criteria[*].recommendations[*].specific_fix` — editorial
- `criteria[*].rationale` — editorial
- `overview.one_paragraph_summary` — editorial
- Does NOT touch `anchor_snippet` or `evidence_snippets` — **PR #1047 governance fix**

### KNOWN BUG: Confidence badge drift
- Webpage shows "High Confidence" for 4 criteria the canonical model classifies as "Moderate Confidence"
- React component reads different confidence field or applies different threshold than `buildUnifiedEvaluationDocument()`
- Downloads are correct; webpage is wrong

### Canon gaps
- SIPOC certification: **Emerging**
- SIPOC says "no fabricated progress" — but doesn't mention sanitization
- **Canon does not address read-time sanitization at all** — this entire subsystem is undocumented in canon

---

## STAGE 15: RENDERER — DOWNLOAD (PDF / DOCX / TXT)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `S11_RENDERER` (same stage ID — **canon doesn't distinguish download from webpage**) |
| **Runtime code** | `app/api/reports/[jobId]/download/route.ts` |
| **Input** | Persisted artifact from `evaluation_artifacts` |
| **Output** | PDF (via Chromium HTML), DOCX (docx library), TXT (VM renderer) |
| **Processing chain** | `artifact` → `buildUnifiedEvaluationDocument()` → `normalizeEvaluationReportViewModel()` → `renderTxtFromViewModel()` / `renderHtmlFromViewModel()` / `renderDocxFromViewModel()` |
| **Quality gates** | Render parity gate — checks field presence across VM-rendered outputs |
| **Mutation points** | ViewModel boundary normalizes author-facing editorial text; renderers format only |
| **Ownership boundary** | Same as webpage — author text preserved, editorial text sanitized |

### What the download pipeline does
1. `buildUnifiedEvaluationDocument()` — builds the Certified UED (same persistence artifact family as webpage)
2. `normalizeEvaluationReportViewModel()` — owns author-facing presentation text and scope-language normalization
3. Format-specific renderer: `renderTxtFromViewModel()`, `renderHtmlFromViewModel()` → PDF, `renderDocxFromViewModel()`
4. Render parity verification confirms required field presence across PDF/DOCX/TXT.

### Canon gaps — THIS IS THE BIGGEST CANON GAP
- **SIPOC does not mention the download pipeline at all**
- No stage ID for the download pipeline (it's lumped into `S11_RENDERER`)
- No input/output acceptance metrics for downloads
- No parity gate mentioned in canon
- No read-time sanitizer mentioned in canon
- **Canon update needed:** Split `S11_RENDERER` into `S11a_WEBPAGE_RENDERER` and `S11b_DOWNLOAD_RENDERER`, or add download-specific acceptance metrics

### Legacy renderer cleanup status
- Legacy UED-consuming canonical-template renderers and the old DOCX dead-code block were removed in PR #1183.
- `renderPremiumReportHtml` remains only as a separate premium report helper/test surface, not as the S11b VM download renderer.

---

## STAGE 16: REVISE QUEUE (ADJACENT_REVISION_LEDGER + ADJACENT_REVISE)

| Field | Value |
|-------|-------|
| **Canon ref** | SIPOC `ADJACENT_REVISION_LEDGER`, `ADJACENT_REVISE` |
| **Runtime code** | `lib/evaluation/processor.ts` (revision opportunity ledger assembly) |
| **Input** | `evaluation_result_v2` + diagnostic findings + accepted story ledger |
| **Output** | `revision_opportunity_ledger_v1` → Populated Revise Queue |
| **Quality gates** | Every opportunity needs evidence anchor, specific source target, operation. A/B/C options must be actual prose. |
| **Mutation points** | LLM generates A/B/C repair options — **another LLM content generation point** |
| **Malformed text entry?** | **YES** — if recommendations were garbled in the evaluation, they contaminate the revision ledger |

### Canon gaps
- SIPOC certification: **Emerging** (both stages)
- SIPOC has the most detailed contract of any stage — but no code enforcement tests exist
- `REVISE_ABC_NOT_PROSE` failure code defined but enforcement status unknown
- **PR #1044's revise admission gate** (`reviseAdmissionGate.ts`) requires `PASS_STRONG+` for workbench cards — this is the first enforcement

---

## CROSS-CUTTING ANALYSIS

### Where Malformed Text Can ENTER the Pipeline

| Entry Point | Stage | What Generates It | Current Gate |
|-------------|-------|-------------------|--------------|
| Seed generation | Phase 0.5A | LLM generates seed entities/layers | Completeness guard (structural only) |
| Story layer extraction | Phase 1A | LLM extracts story understanding | Quality gate (structural + entity contamination) |
| Pass 3A preflight | Track C | LLM generates preflight observations | Degraded state tolerance |
| Pass 1 structural analysis | Phase 2 | LLM evaluates manuscript structure | Timeout budget only |
| Pass 2 editorial analysis | Phase 2 | LLM evaluates manuscript editorially | Independence guard + timeout only |
| Pass 3 synthesis | Phase 3 | LLM synthesizes evaluation | **PR #1044: Recommendation Integrity Gate** |
| A/B/C repair options | Revise Queue | LLM generates repair prose | **PR #1044: Revise Admission Gate (PASS_STRONG+)** |

### Where Malformed Text Can SURVIVE Gates

| Survival Point | Stage | Why It Survives | Fix |
|----------------|-------|-----------------|-----|
| Pass 1/2 → Pass 3 handoff | S05/S06 → S07 | No prose quality check on handoff | **MISSING GATE** |
| Pass 3 → ER2 normalization | S07 → S08 | Normalization checks shape, not text | **PR #1044 adds pre-persistence quarantine** |
| QualityGateV2 | S09 | Pattern/length checks miss garbled prose | **PR #1044 adds Check 4b defense-in-depth** |
| Persistence | S10 | Gate-passed content is stored as-is | By design — but depends on upstream gates |

### Where Malformed Text Is RENDERED to Authors

| Render Point | Stage | What Sees It | Sanitizer? |
|--------------|-------|-------------|------------|
| Webpage | S11 (webpage) | React page.tsx | Yes — `sanitizeResultForDownload()` |
| PDF download | S11 (download) | Chromium → PDF | Yes — sanitizer + parity gate |
| DOCX download | S11 (download) | docx library | Yes — sanitizer + parity gate |
| TXT download | S11 (download) | Template builder | Yes — sanitizer + parity gate |
| Revise Queue workbench | ADJACENT_REVISE | Author workbench UI | **PR #1044: Admission gate** |

---

## CANON UPDATE REQUIREMENTS

### Documents needing updates

| Document | What Needs Adding | Priority |
|----------|-------------------|----------|
| **SIPOC `S07_PASS3`** | Add recommendation integrity gate to output acceptance metrics | P0 |
| **SIPOC `S09_QUALITYGATEV2`** | Add prose completeness check to gate specification | P1 |
| **SIPOC `S11_RENDERER`** | Split into webpage + download sub-stages, add download pipeline acceptance metrics | P0 |
| **SIPOC new stage** | Add `S11b_DOWNLOAD_PIPELINE` with sanitizer, parity gate, format renderer stages | P0 |
| **Volume III §6** | Add recommendation integrity gate to Pass 3 convergence specification | P1 |
| **DREAM Output Spec** | Add download format parity requirements | P1 |
| **Story Layer Contract V1** | Document the `extractStoryLayers()` shape normalization (PR #1045) | P1 |
| **Doctrine OPERATING_RULES** | Add "No malformed recommendation may reach the author" as explicit operating rule | P0 |
| **QUALITY_GATES_v1** | Add recommendation quality metrics (currently policy-only, no prose quality metrics) | P1 |

### Canon ↔ Canon conflicts

| Conflict | Documents | Resolution |
|----------|-----------|------------|
| "Pass 4" vs "QualityGateV2" | Volume III §8 vs SIPOC `S09_QUALITYGATEV2` | Standardize on `QualityGateV2` — Volume III already has mapping table but body text still says "Pass 4" |
| Renderer is one stage vs two paths | SIPOC `S11_RENDERER` | Webpage and download are architecturally unified but operationally distinct — canon should document both |
| Short-form bypass undocumented risk | SIPOC `ADJACENT_REVIEW_GATE` | Canon says short-form bypasses Review Gate — but doesn't address the reduced quality assurance this implies |

---

## SELF-CORRECTING SYSTEM DESIGN

The forensic trace reveals the pipeline needs three categories of self-correction:

### 1. Upstream Prevention (stop malformed text from entering)
- **Seed quality gate** — validate prose quality of seed content, not just structural completeness
- **Pass 1/2 output quality gate** — sentence completeness check on handoff payload
- **Pass 3 integrity gate** — **PR #1044 (ready to merge)**

### 2. Midstream Detection (catch malformed text before persistence)
- **QualityGateV2 prose check** — extend existing gate with sentence completeness patterns
- **ER2 normalization text check** — validate that text fields contain well-formed sentences
- **Pass 3 quarantine** — **PR #1044 (ready to merge)** — FAIL-tier recs never reach persistence

### 3. Downstream Cleanup (fix malformed text in persisted artifacts)
- **Read-time sanitizer** — **PR #1046 (merged)** — cleans known contamination patterns
- **Download parity gate** — **PR #1046 (merged)** — rejects artifacts that can't be cleaned
- **Evidence preservation** — **PR #1047 (merged)** — sanitizer doesn't touch manuscript quotes

### The self-correcting loop should be:

```
LLM generates text
    ↓
Upstream gate validates prose quality
    ↓ (if FAIL → quarantine, regenerate, or fail closed)
Midstream gate validates schema + quality
    ↓ (if FAIL → block persistence)
Persistence
    ↓
Read-time sanitizer cleans known patterns
    ↓
Parity gate validates cleanliness
    ↓ (if FAIL → block download)
Renderer
    ↓
Author sees clean output
```

**Current state:** Upstream prevention is mostly missing (PR #1044 adds the first real upstream gate). Midstream detection exists but checks shape, not prose. Downstream cleanup works but is a band-aid.

**Target state:** Every LLM output has a prose quality gate before it advances to the next stage. If a gate fails, the system either quarantines the bad output, retries the LLM call, or fails closed with a named failure code.
