# Phase Architecture v2 — Runtime Wiring Next Steps

Status: execution plan after merged helper/contract PRs.

## Current helper stack

Merged support layers now provide:

- Phase 0 / chunk-manifest readiness guards.
- Phase 1A / Pass 3A launch readiness helpers.
- Pass 3A MAP/REDUCE readiness helper.
- Review Gate handoff helper.
- Phase 2 preflight guard helper.
- Phase v2 progress labels.
- WAVE Revision proof helper and progress patch helper.

## Next runtime wiring order

### 1. Review Gate processor wiring

Replace the direct Phase 1A handoff construction in `lib/evaluation/processor.ts` with the Phase v2 Review Gate handoff helper.

Requirements:

- Preserve existing artifact writes.
- Preserve `status=queued`, `phase=review_gate`, `phase_status=awaiting_approval` for reviewable handoff.
- Add Pass 3A readiness into the derived Review Gate decision.
- If the helper blocks, do not open Review Gate.
- Log the explicit block code and reason.

### 2. Phase 2 processor guard wiring

Before Phase 2 begins criteria analysis, call the Phase v2 Phase 2 guard helper.

Requirements:

- Reuse the existing accepted Story Ledger lookup.
- Add Pass 3A proof lookup.
- Block Phase 2 when Pass 3A is missing, running, half-written, failed, done without artifact, or degraded without proof.
- Preserve existing author-governance checks.

### 3. Pass 3A runtime extraction

Separate Pass 3A from Phase 1A as Track C.

Requirements:

- Track C starts only after Phase 0 is complete and the chunk manifest is durable.
- Track C does not consume Phase 1A output.
- MAP progress is durable.
- REDUCE waits for all MAP chunks.
- Done/degraded/failed states follow the merged gate-validity contract.

### 4. WAVE proof persistence

After WAVE execution or skip, persist the WAVE proof progress patch.

Requirements:

- WAVE complete/skipped/timeout/failed must be explicit.
- WAVE must not silently no-op.
- Quality Gate and WAVE Revision labels remain distinct.

## Non-goals

- Do not change scoring semantics.
- Do not change synthesis semantics.
- Do not rename Quality Gate.
- Do not rename WAVE to Pass 4.
- Do not combine Track C extraction with scoring changes.
