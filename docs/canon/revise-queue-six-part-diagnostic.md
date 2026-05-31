# Revise Queue Six-Part Diagnostic Canon

## Purpose

This document defines the diagnostic layer of a Revise Queue item.

The diagnostic layer explains why a revision opportunity exists. It is not the same thing as the revision itself.

A/B/C options are where the manuscript changes.  
The six-part diagnostic is where the editorial reasoning lives.

---

## The Six Elements

Every Revise Queue item must include the following six diagnostic elements.

---

## 1. Symptom

### Definition

The symptom is the visible problem on the page.

It answers:

> What does the reader experience or notice in the manuscript text?

### Good symptom examples

```text
The scene jumps from Twillow’s threat to Newton being hit before Newton makes an active choice.
```

```text
The same predator comparison appears twice in close succession, making the second escalation feel recycled.
```

```text
The grief beat after Newton sees Lacerta’s bracelet resolves too quickly for the emotional weight of the discovery.
```

### Bad symptom examples

```text
Narrative Drive needs improvement.
```

```text
This section should be stronger.
```

```text
The author needs to expand the beat.
```

### Symptom rule

A symptom must describe the on-page craft issue, not name a generic criterion.

---

## 2. Cause

### Definition

The cause explains why the symptom is happening.

It answers:

> What craft mechanism is creating the problem?

### Good cause examples

```text
Newton’s physical and emotional reaction is summarized instead of dramatized, so the reader does not witness the choice that defines the beat.
```

```text
The repeated comparison uses the same interpretive frame for two different escalation moments, flattening the second moment.
```

```text
The scene moves from discovery to departure before Newton’s body registers the loss.
```

### Bad cause examples

```text
The prose is weak.
```

```text
The pacing is bad.
```

```text
The scene does not work.
```

### Cause rule

Cause must identify the craft mechanism, not merely restate the symptom.

---

## 3. Fix Strategy

### Definition

The fix strategy describes the repair approach.

It answers:

> What kind of revision should be performed?

### Good fix strategy examples

```text
Insert a short embodied decision beat after Twillow’s command and before the first strike.
```

```text
Replace the repeated comparison with a fresh image that shows Newton’s warning display failing.
```

```text
Add a contained grief beat before Newton leaves so the bracelet reveal has emotional consequence.
```

### Bad fix strategy examples

```text
Make it better.
```

```text
Fix the pacing.
```

```text
Use stronger prose.
```

### Fix strategy rule

Fix strategy may be instructional because it belongs in the diagnostic layer. It must not appear inside A/B/C candidate prose.

---

## 4. Reader Impact

### Definition

Reader impact explains what the reader gains or loses because of the problem.

It answers:

> Why does this matter to the reader’s experience?

### Good reader impact examples

```text
The reader understands Newton’s fear, courage, and agency sooner, making the attack feel more consequential.
```

```text
The reader feels the escalation more clearly because the second image performs new emotional work.
```

```text
The reader has time to absorb Lacerta’s death through Newton rather than only through plot information.
```

### Bad reader impact examples

```text
This will improve the scene.
```

```text
This will make readers like it more.
```

```text
This helps narrative drive.
```

### Reader impact rule

Reader impact belongs in the diagnostic area only. It must never be used as A/B/C candidate text.

---

## 5. Evidence

### Definition

Evidence identifies the manuscript text or location that triggered the queue item.

It answers:

> Where is the problem visible?

### Evidence hierarchy

Prefer evidence in this order:

1. exact quoted excerpt
2. exact selected passage
3. exact anchor text
4. chapter + paragraph / scene label
5. manuscript-wide pattern with count and source

### Good evidence examples

```text
“Move aside, Small Fry. We spotted those slugs first!”
```

```text
Second occurrence of the hobo spider / wolf spider comparison after Newton flashes his belly poisons.
```

```text
Chapter 4: immediately after “On top, they saw Lacerta’s bracelet.”
```

### Bad evidence examples

```text
NARRATIVEDRIVE:recommendation
```

```text
criteria.recommendations[4]
```

```text
No excerpt available.
```

### Evidence rule

Internal artifact keys may be stored, but they must not be the only author-facing evidence.

If exact evidence is missing, route to Needs Targeting.

---

## 6. Operation / Targeting

### Definition

Operation / Targeting tells the system and the author what kind of change will be made and where.

It answers:

> What action will be applied to what text?

### Good operation examples

```text
Insert new prose immediately after Twillow’s line.
```

```text
Replace the second repeated comparison.
```

```text
Insert a grief beat immediately after the bracelet reveal.
```

```text
Compress Thorander’s lore explanation into a more dramatic father-daughter exchange.
```

### Bad operation examples

```text
Suggested replacement.
```

```text
Improve this.
```

```text
Review this issue.
```

### Operation rule

The operation must be executable. If it is not executable, the item is not Ready.

---

## Optional Seventh Field: Mistake-Proofing

Mistake-proofing is recommended but not part of the core six.

It answers:

> What must the repair avoid breaking?

### Good examples

```text
Do not make Newton sound older, braver, or more articulate than he is in the original scene.
```

```text
Do not erase the playful voice; reduce repetition without flattening the fable-like style.
```

```text
Do not turn Rana’s moral choice into human moralizing. Keep the decision embodied in amphibian action.
```

---

## Diagnostic vs Candidate Boundary

### Diagnostic language may say:

```text
Insert a short embodied decision beat.
```

### Candidate language must enact:

```text
Newton held the morsel between his teeth and went still.
```

The first belongs above the cards.  
The second belongs inside A/B/C.

---

## Canonical Layout

```text
Issue
Newton’s first response to Twillow needs a visible choice beat before the attack escalates.

Diagnostic Brief

Symptom
The scene jumps from Twillow’s threat to Newton being hit before Newton makes an active choice.

Cause
Newton’s physical and emotional reaction is summarized instead of dramatized.

Fix Strategy
Insert a short embodied decision beat after Twillow’s command and before the first strike.

Reader Impact
The reader understands Newton’s fear, courage, and agency sooner.

Evidence
“Move aside, Small Fry. We spotted those slugs first!”

Operation / Targeting
Insert after selected passage.

A — Recommended Repair
Newton held the morsel between his teeth and went still...

B — Rhythm Variant
Newton froze with the food still in his mouth...

C — Bolder Rendering Shift
Newton’s jaws stopped working...
```

---

## Failure Modes

A Revise Queue item fails the diagnostic contract if:

- the symptom is a criterion label
- the cause merely restates the symptom
- the fix strategy is vague
- reader impact is generic
- evidence is an internal artifact key only
- operation is not executable
- A/B/C repeat any diagnostic text
- rationale appears in the candidate prose block

---

## Final Rule

The six-part diagnostic must make the author trust the recommendation.

The A/B/C options must let the author act on it.
