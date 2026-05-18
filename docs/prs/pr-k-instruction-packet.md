# PR-K Instruction Packet — Fix QG_SUMMARY_OMITS_WEAKNESS

**Date:** 2026-05-16
**Author bug:** Mike Meraw / Froggin Noggin FULL NOVEL eval `a8d47d73-015a-48f5-819f-15b311fbe3dd`
**Status:** Pass 1/2/3 all succeeded; QualityGate V2 fail-closed at `v2_summary_weakness_presence`.

## Symptom

Live eval failure (job `a8d47d73`, 105,202-word manuscript, 32 chunks, long-form route):

```
[QualityGateV2] v2_summary_weakness_presence:
Overview summary omits bottom-score weakness criteria:
pacing, proseControl, tone, narrativeClosure, marketability
```

Pass 3 completed at 08:30:06 UTC; gate fired 3s later at 08:30:09. No prior phase errors.

## Root cause

Pass 3 already has an enforcer (`enforceSummaryWeaknessPresence` in `lib/evaluation/pipeline/runPass3Synthesis.ts:1839-1863`) that is meant to inject a weakness clause into `overview.one_paragraph_summary` before downstream gating.

But the **enforcement semantics drift** between Pass 3 and the gate:

| Layer | File | Logic |
|---|---|---|
| Pass 3 enforcer | `runPass3Synthesis.ts:1832-1837` | `summaryMentionsCriteria` returns true if ANY bottom-score key is mentioned (`.some()`). |
| Quality Gate V2 | `propagationIntegrity.ts:140-145` | `summaryMentionsBottomWeakness` returns true only if EVERY bottom-score key is mentioned (`missingBottomWeaknessCriteria.length === 0`). |

Additionally, the Pass 3 injector only inserts the top-3 weakness tokens (`slice(0, 3)` at line 1855), so when there are 5 bottom criteria as on Froggin Noggin (pacing, proseControl, tone, narrativeClosure, marketability), even if the enforcer fires it leaves the remaining 2 unmentioned and the gate trips.

A canonical helper already exists for this purpose — `normalizeSummaryWithBottomWeaknesses` in `lib/evaluation/pipeline/propagationIntegrity.ts:154-192` — but it is never imported. Pass 3 reimplements the logic with looser semantics.

## Fix

Single source of truth. Pass 3 should call the SAME helper the gate uses.

### Code changes

**File 1: `lib/evaluation/pipeline/runPass3Synthesis.ts`**

1. Add import (around line 56, with other pipeline imports):
   ```ts
   import { normalizeSummaryWithBottomWeaknesses, missingBottomWeaknessCriteria } from "./propagationIntegrity";
   import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
   import type { CriterionKey } from "@/schemas/criteria-keys";
   ```

2. Replace the body of `enforceSummaryWeaknessPresence` (lines 1839-1863) with a call to the canonical helper. Map `SynthesizedCriterion[]` → a minimal shape acceptable to `summarizePropagationIntegrity`, then call `normalizeSummaryWithBottomWeaknesses`.

   Replacement (replaces both `enforceSummaryWeaknessPresence` AND the in-file helpers `getBottomScoreCriteriaKeys`, `criterionKeyToReadableToken`, `summaryMentionsCriteria` — they become dead code):

   ```ts
   function enforceSummaryWeaknessPresence(
     summary: string,
     criteria: SynthesizedCriterion[],
   ): string {
     const trimmedSummary = summary.trim();
     if (trimmedSummary.length === 0) {
       return trimmedSummary;
     }
     // Project SynthesizedCriterion → minimal V2-criterion shape for bottom-score derivation
     const v2Like = criteria
       .filter((c) => Number.isFinite(c.final_score_0_10))
       .map((c) => ({
         key: c.key as CriterionKey,
         status: "SCORABLE" as const,
         score_0_10: c.final_score_0_10,
         // unused by deriveBottomScoreCriteria but required by EvaluationResultV2 shape
         confidence_level: undefined,
         confidence_score_0_100: undefined,
         evidence: [] as never[],
         scorability_status: "scorable_high_confidence" as const,
       })) as unknown as EvaluationResultV2["criteria"];

     // Derive the SAME bottomScoreCriteria the gate will use
     const { summarizePropagationIntegrity } = require("./propagationIntegrity");
     const { bottomScoreCriteria } = summarizePropagationIntegrity(v2Like);

     if (bottomScoreCriteria.length === 0) {
       return trimmedSummary;
     }

     // normalizeSummaryWithBottomWeaknesses appends a clause naming EVERY
     // missing bottom-score criterion, keeping ≤500 chars.
     return normalizeSummaryWithBottomWeaknesses(trimmedSummary, bottomScoreCriteria, 500);
   }
   ```

   (Prefer top-of-file ES `import` over `require()` if circular imports allow; use require fallback if not.)

3. Delete dead code: `getBottomScoreCriteriaKeys`, `criterionKeyToReadableToken`, `summaryMentionsCriteria` (lines 1805-1837).

**File 2: `lib/evaluation/pipeline/prompts/pass3-synthesis.ts`**

Strengthen the prompt to encourage the model to do this itself (defense in depth — the enforcer is the safety net, the prompt is the request):

In `PASS3_SYSTEM_PROMPT` or the user-prompt builder, add a directive near the `one_paragraph_summary` instruction:

> The `one_paragraph_summary` MUST explicitly name every criterion scoring 5 or below, by the human-readable form of its key (e.g., "pacing", "prose control", "narrative closure"). Do not summarize them as "structural weaknesses" or "execution gaps" — name each one.

### Test changes

**File 3: New test `lib/evaluation/pipeline/__tests__/summary-weakness-presence-parity.test.ts`**

Asserts Pass 3 enforcer and gate agree on every fixture:
- 1 bottom criterion → both pass
- 5 bottom criteria, summary mentions 1 → BOTH must fail (today: Pass 3 passes, gate fails — the bug)
- 5 bottom criteria, summary mentions all 5 → both pass
- 0 bottom criteria → both pass

Use real fixtures, not mocks, to exercise the actual code paths.

**File 4: `lib/evaluation/pipeline/__tests__/qualityGateV2.test.ts`**

Add the Froggin Noggin regression case: 5 bottom criteria, original summary mentions 0, post-enforcement summary mentions all 5, gate passes.

## Acceptance bar

1. Replay job `a8d47d73-015a-48f5-819f-15b311fbe3dd` (or equivalent synthetic fixture) → `v2_summary_weakness_presence` PASSES.
2. New parity test passes.
3. Existing `qualityGateV2.test.ts` + `__tests__/pass3-*` tests all green.
4. `npm run pipeline:stress` (Tier 1, 22 rows) green.
5. CI required checks: enforce-latency-template, Phase Integrity Guard, kevlar-guards, ci, sipoc-certification, flow1-proof-pack — all green.

## Scope discipline

- DO NOT touch Pass 4 / cross-check / Perplexity logic.
- DO NOT touch claim_job_atomic or any DB migration.
- DO NOT widen to gate-threshold tuning. Single-purpose PR.
- DO NOT modify the gate logic. The gate is correct; the producer is wrong.

## Branch name

`fix/pass3-summary-weakness-parity`

## Commit message

```
fix(pass3): align summary weakness enforcement with QualityGateV2

Pass 3's enforceSummaryWeaknessPresence used "ANY bottom criterion
mentioned satisfies" semantics (.some()) and only injected the top-3
weakness tokens (slice(0,3)). QualityGateV2's v2_summary_weakness_presence
check requires EVERY bottom-score criterion be named.

When a manuscript has more than 3 bottom-score criteria and the model's
summary mentions one of them, Pass 3 returned the summary unchanged,
then the gate fired QG_FAILED. Observed on job a8d47d73 (Froggin
Noggin FULL NOVEL): 5 bottom criteria (pacing, proseControl, tone,
narrativeClosure, marketability), summary mentioned 0, gate tripped.

This PR replaces Pass 3's local helpers with the canonical
normalizeSummaryWithBottomWeaknesses from propagationIntegrity.ts —
the same module the gate uses — guaranteeing producer/checker parity.
Also strengthens the Pass 3 prompt to request explicit weakness naming.

Adds a parity test that locks Pass 3 enforcer output against the gate's
acceptance predicate across multiple bottom-criterion counts.

Refs: live eval failure a8d47d73-015a-48f5-819f-15b311fbe3dd
```
