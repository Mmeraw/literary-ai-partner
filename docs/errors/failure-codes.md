# Revision Failure Codes (Phase 2.4.a)

This document defines the canonical, closed failure-code set for revision/apply failures.

## Contract

- Codes are machine-readable and **UPPER_SNAKE_CASE**.
- The set is **closed** (no `UNKNOWN` / generic fallback code).
- Every reproducible failure path must map to one of these codes.
- Human-readable messaging is provided by `lib/errors/revisionCodes.ts`.

## Canonical Codes

| Code | Meaning | Severity |
|---|---|---|
| `ANCHOR_MISS` | Anchor not found in source text | `non_retryable` |
| `ANCHOR_AMBIGUOUS` | Multiple plausible anchor matches | `non_retryable` |
| `CONTEXT_MISMATCH` | Before/after context does not match source | `non_retryable` |
| `OFFSET_CONFLICT` | Offset/range conflicts with other edits | `non_retryable` |
| `PARSE_ERROR` | Input malformed or unparsable | `retryable` |
| `INVARIANT_VIOLATION` | Contract/invariant check failed | `non_retryable` |
| `APPLY_COLLISION` | Duplicate/colliding apply on same span | `non_retryable` |

## Source of Truth

- Enum + metadata: `lib/errors/revisionCodes.ts`

## Next Steps

- **2.4.b** Persist `failure_code` alongside failure message/context.
- **2.4.c** Add tests ensuring 100% failure paths emit non-null canonical codes.
