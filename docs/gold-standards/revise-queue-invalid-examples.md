# Revise Queue Invalid Examples

## Purpose

This document defines examples that must fail Revise Queue V2 validation.

These are not style preferences. They are contract violations.

If any of these appear in A/B/C candidate prose, the item must not render as Ready. It must be regenerated or moved to Needs Targeting.

---

# Core Invalid Pattern

The most common failure is putting diagnostic or recommendation prose inside A/B/C.

Bad:

```text
A — Suggested replacement

Making Newton’s decision and its fallout concrete will sharpen stakes and give readers a clear causal engine.
```

Why invalid:

- It is not manuscript prose.
- It says what the fix would do.
- It cannot be inserted into the manuscript.
- It repeats the diagnostic function inside the candidate slot.

Correct:

```text
A — Recommended Repair

Newton held the morsel between his teeth and went still. The muck gripped both feet, but that was not the only reason he stayed.
```

---

# Invalid Example 1 — Repeating the Issue Statement

## Input

```json
{
  "issue_statement": "At the Chapter 1 face-off where Twillow says “Move aside, Small Fry,” expand Newton’s immediate response into a full beat showing his choice.",
  "candidate_text": "At the Chapter 1 face-off where Twillow says “Move aside, Small Fry,” expand Newton’s immediate response into a full beat showing his choice."
}
```

## Expected Result

```text
INVALID
```

## Reason

The candidate repeats the issue statement instead of providing manuscript prose.

---

# Invalid Example 2 — Reader Impact in Candidate Slot

## Input

```json
{
  "candidate_text": "Making Newton’s decision and its fallout concrete will sharpen stakes and give readers a clear causal engine."
}
```

## Expected Result

```text
INVALID
```

## Reason

This is reader-impact rationale, not manuscript prose.

---

# Invalid Example 3 — Generic Repair Instruction

## Input

```json
{
  "candidate_text": "Apply the same repair goal with a lighter touch, preserving more of the original cadence."
}
```

## Expected Result

```text
INVALID
```

## Reason

This is an instruction to an editor or model, not a proposed revision.

---

# Invalid Example 4 — Fallback Planning Text

## Input

```json
{
  "candidate_text": "Review this opportunity and choose the least disruptive repair that preserves author voice."
}
```

## Expected Result

```text
INVALID
```

## Reason

This is fallback workflow guidance. It is not candidate prose.

---

# Invalid Example 5 — Structural Planning Text in A/B/C

## Input

```json
{
  "candidate_text": "Re-sequence or deepen the affected beat so setup, pressure, and payoff carry through the relevant span."
}
```

## Expected Result

```text
INVALID
```

## Reason

This belongs in `fix_strategy` or `mistake_proofing`, not in `candidate_text`.

---

# Invalid Example 6 — Internal Artifact Leakage

## Input

```json
{
  "candidate_text": "NARRATIVEDRIVE:recommendation"
}
```

## Expected Result

```text
INVALID
```

## Reason

Internal artifact keys are not author-facing candidate prose.

---

# Invalid Example 7 — Criterion Leakage

## Input

```json
{
  "candidate_text": "This revision improves Narrative Drive & Momentum by adding a clearer causal engine."
}
```

## Expected Result

```text
INVALID
```

## Reason

Criterion explanation is diagnostic language. It cannot be accepted into the manuscript.

---

# Invalid Example 8 — "Should" Language

## Input

```json
{
  "candidate_text": "Newton should pause before Twillow hits him so the reader sees his choice."
}
```

## Expected Result

```text
INVALID
```

## Reason

The candidate tells what should happen instead of writing it.

Correct:

```text
Newton paused before Twillow reached him. His sore foot slid deeper into the mud, and still he did not move.
```

---

# Invalid Example 9 — "Could" Language

## Input

```json
{
  "candidate_text": "Newton could remain in place and show that he is choosing not to flee."
}
```

## Expected Result

```text
INVALID
```

## Reason

This is a possible plan, not a manuscript patch.

---

# Invalid Example 10 — Rationale Disguised as Option

## Input

```json
{
  "candidate_text": "This keeps Newton sympathetic while making his agency more visible."
}
```

## Expected Result

```text
INVALID
```

## Reason

This belongs in rationale, not candidate text.

---

# Invalid Example 11 — Missing Target

## Input

```json
{
  "operation": "insert_after_selected_passage",
  "target": {},
  "candidate_text": "Newton held the morsel between his teeth and went still."
}
```

## Expected Result

```text
NEEDS_TARGETING
```

## Reason

The prose may be valid, but the system does not know where to apply it.

---

# Invalid Example 12 — Missing Evidence

## Input

```json
{
  "evidence": {
    "artifact_source": "NARRATIVEDRIVE:recommendation"
  },
  "target": {
    "location_label": "Location pending"
  }
}
```

## Expected Result

```text
NEEDS_TARGETING
```

## Reason

The author-facing evidence and target are not specific enough.

---

# Invalid Example 13 — Duplicated A/B/C Options

## Input

```json
{
  "options": [
    {
      "key": "A",
      "candidate_text": "Newton held the morsel between his teeth and went still."
    },
    {
      "key": "B",
      "candidate_text": "Newton held the morsel between his teeth and went still."
    },
    {
      "key": "C",
      "candidate_text": "Newton held the morsel between his teeth and went still."
    }
  ]
}
```

## Expected Result

```text
NEEDS_TARGETING
```

## Reason

A/B/C must be materially distinct.

---

# Invalid Example 14 — Option Label Inside Candidate Text

## Input

```json
{
  "candidate_text": "A — Recommended Repair: Newton held the morsel between his teeth and went still."
}
```

## Expected Result

```text
INVALID
```

## Reason

The label belongs to the UI, not the manuscript patch.

Correct candidate text:

```text
Newton held the morsel between his teeth and went still.
```

---

# Invalid Example 15 — Rationale Appended to Candidate Text

## Input

```json
{
  "candidate_text": "Newton held the morsel between his teeth and went still. This makes the choice more visible for the reader."
}
```

## Expected Result

```text
INVALID
```

## Reason

The first sentence is candidate prose. The second sentence is rationale. They must be separated.

Correct:

```json
{
  "candidate_text": "Newton held the morsel between his teeth and went still.",
  "rationale": "This makes the choice more visible for the reader."
}
```

---

# Validation Checklist

A candidate is invalid if it answers any of these questions with "yes":

1. Does it tell the author what to do?
2. Does it explain why the revision works?
3. Does it mention the reader?
4. Does it mention a criterion?
5. Does it use "should," "could," "would," or "will" as editorial language?
6. Does it contain an internal artifact key?
7. Does it repeat the issue statement?
8. Does it contain option labels?
9. Does it contain rationale after manuscript prose?
10. Is it too vague to insert, replace, or copy?

---

# Required Routing

Invalid candidate prose must not render as an actionable A/B/C card.

Route as follows:

```text
Valid candidate prose + exact target = Ready

Valid candidate prose + missing target = Needs Targeting

Diagnostic language in candidate slot = Invalid / Regenerate

Fallback planning text in candidate slot = Invalid / Regenerate

Internal artifact key in candidate slot = Invalid / Regenerate

Repeated issue statement in candidate slot = Invalid / Regenerate
```

---

# Final Rule

When in doubt, ask:

> Could the author copy this exact text into the manuscript?

If no, it is not candidate_text.
