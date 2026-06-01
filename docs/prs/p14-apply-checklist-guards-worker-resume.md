# P14 — Apply Checklist Guards in Evaluation Worker and Resume Routes

Status: planned implementation PR  
Depends on: #877, #878  
Scope: runtime wiring only

## Purpose

Wire the checklist enforcer into actual worker and resume surfaces so checklist decisions are not limited to pure helper tests.

This PR turns the P13 guard seams into operational runtime behavior.

## Authority Registry

This PR must comply with:

`docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`

If there is ambiguity about canon, warmup, benchmark authority, WAVE, the 13 Story Criteria, Gate 15, dialogue/speech protection, Story Ledger standards, Revise Queue doctrine, or fail-closed behavior, this registry is the first source of truth.

## SIPOC posture

This PR does not replace `docs/SIPOC_EVALUATION_PROCESS.md`.

The existing SIPOC document remains the canonical runtime certification spine for S01-S11. Checklist enforcement remains an executable companion to SIPOC, not a replacement.

## Runtime surfaces

Primary targets:

```text
app/api/workers/process-evaluations/route.ts
app/api/jobs/[jobId]/resume/route.ts
lib/jobs/retry.ts
lib/jobs/rescueOrphanedJob.ts
```

Secondary surfaces if needed:

```text
lib/evaluation/processor.ts
lib/evaluation/phase-architecture-v2/readinessGuards.ts
lib/evaluation/phase-architecture-v2/phase2Guard.ts
lib/evaluation/phase-architecture-v2/checklistPublicationGate.ts
```

## Required behavior

- Worker cannot enter Phase 0.5A unless `assertChecklistPhaseMayStart('phase_0_5a', artifacts)` passes.
- Worker cannot enter Phase 0.5B unless `assertChecklistPhaseMayStart('phase_0_5b', artifacts)` passes.
- Worker cannot enter Phase 1A seed verification unless `assertChecklistPhaseMayStart('phase_1a', artifacts)` passes.
- Worker cannot enter Phase 2 unless legacy Phase 2 guard and checklist Phase 2 guard both pass.
- Resume route must select the last artifact that is schema-valid, semantically usable, and `is_resume_safe=true`.
- Resume route must not select the newest artifact merely because it exists.
- Blocked resume attempts must write audit evidence, not silently fail.

## Publication rule

Use the P13 publication decision model:

```text
saved_for_audit != usable_downstream != resume_safe
```

Audit artifacts may persist for traceability. They must not become usable downstream or resume-safe unless checklist rules permit it.

## Non-sprawl guardrails

- No new phase taxonomy.
- No new SIPOC document or alternate stage IDs.
- No speculative artifact types.
- No large worker rewrite.
- No new warmup/canon loader.
- No bypass around `checklistEnforcer.ts`.

## Acceptance criteria

- Actual worker path calls checklist guard before starting governed phases.
- Actual resume/retry path uses checklist resume-safe selection.
- Invalid newest artifact is skipped in favor of older valid resume-safe artifact.
- Blocked resume emits structured audit evidence.
- Existing SIPOC S01-S11 identifiers remain unchanged.

## Required tests

- Worker blocks Phase 0.5A without `phase0_authority_proof_v1`.
- Worker blocks Phase 0.5B without `phase0_authority_proof_v1`.
- Worker blocks Phase 1A seed verification without `story_map_seed_v1`.
- Worker blocks Phase 2 without `accepted_story_context_v1` when checklist artifacts are supplied.
- Resume selector prefers older valid checkpoint over newer invalid artifact.
- Resume route writes blocked-resume audit when no valid resume-safe checkpoint exists.

## Done sentence

Checklist enforcement is now active in worker and resume runtime paths; phase entry and resume checkpoint selection cannot bypass the checklist enforcer.
