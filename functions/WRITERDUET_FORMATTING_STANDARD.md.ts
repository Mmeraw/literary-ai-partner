# RevisionGrade™ Screenplay Formatting Standard
**WriterDuet Compatible Specification – v1.0 (Dec 2025)**

**Scope:** Spec scripts and AI-generated screenplay output. Shooting script elements (scene numbers, shot lists, detailed camera instructions) are deliberately out of scope.

This document defines the formatting conventions RevisionGrade uses to generate and evaluate screenplays, aligned with contemporary American spec script standards and compatible with WriterDuet .txt import.

---

## CORE CONVENTIONS

### 1. Title Page
- The title page lives outside the script body.
- Authoring tools (WriterDuet, etc.) generate it.
- The script body begins with **FADE IN:** or the first scene heading.

### 2. Scene Headings (Sluglines)
- **Format:** `INT.` or `EXT.` + LOCATION + `–` + TIME OF DAY
- **Example:** `EXT. HIGHWAY – DAY`
- ALL CAPS, left-aligned.
- One blank line before and after.
- Use an **en dash** between location and time: `–`
- Use **CONTINUOUS** only for truly immediate continuity (no time jump).

### 3. Secondary Headings / Sub-Slugs
- Inside an established scene, you may use short sub-headings for shifts in focus:
  - `LATER` / `SAME` / `KITCHEN` etc.
- Keep them in ALL CAPS and left-aligned.
- Use sparingly and only when they help readability.

### 4. Character Introduction (Spec Standard)
- First time a tracked character appears in action:
  - ALL CAPS name + brief identifier:
    - `MIKE (60s), ex-military, drives alone.`
- If it's a one-off extra who never speaks, no need to cap.
- If they speak (even once), cap them on first action mention:
  - `A FARM WORKER whispers.`

### 5. Action Paragraphing
- Action lines describe only what is visually or audibly happening on screen.
- Left-aligned, no indent. Present tense.
- Break into short, shootable blocks (2–4 lines each).
- Fragments for rhythm are fine, but avoid relying on "unfilmables" alone; pair inner states with physical behavior.

### 6. Em Dashes
- Use a true em dash `—` with **no spaces** inside normal sentences:
  - `Flatland slides by—corn, potatoes, dust.`
- Allow **spaced em dashes** only when used as a label separator, e.g.:
  - `GLYPH VISIBLE: ● — the symbol pulses once, then disappears.`

### 7. Sound Cues (SFX)
- Treat as action lines with a consistent tag:
  - `SFX: CRACK! A shot echoes across the valley.`
- ALL CAPS tag `SFX:` followed by sentence-case description.
- Use consistently throughout the script.

### 8. Dialogue Formatting
- **Character names:**
  - ALL CAPS, centered (~3.5" from left margin).
- **Dialogue:**
  - Directly under the name, indented ~2.5".
  - No blank line between name and dialogue.
  - Avoid long monologues; break after 4–5 lines where possible.
- **NO quotes needed** — the character name indicates speech.

### 9. Parentheticals
- Optional; used to clarify delivery or brief action attached to the line.
- Placed between name and dialogue.
- Indented slightly more than dialogue (~3.0").
- Must be short (ideally one line).

### 10. Voiceover, Off-Screen, and Continued
- Add tags beside the character name:
  - `(V.O.)` for voiceover.
  - `(O.S.)` for off-screen.
  - `(CONT'D)` is optional; generally managed by software.
- Example:
  ```
  MIKE (V.O.)
  ```

### 11. Transitions
- Right-aligned (~6.0" from left margin), ALL CAPS:
  - `CUT TO:`
  - `FADE OUT.`
  - `SMASH TO:` etc.
- One blank line before each transition.
- Use transitions sparingly in spec scripts.

### 12. Hyphens and Portability
- Use standard hyphens `-` for compounds (`nose-out`).
- Avoid non-breaking hyphens or non-ASCII characters that may break .txt imports.

---

## WRITERDUET COMPATIBLE .TXT TEMPLATE

```
EXT. LOCATION NAME – TIME OF DAY

Action line goes here. Describe what is visually happening on screen.
Use present tense. No indent. Break into short paragraphs every 3–5 lines.

                                CHARACTER NAME
                    (optional parenthetical here)
            Dialogue begins here. It is indented 2.5" from the left margin.
            Do not insert a blank line between the character and their dialogue.

                                OTHER CHARACTER
            Dialogue continues. Avoid stacking more than 4–5 lines at a time.

Action resumes here. Again, no indent. Keep spacing readable.

SFX: A sharp crack. Something reacts in the distance.

GLYPH VISIBLE: ● — the symbol pulses once, then disappears.

                                VOICE NAME (V.O.)
            Voiceover dialogue. Add (V.O.) after name. Still indented the same.

                                CHARACTER NAME
                    (low, whispering)
            Parentheticals must stay short and directly relate to delivery.

                                CHARACTER NAME
            More dialogue. Do not add double spaces anywhere in the .txt file.

                                                        CUT TO:


INT. SECOND LOCATION – LATER

New scene heading with same format.

A new beat begins. Describe only what's visually/audibly happening onscreen.

                                CHARACTER NAME
            Dialogue can appear, but style consistency is key.

More action. More movement. Keep your formatting tight.

                                                        FADE OUT.
```

---

## VISUAL LAYOUT SUMMARY

| Block Type | Alignment | Indent | Notes |
|------------|-----------|--------|-------|
| Scene Heading | Left-aligned | None | ALL CAPS |
| Action Line | Left-aligned | None | Paragraph format |
| Character Name | Centered | ~3.5" (36–40 spaces) | ALL CAPS |
| Dialogue | Left-aligned | ~2.5" (24 spaces) | Never blank-line within block |
| Parenthetical | Left-aligned | ~3.0" (28 spaces) | Optional, brief |
| SFX / GLYPH | Left-aligned | None | ALL CAPS + colon |
| Transitions | Right-aligned | ~6.0" (56 spaces) | One blank line before and after |
| Voiceovers | Centered | Same as dialogue | Use (V.O.) in name line |

---

## LINE SPACING GUIDELINES

| Element | Spacing Guideline |
|---------|------------------|
| Between Paragraphs | One blank line between blocks (scene headings, action, dialogue, transitions) |
| Between Dialogue Lines | No blank line within a dialogue block (character name, parenthetical, and dialogue are grouped together) |
| Scene Headings | One blank line before and after |
| Action Paragraphs | One blank line before and after |
| Transitions | One blank line before |

---

## ADVANCED CASES

### Camera Directions (Use Sparingly)
- Write as natural action lines, not labeled directions:
  - ✅ `Close-up on ZIMEON's dorsal ridges twitching.`
  - ❌ `CAMERA: Close-up on ZIMEON's dorsal ridges...`

### Montage / Series of Shots
```
MONTAGE – TRAINING SEQUENCE

-- Mike runs through the desert, sweat pouring.

-- He climbs a rocky outcrop, breath labored.

-- Collapses at the summit, staring at the horizon.

END MONTAGE
```

### Phone / Intercut
```
INTERCUT – PHONE CONVERSATION

                                MIKE
            Where are you?

                                SARAH
            Safe. For now.
```

### Foreign Language Dialogue
- Use standard character cue, add subtitles in action:
```
                                RAÚL
            (in Spanish)
            ¿Dónde está el jefe?

Subtitle: "Where is the boss?"
```

### Internal Scene Dividers
- Use `***` sparingly for ritual/ceremonial pacing within a single scene number.
- Not a hard cut—softer than `CUT TO:`.

---

## IMPORT/EXPORT NOTES

### For WriterDuet .txt Import:
1. Use ONE blank line between sections (not two).
2. Keep character names consistently spelled (including accents).
3. Avoid curly quotes in dialogue (use straight quotes `"` or none).
4. Use standard hyphens `-` not special/non-breaking hyphens.
5. Em dashes: use `—` (Unicode 2014) consistently.

### Character First Appearance:
- `HUGO BOSS KID (early 20s)` in action line before first dialogue.
- After first appearance, can use normal case in action (`Mike`, `Raúl`).

### ALL CAPS Emphasis in Action:
- Use sparingly for critical beats:
  - `ZIMEON FREEZES. Not in fear. In recognition.`
- Avoid for regular motion (`WALKS`, `TURNS`, `LOOKS`).

---

## FORMATTING AUDIT CHECKLIST

- [ ] Scene headings: `INT./EXT. LOCATION – TIME` with en dash
- [ ] Character first appearances: ALL CAPS in action
- [ ] Dialogue: no quotes, character name centered
- [ ] Em dashes: tight in sentences, spaced for labels
- [ ] SFX formatted as action line with `SFX:` tag
- [ ] Transitions: right-aligned, ALL CAPS, minimal use
- [ ] Parentheticals: brief, essential delivery only
- [ ] Action: present tense, visual, filmable only
- [ ] No curly quotes, special hyphens, or encoding issues

---

**Version:** 1.0 (December 2025)  
**Platform:** RevisionGrade™  
**Compatibility:** WriterDuet, Final Draft, Celtx (via .txt)