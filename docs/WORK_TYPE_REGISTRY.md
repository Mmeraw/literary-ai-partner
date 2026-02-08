# Work Type Registry

**Authority:** Canonical Reference  
**Status:** LOCKED  
**Effective Date:** 2026-01-04  
**Last Updated:** 2026-02-08

---

## Executive Summary

This registry defines the complete, exhaustive set of Work Types recognized by RevisionGrade. Each Work Type is a structural form (not a genre, not a market, not a vibe) used solely to determine which criteria apply.

**Every text must land in exactly one Work Type. That Work Type must fully determine which criteria are Required, Optional, or N/A.**

---

## Canonical Work Type IDs (Immutable)

The following Work Type IDs are locked and backward-compatible. New IDs require a new matrix version.

---

## Prose Nonfiction Family

### personalEssayReflection

| Field | Value |
|-------|-------|
| **ID** | `personalEssayReflection` |
| **Label** | Personal essay / reflection |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
First-person reflective prose centered on meaning, insight, change, values; not obligated to include scenes/dialogue. Focus is interior—the writer's thoughts, realizations, and growth.

**Detection Hints (Structural Cues Only):**
- High "I/me/my" density
- Thesis statements or central questions
- Rhetorical questions
- Reflective transitions ("As I look back…", "I realized…", "I learned…")
- Low dialogue (or none)
- No scene headers or screenplay markers
- Word length modest to long

**Criteria Plan:**  
See [`MDM_WORK_TYPE_CANON_v1.md`](./MDM_WORK_TYPE_CANON_v1.md) for R/O/NA matrix.

---

### memoirVignette

| Field | Value |
|-------|-------|
| **ID** | `memoirVignette` |
| **Label** | Memoir vignette |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
A bounded memory moment with concrete details; may have scene qualities but remains non-fiction. Often a single episode or turning point in a larger life story.

**Detection Hints:**
- Past-tense memory framing ("I remember…", "When I was…")
- Time/place anchors (specific dates, locations, names)
- Sensory detail (what you saw, heard, felt)
- Named people (family members, friends, specific individuals)
- Brief dialogue possible but not formatted as script
- Bounded scope (one moment, one scene equivalent)

---

### memoirChapterNarrative

| Field | Value |
|-------|-------|
| **ID** | `memoirChapterNarrative` |
| **Label** | Narrative memoir chapter |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Extended memoir section with progression, turning points, and narrative momentum across pages. Multiple scenes or episodes woven into a larger arc.

**Detection Hints:**
- Chapter-length (several pages)
- Clear arc across sections
- Multiple beats/mini-scenes
- Consistent narrator voice
- Intermittent dialogue possible
- Time progression visible

---

### creativeNonfiction

| Field | Value |
|-------|-------|
| **ID** | `creativeNonfiction` |
| **Label** | Creative non-fiction (lyrical / braided / narrative) |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Non-fiction using literary techniques (braiding, lyric fragments, associative structure). Higher stylistic ambition than straight memoir.

**Detection Hints:**
- Section breaks or fragments
- Braided timelines or perspectives
- Poetic cadence
- Mixture of reflective and sensory details
- Non-linear structure
- Less straightforward narrative than memoir chapter

---

### professionalNonfictionSample

| Field | Value |
|-------|-------|
| **ID** | `professionalNonfictionSample` |
| **Label** | Professional non-fiction sample |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Informational/industry writing, essays for business/technical audiences, "how-to," explainer style. Emphasizes clarity and utility.

**Detection Hints:**
- Headings/subheadings
- Definitions and explanations
- Structured argument
- Low imagery, high specificity
- Citations/figures/data
- Instructional tone

---

### opinionEditorial

| Field | Value |
|-------|-------|
| **ID** | `opinionEditorial` |
| **Label** | Opinion / editorial |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Persuasive viewpoint piece meant to argue a position; may include rhetorical conflict.

**Detection Hints:**
- Strong claims and opinions
- "Should/must" language
- Argument structure with counters/rebuttals
- Calls to action
- Topical framing

---

### academicAnalyticalProse

| Field | Value |
|-------|-------|
| **ID** | `academicAnalyticalProse` |
| **Label** | Academic / analytical prose |
| **Family** | `prose_nonfiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Research/analysis voice; thesis + evidence; formal structure; may use references. Audience is scholarly or intellectual.

**Detection Hints:**
- Abstract-like opening (thesis statement)
- Citations and footnotes
- Methods/analysis sections
- Formal diction
- Low narrative beats

---

## Prose Fiction Family

### flashFictionMicro

| Field | Value |
|-------|-------|
| **ID** | `flashFictionMicro` |
| **Label** | Flash fiction / micro-fiction |
| **Family** | `prose_fiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Very short fiction prioritizing compression, implication, punch ending/turn. Under 1,500 words typically.

**Detection Hints:**
- Very low word count
- High density
- Often one central moment
- Twist/turn or surprise ending
- Minimal exposition

---

### shortStory

| Field | Value |
|-------|-------|
| **ID** | `shortStory` |
| **Label** | Short story |
| **Family** | `prose_fiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Complete fictional arc in short form; characters + tension + resolution/turn.

**Detection Hints:**
- Title + narrative arc
- Fictional character names
- Implied world/setting
- Some scene structure
- Resolution/turning point present

---

### novelChapter

| Field | Value |
|-------|-------|
| **ID** | `novelChapter` |
| **Label** | Novel chapter |
| **Family** | `prose_fiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
A chapter excerpt from a longer fictional work; often ends with forward pull. Part of a larger narrative arc.

**Detection Hints:**
- "Chapter" labels or numbering
- Recurring cast
- References to earlier events
- Chapter-ending hook (promise of continuation)
- Longer length (several pages)

---

### literaryFictionGeneral

| Field | Value |
|-------|-------|
| **ID** | `literaryFictionGeneral` |
| **Label** | Literary fiction (general) |
| **Family** | `prose_fiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Character/voice/theme-forward fiction; may de-emphasize plot mechanics. Elevated style and interiority.

**Detection Hints:**
- Elevated or distinctive prose style
- Deep interiority and character voice
- Thematic motifs
- Less explicit genre tropes
- Subtle conflict possible

---

### genreFictionGeneral

| Field | Value |
|-------|-------|
| **ID** | `genreFictionGeneral` |
| **Label** | Genre fiction (general) |
| **Family** | `prose_fiction` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Fiction driven by genre conventions (thriller, horror, romance, fantasy, mystery, sci-fi, etc.).

**Detection Hints:**
- Clear stakes and external goals
- Genre markers (investigation, monster, magic, chase, romance beats)
- Higher plot velocity
- Expected genre tropes present

---

## Prose Scene Family

### proseScene

| Field | Value |
|-------|-------|
| **ID** | `proseScene` |
| **Label** | Prose scene (fiction or memoir) |
| **Family** | `prose_scene` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
A single scene unit in prose (one time/place/beat cluster), not a chapter. Bounded scope with immediate action.

**Detection Hints:**
- Single location/time focus
- Strong present action
- Minimal chapter framing
- Often begins in medias res
- Bounded length

---

## Script Scene Family

### scriptSceneFilmTv

| Field | Value |
|-------|-------|
| **ID** | `scriptSceneFilmTv` |
| **Label** | Script scene (film/TV) |
| **Family** | `script_scene` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
One scene formatted as screenplay/teleplay (sluglines/action/dialogue). Self-contained visual unit.

**Detection Hints:**
- INT./EXT. sluglines
- Character cues (capitalized, centered)
- Dialogue blocks
- Action lines (non-dialogue narrative)
- Parentheticals (emotional direction)
- Scene numbers sometimes present

---

## Screenplay / Feature Family

### featureScreenplay

| Field | Value |
|-------|-------|
| **ID** | `featureScreenplay` |
| **Label** | Feature screenplay |
| **Family** | `screenplay_feature` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Full feature-length screenplay format; multi-scene arc. 90–120 pages typically.

**Detection Hints:**
- Title page elements (INT./EXT. sluglines)
- "FADE IN / FADE OUT"
- Frequent sluglines
- Scene count visible
- Act turns implied

---

## Television Family

### televisionPilot

| Field | Value |
|-------|-------|
| **ID** | `televisionPilot` |
| **Label** | Television pilot |
| **Family** | `tv_pilot` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Pilot teleplay establishing series engine, world, tone, and recurring characters.

**Detection Hints:**
- "PILOT" labeling or marking
- Teaser/act structure (cold open)
- Series setup beats
- Recurring character introductions
- Episodic hooks

---

### televisionEpisode

| Field | Value |
|-------|-------|
| **ID** | `televisionEpisode` |
| **Label** | Television episode (non-pilot) |
| **Family** | `tv_episode` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Teleplay for an existing series episode (non-origin). Standalone story within established world.

**Detection Hints:**
- Episode title/number
- Established cast assumed
- Act structure (typical 4–6 acts for TV)
- Less world setup, more story-of-week
- Series continuity references

---

## Stage Play Family

### stagePlayScript

| Field | Value |
|-------|-------|
| **ID** | `stagePlayScript` |
| **Label** | Stage play / theatrical script |
| **Family** | `stage_play` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Stage format with dialogue + stage directions; may include act/scene markers. Performance script for theater.

**Detection Hints:**
- "ACT I / SCENE 1" labels
- Stage directions (in parentheses or separate lines)
- Character list (dramatis personae)
- Dialogue-heavy
- Fewer sluglines than screenplay

---

## Submission Materials Family

### queryPackage

| Field | Value |
|-------|-------|
| **ID** | `queryPackage` |
| **Label** | Query package |
| **Family** | `submission_materials` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Query letter + synopsis/metadata components for submission to agents/publishers.

**Detection Hints:**
- "Dear Agent" salutation
- Comps (comparable titles)
- Word count and genre
- Logline present
- Author bio and housekeeping
- Submission-focused tone

---

### synopsis

| Field | Value |
|-------|-------|
| **ID** | `synopsis` |
| **Label** | Synopsis |
| **Family** | `submission_materials` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Plot summary (beginning–middle–end), often including ending; not prose chapter. Comprehensive story overview.

**Detection Hints:**
- Present tense summary style
- Named characters + plot beats
- Compressed timeline
- Ending revealed
- Minimal line artistry

---

### pitchOrLogline

| Field | Value |
|-------|-------|
| **ID** | `pitchOrLogline` |
| **Label** | Pitch / logline |
| **Family** | `submission_materials` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
One-liner / short pitch used for marketing or submission. Extremely compressed story hook.

**Detection Hints:**
- Very short (often 1–3 sentences)
- "When X, Y must Z or else…" structure
- High-concept phrasing
- Stakes compacted
- No scene detail

---

### treatmentOrSeriesBible

| Field | Value |
|-------|-------|
| **ID** | `treatmentOrSeriesBible` |
| **Label** | Treatment / series bible |
| **Family** | `submission_materials` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Overview document for film/TV: premise, characters, arcs, season plan, tone guide.

**Detection Hints:**
- Sections: premise/characters/episodes
- Bullet-like structure
- "Season 1" planning visible
- Tone comps
- Broad character/story arcs

---

### outlineOrProposal

| Field | Value |
|-------|-------|
| **ID** | `outlineOrProposal` |
| **Label** | Outline / proposal |
| **Family** | `submission_materials` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Structured plan of the work; beat outline; chapter outline; proposal sections.

**Detection Hints:**
- Numbered beats
- Chapter lists
- Bullet points
- "Act 1/2/3" structure
- Synopsis-like but structured
- Meta commentary on approach

---

## Hybrid / Other Family

### hybridExperimental

| Field | Value |
|-------|-------|
| **ID** | `hybridExperimental` |
| **Label** | Hybrid or experimental work |
| **Family** | `hybrid_other` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
Cross-form writing that intentionally breaks conventions; routed conservatively.

**Detection Hints:**
- Mixed formatting (essay + dialogue + fragments)
- Nonstandard typography
- Inconsistent structural signals
- "Experimental" markers or author statement

---

### otherUserDefined

| Field | Value |
|-------|-------|
| **ID** | `otherUserDefined` |
| **Label** | Other (user-defined) |
| **Family** | `hybrid_other` |
| **Introduced** | v1.0.0 |
| **Status** | active |

**Description:**  
User-specified form when detector is uncertain or when none of the above fit cleanly. Authoritative override key.

**Detection Hints:**
- Triggered by user override
- Free-text description provided
- Often used when detection is ambiguous or intentionally unconventional

---

## Detection Confidence Policy (Global)

Detection is **advisory only**. Only user confirmation authorizes routing.

| Confidence | Meaning | System Behavior |
|------------|---------|-----------------|
| **High** | Strong structural certainty | Auto-suggest + confirm |
| **Medium** | Likely but with ambiguity | Suggest + require confirm |
| **Low** | Weak signal | Ask user to select / override |

**Rule:**  
Detection may propose. Only the user confirmation (or explicit override) authorizes routing.

---

## UI Contract (Training-Safe)

**Required UX Pattern:**

```
"Detected work type: <Label>. Confirm?"

[Confirm] [This isn't right → Select another] [Other → Describe]
```

**Prohibited UX Patterns:**
- ❌ Silent auto-routing
- ❌ Defaulting to a work type without confirmation
- ❌ Forcing users to misclassify to proceed

---

## Approved Families (Enumerated in Schema)

The following families are locked in the JSON schema and must be used exactly as shown:

1. `prose_nonfiction`
2. `prose_fiction`
3. `prose_scene`
4. `script_scene`
5. `screenplay_feature`
6. `tv_pilot`
7. `tv_episode`
8. `stage_play`
9. `submission_materials`
10. `hybrid_other`

Any new family requires a matrix version change and explicit governance review.

---

## Change Management & Deprecation

### Adding a New Work Type

1. Update the matrix version (e.g., v1.0.0 → v1.1.0)
2. Add the new Work Type with all 13 criteria keys (Invariant MDM-01)
3. Assign one of the approved families (Invariant MDM-02)
4. Document detection hints
5. Update this registry
6. Push to GitHub
7. Re-validate in staging
8. Announce to team + Base44

### Deprecating a Work Type

1. Mark `status = deprecated` in the registry
2. Mark in matrix version notes
3. Keep backward compatible (old evaluations still reference it)
4. Hide from UI for new users (optional)
5. Never delete

### Name / Label Changes

Once a Work Type ID is in production, the ID is immutable. Labels may be refined but are discouraged.

---

## References

- See: [`docs/MDM_WORK_TYPE_CANON_v1.md`](./MDM_WORK_TYPE_CANON_v1.md) — Governance invariants, controls, and enforcement semantics
- See: [`docs/MDM_IMPLEMENTATION_RUNBOOK.md`](./MDM_IMPLEMENTATION_RUNBOOK.md) — How to wire this into code
- Master Data: [`functions/masterdata/work_type_criteria_applicability.v1.json`](../functions/masterdata/work_type_criteria_applicability.v1.json)
