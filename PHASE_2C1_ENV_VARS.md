# Phase 2C-1: Environment Variables (OpenAI Integration + Retry/Circuit-Breaker)

This document specifies all required and optional environment variables for Phase 2C-1 real OpenAI integration.

## Required Variables

### OpenAI API
- **`OPENAI_API_KEY`** (required)
  - OpenAI API key for authentication
  - No default value
  - Must be set or `callOpenAI()` will throw

### Supabase (Manuscript Chunk Storage)
- **`SUPABASE_URL`** or **`NEXT_PUBLIC_SUPABASE_URL`**
  - Supabase project URL
  - Used to fetch manuscript chunks from `manuscript_chunks` table
  
- **`SUPABASE_SERVICE_ROLE_KEY`** or **`SUPABASE_ANON_KEY`**
  - Supabase authentication key
  - Service role key preferred for worker context

## Optional Variables (with Defaults)

### OpenAI Model Configuration
| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4o-mini` | LLM model to use for evaluation |
| `OPENAI_TEMPERATURE` | `0.2` | Temperature for generation (0-1) |
| `OPENAI_MAX_OUTPUT_TOKENS` | `1200` | Max tokens in response |

### Retry & Backoff
| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_MAX_RETRIES` | `4` | Max attempts for retryable errors (429, 500, 503) |
| `OPENAI_BACKOFF_BASE_MS` | `800` | Base backoff in ms; uses exponential backoff with jitter |

### Circuit Breaker
| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_CB_FAILS` | `5` | Consecutive failures before opening circuit |
| `OPENAI_CB_COOLDOWN_MS` | `45000` | Cooldown (45s) before trying half-open state |

## Error Handling Contract

### Fast-Fail (4xx, except 429)
- Status codes: 400, 401, 403, 404, etc.
- Behavior: Return immediately with `error.kind = "fast_fail"`
- Example: Invalid API key (401) → no retry

### Retryable (429, 500, 503, network errors)
- Status codes: 429 (rate limit), 500, 503 (server), undefined (network)
- Behavior: Exponential backoff up to `OPENAI_MAX_RETRIES`
- Example: 429 → retry with backoff

### Circuit Breaker States
- **closed**: Normal operation
- **open**: Too many failures; reject requests immediately with `error.kind = "circuit_open"`
- **half-open**: Cooling down; allows next attempt after `OPENAI_CB_COOLDOWN_MS`

## Metadata Preserved

Every OpenAI call logs audit-grade metadata to `result.metadata.provider_meta`:

```typescript
{
  provider: "openai",
  model: "gpt-4o-mini",
  temperature: 0.2,
  max_output_tokens: 1200,
  latency_ms: 1543,
  retries: 2,
  circuit_breaker: { state: "closed" },
  request_id: "req-123",
  error?: { kind: "...", status?: 401, code?: "...", message?: "..." }
}
```

Additionally, `result.metadata.openai_runtime` contains:

```typescript
{
  model: "gpt-4o-mini",
  temperature: 0.2,
  max_output_tokens: 1200
}
```

## Example `.env` for Phase 2C-1

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_OUTPUT_TOKENS=1200
OPENAI_MAX_RETRIES=4
OPENAI_BACKOFF_BASE_MS=800

# Circuit Breaker
OPENAI_CB_FAILS=5
OPENAI_CB_COOLDOWN_MS=45000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## Implementation Note (JOB_CONTRACT_v1 Compliance)

Phase 2C-1 respects the canonical job state machine:
- No invented states
- Failures are deterministic: categorized as `fast_fail`, `retryable_exhausted`, `circuit_open`, or `unknown`
- All metadata persisted to JSONB `evaluation_metadata` without schema drift
- Idempotent: safe to retry (no duplicate LLM calls per request_id if tracked upstream)

---
**Last Updated:** Phase 2C-1 Implementation  
**Related Files:**
- `workers/phase2Evaluation.ts` - Core implementation
- `workers/phase2Worker.ts` - Job orchestration
- `docs/JOB_CONTRACT_v1.md` - Canonical job state machine
