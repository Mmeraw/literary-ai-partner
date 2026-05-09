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

---

## Second Data Point — Hardened-QGv2 Counterpart (`842ec7ab`)

_Same substrate starvation. Different surface behavior. Captured as architectural evidence for #384._

### Job metadata

| Field | Value |
|---|---|
| Job ID | `842ec7ab-e8d2-49f3-9671-d199113bd1a8` |
| Manuscript ID | 6041 |
| Title | Let the River Decide |
| Submission date | 2026-05-09 11:52:11 UTC |
| Terminal state recorded | 2026-05-09 11:53:49 UTC (≈98s after creation) |
| Final JobStatus | `failed` |
| Main SHA at time of eval | `611e927b` (post-PR #383 merge) |

### Verbatim governance error (do not paraphrase)

> [QualityGateV2]
> `v2_completeness_bridge`: Criteria not validly classified per completeness bridge: pacing, marketability;
> `v2_scored_anchor_threshold`: Scored criteria under anchor threshold: pacing:1<2, marketability:1<2;
> `v2_fidelity_score_confidence_alignment`: Low-confidence criteria exceeded score cap (5) and were downgraded to INSUFFICIENT_SIGNAL: pacing:6, proseControl:7, marketability:7

### Doctrinal reading of the three gate firings

| Gate | What it exposed |
|---|---|
| `v2_completeness_bridge` | Manuscript-scale criteria (`pacing`, `marketability`) lacked valid classification substrate. |
| `v2_scored_anchor_threshold` | Insufficient anchors for manuscript-scale claims (1 anchor where ≥2 required). |
| `v2_fidelity_score_confidence_alignment` | Model certainty (scores 6–7) exceeded evidence reality (low confidence) and was correctly downgraded to `INSUFFICIENT_SIGNAL`. |

These three gates form a coherent chain. They are not random. They are the QGv2 stack refusing to certify an evaluation whose substrate is a 40K-char sampled window over an 82,869-word manuscript.

### Comparison to the 53.00 baseline above

| Aspect | First job (`20079165`) | Second job (`842ec7ab`) |
|---|---|---|
| Substrate input | 40K-char begin/middle/end window (~7.7% coverage) | 40K-char begin/middle/end window (same) |
| Pass 1 / Pass 2 cognition surface | Sampled window | Sampled window (unchanged) |
| QGv2 enforcement posture | Soft refusal — Prose Control "Score not certified — insufficient evidence anchoring"; other criteria emitted at Moderate confidence | Hard refusal — `JobStatus = failed`, no report emitted |
| Final JobStatus | `complete` (with quarantined output) | `failed` (no output) |
| Visible artifact | Score 53.00 (quarantined) | No score; structured QGv2 error |

Same underlying failure mode. Different surface behavior. The change between the two runs is **not** in the substrate path — it is in the QGv2 stack, which tightened between submissions to the point where insufficient manuscript-scale evidence now produces certification refusal rather than degraded-but-completed output.

### Why this is a success signal, not a regression

Before QGv2 hardened: starved substrate → degraded completion → low-confidence number that could be misread as a manuscript judgment.

After QGv2 hardened: starved substrate → certification refusal → no number to misread.

The system is no longer willing to bluff confidence over evidence. That is the governance maturity step the doctrine has been pushing toward.

### Architectural implication for #384

Once QGv2 reached this maturity level, **sample-window cognition became fundamentally incompatible with manuscript-scale certification.** The substrate problem and the gate problem are now mathematically coupled:

- A sampler-fed Pass 1 / Pass 2 cannot anchor manuscript-scale criteria at the QGv2 anchor threshold.
- A budget bump (`40K → 100K`) does not close the coupling — at 100K the manuscript is still ≈14% covered and anchor density remains below threshold.
- The only doctrine-clean unblock is to make Pass 1 / Pass 2 consume `manuscriptChunks[]` directly. That is the contract defined in `pr-c/design-doc.md` §1 and §2.

In other words: this failure is the substrate problem stated in the canonical voice of the gate stack. It is the same diagnosis the design doc made — now uttered in production, with a job ID attached.

### Evidence retention rule

Both quarantined jobs (`20079165-…` and `842ec7ab-…`) must remain readable for the lifetime of #384's design and rollout. They are the before/after pair that proves PR-C's necessity:

- `20079165` — pre-hardening behavior of the same substrate starvation.
- `842ec7ab` — post-hardening behavior of the same substrate starvation.
- A successful PR-C re-evaluation of manuscript 6041 (per design-doc §8.4) becomes the third point and the closure of this evidence chain.

### What was not done in response

In keeping with the hard guardrails of `pr-c/design-doc.md`, the following responses were considered and rejected:

- ❌ Weakening any of the three QGv2 gates that fired (forbidden by §2.5, §7.6).
- ❌ Lowering the anchor threshold from 2 to 1 (forbidden by §7.6).
- ❌ Raising the 40K prompt budget (forbidden by §0, §1.4, §2.5, §5.6, §7.6, §8.7).
- ❌ Inserting a "pass-through" patch to let the job complete with a fabricated number (forbidden by §3.5 anti-fabrication rule).

The correct response is the long one: ship #384 under the contracts defined in `pr-c/design-doc.md`. No tactical detour is doctrine-compliant.

