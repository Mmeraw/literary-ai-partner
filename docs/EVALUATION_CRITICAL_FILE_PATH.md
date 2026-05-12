# EVALUATION_CRITICAL_FILE_PATH.md

> Engineering control map for the evaluation pipeline.  
> **Source of truth: repo code. Docs are context. Chat is a hint.**  
> **Repo state:** Mmeraw/literary-ai-partner @ main (post-PR #277, post-PR-002 merge c60d5fa5)  
> **Scope:** Evaluation pipeline only. Revision/wave layer documented separately.  
> **Reconciled from:** Three independent passes — GitHub/Copilot (file_search + read_file), ChatGPT (raw read @ d5b1134a), Perplexity (directory listing @ main). All entries below are verified against the actual repo.

## Verification Legend

| Tag | Meaning |
|-----|---------|
| **route** | Next.js route handler reachable from Vercel in production |
| **import** | File is imported by another verified file in the runtime path |
| **call** | Function is invoked at runtime by a verified caller |
| **grep** | Found by grep/search in repo; verification weakest — upgrade before trusting |
| **test** | File is exercised by a test under `__tests__/` or `*.test.ts` |

---

## Section 1 — Runtime Path (Input → Output)

### Stage 1: Job Creation & Queuing
**Entry:** User submits manuscript for evaluation via UI.

| File | Responsibility | Verified By |
|------|---|---|
| [app/api/jobs/route.ts](../app/api/jobs/route.ts) | Job creation endpoint; rate limiting; auth | **route** — POST handler; imports rateLimiter, createJob |
| [lib/jobs/store.ts](../lib/jobs/store.ts) | Persist job to DB; idempotent upsert | **import** — from [app/api/jobs/route.ts](../app/api/jobs/route.ts) (`createJob`) |
| [lib/jobs/rateLimiter.ts](../lib/jobs/rateLimiter.ts) | Per-user rate limit; feature access gates | **import** — from [app/api/jobs/route.ts](../app/api/jobs/route.ts) |
| [lib/observability/logger.ts](../lib/observability/logger.ts) | Trace ID generation; request logging | **import** — from [app/api/jobs/route.ts](../app/api/jobs/route.ts) |
| [lib/jobs/triggerWorker.ts](../lib/jobs/triggerWorker.ts) | Trigger evaluation worker after job creation | **import** — from [app/api/jobs/route.ts](../app/api/jobs/route.ts) (`triggerEvaluationWorker`) |

---

### Stage 2: Worker Ingress (Production Cron)
**Entry:** Vercel cron (`vercel-cron/1.0`) hits `GET /api/workers/process-evaluations`.

| File | Responsibility | Verified By |
|------|---|---|
| [app/api/workers/process-evaluations/route.ts](../app/api/workers/process-evaluations/route.ts) | **TRUE production worker entry point**; auth gate; calls processQueuedJobs | **route** — verified; `maxDuration = 900`; imports processor, checkServiceRoleAuth, getEvaluationRuntimeConfig |
| [lib/auth/api.ts](../lib/auth/api.ts) | Service-role auth guard (`checkServiceRoleAuth`) | **import** — from [app/api/workers/process-evaluations/route.ts](../app/api/workers/process-evaluations/route.ts) |
| [lib/config/evaluationRuntimeConfig.ts](../lib/config/evaluationRuntimeConfig.ts) | Runtime config resolution (model, lease, batch size, timeouts) | **import** — from [app/api/workers/process-evaluations/route.ts](../app/api/workers/process-evaluations/route.ts) AND [lib/evaluation/processor.ts](../lib/evaluation/processor.ts) |

---

### Stage 3: Job Claim & Lease Acquisition
**Action:** Processor performs `claim_evaluation_jobs` RPC; acquires lease atomically.

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/processor.ts](../lib/evaluation/processor.ts) | **Main orchestration hub**; claim → pipeline → gate → persist | **import** — from [app/api/workers/process-evaluations/route.ts](../app/api/workers/process-evaluations/route.ts) (`processQueuedJobs`) |
| [lib/jobs/contracts/claimEvaluationJobs.contract.ts](../lib/jobs/contracts/claimEvaluationJobs.contract.ts) | Contract assert for claimed jobs shape | **import** — from processor.ts (`assertClaimedJobsContract`) |
| [lib/jobs/jobStore.supabase.ts](../lib/jobs/jobStore.supabase.ts) | Supabase job store; `finalizeJobFailure` | **import** — from processor.ts |
| [lib/evaluation/status.ts](../lib/evaluation/status.ts) | Job status normalization; transition assertions | **import** — from processor.ts (`assertValidJobStatusTransition`, `normalizeEvaluationJobStatus`) |
| [lib/jobs/types.ts](../lib/jobs/types.ts) | `JOB_STATUS`, `JobStatus` canonical type | **import** — from processor.ts |
| [lib/evaluation/config.ts](../lib/evaluation/config.ts) | Eval timeout config assertions | **import** — from processor.ts (`assertEvalTimeoutConfig`, `getEvalOpenAiTimeoutMs`, `getEvalPassTimeoutMs`) |
| [lib/config/evaluationTimeouts.ts](../lib/config/evaluationTimeouts.ts) | Timeout budget per pass | **import** — from evaluationRuntimeConfig; used by processor |

---

### Stage 4: Manuscript Load & Prompt Input Preparation

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/fullManuscript.ts](../lib/evaluation/fullManuscript.ts) | Load full manuscript; chunk aggregation; `getEvaluationArtifact` | **import** — internal to processor flow |
| [lib/evaluation/pipeline/promptInput.ts](../lib/evaluation/pipeline/promptInput.ts) | Char-budget enforcement; prompt input schema; `summarizePromptCoverage` | **import** — from processor.ts |
| [lib/evaluation/WAVE_GUIDE.ts](../lib/evaluation/WAVE_GUIDE.ts) | Wave guide summary and version constant | **import** — from processor.ts (`WAVE_GUIDE_SUMMARY`, `WAVE_GUIDE_VERSION`) |

---

### Stage 5: Pipeline Orchestrator
**Coordinates Pass 1 → Pass 2 (parallel) → Pass 3 → Pass 4 cross-check.**

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/runPipeline.ts](../lib/evaluation/pipeline/runPipeline.ts) | **Pipeline orchestrator**; coordinates all passes; exports `synthesisToEvaluationResultV2` | **import** — from processor.ts; full import list read directly from file |

**Full import graph of runPipeline.ts** (all verified by direct file read):

| Imported From | Symbols |
|---|---|
| `./runPass1` | `runPass1`, `RunPass1Options` |
| `./runPass2` | `runPass2`, `RunPass2Options` |
| `./runPass3Synthesis` | `runPass3Synthesis`, `RunPass3Options` |
| `./perplexityCrossCheck` | `runPerplexityCrossCheck`, `CrossCheckOutput` |
| `@/lib/evaluation/governance/evaluatePass4Governance` | `evaluatePass4Governance` |
| `./qualityGate` | `runQualityGate`, `summarizeQualityGateFailures` |
| `./buildScoreLedger` | `buildScoreLedger` |
| `./buildExcellenceFilter` | `buildExcellenceFilter` |
| `./buildAdvisoryPlan` | `buildAdvisoryPlan` |
| `./criterionConfidence` | `computeCriterionConfidence` |
| `./types` | `PipelineResult`, `SinglePassOutput`, `SynthesisOutput`, `QualityGateResult` |
| `./propagationIntegrity` | `summarizePropagationIntegrity` |
| `@/schemas/evaluation-result-v1` | `EvaluationResultV1` |
| `@/schemas/evaluation-result-v2` | `EvaluationResultV2` |
| `@/schemas/criteria-keys` | `CRITERIA_KEYS` |
| `./prompts/pass1-craft` | `PASS1_PROMPT_VERSION` |
| `./prompts/pass2-editorial` | `PASS2_PROMPT_VERSION` |
| `./prompts/pass3-synthesis` | `PASS3_PROMPT_VERSION` |
| `@/lib/evaluation/signal/criterionObservability` | `normalizeCriterion`, `computeWeightedScore`, `CriteriaPlanMap` |
| `@/lib/governance/canonRegistry` | `loadCanonicalRegistry`, `CanonRegistry` |
| `@/lib/governance/injectionMap` | `loadGovernanceInjectionMap`, `getGovernanceCheckpointById`, `getLlrCheckpointForStage` |
| `@/lib/governance/lessonsLearned` | `evaluateLessonsLearnedRules`, `deriveLessonsLearnedEnforcementDecision` |
| `@/lib/observability/latencyTrace` | `emitLatencyTrace`, `finishLatencyStage`, `startLatencyStage` |
| `@/lib/llm/jsonParseBoundary` | `JsonBoundaryError` |

---

### Stage 6: Pass 1 — Craft Analysis
**LLM Call:** gpt-4o analyzes manuscript craft fundamentals.

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/runPass1.ts](../lib/evaluation/pipeline/runPass1.ts) | Pass 1 execution; model selection | **import** — from runPipeline.ts |
| [lib/evaluation/pipeline/prompts/pass1-craft.ts](../lib/evaluation/pipeline/prompts/pass1-craft.ts) | Pass 1 system + user prompt; `PASS1_PROMPT_VERSION` | **import** — from runPipeline.ts |
| [lib/llm/jsonParseBoundary.ts](../lib/llm/jsonParseBoundary.ts) | Parse LLM response to structured JSON; `JsonBoundaryError` | **import** — from runPipeline.ts |

**Canon Contract:** Pass 1 independent (no Pass 2 signals); all 13 criteria required.

---

### Stage 7: Pass 2 — Editorial Analysis *(parallel with Pass 1)*
**LLM Call:** gpt-4o analyzes from editorial perspective. **Never receives Pass 1 output.**

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/runPass2.ts](../lib/evaluation/pipeline/runPass2.ts) | Pass 2 execution; independence enforced | **import** — from runPipeline.ts |
| [lib/evaluation/pipeline/prompts/pass2-editorial.ts](../lib/evaluation/pipeline/prompts/pass2-editorial.ts) | Pass 2 system + user prompt | **import** — from runPipeline.ts |
| [lib/evaluation/pipeline/mechanismMarkers.ts](../lib/evaluation/pipeline/mechanismMarkers.ts) | Dialogue/POV mechanism detection markers | **import** — from [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) |
| [lib/llm/jsonParseBoundary.ts](../lib/llm/jsonParseBoundary.ts) | JSON parse boundary | **import** — from Pass 1/2/3 runners ([lib/evaluation/pipeline/runPass1.ts](../lib/evaluation/pipeline/runPass1.ts), [lib/evaluation/pipeline/runPass2.ts](../lib/evaluation/pipeline/runPass2.ts), [lib/evaluation/pipeline/runPass3Synthesis.ts](../lib/evaluation/pipeline/runPass3Synthesis.ts)) |
| [lib/evaluation/governance/contextContaminationGuard.ts](../lib/evaluation/governance/contextContaminationGuard.ts) | Detect context contamination (P1 leaking into P2) | **import** — from processor.ts (`detectContextContamination`) |

---

### Stage 8: Pass 3 — Synthesis

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/runPass3Synthesis.ts](../lib/evaluation/pipeline/runPass3Synthesis.ts) | Pass 3 synthesis; receives both P1 & P2 | **import** — from runPipeline.ts |
| [lib/evaluation/pipeline/prompts/pass3-synthesis.ts](../lib/evaluation/pipeline/prompts/pass3-synthesis.ts) | Pass 3 prompt; synthesis schema | **import** — from runPipeline.ts |
| [lib/evaluation/pipeline/recommendationSemantics.ts](../lib/evaluation/pipeline/recommendationSemantics.ts) | Recommendation dedup/normalization/ranking | **import** — from qualityGate.ts |

---

### Stage 9: Pass 4 AI — Cross-Check *(optional)*
**LLM Call:** Perplexity cross-checks synthesis for contradictions.

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/perplexityCrossCheck.ts](../lib/evaluation/pipeline/perplexityCrossCheck.ts) | Perplexity cross-check invocation | **import** — from runPipeline.ts |
| [lib/config/envContract.ts](../lib/config/envContract.ts) | Env contract; provider API key resolution | **import** — from evaluationRuntimeConfig |

---

### Stage 10: Pass 4 Governance — evaluatePass4Governance

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/governance/evaluatePass4Governance.ts](../lib/evaluation/governance/evaluatePass4Governance.ts) | Governance enforcement at Pass 4 boundary | **import** — from runPipeline.ts |
| [lib/evaluation/governance/runtimeQualityGuards.ts](../lib/evaluation/governance/runtimeQualityGuards.ts) | Runtime quality guards | **file** — verified exists |

---

### Stage 11: Quality Gate (Deterministic, No LLM)
**All checks must pass, or job fails with no artifact written.**

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) | **17 QG checks**; `runQualityGate`, `runQualityGateV2` | **import** — from runPipeline.ts AND processor.ts |
| [lib/evaluation/signal/criterionObservability.ts](../lib/evaluation/signal/criterionObservability.ts) | `MIN_ANCHORS`; `isCriterionComplete()`; `minAnchorsFor()` | **import** — from runPipeline.ts AND qualityGate.ts |
| [lib/evaluation/pipeline/gates.ts](../lib/evaluation/pipeline/gates.ts) | Individual gate implementations | **import** — from [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) |
| [lib/evaluation/pipeline/propagationIntegrity.ts](../lib/evaluation/pipeline/propagationIntegrity.ts) | Summary/weakness propagation checks | **import** — from runPipeline.ts |
| [lib/evaluation/pov/analyzePovRendering.ts](../lib/evaluation/pov/analyzePovRendering.ts) | POV consistency; psychic distance | **import** — from [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) |
| [lib/evaluation/pov/analyzeDialogueAttribution.ts](../lib/evaluation/pov/analyzeDialogueAttribution.ts) | Dialogue attribution; mechanism detection | **import** — from [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) |
| [lib/evaluation/pov/validatePovCriterionEvidence.ts](../lib/evaluation/pov/validatePovCriterionEvidence.ts) | POV criterion evidence sufficiency | **import** — from [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) |
| [lib/evaluation/pov/types.ts](../lib/evaluation/pov/types.ts) | POV/dialogue type definitions | **file** — verified in pov/ directory |

---

### Stage 12: Score Calculation, Authority Cap & Excellence Filter

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/pipeline/buildScoreLedger.ts](../lib/evaluation/pipeline/buildScoreLedger.ts) | Score ledger; `computeAuthorityComposite()` SIGNAL | **import** — from runPipeline.ts AND processor.ts |
| [lib/evaluation/pipeline/buildExcellenceFilter.ts](../lib/evaluation/pipeline/buildExcellenceFilter.ts) | Excellence filter verdict (PASS/DEGRADED/FAIL) | **import** — from runPipeline.ts AND processor.ts |
| [lib/evaluation/pipeline/buildAdvisoryPlan.ts](../lib/evaluation/pipeline/buildAdvisoryPlan.ts) | Advisory plan derivation | **import** — from runPipeline.ts |
| [lib/evaluation/pipeline/criterionConfidence.ts](../lib/evaluation/pipeline/criterionConfidence.ts) | Per-criterion confidence score | **import** — from runPipeline.ts |
| [lib/evaluation/persistEvaluationResultV2.ts](../lib/evaluation/persistEvaluationResultV2.ts) | Apply authority composite cap + record `AUTHORITY_CAP_APPLIED` | **import** — from processor.ts |

---

### Stage 13: Persistence (Atomic)

| File | Responsibility | Verified By |
|------|---|---|
| [lib/evaluation/persistEvaluationResultV2.ts](../lib/evaluation/persistEvaluationResultV2.ts) | V2 artifact persistence via atomic RPC | **import** — from processor.ts (`persistEvaluationResultV2`) |
| [lib/evaluation/artifactPersistence.ts](../lib/evaluation/artifactPersistence.ts) | Low-level DB upsert; `stableSourceHash`; `upsertEvaluationArtifact` | **import** — from processor.ts |
| [lib/governance/evaluationBridge.ts](../lib/governance/evaluationBridge.ts) | Map result to governance envelope before persist | **import** — from processor.ts (`mapEvaluationResultV2ToGovernanceEnvelope`) |
| [lib/jobs/store.finalizer.ts](../lib/jobs/store.finalizer.ts) | Mark job complete; release lease | **import** — called by processor after artifact persisted |

---

### Stage 14: Governance Injection (throughout pipeline)

| File | Responsibility | Verified By |
|------|---|---|
| [lib/governance/canonRegistry.ts](../lib/governance/canonRegistry.ts) | Canonical criteria registry | **import** — from runPipeline.ts |
| [lib/governance/injectionMap.ts](../lib/governance/injectionMap.ts) | Governance checkpoint injection | **import** — from runPipeline.ts |
| [lib/governance/lessonsLearned/index.ts](../lib/governance/lessonsLearned/index.ts) | LLR rule evaluation entry point | **file** — verified in governance/lessonsLearned/ |
| [lib/governance/lessonsLearned/engine.ts](../lib/governance/lessonsLearned/engine.ts) | LLR rule engine | **file** — verified |
| [lib/governance/lessonsLearned/ACTIVE_RULES.ts](../lib/governance/lessonsLearned/ACTIVE_RULES.ts) | Active LLR rules list | **file** — verified |

---

### Stage 15: UI Read Path
**UI reads persisted artifact — never re-computes.**

| File | Responsibility | Verified By |
|------|---|---|
| [app/api/jobs/[jobId]/artifacts/route.ts](../app/api/jobs/[jobId]/artifacts/route.ts) | **Canonical artifact GET**; ownership auth | **route** — reads `evaluation_artifacts` |
| [app/api/evaluations/[jobId]/route.ts](../app/api/evaluations/[jobId]/route.ts) | Unified evaluation response | **route** — reads `evaluation_artifacts` |
| [app/api/jobs/[jobId]/evaluation-result/route.ts](../app/api/jobs/[jobId]/evaluation-result/route.ts) | Legacy V1 evaluation result endpoint | **route** — legacy; V1 read path |
| [app/api/admin/jobs/[jobId]/route.ts](../app/api/admin/jobs/[jobId]/route.ts) | Admin inspection; includes artifacts | **route** — reads `evaluation_artifacts` |

---

## Section 2 — Concern Map (Issue → Exact Files to Inspect)

### Dialogue / Speech / Voice / POV

| File | Concern Surface | Priority |
|------|---|---|
| [lib/evaluation/signal/criterionObservability.ts](../lib/evaluation/signal/criterionObservability.ts) | `MIN_ANCHORS` thresholds; `isCriterionComplete()` — **ROOT of dialogue soft-fail bug** | **HIGHEST** |
| [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) | Completeness bridge enforcement; blocking vs non-blocking filter | **HIGHEST** |
| [lib/evaluation/pov/analyzeDialogueAttribution.ts](../lib/evaluation/pov/analyzeDialogueAttribution.ts) | Dialogue tag parsing; attribution tracking | HIGH |
| [lib/evaluation/pov/analyzePovRendering.ts](../lib/evaluation/pov/analyzePovRendering.ts) | POV consistency; narrative distance | HIGH |
| [lib/evaluation/pov/validatePovCriterionEvidence.ts](../lib/evaluation/pov/validatePovCriterionEvidence.ts) | POV/voice evidence sufficiency | HIGH |
| [lib/evaluation/pov/types.ts](../lib/evaluation/pov/types.ts) | POV/dialogue type definitions | MED |
| [lib/evaluation/pipeline/mechanismMarkers.ts](../lib/evaluation/pipeline/mechanismMarkers.ts) | Dialogue/POV mechanism detection marker lists | MED |
| [lib/evaluation/pipeline/runPass2.ts](../lib/evaluation/pipeline/runPass2.ts) | Pass 2 dialogue/voice analysis execution | MED |
| [lib/evaluation/pipeline/prompts/pass2-editorial.ts](../lib/evaluation/pipeline/prompts/pass2-editorial.ts) | Pass 2 dialogue prompt text | MED |
| [lib/evaluation/pipeline/runPass3Synthesis.ts](../lib/evaluation/pipeline/runPass3Synthesis.ts) | Synthesis of dialogue/voice signals | MED |

**For PR-002.5 (Dialogue Soft-Fail) — NARROW SCOPE (2 files + 1 test):**
- **Primary runtime (ONLY these 2):** [lib/evaluation/signal/criterionObservability.ts](../lib/evaluation/signal/criterionObservability.ts) + [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts)
- **Tests (verify existing coverage, add dialogue soft-fail cases):** [__tests__/lib/evaluation/pipeline/qualityGate.coverage.test.ts](__tests__/lib/evaluation/pipeline/qualityGate.coverage.test.ts)
- **Out of scope (regression risk):** All POV analyzers, Pass 1/2/3 runners, processor.ts — these are already safe per existing tests

---

### Model Routing / Provider Config / o3

| File | Concern Surface | Verified By |
|------|---|---|
| [lib/config/envContract.ts](../lib/config/envContract.ts) | Env vars; model provider selection | **import** — from evaluationRuntimeConfig |
| [lib/config/evaluationRuntimeConfig.ts](../lib/config/evaluationRuntimeConfig.ts) | Runtime config object; model field resolution | **import** — from worker route + processor |
| [lib/config/evaluationTimeouts.ts](../lib/config/evaluationTimeouts.ts) | Timeout budgets per pass and provider | **import** — from evaluationRuntimeConfig |
| [lib/evaluation/policy.ts](../lib/evaluation/policy.ts) | Policy decisions; `getCanonicalPipelineModel` | **import** — from processor.ts |
| [lib/evaluation/pipeline/runPass1.ts](../lib/evaluation/pipeline/runPass1.ts) | Pass 1 model selection | **import** |
| [lib/evaluation/pipeline/runPass2.ts](../lib/evaluation/pipeline/runPass2.ts) | Pass 2 model selection | **import** |
| [lib/evaluation/pipeline/runPass3Synthesis.ts](../lib/evaluation/pipeline/runPass3Synthesis.ts) | Pass 3 model selection | **import** |
| [app/api/workers/process-evaluations/route.ts](../app/api/workers/process-evaluations/route.ts) | Worker reads config to set model | **route** |
| [lib/evaluation/processor.ts](../lib/evaluation/processor.ts) | Calls `getCanonicalPipelineModel` | **import** |
| [__tests__/lib/evaluation/processor.openai-params.test.ts](__tests__/lib/evaluation/processor.openai-params.test.ts) | Model routing test | **test** |

---

### Quality Gate Failures

| File | Concern Surface |
|------|---|
| [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) | All 17 QG error codes (QG_*) |
| [lib/evaluation/signal/criterionObservability.ts](../lib/evaluation/signal/criterionObservability.ts) | `isCriterionComplete()`; `MIN_ANCHORS` |
| [lib/evaluation/pipeline/gates.ts](../lib/evaluation/pipeline/gates.ts) | Individual gate implementations |
| [lib/evaluation/governance/evaluatePass4Governance.ts](../lib/evaluation/governance/evaluatePass4Governance.ts) | Pass 4 governance enforcement |
| [lib/governance/evaluationBridge.ts](../lib/governance/evaluationBridge.ts) | Governance envelope mapping |
| [lib/evaluation/pipeline/propagationIntegrity.ts](../lib/evaluation/pipeline/propagationIntegrity.ts) | Summary/weakness propagation |
| [lib/evaluation/pipeline/recommendationSemantics.ts](../lib/evaluation/pipeline/recommendationSemantics.ts) | Rec dedup/normalization |

**QG Error Code → File Map:**
- `QG_CRITERIA_MISSING` → [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts) (CRITERIA_KEYS check)
- `QG_INDEPENDENCE_VIOLATION` → [lib/evaluation/pipeline/runPass2.ts](../lib/evaluation/pipeline/runPass2.ts) + [lib/evaluation/pipeline/runPipeline.ts](../lib/evaluation/pipeline/runPipeline.ts)
- `QG_*_EVIDENCE` / `QG_*_ANCHOR` → [lib/evaluation/signal/criterionObservability.ts](../lib/evaluation/signal/criterionObservability.ts)
- `QG_PLACEHOLDER_RATIONALE` → [lib/evaluation/pipeline/placeholderRationalePatterns.ts](../lib/evaluation/pipeline/placeholderRationalePatterns.ts)

---

### Artifact Persistence & Schema

| File | Concern Surface | Verified By |
|------|---|---|
| [lib/evaluation/persistEvaluationResultV2.ts](../lib/evaluation/persistEvaluationResultV2.ts) | V2 artifact persistence; authority cap enforcement | **import** — processor.ts |
| [lib/evaluation/artifactPersistence.ts](../lib/evaluation/artifactPersistence.ts) | Low-level DB upsert; `stableSourceHash` | **import** — processor.ts |
| [lib/evaluation/phase2.ts](../lib/evaluation/phase2.ts) | Phase 2 artifact writing; V1 path | **file** — verified |
| [lib/evaluation/fullManuscript.ts](../lib/evaluation/fullManuscript.ts) | `getEvaluationArtifact()`; read/write coordination | **file** — verified |
| [schemas/evaluation-result-v2.ts](../schemas/evaluation-result-v2.ts) | `EvaluationResultV2` type | **import** — runPipeline.ts |
| [schemas/evaluation-result-v1.ts](../schemas/evaluation-result-v1.ts) | `EvaluationResultV1` type (legacy read-only) | **import** — runPipeline.ts |

---

### Job Lifecycle / Worker / Lease Claims

| File | Concern Surface | Verified By |
|------|---|---|
| [app/api/workers/process-evaluations/route.ts](../app/api/workers/process-evaluations/route.ts) | Production worker entry; cron trigger | **route** |
| [lib/evaluation/processor.ts](../lib/evaluation/processor.ts) | `processQueuedJobs`; claim + dispatch | **import** |
| [lib/jobs/jobStore.supabase.ts](../lib/jobs/jobStore.supabase.ts) | Supabase job store; `finalizeJobFailure` | **import** — processor.ts |
| [lib/jobs/contracts/claimEvaluationJobs.contract.ts](../lib/jobs/contracts/claimEvaluationJobs.contract.ts) | Claim contract assertion | **import** — processor.ts |
| [lib/evaluation/status.ts](../lib/evaluation/status.ts) | Job status transitions; normalization | **import** — processor.ts |
| [lib/jobs/types.ts](../lib/jobs/types.ts) | `JOB_STATUS` canon values | **import** — processor.ts |
| [lib/config/evaluationRuntimeConfig.ts](../lib/config/evaluationRuntimeConfig.ts) | Lease ms; batch size; timeouts | **import** — worker route + processor |
| [app/api/jobs/route.ts](../app/api/jobs/route.ts) | Job creation; rate limiting | **route** |
| [lib/jobs/store.ts](../lib/jobs/store.ts) | Job persistence | **import** |
| [lib/jobs/rateLimiter.ts](../lib/jobs/rateLimiter.ts) | Rate limits | **import** |
| [lib/jobs/triggerWorker.ts](../lib/jobs/triggerWorker.ts) | Trigger worker post-creation | **import** |
| [lib/jobs/store.finalizer.ts](../lib/jobs/store.finalizer.ts) | Mark job complete; release lease | **import** |

---

## Section 3 — Schemas & Types

| File | Purpose | Verified By |
|------|---|---|
| [schemas/criteria-keys.ts](../schemas/criteria-keys.ts) | `CRITERIA_KEYS`; canonical 13-criterion list | **import** — runPipeline.ts, processor.ts |
| [schemas/evaluation-result-v2.ts](../schemas/evaluation-result-v2.ts) | `EvaluationResultV2` (canonical artifact shape) | **import** — runPipeline.ts |
| [schemas/evaluation-result-v1.ts](../schemas/evaluation-result-v1.ts) | `EvaluationResultV1` (legacy, read-only post-PR-001a) | **import** — runPipeline.ts |
| [lib/evaluation/pipeline/types.ts](../lib/evaluation/pipeline/types.ts) | Pipeline types: `PipelineResult`, `SinglePassOutput`, `SynthesisOutput`, `QualityGateResult` | **import** — runPipeline.ts |
| [lib/evaluation/pov/types.ts](../lib/evaluation/pov/types.ts) | POV/dialogue types | **file** — verified |
| [lib/governance/types.ts](../lib/governance/types.ts) | Governance types | **file** — verified |

---

## Section 4 — Cross-Cutting Concerns

### Observability

| File | Purpose | Verified By |
|------|---|---|
| [lib/observability/logger.ts](../lib/observability/logger.ts) | Structured logging; trace IDs | **import** — route.ts |
| [lib/observability/latencyTrace.ts](../lib/observability/latencyTrace.ts) | Per-stage timing; `startLatencyStage`, `finishLatencyStage` | **import** — runPipeline.ts + processor.ts |
| [lib/llm/client.ts](../lib/llm/client.ts) | LLM client (OpenAI) | **file** — verified in lib/llm/ |
| [lib/llm/jsonParseBoundary.ts](../lib/llm/jsonParseBoundary.ts) | JSON parse boundary; `JsonBoundaryError` | **import** — runPipeline.ts |

### Governance Stack

| File | Purpose | Verified By |
|------|---|---|
| [lib/governance/canonRegistry.ts](../lib/governance/canonRegistry.ts) | Load canonical criteria registry | **import** — runPipeline.ts |
| [lib/governance/injectionMap.ts](../lib/governance/injectionMap.ts) | Governance checkpoint injection | **import** — runPipeline.ts |
| [lib/governance/evaluationBridge.ts](../lib/governance/evaluationBridge.ts) | Map evaluation result to governance envelope | **import** — processor.ts |
| [lib/governance/eligibilityGate.ts](../lib/governance/eligibilityGate.ts) | Wave eligibility gate | **file** — verified |
| [lib/governance/enforcementHooks.ts](../lib/governance/enforcementHooks.ts) | Enforcement hooks | **file** — verified |
| [lib/governance/confidenceDerivation.ts](../lib/governance/confidenceDerivation.ts) | Confidence derivation | **file** — verified |
| [lib/governance/leaseService.ts](../lib/governance/leaseService.ts) | Governance lease service | **file** — verified |

---

## Section 5 — Key Tests

| File | What It Verifies |
|------|---|
| [__tests__/lib/evaluation/processor.canonical-pipeline.test.ts](__tests__/lib/evaluation/processor.canonical-pipeline.test.ts) | Full pipeline execution end-to-end |
| [__tests__/lib/evaluation/pipeline/qualityGate.coverage.test.ts](__tests__/lib/evaluation/pipeline/qualityGate.coverage.test.ts) | All 17 QG checks |
| [__tests__/lib/evaluation/persistEvaluationResultV2.boundary-gate.test.ts](__tests__/lib/evaluation/persistEvaluationResultV2.boundary-gate.test.ts) | Authority cap enforcement & persistence |
| [__tests__/lib/evaluation/processor.openai-params.test.ts](__tests__/lib/evaluation/processor.openai-params.test.ts) | Model routing correctness |
| [__tests__/lib/evaluation/contextContaminationGuard.test.ts](__tests__/lib/evaluation/contextContaminationGuard.test.ts) | Pass independence (no P1→P2 leakage) |
| [__tests__/lib/jobs/contracts/claimEvaluationJobs.contract.test.ts](__tests__/lib/jobs/contracts/claimEvaluationJobs.contract.test.ts) | Claim contract validation |
| [__tests__/lib/evaluation/governance/runtimeQualityGuards.test.ts](__tests__/lib/evaluation/governance/runtimeQualityGuards.test.ts) | Runtime quality guards |
| [app/api/workers/process-evaluations/auth.test.ts](../app/api/workers/process-evaluations/auth.test.ts) | Worker auth gate |

---

## Section 6 — Dependency Tree (Full Critical Path)

```
PRODUCTION TRIGGER:
Vercel cron → app/api/workers/process-evaluations/route.ts
  ↓ auth: lib/auth/api.ts (checkServiceRoleAuth)
  ↓ config: lib/config/evaluationRuntimeConfig.ts
  ↓ calls
lib/evaluation/processor.ts (processQueuedJobs)
  ↓ claims job: claim_evaluation_jobs RPC
  │   ├─ lib/jobs/contracts/claimEvaluationJobs.contract.ts
  │   ├─ lib/jobs/jobStore.supabase.ts
  │   └─ lib/evaluation/status.ts
  ↓
  lib/evaluation/pipeline/runPipeline.ts
    ├─ [parallel] runPass1.ts → prompts/pass1-craft.ts → lib/llm/jsonParseBoundary.ts
    ├─ [parallel] runPass2.ts → prompts/pass2-editorial.ts → jsonParseBoundary.ts
    │   └─ mechanismMarkers.ts
    └─ runPass3Synthesis.ts → prompts/pass3-synthesis.ts → jsonParseBoundary.ts
    ↓
    perplexityCrossCheck.ts (optional)
    ↓
    evaluatePass4Governance.ts
    ↓
    qualityGate.ts (17 checks — fail-closed)
      ├─ criterionObservability.ts (isCriterionComplete, MIN_ANCHORS)
      ├─ pov/analyzePovRendering.ts
      ├─ pov/analyzeDialogueAttribution.ts
      ├─ pov/validatePovCriterionEvidence.ts
      ├─ gates.ts
      └─ propagationIntegrity.ts
    ↓ [only on QG PASS]
    buildScoreLedger.ts (computeAuthorityComposite → SIGNAL)
    buildExcellenceFilter.ts
    buildAdvisoryPlan.ts
  ↓
  persistEvaluationResultV2.ts (apply AUTHORITY_CAP, record score_adjustments)
    └─ artifactPersistence.ts (DB upsert → evaluation_artifacts)
  ↓
  lib/governance/evaluationBridge.ts
  lib/jobs/store.finalizer.ts (mark job complete)

UI READ PATH:
app/api/jobs/[jobId]/artifacts/route.ts
  └─ reads evaluation_artifacts table (canonical; no re-computation)
```

---

## Section 7 — Reconciliation Notes (Three-Source Comparison)

| Category | My Initial Map | ChatGPT/Perplexity Added | Status |
|---|---|---|---|
| **Worker entry point** | `app/api/jobs/route.ts` (job creation only) | `app/api/workers/process-evaluations/route.ts` (cron trigger) | ✅ ADDED — this is the true worker entry |
| **Auth gate** | Missing | `lib/auth/api.ts` (`checkServiceRoleAuth`) | ✅ ADDED |
| **Claim contract** | Missing | `lib/jobs/contracts/claimEvaluationJobs.contract.ts` | ✅ ADDED |
| **Job store** | `lib/jobs/store.ts` | `lib/jobs/jobStore.supabase.ts` + `lib/jobs/jobStore.memory.ts` | ✅ ADDED Supabase variant |
| **Status transitions** | Missing | `lib/evaluation/status.ts` | ✅ ADDED |
| **Pass 4 governance** | Missing | `lib/evaluation/governance/evaluatePass4Governance.ts` | ✅ ADDED |
| **Contamination guard** | Missing | `lib/evaluation/governance/contextContaminationGuard.ts` | ✅ ADDED |
| **JSON parse boundary** | Wrong path (`lib/evaluation/pipeline/jsonParseBoundary.ts`) | `lib/llm/jsonParseBoundary.ts` | ✅ CORRECTED |
| **LLM client** | Missing | `lib/llm/client.ts` | ✅ ADDED |
| **Propagation integrity** | Listed but not verified | `lib/evaluation/pipeline/propagationIntegrity.ts` | ✅ CONFIRMED |
| **WAVE_GUIDE.ts** | Missing | `lib/evaluation/WAVE_GUIDE.ts` | ✅ ADDED |
| **lessonsLearned** | Flat `lib/governance/lessonsLearned.ts` | `lib/governance/lessonsLearned/` directory (index + engine + ACTIVE_RULES + types) | ✅ CORRECTED to directory |
| **Worker auth test** | Missing | `app/api/workers/process-evaluations/auth.test.ts` | ✅ ADDED |
| **Evaluation config** | `lib/config/evaluationTimeouts.ts` | `lib/evaluation/config.ts` also used by processor | ✅ BOTH verified |
| **UI enumeration** | Partial | Both agree on artifact routes | ✅ ALIGNED |

---

## Section 8 — Critical Reminders

1. **Dialogue soft-fail (PR-002.5) — still not merged.** Blocking all artifact persistence for zero-dialogue chapters. Target:
   - [lib/evaluation/signal/criterionObservability.ts](../lib/evaluation/signal/criterionObservability.ts)
   - [lib/evaluation/pipeline/qualityGate.ts](../lib/evaluation/pipeline/qualityGate.ts)

2. **Authority cap (PR-002) — merged (c60d5fa5).** To verify live: run a low-authority evaluation → fetch artifact from [app/api/jobs/[jobId]/artifacts/route.ts](../app/api/jobs/[jobId]/artifacts/route.ts) → check `score_adjustments[].reason === "AUTHORITY_CAP_APPLIED"`.

3. **`lib/evaluation/pipeline/jsonParseBoundary.ts` does NOT exist.** The real file is [lib/llm/jsonParseBoundary.ts](../lib/llm/jsonParseBoundary.ts).

4. **True production worker entry** is `app/api/workers/process-evaluations/route.ts`, NOT `app/api/jobs/route.ts` (which is job creation only).

5. **Update procedure:** Before adding any new file to this map, verify it exists (file_search) and is imported (grep_search for imports). Do not infer filenames from docs.

---

**Document Version:** 1.1  
**Reconciled by:** GitHub/Copilot (file_search + read_file) + ChatGPT (raw read @ d5b1134a) + Perplexity (directory listing @ main)  
**Canonical Authority:** Repo code only  
**Next Update Trigger:** PR-002.5 merge; any new pass, governance module, or persistence path added
