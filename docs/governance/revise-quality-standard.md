# Revise Quality Standard

**Authority:** Revision Governance Volume VII  
**Scope:** Candidate quality scoring and card admission.

A candidate is quality-passed only when it satisfies all required dimensions below.

## Dimensions
1. **Relevance** — directly addresses the identified weakness.
2. **Context awareness** — fits the surrounding manuscript context.
3. **Continuity** — preserves timeline, causal logic, and established facts.
4. **Voice fidelity** — preserves the author’s narrative identity.
5. **Execution readiness** — can be inserted immediately as manuscript prose.

## Failure Codes
- `GENERIC_PROSE`
- `NON_EXECUTABLE_PROSE`
- `NOT_EXECUTABLE`
- `VOICE_DRIFT`
- `CANON_DRIFT`
- `CONTEXT_MISMATCH`
- `UNSUPPORTED_FACT`
- `ANCHOR_ECHO`
- `TOO_SHORT`
- `REVISION_QUALITY_FAILED`

## Card Rule
A card requires at least two quality-passed candidates. If fewer than two candidates pass, the card must enter regeneration. If regeneration fails, it is withheld.
