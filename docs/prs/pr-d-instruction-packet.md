# PR D — fix(eval): prevent zero-score contamination in long-form chunk aggregation

**Base branch**: `main` @ `83c14b6`
**Working branch**: `fix/longform-zero-score-contamination`
**Repo**: `Mmeraw/literary-ai-partner`
**Triggering evidence**: job `a2530e4b-12dc-4b62-a99f-80529a8da7b4` (Froggin Noggin FULL NOVEL, 105,247 words, 39 chunks)

---

## Problem statement (paste-ready)

A full-novel evaluation failed with `PASS4_CANON_INVALID` because five holistic criteria — `pacing`, `proseControl`, `tone`, `narrativeClosure`, `marketability` — reached Pass 4 with `score = 0` (recorded as `null` after the Pass 4 normalizer's range check). Pass 4 is correct to reject. The bug is upstream:

- `lib/evaluation/pipeline/runPass1.ts` L866 silently defaults any missing/non-numeric `score_0_10` to `0`.
- `lib/evaluation/pipeline/runPass2.ts` L844 does the same.
- Both passes' chunk aggregators (`runPass1.ts` L278-326, `runPass2.ts` L243-291) then *average* those fake zeroes across all chunks, including chunks where GPT didn't emit a real score for that criterion.
- `lib/evaluation/pipeline/runPass3Synthesis.ts` L652-653 and L751-752 clamp to `[0, 10]`, allowing the contaminated zero to propagate to the canonical record.
- Pass 4 (`lib/evaluation/pipeline/perplexityCrossCheck.ts` L238) correctly enforces `score >= 1`, so the canon-invalidates and the job fails.

This is **not** a Pass 4 problem and **not** the disputed-criteria case PR-A fixed. This is a new failure class: **upstream score contract permits an impossible score**.

The trigger is long-form chunk-native evaluation (introduced in #439, expanded by adaptive chunker #490, finalized by #501). On a 39-chunk full novel, holistic criteria don't have meaningful per-chunk signal — GPT either omits the score field or returns something the silent-zero fallback converts to 0. The aggregator drags the criterion average to 0 across many chunks. PR-A never touches this path.

---

## Out of scope — DO NOT TOUCH

- Pass 4 validator logic (`perplexityCrossCheck.ts`). It is correct.
- PR-A governance warning behavior (`runPipeline.ts` L1614 area).
- Pass 2/3 schema, prompts, or criteria list.
- `DISPUTE_THRESHOLD`, `EVAL_EXTERNAL_ADJUDICATION_MODE`, or any env var.
- The UI status-label inconsistency (separate follow-up).
- WAVE methodology / scoring philosophy / criterion definitions.

---

## Scope

### File 1: `lib/evaluation/pipeline/runPass1.ts`

**Surface A — per-chunk parser (around L860-874)**

Current:
```ts
const rawScore = c["score_0_10"];
const score = Number.isFinite(Number(rawScore)) ? Math.round(Number(rawScore)) : 0;

criteria.push({
  key: key as AxisCriterionResult["key"],
  score_0_10: Math.min(10, Math.max(0, score)),
  // ...
});
```

Required behavior: produce a `score_0_10` that is either a valid integer in `[1, 10]` or explicitly absent / sentinel `null` (your choice — but it MUST be distinguishable from a real score). Do NOT coerce missing/invalid to 0. Persist the criterion record with rationale + evidence regardless, so downstream can see "GPT said something but had no score."

Suggested helper, colocated at the top of the file:
```ts
function parseValidScore0To10(rawScore: unknown): number | null {
  if (rawScore === null || rawScore === undefined) return null;
  const parsed = Number(rawScore);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}
```

Then:
```ts
const score = parseValidScore0To10(c["score_0_10"]);
criteria.push({
  key: key as AxisCriterionResult["key"],
  score_0_10: score, // null permitted
  // ...
});
```

The `AxisCriterionResult.score_0_10` field type in `types.ts` will need to accept `number | null` — make that change and update all consumers.

**Surface B — chunk aggregator (around L278-326)**

Current:
```ts
const avgScore = Math.round(
  criteriaForKey.reduce((sum, c) => sum + c.score_0_10, 0) / criteriaForKey.length
);
// ...
score_0_10: Math.min(10, Math.max(0, avgScore)),
```

Required behavior:
1. Filter `criteriaForKey` down to entries where `score_0_10 !== null` and the value is in `[1, 10]`.
2. Compute average over the filtered set only.
3. If the filtered set is empty for a criterion that is required by `CRITERIA_KEYS`:
   - Throw `PASS1_CHUNK_AGGREGATE_SCORE_MISSING` with diagnostic JSON:
     ```ts
     {
       code: "PASS1_CHUNK_AGGREGATE_SCORE_MISSING",
       criterion: key,
       chunks_total: criteriaForKey.length,
       valid_score_chunks: 0,
       invalid_score_chunks: criteriaForKey.length,
     }
     ```
4. The aggregated `score_0_10` must be in `[1, 10]`. Do not clamp invalid data — fail loud.

### File 2: `lib/evaluation/pipeline/runPass2.ts`

Same two surfaces, same treatment:

- **Per-chunk parser** at L843-844: replace silent zero default with `parseValidScore0To10`. Keep the existing `NO_TEXTUAL_ANCHOR` reason code logic but **do not let it produce 0** — if `boundedScore` is null because the parser rejected it, the criterion has no valid score for that chunk. If `boundedScore` is valid but `!hasTextualAnchor(...)`, cap at 5 *but never below 1*.
- **Chunk aggregator** at L243-291: same filter-by-validity, fail-loud-on-empty pattern. Error code `PASS2_CHUNK_AGGREGATE_SCORE_MISSING`.

### File 3: `lib/evaluation/pipeline/runPass3Synthesis.ts`

Around L640-755, three sub-surfaces:

**Sub-surface 1 — craftScore / editorialScore (L643-648)**

Current:
```ts
const craftScore = rawEntry
  ? Math.round(Number(rawEntry["craft_score"] ?? p1c?.score_0_10 ?? 5))
  : (p1c?.score_0_10 ?? 5);
```

Required: validate the raw values against `parseValidScore0To10`. If `rawEntry["craft_score"]` is invalid, fall back to **a validated** `p1c?.score_0_10`. If that is also null/invalid, fall back to **5 ONLY if upstream legitimately had no signal** — but the new upstream contract should never deliver invalid data. The `?? 5` magic-number fallback should now be a defensive last resort, not the primary path.

Better: if `p1c.score_0_10` is null at this point, that means Pass 1 emitted no valid score for this criterion — that case should already have failed in Pass 1's aggregator. So in practice the `?? 5` should be unreachable. Make it throw if reached.

**Sub-surface 2 — finalScore clamps (L651-653)**

Current:
```ts
const rawFinal = rawEntry ? Number(rawEntry["final_score_0_10"]) : NaN;
const finalScore = Number.isFinite(rawFinal)
  ? Math.min(10, Math.max(0, Math.round(rawFinal)))
  : Math.min(10, Math.max(0, Math.round((craftScore + editorialScore) / 2)));
```

Required: replace `Math.max(0, ...)` with `Math.max(1, ...)` everywhere — there is no canonical score below 1.

**Sub-surface 3 — emitted clamps (L751-752)**

Current:
```ts
craft_score: Math.min(10, Math.max(0, craftScore)),
editorial_score: Math.min(10, Math.max(0, editorialScore)),
```

Required: same — clamp floor of 1, not 0. Pass 4 will canon-invalidate anything that emits below 1, so emitting below 1 is by definition wrong.

### File 4: `lib/evaluation/pipeline/types.ts`

Update `AxisCriterionResult.score_0_10` to `number | null` if you chose null-sentinel; otherwise document the invariant.

### File 5: `lib/evaluation/pipeline/perplexityCrossCheck.ts` (NO LOGIC CHANGE)

The validator at L238 already enforces `< 1 || > 10`. Do **not** touch it. If anything, add a test case that proves it still rejects 0.

---

## Required tests

Place under `tests/evaluation/pipeline/`.

### `pass1-score-contamination.test.ts`
1. Missing `score_0_10` in GPT response → per-chunk parser returns `null` (not 0). The criterion is still emitted with rationale + evidence.
2. Non-finite `score_0_10` (string, NaN, undefined) → same.
3. `score_0_10: 0` from GPT → rejected as out-of-range, treated identically to missing.
4. `score_0_10: 11` from GPT → rejected as out-of-range.
5. Chunk aggregation across 39 chunks where 5 chunks return valid `7` and 34 return null → aggregate = 7 (not contaminated, denominator = 5).
6. Chunk aggregation where ALL 39 chunks return null for a required criterion → throws `PASS1_CHUNK_AGGREGATE_SCORE_MISSING` with the diagnostic payload.

### `pass2-score-contamination.test.ts`
Mirror of the above for Pass 2, with `PASS2_CHUNK_AGGREGATE_SCORE_MISSING`.

### `pass3-never-emits-zero.test.ts`
1. Pass 3 given valid Pass 1 (score=7) + Pass 2 (score=7) → final ∈ [1,10].
2. Pass 3 given mocked rawEntry with `final_score_0_10: 0` → output is at least 1 (clamped) — OR throws if you choose strict mode.
3. Pass 3 craft_score and editorial_score outputs are always ≥ 1.

### `longform-holistic-criteria-regression.test.ts`
Replay the shape of job `a2530e4b-12dc-4b62-a99f-80529a8da7b4`:
- 39 chunks, full novel
- For `pacing`, `proseControl`, `tone`, `narrativeClosure`, `marketability`: simulate GPT returning rationale + evidence but no `score_0_10` field on most chunks (or `score_0_10: 0`).
- Assert: the pipeline fails *in Pass 1's aggregator* with `PASS1_CHUNK_AGGREGATE_SCORE_MISSING`, not in Pass 4 with `PASS4_CANON_INVALID`.
- This makes the failure surface honest.

### `pass4-still-rejects-zero.test.ts`
Sanity test that the Pass 4 validator continues to reject score=0. We do NOT want to regress the gate.

---

## Acceptance criteria

A long-form evaluation must either:
1. Complete with all canonical criterion scores in `[1, 10]`, OR
2. Fail with a precise diagnostic (`PASS1_CHUNK_AGGREGATE_SCORE_MISSING` / `PASS2_CHUNK_AGGREGATE_SCORE_MISSING`) identifying the specific criterion and chunk vote counts.

It must NEVER reach Pass 4 with `score: 0` or `score: null` masquerading as a canonical criterion record.

PR-A behavior is preserved: a canon-valid Pass 4 with `(warning, optional)` severity still ships as `ok:true` with a surfaced warning.

---

## Branch protection / required checks

- `enforce-latency-template`
- `Phase Integrity Guard`
- `kevlar-guards`
- `ci`
- `sipoc-certification`

Squash or rebase merge only.

---

## Forensic appendix — evidence from job a2530e4b

`cross_check_output.criteria` field-by-field for the 5 failing criteria:

| Criterion | gpt_score | gpt_evidence_chars | gpt_rationale_chars | invalid_gpt | pplx_score |
|---|---|---|---|---|---|
| pacing | **null** | 331 | 157 | TRUE | 5 |
| proseControl | **null** | 316 | 155 | TRUE | 7 |
| tone | **null** | 201 | 125 | TRUE | 6 |
| narrativeClosure | **null** | 225 | 131 | TRUE | 6 |
| marketability | **null** | 217 | 148 | TRUE | 6 |

For comparison, the 8 criteria that canon-validated:

| Criterion | gpt_score | pplx_score | disputed |
|---|---|---|---|
| character | 6 | 7 | false |
| concept | 7 | 8 | false |
| dialogue | 5 | 6 | false |
| narrativeDrive | 5 | 6 | false |
| sceneConstruction | 6 | 6 | false |
| theme | 6 | 8 | TRUE (delta=2) |
| voice | 6 | 7 | false |
| worldbuilding | 6 | 8 | TRUE (delta=2) |

**Note**: `gpt_signals_cnt = 0` for all 13 criteria — that's the PR-B issue (Pass 1 `openaiDetectedSignals` empty). PR-B is now downgraded, not cancelled. Address after PR D ships and we see whether full-novel runs surface the signals issue once scores are honest.

The Pass 4 warning text says "out of range: 0" — that comes from `perplexityCrossCheck.ts` L241's `${raw}` interpolation where `raw` is the original numeric value before normalization. So GPT (or the per-chunk parser) actually emitted **the number 0**, not undefined. Confirms the `?: 0` silent default in `runPass1.ts:866` is the culprit, not a missing field.

---

## Pre-flight (already done)

- ✅ Local clone `/tmp/p4chunk-fresh/literary-ai-partner/` synced to `main @ 83c14b6`
- ✅ Branch `fix/longform-zero-score-contamination` created locally, ready to commit against
- ✅ All four code surfaces identified and verified at the line numbers above
- ✅ No conflict with PR-A — PR-A's gate lives at `runPipeline.ts:1614` and is untouched

---

## Order after PR D merges

1. Retry Froggin Noggin full novel (job a2530e4b shape)
2. If it completes → inspect Pass 4 warnings, then start PR B (signals emission)
3. If it fails earlier with the new diagnostic codes → that means GPT is genuinely not emitting scores for holistic criteria on per-chunk Pass 1/2 — escalate to prompt/schema work (per-criterion routing or chunk-skip for arc-level criteria)
4. Then: UI status-label cleanup (the "In progress" + "Needs attention" double-signal on failed jobs)
