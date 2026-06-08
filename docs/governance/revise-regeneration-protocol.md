# Revise Candidate Regeneration Protocol

**Authority:** Revision Governance Volume VII  
**Scope:** Corrective action after candidate quality failure.

Blocking bad candidates is containment. Regeneration is corrective action.

## Trigger
Run regeneration when:
- `grounding_status === "supported"`
- `preflight_status === "passed"`
- `context_quality === "clean"`
- fewer than two candidates pass quality

## Inputs
Regeneration must use:
- Original target passage
- Surrounding context
- Revision operation
- Criterion
- Diagnosis / symptom
- Author voice constraints
- Canon constraints
- Explicit copy-ready prose instruction
- Explicit no-generic-literary-filler contract

## Retry Policy
- Maximum two regeneration attempts per opportunity.
- No infinite loops.
- Re-score after every attempt.

## Success
If at least two candidates pass after regeneration:
- update candidate text
- clear candidate quality failure
- admit the card

## Failure
If regeneration fails:
- withhold the card
- append `CANDIDATE_QUALITY_FAILED_AFTER_REGENERATION`
- add admin action: `Regenerate candidate prose`
- emit privacy-safe telemetry only

## Acceptance
The user sees only regenerated cards that pass. If none pass, the queue may be small or empty, but never garbage.
