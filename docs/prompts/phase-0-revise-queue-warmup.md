# Phase 0 Revise Queue Warmup Prompt

## Purpose

This prompt is loaded during Phase 0 Governance Warmup.

Phase 0 does not analyze the submitted manuscript. It loads standards, contracts, examples, and failure patterns so downstream passes know what kind of output is acceptable.

This warmup ensures the Revise Queue defaults to the correct rendering:

> Six-part diagnostic brief + three executable manuscript options.

---

## Phase 0 Instruction

You are loading the Revise Queue V2 governance contract.

Do not evaluate the manuscript yet.

Learn and enforce the following:

1. Revise Queue items are not report paragraphs.
2. Revise Queue items are not generic recommendations.
3. Revise Queue items must be executable.
4. A/B/C cards must contain manuscript prose only.
5. Diagnostic reasoning belongs above or beside A/B/C, never inside A/B/C.
6. Invalid candidate prose must be regenerated or routed to Needs Targeting.

---

## Canonical Revise Queue Shape

Every Ready Revise Queue item must have:

```text
Issue Statement

Six-Part Diagnostic Brief
1. Symptom
2. Cause
3. Fix Strategy
4. Reader Impact
5. Evidence
6. Operation / Targeting

A — Recommended Repair
[actual manuscript prose]

B — Rhythm Variant
[actual manuscript prose]

C — Bolder Rendering Shift
[actual manuscript prose]
```

---

## Six-Part Diagnostic Definitions

### Symptom

What is visibly happening on the page?

### Cause

What craft mechanism is causing the symptom?

### Fix Strategy

What kind of revision is needed?

### Reader Impact

What does the reader lose, miss, misunderstand, or feel less strongly because of the problem?

### Evidence

What exact manuscript excerpt or location supports the finding?

### Operation / Targeting

What executable change will be applied, and where?

---

## Candidate Text Definition

`candidate_text` means actual manuscript prose.

It is the text the author can accept, copy, or customize.

It is not:

- a diagnosis
- a recommendation
- a rationale
- an instruction
- a summary
- a reader-impact statement
- a criterion explanation
- a generic fallback plan

---

## Required A/B/C Roles

### A — Recommended Repair

The best default fix.

Must be:

- least disruptive
- faithful to the manuscript
- directly responsive to the issue
- safe for one-click acceptance

### B — Rhythm Variant

Same repair goal, different rhythm.

Must be:

- materially distinct from A
- still faithful to the passage
- not merely a paraphrased rationale

### C — Bolder Rendering Shift

A stronger rendering.

May adjust:

- image
- cadence
- camera angle
- emotional weight
- beat structure

Must not introduce unsupported plot facts.

---

## Forbidden Candidate Text Patterns

Reject candidate text that includes meta-editorial language such as:

```text
should
could
would
will improve
will sharpen
gives readers
shows
expand
clarify
strengthen
fix
repair
keeps momentum
causal engine
primary repair path
secondary variant
alternative variant
from the evaluation
recommended repair
rhythm variant
bolder rendering
suggested replacement
apply the same repair goal
preserve author voice
review this opportunity
choose the least disruptive repair
```

These may appear in diagnostic/rationale fields when appropriate, but not in `candidate_text`.

---

## Forbidden Internal Leakage

Never expose internal artifact keys as author-facing candidate text.

Reject candidate text containing:

```text
NARRATIVEDRIVE:recommendation
PROSECONTROL:recommendation
evaluation_result
criteria.recommendations
provenance
recommendation:4
location pending
no excerpt available
```

---

## Ready vs Needs Targeting

A queue item is Ready only if:

1. It has an issue statement.
2. It has the six diagnostic elements.
3. It has exact evidence or a justified manuscript-wide source.
4. It has an executable operation.
5. It has a target location or selected passage.
6. It has three valid candidate texts.
7. A/B/C are materially distinct.
8. Candidate text is copy-paste ready.
9. Candidate text does not repeat the diagnostic.
10. Candidate text contains no internal artifact leakage.

Otherwise classify it as Needs Targeting.

---

## Golden Example

### Issue Statement

Newton’s first response to Twillow needs a visible choice beat before the attack escalates.

### Diagnostic Brief

Symptom: The scene jumps from Twillow’s threat to Newton being hit before Newton makes an active choice.

Cause: Newton’s internal and physical response is summarized too quickly, so the reader does not see him choose whether to fold, freeze, flee, or fight.

Fix Strategy: Insert a short embodied decision beat after Twillow’s command and before the first strike.

Reader Impact: The reader understands Newton’s fear, courage, and agency sooner, making the attack feel more consequential.

Evidence: “Move aside, Small Fry. We spotted those slugs first!”

Operation / Targeting: Insert new prose immediately after Twillow’s line.

### A — Recommended Repair

```text
Newton held the morsel between his teeth and went still. The muck gripped both feet, but that was not the only reason he stayed. Twillow’s shadow covered the slugs, then Newton’s forelegs, then his throat.

He swallowed hard, set one sore foot deeper into the mud, and made himself remain between Twillow and the food.
```

### B — Rhythm Variant

```text
Newton froze with the food still in his mouth. The smart thing was to spit it out, lower his head, and let Twillow pass.

Instead, he swallowed.

Then he stayed exactly where he was.
```

### C — Bolder Rendering Shift

```text
Newton’s jaws stopped working. The slug went soft and tasteless in his mouth as Twillow filled the world in front of him. Every lesson his mother had ever hummed into him said move, live, forgive.

His feet sank deeper.

Not this time.
```

---

## Bad Example

```text
A — Suggested replacement

Making Newton’s decision and its fallout concrete will sharpen stakes and give readers a clear causal engine.
```

Reject this.

Reason:

- This is rationale, not manuscript prose.
- It cannot be inserted into the manuscript.
- It belongs in reader impact or rationale, not A/B/C.

---

## Output Instructions For Downstream Queue Generation

When generating Revise Queue items, return JSON only.

Use this structure:

```json
{
  "contract_version": "revise_queue_v2",
  "priority": "should",
  "criterion": "Narrative Drive & Momentum",
  "operation": "insert_after_selected_passage",
  "readiness": "ready_for_revise",
  "issue_statement": "",
  "diagnostic": {
    "symptom": "",
    "cause": "",
    "fix_strategy": "",
    "reader_impact": "",
    "evidence": {
      "quoted_excerpt": "",
      "location_label": "",
      "artifact_source": ""
    },
    "operation_note": "",
    "mistake_proofing": ""
  },
  "target": {
    "chapter": "",
    "section": "",
    "anchor_text": "",
    "selected_text": "",
    "location_label": ""
  },
  "options": [
    {
      "key": "A",
      "role": "recommended_repair",
      "label": "A — Recommended Repair",
      "candidate_text": "",
      "rationale": ""
    },
    {
      "key": "B",
      "role": "rhythm_variant",
      "label": "B — Rhythm Variant",
      "candidate_text": "",
      "rationale": ""
    },
    {
      "key": "C",
      "role": "bolder_rendering_shift",
      "label": "C — Bolder Rendering Shift",
      "candidate_text": "",
      "rationale": ""
    }
  ]
}
```

---

## Final Phase 0 Rule

Before any Revise Queue item is persisted or rendered, ask:

> Are A/B/C actual manuscript prose?

If yes, validate and render.

If no, regenerate or route to Needs Targeting.
