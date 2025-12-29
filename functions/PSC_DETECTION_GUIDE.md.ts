# Physical State Continuity (PSC) Detection Guide

## Rule Definition

**Physical State Continuity (PSC)**: An object, environment, or physical condition cannot be in mutually exclusive states at the same time unless the text clearly shows a transition or cause.

## Detection Layer
- **Primary:** Story Architecture / Narrative Continuity
- **Scoring:** Criterion 13 (Narrative Closure & Promises Kept)
- **Cross-reference:** WAVE Guide (World Logic section)

---

## Mutually Exclusive State Pairs

The system should flag when these pairs appear together without transition:

1. **wet ↔ dry**
2. **fresh ↔ long-aged**
3. **clean ↔ grimy/dirty**
4. **intact ↔ broken/damaged**
5. **warm ↔ cold**
6. **recently disturbed ↔ long-abandoned**
7. **bright/vivid ↔ sun-bleached/faded**
8. **sharp/crisp ↔ blurred/smudged (unless actively drying)**

---

## Trigger Pattern (Canonical Example)

### Error Pattern
```
The notice curled at the corners, a film of dust over the paper. Blue Sharpie smeared like it was still wet where someone had dragged their thumb across it.
```

**Why flagged:**
- State A: aged (curling, dusty) = time exposure
- State B: fresh (wet ink) = recency
- No transition/cause provided

---

## Fix Options (Author Chooses)

### Option 1: Keep "aged" state, make disturbance old
```
The notice curled at the corners, a film of dust over the paper, the blue Sharpie long since blurred by rain and fingers.
```

### Option 2: Keep "fresh" state, minimize age cues
```
The notice's corner had just begun to curl, dust not yet settled, blue Sharpie still wet where someone had dragged a thumb through it.
```

### Option 3: Explain the contradiction explicitly
```
The notice curled at the corners, dust caught along the edge, but a fresh streak of blue showed where someone had recently tried to rub the name away.
```

---

## System Output Format

When PSC violation detected:

```json
{
  "flag_type": "Physical State Continuity Conflict",
  "location": "Chapter 1, paragraph 3",
  "object": "missing-person notice",
  "conflict": "Described as long-aged (curling, dusty) and freshly smeared (wet ink) with no indicated cause or timing",
  "contradictory_states": ["aged/weathered", "freshly wet"],
  "impact": "Can break reader trust by making the world feel physically inconsistent",
  "suggested_actions": [
    "Pick one dominant state (aged OR fresh)",
    "Add transition language ('after last night's rain...')",
    "Insert causal explanation ('where someone recently touched it...')"
  ]
}
```

---

## What This Rule Does NOT Do

❌ **Does not block:**
- Intentional surrealism ("The snow fell upward")
- Metaphor ("Her words were ice and fire")
- Magic/supernatural contradictions if established in-world
- Stylistic juxtaposition when clearly deliberate

✅ **Only flags when:**
- Reader cannot tell if contradiction is deliberate or accidental
- The world's internal logic appears broken
- Trust in narrative reliability is at risk

---

## Additional Examples

### ❌ Error: Temperature Conflict
```
The room was freezing, breath visible in the air. Sweat beaded on his forehead.
```
**Fix:** Add cause: `The room was freezing, but sweat still beaded on his forehead from the sprint up the stairs.`

### ❌ Error: Damage State
```
The glass was pristine, not a scratch. Spiderweb cracks radiated from the center.
```
**Fix:** Choose one: `The glass had been pristine until five minutes ago. Now spiderweb cracks radiated from the center.`

### ✅ Acceptable: Transition Present
```
The flyer had been clean yesterday. Now it was torn and mud-spattered.
```

---

## Integration Points

1. **Story Architecture Function** (`analyzeNarrativeContinuity.js`)
   - Add PSC as thread type
   - Detect contradictory state descriptions
   - Flag when no transition present

2. **Criterion 13 Scoring** (`13_STORY_CRITERIA.md`)
   - Include PSC violations in "Narrative Closure & Promises Kept"
   - Ask: "Are physical, temporal, and causal states internally consistent?"

3. **WAVE Guide Cross-Reference** (optional)
   - Brief note in World Logic section
   - Direct users to Story Architecture layer for full PSC detection