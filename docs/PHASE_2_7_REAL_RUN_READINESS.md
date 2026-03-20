# PHASE 2.7 — Real-Run Readiness Audit

**Generated:** 2026-03-19T20:57:00-07:00 (MST)  
**Audited from:** GitHub `main` @ `fb08a42`  
**Scope:** `lib/evaluation/pipeline/` (9 files) + `tests/evaluation/pipeline/` (6 files) + `schemas/criteria-keys.ts`

---

## 1. What Exists Today (Scaffold Inventory)

### 1.1 Pipeline Architecture — SOLID

| Component | File | Status |
|---|---|---|
| Type contracts | `types.ts` | ✅ Complete — EvidenceAnchor, AxisCriterionResult, SinglePassOutput, SynthesizedCriterion, SynthesisOutput, QualityGateResult, PipelineResult |
| Pass 1 prompt | `prompts/pass1-craft.ts` | ✅ System prompt + user prompt builder |
| Pass 2 prompt | `prompts/pass2-editorial.ts` | ✅ System prompt + user prompt builder, independence enforced at type level |
| Pass 3 prompt | `prompts/pass3-synthesis.ts` | ✅ System prompt + user prompt builder |
| Pass 1 runner | `runPass1.ts` | ✅ DI-enabled, parser exported for unit testing |
| Pass 2 runner | `runPass2.ts` | ✅ DI-enabled, independence guarantee (no Pass 1 parameter) |
| Pass 3 runner | `runPass3Synthesis.ts` | ✅ DI-enabled, deterministic fallback for missing AI fields |
| Orchestrator | `runPipeline.ts` | ✅ Full 4-pass coordination + EvaluationResultV1 adapter |
| Quality Gate | `qualityGate.ts` | ✅ 8 deterministic checks, zero AI dependency |
| Criteria Registry | `schemas/criteria-keys.ts` | ✅ 13 canonical keys, metadata, governance contract |

### 1.2 Test Coverage — SOLID

| Suite | File | Tests |
|---|---|---|
| Pass 1 parser | `pass1.test.ts` | Parser validation, edge cases |
| Pass 2 parser | `pass2.test.ts` | Parser validation, independence |
| Pass 3 parser | `pass3.test.ts` | Reconciliation, delta logic |
| Pipeline E2E | `pipeline-e2e.test.ts` | Full orchestration via DI |
| Independence | `pipeline-independence.test.ts` | Cross-contamination detection |
| Quality Gate | `quality-gate.test.ts` | All 8 check types |
| **Total** | **6 suites** | **52/52 passing** |

### 1.3 Key Design Decisions Already Baked In

- **DI architecture**: Every runner accepts `_createCompletion` override → tests never call OpenAI
- **DI orchestrator**: `runPipeline` accepts `_runners` override → E2E tests inject fake pass runners
- **Parsers are pure functions**: `parsePass1Response()`, `parsePass2Response()`, `parsePass3Response()` — exported, deterministic, testable
- **Independence enforced at 3 levels**: (1) type signature, (2) orchestrator wiring, (3) quality gate n-gram check
- **Fail-closed pipeline**: Any pass failure → `PipelineResult.ok = false`, no partial artifacts
- **EvaluationResultV1 adapter**: `synthesisToEvaluationResult()` bridges pipeline output to existing downstream schemas

---

## 2. What's Missing for Real-Run (Gap Analysis)

### GAP 2.1 — No Logging / Observability Layer

**Current state:** Pipeline runs fire-and-forget. Raw LLM responses, parsed outputs, and quality gate results are returned but never persisted to disk or logged.

**What's needed for real-run:**
- A `runPipelineWithLogging()` wrapper (or flag in `RunPipelineOptions`) that writes:
  - `pass1_raw.json` — raw OpenAI response text
  - `pass1_parsed.json` — validated `SinglePassOutput`
  - `pass2_raw.json` / `pass2_parsed.json`
  - `pass3_raw.json` / `pass3_parsed.json`
  - `quality_gate.json` — full `QualityGateResult`
  - `pipeline_result.json` — final `PipelineResult`
- This becomes the **truth audit trail** referenced in the ChatGPT roadmap
- Output directory should be configurable (e.g., `outputDir: string` option)

**Complexity:** Low — wrapper function, ~50 lines. No architecture change needed.

### GAP 2.2 — No Real Manuscript Input Path

**Current state:** Pipeline entry point (`runPipeline`) accepts `manuscriptText: string`. But there's no code that:
- Reads a chapter from the database
- Reads a chapter from a file
- Provides a CLI/script entry point for ad-hoc real runs

**What's needed:**
- A **real-run script** (e.g., `scripts/real-run.ts`) that:
  1. Reads manuscript text from a file (e.g., `manuscripts/cartel-babies-ch1.txt`)
  2. Sets `OPENAI_API_KEY` from env
  3. Calls `runPipeline()` with logging enabled
  4. Writes all outputs to a timestamped directory
- Alternatively, a Codespace-runnable command: `npx tsx scripts/real-run.ts --input manuscripts/ch1.txt --title "Cartel Babies Ch1"`

**Complexity:** Low — script, ~40 lines. Pipeline already accepts string input.

### GAP 2.3 — Manuscript Text Truncation at 12,000 Characters

**Current state:**
- Pass 1 user prompt: `params.manuscriptText.substring(0, 12000)` (line 80, pass1-craft.ts)
- Pass 2 user prompt: `params.manuscriptText.substring(0, 12000)` (line 85, pass2-editorial.ts)
- Pass 3 user prompt: manuscript truncated to 4,000 chars, pass1/pass2 JSON to 6,000 chars each (lines 93-99, pass3-synthesis.ts)

**Impact:**
- 12,000 chars ≈ 2,000–2,500 words. If a chapter is 5,000+ words, the pipeline evaluates only the first half.
- This is acceptable for Phase 2.7 single-chunk validation, but must be documented.
- Pass 3 only sees 4,000 chars of manuscript for reference — adequate for synthesis but should be noted.

**Action needed:** Document the truncation limits in the real-run script output. Consider raising limits if using `gpt-4o` (128K context) instead of `gpt-4o-mini` (128K context — same window, but mini may produce lower quality on long inputs).

### GAP 2.4 — Model Hardcoded to `gpt-4o-mini`

**Current state:**
- Pass 1: `gpt-4o-mini` (line 18, runPass1.ts)
- Pass 2: `gpt-4o-mini` (line 20, runPass2.ts)
- Pass 3: `gpt-4o-mini` (line 19, runPass3Synthesis.ts)

**Impact:**
- `gpt-4o-mini` is cost-efficient for testing but may produce:
  - Vague criteria scoring (ChatGPT's concern #1)
  - Generic recommendations (ChatGPT's concern #2)
  - Weak synthesis reconciliation (ChatGPT's concern #3)
- For real-run calibration, consider `gpt-4o` or `gpt-4-turbo` on at least the first run to establish a quality ceiling.

**Action needed:** Make model configurable via `RunPipelineOptions` (e.g., `model?: string`). Default remains `gpt-4o-mini` for cost control; override per-run for calibration.

### GAP 2.5 — No Raw Response Capture in Runners

**Current state:** Runners parse the response immediately:
```typescript
const responseText = completion.choices[0]?.message?.content;
return parsePass1Response(responseText);
```
The raw `responseText` is consumed and never returned or logged.

**What's needed:** Each runner should return `{ parsed: SinglePassOutput, rawResponse: string }` (or the logging wrapper captures it). Without this, the `PHASE_2_7_REAL_RUN_01.md` deliverable can't show "Raw output" vs. "Parsed output" side by side.

**Complexity:** Low — change return type or add a logging hook in the wrapper.

### GAP 2.6 — No Token/Cost Tracking

**Current state:** No `usage` data is captured from OpenAI responses.

**What's needed for real-run:** At minimum, log `completion.usage.prompt_tokens`, `completion_tokens`, `total_tokens` per pass. This is critical for:
- Estimating per-chapter cost
- Scaling cost projections for multi-chunk (Phase 2.8)
- Identifying prompt bloat

**Complexity:** Low — OpenAI response already includes `usage`; just need to read it.

### GAP 2.7 — Prompt Specificity Weaknesses (Pre-diagnosis)

These are NOT code bugs — they're prompt tuning targets that will surface during real runs:

| Prompt | Weakness | Expected Symptom |
|---|---|---|
| Pass 1 system | Criteria list is keys only (`concept`, `narrativeDrive`, etc.) — no human-readable descriptions passed to the model | LLM must guess what "concept" means; may misinterpret scope |
| Pass 1 system | Craft axis guidance is general ("structural integrity," "prose control") — no examples of what good/bad looks like | Vague rationale, score compression (everything 5-7) |
| Pass 2 system | Same issue — criteria listed as keys, no semantic grounding | Inconsistent interpretation across runs |
| Pass 3 system | Score reconciliation rule is simplistic (average if delta ≤2, explain if >2) — no guidance on WHICH axis to weight | Synthesis may default to averaging everything |
| All prompts | No few-shot examples | LLM invents its own output style; inconsistent across runs |
| All prompts | No canon language enforcement | Outputs won't use RevisionGrade terminology (blur vs. multiplicity, authority confusion, etc.) |
| Pass 2 user | `substring(0, 12000)` with no overlap/context from rest of chapter | Judgments about pacing, closure, and narrative drive are unreliable on truncated text |

**Action needed:** This is ChatGPT's lane — prompt tuning after first real run provides evidence.

---

## 3. Recommended Implementation Order for Real-Run

### Step A: Real-Run Script + Logging (Copilot task)
Create `scripts/real-run.ts`:
- Accepts `--input <file>` + `--title <string>` + `--output-dir <path>`
- Wraps `runPipeline()` with raw response capture
- Writes timestamped output directory with all artifacts
- Logs token usage per pass

### Step B: Model Override (Copilot task)
Add `model?: string` to `RunPipelineOptions`, thread through to all three passes.
Default: `gpt-4o-mini`. First real run: `gpt-4o`.

### Step C: Manuscript Preparation (User task)
Place 1-2 real chapter files in `manuscripts/`:
- One strong chapter (e.g., Cartel Babies — polished)
- One messy chapter (e.g., DOMINATUS — known issues)

### Step D: First Real Run (Copilot executes)
```bash
npx tsx scripts/real-run.ts \
  --input manuscripts/cartel-babies-ch1.txt \
  --title "Cartel Babies - Chapter 1" \
  --model gpt-4o \
  --output-dir runs/run-001
```

### Step E: Audit & Prompt Tuning (ChatGPT analyzes outputs, designs prompt changes)

### Step F: Governance Closure (Perplexity writes PHASE_2_7_REAL_RUN_01.md, updates roadmap)

---

## 4. What Does NOT Need to Change

| Area | Why it's fine |
|---|---|
| Type contracts (`types.ts`) | Already comprehensive — supports all real-run data |
| Quality gate (`qualityGate.ts`) | 8 checks cover all hard rules; will catch real failures |
| DI architecture | Critical for test isolation; stays untouched |
| Parser logic | Deterministic, handles malformed AI output gracefully |
| EvaluationResultV1 adapter | Bridge to downstream already works |
| Test suite | 52/52 — no regression risk from real-run additions |
| Independence guarantee | Enforced at type, orchestrator, and quality gate levels |

---

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| `gpt-4o-mini` produces low-quality evaluations | Medium | Override to `gpt-4o` for calibration runs |
| 12K char truncation cuts critical late-chapter content | Medium | Document limit; defer multi-chunk to Phase 2.8 |
| First real run hits rate limits | Low | OpenAI `maxRetries: 0` means immediate fail; add retry config |
| Raw response lost, can't diagnose prompt issues | High | Step A (logging wrapper) is prerequisite for everything |
| Prompt tuning without examples leads to score compression | High | Add few-shot examples after first run provides evidence |

---

## 6. Deliverable Checklist for ChatGPT → Copilot

- [ ] **A.** `scripts/real-run.ts` — CLI real-run script with logging
- [ ] **B.** Model override in `RunPipelineOptions` + thread to all passes
- [ ] **C.** Raw response capture (return or log `rawResponse` per pass)
- [ ] **D.** Token usage logging (`completion.usage`)
- [ ] **E.** First real run on manuscript chapter
- [ ] **F.** Prompt tuning based on real-run evidence (ChatGPT designs, Copilot implements)
- [ ] **G.** `PHASE_2_7_REAL_RUN_01.md` (Perplexity writes after run completes)

---

**Bottom line:** The scaffold is production-grade. The gaps are all at the "last mile" integration layer — logging, real input, model selection, and prompt calibration. No architectural changes needed. The DI refactor from the previous session made this possible.
