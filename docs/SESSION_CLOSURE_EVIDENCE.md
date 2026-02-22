# SESSION_CLOSURE_EVIDENCE — RevisionGrade Flow 1 (Evaluation Artifact Persistence)

Date: 2026-02-22
Repo: Mmeraw/literary-ai-partner
Branch: main
HEAD: 71ae01866c108371fc6fb51353e968190fd1a69f

## 1) Scope of closure (what this evidence is asserting)
- Claim A: `evaluation_artifacts` rows are persisted with correct `manuscript_id` linkage.
- Claim B: evaluation job processor code path passes `manuscript_id` into persistence layer.
- Claim C: production data demonstrates non-null `manuscript_id` on recent artifacts (or backfill applied).
- Claim D (optional): worker runtime timeout configuration is sufficient for OpenAI calls.

## 2) Evidence — Commit chain (verbatim)
```text
71ae018 (HEAD -> main, origin/main, origin/HEAD) fix(worker): add maxDuration=300 to prevent function timeout during OpenAI calls
c24e76b docs: session closure evidence - audit-grade stabilization summary
bbe7c37 fix(evaluation): remove mock fallback - fail-closed on all AI evaluation errors
8b163e3 test(artifacts): cover manuscript_id fail-closed upsert behavior
de310b0 fix(artifacts): persist manuscript_id with fail-closed guards
46abfef fix(evaluation): resolve manuscript text from file_url data URI for paste submissions
c12be01 feat(evaluation): add calibration profiles and quality-signal confidence controls
1efc238 test(guard): enforce critical regression suites are non-empty
07d50fc test(evaluation): fail closed on short text before OpenAI call
dc982b7 test+perf(evaluation): lock diagnostics aggregation and text-threshold safeguards
5c0850a perf(evaluation): add min-text guard and aggregate normalization diagnostics
dcc7bbb test(integration): require RUN_REAL_AI_TESTS=1 for real-AI anti-mock check
```

## 3) Evidence — Code: processor.ts (lines 540–760)
```text
Captured via: nl -ba lib/evaluation/processor.ts | sed -n '540,760p'
   540            };
   541          })
   542      : [];
   543
   544    evalDebugLog(
   545      `[Processor] normalizeCriterionEntry key=${key} recordKeys=${Object.keys(record).join(',')} score_0_10=${record.score_0_10} score=${(record as any).score}`,
   546    );
   547
   548    const canonicalScore = toFiniteNumber(record.score_0_10);
   549    const legacyScore = toFiniteNumber((record as any).score);
   550    const scoreSource =
   ...
   700  async function generateAIEvaluation(manuscript: Manuscript, job: EvaluationJob): Promise<EvaluationResultV1> {
   701    if (!openaiApiKey) {
   702      throw new Error('[Processor] OPENAI_API_KEY is not configured (fail-closed, no mock fallback)');
   703    }
   ...
   760        response_format: { type: 'json_object' }
```

## 4) Evidence — Code: artifactPersistence.ts (verbatim)
```typescript
/**
 * Artifact Persistence
 * 
 * Canonical artifact storage with idempotent writes and fail-closed enforcement.
 */
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ArtifactType = "evaluation_result_v1";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function stableSourceHash(params: {
  manuscriptId: number;
  jobId: string;
  userId: string;
  manuscriptText: string;
  promptVersion: string;
  model: string;
}) {
  const payload = JSON.stringify({
    manuscriptId: params.manuscriptId,
    jobId: params.jobId,
    userId: params.userId,
    manuscriptText: params.manuscriptText,
    promptVersion: params.promptVersion,
    model: params.model,
  });
  return sha256Hex(payload);
}

export async function upsertEvaluationArtifact(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  artifactType: ArtifactType;
  content: unknown;
  sourceHash: string;
  artifactVersion: string;
}): Promise<string> {
  if (!Number.isFinite(params.manuscriptId) || params.manuscriptId <= 0) {
    throw new Error(
      `[ArtifactPersistence] Upsert aborted for job_id=${params.jobId}: invalid manuscriptId=${params.manuscriptId}`,
    );
  }

  const { data, error } = await params.supabase
    .from("evaluation_artifacts")
    .upsert(
      {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
        artifact_type: params.artifactType,
        content: params.content,
        source_hash: params.sourceHash,
        artifact_version: params.artifactVersion,
      },
      {
        onConflict: "job_id,artifact_type",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`[ArtifactPersistence] Upsert failed for job_id=${params.jobId}: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`[ArtifactPersistence] Upsert returned null for job_id=${params.jobId}`);
  }

  return data.id as string;
}
```

## 5) Evidence — Callsite linkage proof
### 5.1 manuscript_id propagation (search output)
```text
lib/evaluation/processor.ts
1002:    if (!Number.isFinite(job.manuscript_id) || job.manuscript_id <= 0) {
1020:        manuscriptId: job.manuscript_id,

lib/evaluation/artifactPersistence.ts
87:        manuscript_id: params.manuscriptId,

lib/evaluation/phase2.ts
81:      manuscriptId,
```

### 5.2 upsertEvaluationArtifact callsites (search output)
```text
lib/evaluation/processor.ts
1017:      const artifactId = await upsertEvaluationArtifact({

lib/evaluation/phase2.ts
78:    const artifactId = await upsertEvaluationArtifact({
```

## 6) Evidence — Database remediation SQL (if used)
### 6.1 Backfill NULL manuscript_id (executed? yes/no)
Status in this session: **not executed** (SQL preserved for runbook use).

```sql
UPDATE public.evaluation_artifacts ea
SET manuscript_id = ej.manuscript_id
FROM public.evaluation_jobs ej
WHERE ea.job_id = ej.id
  AND ea.manuscript_id IS NULL
  AND ej.manuscript_id IS NOT NULL;
```

### 6.2 Requeue stuck job(s) (executed? yes/no)
Status in this session: **not executed** (SQL preserved for runbook use).

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='evaluation_jobs'
  AND column_name IN ('status','updated_at','last_heartbeat','last_error','manuscript_id');
```

Requeue statement actually executed:

```sql
UPDATE public.evaluation_jobs
SET
  status = 'queued',
  updated_at = now(),
  last_heartbeat = NULL
  -- last_error = NULL  (include only if column exists)
WHERE manuscript_id = <ID>
  AND status = 'failed';
```

## 7) Evidence — Post-run verification queries

Jobs:
```sql
SELECT id, manuscript_id, status, updated_at, last_heartbeat
FROM public.evaluation_jobs
WHERE manuscript_id IN (<IDs>)
ORDER BY updated_at DESC;
```

Artifacts:
```sql
SELECT id, manuscript_id, job_id, artifact_type, created_at
FROM public.evaluation_artifacts
WHERE manuscript_id IN (<IDs>)
ORDER BY created_at DESC
LIMIT 50;
```

## 8) Acceptance criteria (pass/fail)

AC1: New artifacts created after <timestamp> have manuscript_id NOT NULL. **UNVERIFIED IN THIS SESSION**

AC2: For a processed job, evaluation_artifacts.job_id references the correct evaluation_jobs.id. **UNVERIFIED IN THIS SESSION**

AC3: Processor code path passes job.manuscript_id (or equivalent) into persistence payload. **PASS**

AC4 (optional): Worker route configuration allows completion under worst-case latency (e.g., maxDuration set appropriately). **PASS** (`app/api/workers/process-evaluations/route.ts` line 25: `maxDuration = 300`)

## 9) Residual risk / follow-ups (non-blocking)

Dead code / mock fallback cleanup: **completed in this session** (`generateMockEvaluation` removed from `lib/evaluation/processor.ts`).

SDK warning cleanup (`url.parse` deprecation): pending.

Roadmap: Structured Judgment Engine: pending.
