# Self-Correction Policy

**Canon authority:** Runtime Doctrine #11, #13; Volume III §III.PL5; SIPOC S06b, S07, S09, S11b  
**Effective:** Upon merge  
**Status:** Normative

## Purpose

This document defines what happens when any pipeline gate detects a violation. It is the enforcement complement to the operating rules — where operating rules say _what must be true_, this policy says _what happens when it isn't_.

## Core Principle

> **The system must never persist, render, or deliver malformed content to the author.**
> When a gate fails, the system self-corrects or fails closed. There is no third option.

## Policy Sequence

When any gate detects a violation:

```
1. QUARANTINE  — isolate the bad content (do not persist as final artifact)
2. RETRY ONCE  — re-invoke the failing pass with explicit failure context
3. FAIL CLOSED — if retry also fails, mark the job FAILED with admin-visible diagnostics
4. NOTIFY      — provide admin-visible error code + user-safe message
```

### Step 1: Quarantine

Bad content is **never persisted as a deliverable artifact**. Specifically:

- The pipeline does NOT write `evaluation_result_v2` for a failed job
- The pipeline does NOT advance the job to `complete` status
- Failed intermediate outputs MAY be persisted as diagnostic artifacts (prefixed `quarantine_`) for admin inspection, but MUST NOT be served to the author
- Quarantined artifacts are tagged with the gate that caught them and the violation codes

### Step 2: Retry Once

The system retries the failing pass **exactly once** with:

- The original input (unchanged)
- An explicit `retry_context` block containing:
  - Which gate failed
  - Which violation codes were raised
  - Which specific fields/criteria violated
  - A prose instruction: "Your previous output was rejected for: [violation summary]. Regenerate without these defects."

Retry is only attempted for LLM-generated content failures. Deterministic gate failures (scaffold residue, broken modals) that originate from the LLM output are retryable because the LLM may produce clean output on a second attempt. Infrastructure failures are handled by the existing `maxSelfRecoveryAttemptsForFailureCode` mechanism.

### Step 3: Fail Closed

If the retry also fails the gate:

- The job transitions to `FAILED` status
- The failure is classified as **terminal** (no further automatic retries)
- The `failure_details` payload contains full gate diagnostics
- No partial artifact is served to the author

### Step 4: Notify

Two notification channels:

#### Admin-Visible (pipeline_progress / failure_details)

```json
{
  "error_code": "HANDOFF_SCAFFOLD_RESIDUE",
  "failed_at": "pass2",
  "failure_details": {
    "handoff_gate": {
      "total_violations": 3,
      "pass1_violations": 1,
      "pass2_violations": 2,
      "check_summary": { "HANDOFF_SCAFFOLD_RESIDUE": 2, "HANDOFF_BROKEN_MODAL": 1 },
      "first_violations": [...]
    }
  },
  "retry_attempted": true,
  "retry_also_failed": true
}
```

#### User-Safe (author-facing error page)

The author sees:

> "Your evaluation encountered a quality issue and could not be completed. Our team has been notified. Please try again or contact support."

The author **never** sees:
- Internal error codes
- Violation details
- Raw pipeline diagnostics
- Stack traces

## Gate-Specific Policies

### S06b — Pass 1/2 Handoff Gate

| Violation | Retryable? | Terminal after retry? | Notes |
|-----------|-----------|----------------------|-------|
| `HANDOFF_SCAFFOLD_RESIDUE` | Yes (1x) | Yes | LLM may produce clean output on retry |
| `HANDOFF_INCOMPLETE_SENTENCE` | Yes (1x) | Yes | Same |
| `HANDOFF_BROKEN_MODAL` | Yes (1x) | Yes | Same |
| `HANDOFF_GENERIC_LANGUAGE` | Yes (1x) | Yes | Same |
| `HANDOFF_MISSING_EVIDENCE_ANCHOR` | Yes (1x) | Yes | Same |

### S07 — Recommendation Integrity Gate

| Violation | Retryable? | Terminal after retry? | Notes |
|-----------|-----------|----------------------|-------|
| `REC_INTEGRITY_MALFORMED` | Yes (1x) | Yes | Pass 3 may synthesize cleanly on retry |
| `REC_INTEGRITY_GENERIC` | Yes (1x) | Yes | Same |
| `REC_INTEGRITY_NO_EVIDENCE` | Yes (1x) | Yes | Same |

### S09 — QualityGateV2

| Violation | Retryable? | Terminal after retry? | Notes |
|-----------|-----------|----------------------|-------|
| `QG_*` | No | Yes (immediately) | Deterministic gate on deterministic input — retry won't help |

### S11b — Download Pipeline

| Violation | Retryable? | Terminal after retry? | Notes |
|-----------|-----------|----------------------|-------|
| `DOWNLOAD_SANITIZER_FAILED` | No | Yes | Deterministic code failure — needs code fix |
| `DOWNLOAD_PARITY_FAILED` | No | Yes | Same |
| `DOWNLOAD_RENDER_FAILED` | No | Yes | Same |

## Invariants

1. **No partial success:** A job is either `complete` (all gates passed) or `failed` (any gate failed after retry). There is no "complete with warnings" status for gate-critical violations.

2. **Idempotent retry:** Retrying a pass with the same input + retry_context must not produce side effects beyond the pass output itself.

3. **Diagnostic preservation:** Every gate failure produces a persistent diagnostic artifact that admins can inspect via `/admin/pipeline-health`.

4. **Monotonic strictness:** Gates may become stricter over time (new patterns added, thresholds lowered) but MUST NOT become more permissive without explicit canon amendment.

5. **Author trust boundary:** The author never sees internal failure mechanics. The error page is generic and supportive. Specifics are for admins only.

## Implementation Notes

- `HANDOFF_*` codes are registered in `TERMINAL_FAILURE_PREFIXES` in `processor.ts` — they are terminal after one retry attempt
- `maxSelfRecoveryAttemptsForFailureCode` returns `1` for all `HANDOFF_*` codes (retry once, then terminal)
- Retry context is injected via `_retryContext` field on pass options, consumed by the prompt builder
- Quarantined artifacts use the existing `evaluation_artifacts` table with `artifact_type = 'quarantine_pass1'` / `'quarantine_pass2'`
