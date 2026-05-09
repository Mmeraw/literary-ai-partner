# PR-C Baseline: Manuscript 6041 Pre-PR-C Evaluation
_DO NOT TRUST THIS SCORE. Sampling artifact — see below._

---

## Job Metadata

| Field | Value |
|---|---|
| Job ID | `20079165-a265-4696-a658-21a95bacfe14` |
| Manuscript ID | 6041 |
| Title | Let the River Decide (V1) (2 Oct 2025) |
| Word count | 82,869 |
| Submission date | 2026-05-09 04:59:41 UTC |
| Evaluation completed | 2026-05-09 05:01:08 UTC |
| Main SHA at time of eval | `611e927b` (post-PR #383 merge) |

---

## Why This Score Is Not Valid

**Chunks Analyzed: 3 / Successfully Processed: 3**  
against 58 DB chunks and 87,737 manuscript words.

**Provenance footer (verbatim):**
> Pass 1 and Pass 2 analyzed a sampled prompt window (~6,791 of 87,737 words; 40,000-char budget).
> Pass 3 synthesis uses a compressed manuscript reference window for arbitration context.

**Coverage: 7.7% of the manuscript.** This evaluation graded the book on a sampling of its opening, middle, and closing pages — not the full manuscript.

Denominator note: metadata `Word count` (82,869) and provenance denominator (87,737) differ; coverage math in this artifact is anchored to the provenance denominator because it is the value emitted by the evaluation pipeline.

The governance layer behaved correctly:
- Prose Control & Line-Level Craft: **Score not certified — insufficient evidence anchoring** ← gate fired honestly
- All other criteria: **Moderate Confidence** ← system disclosed its own epistemic limits
- No Pass 4 in the provenance string ← QGv2 may have lacked anchors

This is the system telling the truth. It is not a failure of governance. It is a failure of the input layer (issue #384).

---

## Scores (SAMPLING ARTIFACT — NOT VALID FOR MANUSCRIPT JUDGMENT)

| Criterion | Score | Confidence |
|---|---|---|
| Concept & Core Premise | 8/10 | Moderate |
| Narrative Drive & Momentum | 6/10 | Moderate |
| Character Depth & Psychological Coherence | 7/10 | Moderate |
| Point of View & Voice Control | 8/10 | Moderate |
| Scene Construction & Function | 7/10 | Moderate |
| Dialogue Authenticity & Subtext | 6/10 | Moderate |
| Thematic Integration | 9/10 | Moderate |
| World-Building & Environmental Logic | 8/10 | Moderate |
| Pacing & Structural Balance | 6/10 | Moderate |
| Prose Control & Line-Level Craft | **Not certified** | **Low** |
| Tonal Authority & Consistency | 8/10 | Moderate |
| Narrative Closure & Promises Kept | 7/10 | Moderate |
| Professional Readiness & Market Positioning | 6/10 | Moderate |

**Overall Score: 53.00** ← Normalized from 6.74/10 raw.  
**Certified: 12 of 13 criteria** ← Prose Control uncertified.  
**Engine:** GPT-4 / OpenAI  
**Prompt Version:** `pass1-craft-v7-bounded+pass2-editorial-v8-independence+pass3-synthesis-v10-non-certified-three-and-three`  
**Confidence:** 70%

---

## Chunker State at Time of Eval (Post-PR #383 ✅)

| Metric | Value | Invariant |
|---|---|---|
| Total chunks | 58 | ✅ |
| Min content length | 3,500 chars | ✅ above minChars=3000 |
| Median content length | 9,566 chars | ✅ |
| Max content length | 12,500 chars | ✅ at maxChars ceiling |
| Under 200 chars | 0 | ✅ TOC bug eliminated |
| Under 3,000 chars | 0 | ✅ |
| Chunk labels | all BlankBreak | ⚠️ see issue #385 |

---

## Comparison Target After PR-C

After PR-C ships, re-evaluate manuscript 6041 against the same SHA.  
Success criteria:
- `Chunks Analyzed` = 58 (or the full chunk count, whatever it is at re-eval time)
- Coverage ≈ 100% (or ≥ 90% with governed sampling)
- Prose Control: certified, confidence ≥ moderate
- All manuscript-scale criteria (Closure, Pacing, Thematic Integration): confidence derivable from full chunk set
- Provenance footer: no "sampled prompt window" statement

That evaluation is the one that is real.

---

## Do Not Show This Score

Do not present the 53.00 to any audience as a valid evaluation of "Let the River Decide." It is a fragment-based score on 7.7% of the manuscript. The novel has not been evaluated. The opening pages have.
