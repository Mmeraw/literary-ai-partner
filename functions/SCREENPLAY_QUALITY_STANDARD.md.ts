# Screenplay Quality Standard (WriterDuet Mode)
**RevisionGrade™ Industry-Standard Script Formatting**

## Core Philosophy
**"Import-safe, industry-readable, structurally correct."**

All screenplay excerpts and script pages generated or revised by Base44 must be:
- WriterDuet import-safe
- Final Draft compatible
- Industry-standard formatting
- Visually filmable (no unfilmables)

---

## PURPOSE
Define how all screenplay excerpts and script pages must look when generated or revised by Base44, so they are import-safe for WriterDuet and industry-readable.

---

## CORE CONVENTIONS

### 1. Title Page
- **Title page lives outside the script body**
- Script itself starts with `FADE IN:` or the first slugline, not a title block
- ❌ No embedded title blocks in script content
- ✅ Clean script start: `FADE IN:` or `INT. LOCATION – TIME`

### 2. Sluglines (Scene Headings)
**Format:** `INT./EXT. LOCATION – TIME`

**Rules:**
- All caps: `INT. BEDROOM – NIGHT`
- Use a true en dash `–` between LOCATION and TIME, not a hyphen `-`
- Use `CONTINUOUS` only when the cut is truly immediate
- No extra spaces or punctuation

**Examples:**
- ✅ `INT. KITCHEN – DAY`
- ✅ `EXT. DESERT HIGHWAY – CONTINUOUS`
- ❌ `Int. kitchen - day` (wrong case, wrong dash)
- ❌ `INT. KITCHEN- DAY` (missing space before dash)
- ❌ `INT KITCHEN – DAY` (missing period after INT)

### 3. Character Introductions
**First time a trackable character appears in action:**
- Name in CAPS
- Age if relevant: `MIKE (60s) steps off the bus.`
- Type if relevant: `A YOUNG POLICEMAN approaches.`

**Rules:**
- Background extras with no dialogue: no caps needed
- If an extra speaks once, cap them on first action mention: `A FARM WORKER whispers.`
- One-off background characters without dialogue: lowercase

**Examples:**
- ✅ `MIKE (60s), weathered and quiet, exits the bus.`
- ✅ `A YOUNG POLICEMAN approaches the scene.`
- ❌ `Mike (60s) exits the bus.` (first mention not capped)
- ❌ `A young policeman approaches.` (speaking extra not capped)

### 4. Action Blocks
**All action is in present tense and visually filmable.**

**Rules:**
- Short, shootable paragraphs: break action every 3–5 lines
- Fragments allowed for rhythm, but avoid pure "unfilmables" as the only signal
- No long interior monologues or purely internal states without a physical correlate
- Anchor interiority to physical behavior

**Examples:**
- ✅ `Mike stares at the horizon. His jaw tightens.`
- ✅ `Interest. Not anger.` (rhythmical fragment, sparingly used, anchored to physical beat)
- ❌ `Mike thinks about his past and feels regret washing over him.` (unfilmable interiority)
- ❌ Long action paragraphs exceeding 5 lines without a break

**Rhythm & Pacing:**
```
Mike steps off the bus.

Flatland slides by—corn, scrub, distant power lines.

He breathes. Waits.
```

### 5. Em Dashes Inside Action
**Use true em dash `—` with no spaces on either side:**

**Examples:**
- ✅ `Flatland slides by—corn, scrub, distant power lines.`
- ✅ `He pauses—then moves forward.`
- ❌ `Flatland slides by — corn, scrub, distant power lines.` (spaces around dash)
- ❌ `Flatland slides by - corn, scrub, distant power lines.` (hyphen instead of em dash)

**Consistency Rule:** Use this pattern everywhere in action lines.

### 6. Sound Cues
**Use a single, consistent system:**

**Format:** `SFX: CRACK!`

**Rules:**
- All caps for the sound itself: `CRACK!`, `THUD!`, `BANG!`
- Consistent pattern throughout the script
- No weird fonts or symbols
- No mixing of styles (`BANG!` vs `SFX BANG` vs `(BANG!)`)

**Examples:**
- ✅ `SFX: CRACK!`
- ✅ `SFX: DISTANT SIRENS`
- ❌ `BANG!` (inconsistent with rest of script using SFX:)
- ❌ `(sound: bang)` (lowercase, inconsistent)

### 7. Dialogue Formatting
**Character names:** centered, ALL CAPS (WriterDuet handles centering on import)

**Rules:**
- Use `(O.S.)` and `(V.O.)` consistently and only when correct
- No blank line between character name and dialogue block
- Parentheticals are brief and essential, not full-line directions or emotions

**Examples:**
```
MIKE
I'm not going back.

SARAH (O.S.)
You don't have a choice.
```

**Parentheticals:**
- ✅ `MIKE\n(quietly)\nI know.`
- ❌ `MIKE\n(He feels sad and doesn't want to go)\nI know.` (parenthetical too long, unfilmable emotion)

### 8. Hyphens and Portability
**Use standard hyphens for compounds:**

**Examples:**
- ✅ `nose-out`, `half-finished`, `ex-wife`
- ❌ Non-breaking hyphens, special hyphens that can corrupt on export
- ❌ Smart hyphens that misalign on export

**Safe Hyphen Rule:** Only use standard ASCII hyphen `-` in compound words.

---

## ROUTING RULE: SCREENPLAY MODE VS PROSE MODE

### Mode: "screenplay"
**Enforces the above standards.**

**When to use:**
- User asks for scenes/pages in script form
- Output intended for WriterDuet/Final Draft
- Generating screenplay excerpts or revisions

**Behavior:**
- Turns on stricter checks: no inline quotes styling, no curly quotes messing sluglines
- No narrative paragraphs masquerading as action
- Prioritizes structure and formatting correctness alongside content
- All formatting rules from this document are mandatory

### Mode: "prose-adaptation"
**Looser formatting, allowed to use paragraphs, internal thought, rhetorical devices.**

**When to use:**
- Prose adaptation summaries
- Novel-to-film analysis
- Coverage-style summaries (not actual script pages)

**Behavior:**
- Uses prose voice; not constrained by INT./EXT. or dialogue blocks
- Allowed to use internal monologue
- Can use narrative description, not limited to visual filmables

**Decision Rule:**
> "If the user is asking for scenes/pages in script form or anything meant for WriterDuet/Final Draft, always use screenplay mode and apply the Screenplay Quality Standard."

---

## SCREENPLAY QA CHECKLIST (Pre-Output)

Use this whenever Base44 generates screenplay pages or excerpts.

### 1. Mode & Intent
- ✅ Task is clearly flagged as `mode: "screenplay"`, not prose
- ✅ Output is intended for WriterDuet / industry script use, not narrative summary

### 2. Sluglines
- ✅ All scene headings are in the form: `INT./EXT. LOCATION – TIME`
- ✅ LOCATION and TIME are in ALL CAPS
- ✅ The separator is a true en dash `–`, not a hyphen `-`
- ✅ `CONTINUOUS` is used only when the action truly continues from the previous scene

### 3. Character Introductions
- ✅ First appearance of each trackable character is capped in action: `MIKE (60s)...`
- ✅ Age or type is given where relevant: `MIKE (60s)`, `YOUNG POLICEMAN`, etc.
- ✅ One-off background extras without dialogue are not capped
- ✅ If a background character speaks (even once), they are capped on first action mention: `A FARM WORKER whispers.`

### 4. Action Blocks
- ✅ All action is in present tense and visually filmable
- ✅ Action paragraphs are short (generally 3–5 lines max before a break)
- ✅ Rhythmical fragments (e.g., `Interest. Not anger.`) are used sparingly and anchored to physical behavior
- ✅ No long interior monologues or purely internal states without a physical correlate

### 5. Em Dashes & Punctuation
- ✅ Em dashes inside action are true em dashes `—` with no spaces on either side
- ✅ Example: `Flatland slides by—corn, scrub, distant power lines.`
- ✅ No hyphen `-` is used where em dash `—` is intended
- ✅ No stray special punctuation that could break on export

### 6. Sound Cues
- ✅ A single, consistent sound convention is used throughout, e.g.: `SFX: CRACK!`
- ✅ Sound words are in ALL CAPS (`CRACK!`, `THUD!`, etc.)
- ✅ No mixing of styles (`BANG!`, `SFX BANG`, `(BANG!)`) within the same script

### 7. Dialogue Formatting
- ✅ Character names appear in ALL CAPS, centered (WriterDuet will handle exact centering on import)
- ✅ There is no blank line between the character name and their dialogue block
- ✅ `(O.S.)` and `(V.O.)` are used correctly and consistently
- ✅ Parentheticals are brief and essential, not used for full-line directions or emotions that should be in action

### 8. Hyphens & Portability
- ✅ Only standard hyphens are used in compounds (`nose-out`, `half-finished`)
- ✅ No nonbreaking or unusual hyphen characters that can cause issues on export/import
- ✅ Smart quotes / curly quotes are acceptable only where they don't break sluglines or character labels

### 9. Title Page & Start
- ✅ Title page is not embedded in the script body
- ✅ Script content begins with `FADE IN:` or the first slugline, not a title block

### 10. Tagging Drift (for Feedback Loop)
If something is off, tag the output before fixing:
- ✅ Tag applied if needed (see Tagging System below)

---

## TAGGING SYSTEM FOR SCREENPLAY DRIFT

### Issue Tags
Use these to label formatting violations when reviewing generated pages:

- **`#slugline-format`** — Wrong pattern (missing INT./EXT., wrong dash, not all caps)
- **`#char-intro-missed`** — First appearance not capped or missing age/type
- **`#action-bloat`** — Action paragraphs exceed 5 lines or include unfilmable interiority
- **`#emdash-wrong`** — Spaces around em dash or using hyphen instead of em dash in action
- **`#sound-inconsistent`** — Multiple sound styles (BANG! vs SFX:) within same script
- **`#dialogue-spacing`** — Extra blank lines; parentheticals misused or overused
- **`#hyphen-glitch`** — Nonstandard hyphens that break in export

### Tag Usage
- Apply tags when reviewing generated screenplay pages
- Gives Base44 clear patterns to correct
- Feeds into quality improvement loop

**Example:**
```
Output flagged: #slugline-format, #emdash-wrong
Correction applied: Changed "INT. KITCHEN - DAY" to "INT. KITCHEN – DAY"
Changed "He pauses - then moves" to "He pauses—then moves"
```

---

## EXAMPLES: CORRECT VS INCORRECT

### Correct Screenplay Page
```
FADE IN:

INT. KITCHEN – DAY

MIKE (60s), weathered and quiet, pours coffee.

Flatland slides by—corn, scrub, distant power lines.

He breathes. Waits.

SFX: DISTANT SIRENS

MIKE
I'm not going back.

SARAH (O.S.)
You don't have a choice.

Mike's jaw tightens. He sets the cup down.
```

### Incorrect Screenplay Page (Violations Marked)
```
# TITLE: MY SCREENPLAY  ❌ (title embedded in script)

INT. kitchen - day  ❌ (lowercase, hyphen not en dash)

Mike (60s), weathered and quiet, pours coffee.  ❌ (first mention not capped)
He thinks about his past and feels regret washing over him. He knows he can't go back but part of him wants to. The weight of his decisions press down on him as he stands there in the morning light filtering through the dusty window.  ❌ (action bloat, unfilmable interiority)

He pauses - then moves forward.  ❌ (hyphen instead of em dash)

BANG!  ❌ (inconsistent sound format)

MIKE

(sadly)  ❌ (blank line before dialogue, unfilmable emotion)
I'm not going back.

Sarah (O.S.)  ❌ (character name not all caps)
You don't have a choice.
```

---

## INTERNAL ONBOARDING RULE

**"If it fails this checklist, it doesn't go to the client."**

All screenplay outputs must pass the QA Checklist before delivery.

---

## INTEGRATION WITH FILM PITCH DECK STANDARD

When generating **screenplay-to-pitch-deck** adaptations:
1. Use `mode: "screenplay"` for actual script pages
2. Use Film Pitch Deck Quality Standard for synopsis/logline/deck content
3. Keep screenplay excerpts in the deck formatted per this standard
4. Visual style descriptions in the deck should reference screenplay formatting choices

**Cross-Reference:**
- Screenplay pages → this standard
- Pitch deck slides → Film Pitch Deck Quality Standard
- Coverage summaries → `mode: "prose-adaptation"` with pitch deck guidelines

---

**Last Updated:** 2025-12-31  
**Version:** 1.0  
**Status:** Active Quality Standard  
**Philosophy:** "Import-safe, industry-readable, structurally correct."