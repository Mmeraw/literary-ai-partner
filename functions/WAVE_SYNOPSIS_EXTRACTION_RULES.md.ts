# WAVE Synopsis & Logline Extraction Rules

## Purpose
This document defines binding rules for synopsis and logline generation across all RevisionGrade outputs (synopsis, pitch, agent package, comps, query support).

---

## Synopsis & Logline Extraction Rules (WAVE-Aligned)

**When WAVE is used to generate or evaluate synopses, jackets, or loglines, the following rules are binding:**

### 1. POV and Protagonist
In first-person or tight close POV, the POV character is the **default protagonist** (Rule W-P1).

A different protagonist may be named **only if** the text clearly and consistently centers that other character's goals and decisions across the work.

Any synopsis or logline that names a different "main character" must **justify that choice on the page, not in speculation**.

### 2. Page-Time Threshold for Central Roles
No character may be labeled protagonist, co-protagonist, or antagonist unless they:
- **Appear in the main narrative body**
- **Act in-scene**, and
- **Influence outcomes in a material way** (Rule W-C2)

Characters who only appear in titles, epigraphs, acknowledgments, notes, or framing conversations **cannot be elevated to central roles**.

### 3. Antagonist Optionality (Memoir / Essay / Observational Nonfiction)
For memoir, personal essay, and observational nonfiction, it is **WAVE-compliant to state that no single human antagonist exists** (Rule W-A3).

In these forms, opposition may be:
- **Situational** (e.g., anonymity, poverty, illness, bureaucracy)
- **Environmental** (e.g., systems, culture, geography)
- **Internal** (e.g., shame, addiction, self-betrayal)

Synopsis and logline text **must not invent a human villain simply to satisfy a three-act template**.

### 4. Meta-Lens Containment
Figures who function primarily as **interpretive lenses, title contributors, or thematic commentators** (e.g., someone who suggests a title or articulates a later "lesson") are **contextual contributors, not central characters** (Rule W-M4).

Reflective end-notes, bullet lists, or later discussions **cannot override the concrete events** when determining:
- Who the story is about
- Who or what is in opposition

### 5. Required Checks for Any AI-Generated Synopsis/Logline

**Every AI-generated synopsis or logline must pass these checks before acceptance:**

**Protagonist Check:**
- Named main character = POV character (for first-person/close POV), unless a human reviewer explicitly overrides with justification

**Page-Time Check:**
- No character with minimal on-page presence is described as "the main character," "central figure," or "primary antagonist"

**Antagonist Check:**
- For memoir/essay/observational work, the text may say: "Opposition is situational/environmental/internal; there is no single human antagonist," instead of forcing one

**Meta Check:**
- No character mentioned only in title notes, afterwords, or thematic commentary is promoted to protagonist/antagonist status

**If any of these checks fail, the synopsis/logline is not WAVE-compliant and must be revised or rejected.**

---

## Implementation Binding

These rules are enforced in:
- `functions/generateSynopsis.js` - WAVE-SYN validators
- `functions/WAVE_GUIDE.md` - Canonical WAVE-SYN section
- `functions/tests/synopsis_regression_culture.json` - Regression test fixture

All synopsis generation must validate against these rules before acceptance.