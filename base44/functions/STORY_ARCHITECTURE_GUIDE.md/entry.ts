# Story Architecture Layer — Narrative Integrity & Closure Rules
## Detection Guide for Structural Failures Beyond Line-Level Craft

---

## Purpose

This guide defines detection rules for **narrative architecture failures** that break reader trust at the structural level. These are not stylistic preferences—they are:
- Physics-of-the-world violations
- Unresolved narrative promises
- Thematic motifs that don't pay off
- Structural disunity masquerading as complexity

**Critical Distinction:**
- **WAVE** = sentence/paragraph craft (filters, adverbs, dialogue tags)
- **Story Architecture** = cross-scene logic, causality, closure, promise-keeping

These rules feed **Criterion 12/13: Narrative Closure & Promises Kept**

---

## Rule 1: Physical State Continuity (PSC)

### Definition
Objects, environments, and physical conditions cannot exist in mutually exclusive states simultaneously unless the text provides transition language or causal explanation.

### Why This Matters
Physical contradictions break reader trust at a subconscious level. Readers track the physics of the story world—when it violates its own rules without signal, immersion breaks.

### Mutually Exclusive State Pairs
- **wet ↔ dry**
- **fresh ↔ long-aged**
- **clean ↔ grimy/dirty**
- **intact ↔ broken/damaged**
- **warm ↔ cold**
- **recently disturbed ↔ long-abandoned**
- **bright/vivid ↔ sun-bleached/faded**
- **sharp/crisp ↔ blurred/smudged** (unless actively transitioning)

### Detection Pattern
Flag when:
1. Same object receives contradictory physical descriptors within close proximity
2. No transition language exists ("after the rain," "someone had recently...")
3. Contradiction is not clearly intentional (surrealism, magic, etc.)

### Canonical Example

❌ **Violation:**
> "The notice curled at the corners, a film of dust over the paper. Blue Sharpie smeared like it was still wet where someone had dragged their thumb across it."

**Why it fails:** Curling + dust = age/neglect. Wet smear = fresh disturbance. Cannot coexist without explanation.

✅ **Fix Options:**
1. **Keep aged state:** "The notice curled at the corners, a film of dust over the paper, the blue Sharpie long since blurred by rain and fingers."
2. **Keep fresh state:** "The notice's corner had just begun to curl, dust not yet settled, blue Sharpie still wet where someone had dragged a thumb through it."
3. **Explain contradiction:** "The notice curled at the corners, dust caught along the edge, but a fresh streak of blue showed where someone had recently tried to rub the name away."

### What This Rule Does NOT Block
- Intentional surrealism or magical realism
- Metaphor or deliberate juxtaposition
- Symbolism over realism
- Voice-driven distortion

### Output Format
```json
{
  "violation_type": "Physical State Continuity",
  "location": "Chapter X, paragraph Y",
  "object": "[description]",
  "conflict": "[aged state] + [fresh state] without transition",
  "severity": "Moderate",
  "suggested_action": "Choose one state OR add causal explanation",
  "criterion_affected": "Criterion 12: Narrative Closure & Promises Kept",
  "auto_fix_allowed": false
}
```

---

## Rule 2: Narrative Promise Completion (Thread Closure)

### Definition
Major narrative elements (characters, conflicts, questions, motifs, symbols) introduced with weight must either:
1. **Resolve on-page**
2. **Be explicitly marked as intentionally open**
3. **Be acknowledged as abandoned/lost**

### Why This Matters
Agents and readers track narrative contracts. When threads vanish without closure or acknowledgment, it reads as oversight, not craft.

### Thread Types
1. **Character threads:** Named characters with stakes
2. **Conflict threads:** Tensions/arguments/ruptures
3. **Question threads:** Explicit narrative questions
4. **Motif/symbol threads:** Central metaphors (e.g., "trophy")
5. **Relationship threads:** Bonds/ruptures with arc implications

### Detection Pattern
Flag when:
1. Character with stakes appears, then vanishes without exit line
2. Conflict introduced but no escalation/resolution/acknowledgment
3. Explicit question raised but never answered or reframed
4. Title or central metaphor not structurally paid off
5. Relationship arc starts but doesn't complete

### Canonical Example (from TROPHY BOY/TROPHY MAN)

❌ **Violation:**
> "I had singled out three women and extended each an invitation: **Diane. Computer programmer. Age 35. She was my favorite. First choice.**"
> [Diane never mentioned again]

**Why it fails:** Character introduced with priority stakes ("favorite," "first choice"), then disappears without on-page acknowledgment.

✅ **Fix Options:**
1. **Explicit closure:** "Diane never showed up."
2. **Acknowledged mystery:** "I never learned why Diane didn't come."
3. **Later callback:** "Years later I'd realize Diane made the smartest choice."

### What This Rule Does NOT Block
- Intentional ambiguity (if clearly signaled: "That answer never came.")
- Background characters with no stakes (waiters, clerks)
- Atmospheric mentions (passing references)
- Literary open endings (if structurally earned through pattern)

### Output Format
```json
{
  "violation_type": "Unresolved Narrative Thread",
  "thread_type": "Character | Conflict | Question | Motif | Relationship",
  "location": "Chapter X",
  "element": "[description]",
  "severity": "Moderate",
  "suggested_action": "Add closure line OR mark as intentionally open",
  "criterion_affected": "Criterion 12: Narrative Closure & Promises Kept",
  "auto_fix_allowed": false
}
```

---

## Rule 3: Thematic/Structural Unity (Braided Narratives)

### Definition
If a manuscript uses **multiple timeframes or narrative threads**, they must converge toward:
- A single dramatic question, OR
- A thematic resolution that recontextualizes all threads

**Violation:** Parallel threads that merely accumulate (without causality or final synthesis) read as essays or vignettes, not unified story.

### Why This Matters
Agents read for structural intent. If multiple timelines don't clearly serve a single question, the manuscript reads as "two stories stapled together."

### Detection Pattern
Flag when:
1. Multiple timeframes exist without clear causal link
2. No **hinge moment** connects the threads
3. No **final interpretive turn** that reframes earlier material
4. Title or central metaphor introduced but not structurally resolved

### Canonical Example (from TROPHY BOY/TROPHY MAN)

❌ **Violation:**
- **2012 section:** Narrator as "trophy boy" for older man (Utku)
- **1985 section:** Narrator as "trophy man" in naval whites (women as trophies)
- **NO explicit hinge** connecting these as origin → consequence
- **NO final turn** where narrator recognizes trophy/hunter pattern in himself

**Why it fails:** Two strong vignettes sit side-by-side but don't resolve into unified argument. Reader must supply connective tissue.

✅ **Fix Options:**
1. **Add hinge sentence:** "Long before Raj, I'd already learned what trophies cost."
2. **Add closing reframe:** "I wasn't just a trophy. I was running my own tournament."
3. **Structural adjustment:** Open with brief present-tense frame questioning trophy dynamics → cut to 2012/1985 as evidence → return to present with new understanding

### What This Rule Does NOT Block
- Intentionally fragmented structures (if pattern is clear)
- Multi-POV novels (if each POV advances shared question)
- Anthology-style collections (if framed as such)

### Output Format
```json
{
  "violation_type": "Structural Disunity",
  "issue": "Multiple narrative threads without convergence",
  "threads_detected": ["2012: Trophy boy", "1985: Trophy man"],
  "missing_element": "Causal hinge OR final interpretive turn",
  "severity": "Hard",
  "suggested_action": "Add bridging language OR closing reframe that unifies timelines",
  "criterion_affected": "Criterion 12: Narrative Closure & Promises Kept",
  "auto_fix_allowed": false
}
```

---

## Rule 4: Exposition vs. Enacted Scene (Scene Compression)

### Definition
Narrative weight should fall on **scenes of choice and consequence**, not on explanatory blocks or technical background. Overlong exposition stalls momentum and reads as research notes, not lived experience.

### Why This Matters
Agents skim or skip exposition. They read for **stakes-bearing scenes**. If technical/historical detail exceeds story necessity, it signals manuscript isn't ready.

### Detection Pattern
Flag when:
1. Multi-paragraph blocks explain systems, history, or context without character stakes
2. Wikipedia-style citations or URLs embedded in narrative
3. Technical/historical detail exceeds story necessity (>3 sentences on background)
4. Essay voice replaces scene voice for extended passages

### Canonical Example (from TROPHY BOY/TROPHY MAN)

❌ **Violation:**
- Extended CARIBOPS operations list (8+ technical items)
- Full F-14 specs + Top Gun cultural context (box office rankings, release dates)
- Embedded Wikipedia URLs inside narrative blocks

**Why it fails:** These blocks add texture but don't alter character stakes or advance trophy/aging theme. They read as research, not scene pressure.

✅ **Fix Options:**
1. **Compress to one sharp detail:** "The F-14 pilots. Women wanted bragging rights."
2. **Embed in scene beat:** "She asked if I flew Tomcats. I told her helicopters. Her eyes moved on."
3. **Delete entirely** if not weight-bearing for central question

### What This Rule Does NOT Block
- World-building in genre fiction (if integrated with stakes)
- Technical detail that carries thematic weight (e.g., rhinoplasty = trophy maintenance)
- One-line precision details that sharpen character (Porsche model, Botox clinic name)

### Output Format
```json
{
  "violation_type": "Exposition Overload",
  "location": "Chapter X, paragraphs Y-Z",
  "issue": "Research/background crowding out scene stakes",
  "word_count_affected": 450,
  "severity": "Moderate",
  "suggested_action": "Compress to 1-2 weight-bearing details OR delete",
  "criterion_affected": "Criterion 6: Structure, Pacing & Flow",
  "auto_fix_allowed": false
}
```

---

## Rule 5: Essay Drift (POV Integrity at Macro Scale)

### Definition
First-person narrative can shift into **essayistic generalization** ("women are...," "you would think..."), which:
- Breaks scene immersion
- Reveals unexamined biases
- Replaces observed behavior with narrator assertion

**Fix:** Generalizations about groups must be converted to specific observed behavior OR self-aware framing.

### Why This Matters
Agents read for **dramatized insight**, not lecture. Essay drift reads as:
- Defensive over-explanation
- Lack of trust in reader intelligence
- Failure to distinguish scene from thesis

### Detection Pattern
Flag when:
1. Narrator makes sweeping claims about groups ("women can smell money")
2. Multiple "you would think..." constructions
3. Interpretive paragraphs that restate what scene already showed
4. Defensive or justifying tone (explaining choices reader should judge)

### Canonical Example (from TROPHY BOY/TROPHY MAN)

❌ **Violation:**
> "Women can smell money, or opportunity. Those near military bases are well trained to read uniform insignia, looking for Officers..."

**Why it fails:** Sweeping claim about all women near bases; could be shown through specific behavior at Breezy Point instead.

✅ **Fix Options:**
1. **Convert to observed behavior:** "Three women at the bar turned when I walked in. One of them pointed at my wings."
2. **Self-aware framing:** "I assumed they could smell rank and money—maybe I wanted to believe that."
3. **Delete** if not essential to trophy/power theme

### What This Rule Does NOT Block
- Reflective voice (if grounded in scene consequence)
- Thesis statements **earned** through accumulated evidence
- Narrator self-awareness about their own blind spots

### Output Format
```json
{
  "violation_type": "Essay Drift / Generalization",
  "location": "Paragraph X",
  "issue": "Sweeping claim about group behavior without scene support",
  "severity": "Soft",
  "suggested_action": "Convert to specific observed scene OR add self-aware framing",
  "criterion_affected": "Criterion 2: Narrative Voice & Style",
  "auto_fix_allowed": false
}
```

---

## Integration with WAVE System

Story Architecture detection runs **before** WAVE line-level checks.

### Detection Flow
1. **Story Architecture Layer** scans for:
   - Physical state contradictions (PSC)
   - Unresolved narrative threads
   - Structural disunity (braided narratives)
   - Exposition overload
   - Essay drift
2. **Flags violations** with context and severity
3. **Feeds severity** into Criterion 12/13 scoring
4. **Does NOT auto-correct** (author decision required)

### Priority Order
1. **Structural Unity** (hardest to fix late)
2. **Thread Closure** (agents stop reading if promises aren't kept)
3. **Exposition Compression** (easy win for momentum)
4. **Physical State Continuity** (immersion integrity)
5. **Essay Drift** (voice polish)

### Unified Output Schema
```json
{
  "story_architecture_violations": [
    {
      "violation_type": "Physical State Continuity | Thread Closure | Structural Disunity | Exposition Overload | Essay Drift",
      "location": "Chapter X, paragraph Y",
      "severity": "Soft | Moderate | Hard",
      "issue_description": "...",
      "suggested_action": "...",
      "criterion_affected": "Criterion 12: Narrative Closure & Promises Kept",
      "auto_fix_allowed": false
    }
  ],
  "overall_closure_score": 7.5,
  "closure_status": "Mostly resolved with 2 suspect threads",
  "recommended_fixes": [
    "Add closure line for Diane thread",
    "Insert hinge sentence connecting 2012 and 1985 sections"
  ]
}
```

---

## Testing & Validation

**Gold Standard Test Case:** TROPHY BOY / TROPHY MAN
- Tests all 5 Story Architecture rules
- Real-world manuscript with professional-level prose but structural gaps
- Demonstrates difference between WAVE (line-level) and Architecture (cross-scene)

**Success Criteria:**
- System correctly flags all 5 violation types in test manuscript
- No false positives on intentional ambiguity or voice-driven choices
- Severity classifications match human editorial judgment
- Output is actionable (not prescriptive)

---

**END OF STORY ARCHITECTURE GUIDE**