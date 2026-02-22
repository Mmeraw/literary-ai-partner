# Production Evidence — Evaluation "Real AI" Proof

Date:
Env: Production / Preview (circle one)
Commit / Deploy ID:

## 1) Vercel Logs (Screenshot)

PASS criteria:
- Logs include: `[Processor] Calling OpenAI API...`
- Logs DO NOT include: `No OpenAI API key found`
- Logs DO NOT include: `Falling back to mock evaluation`

[Paste screenshot here]

## 2) Supabase Proof (Screenshot)

SQL run:

select
  id,
  created_at,
  evaluation_result->'engine'->>'model' as model,
  evaluation_result->'governance'->'warnings' as warnings
from evaluation_jobs
order by created_at desc
limit 5;

PASS criteria:
- model starts with `gpt-`
- warnings does NOT contain `MOCK EVALUATION`

[Paste screenshot here]

## 3) UI Output Proof (Screenshot)

PASS criteria:
- Mentions specific manuscript evidence/snippets
- Not templated/generic
- Strengths/risks vary from job to job

[Paste screenshot here]
