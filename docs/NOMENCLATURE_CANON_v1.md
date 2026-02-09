# NOMENCLATURE CANON v1

**Status:** CANON — Binding

## 1. Purpose and Scope

**Purpose.** This document defines the canonical terminology used by RevisionGrade across storage, code, evaluation, revision, UI, analytics, and AI-assisted generation. Any term used as an identifier, key, enum member, discriminator, or routing value must be drawn from this canon or from the referenced source canons.

**Scope (applies to):** DB schema, JSON contracts, TypeScript unions/types, RPCs, worker code, evaluation fixtures, MDM JSON, CI audits, and API payloads.

**Out of scope:** Free-form narrative text inside user manuscripts, natural-language rationales, and marketing copy—except where such text is used to drive logic or storage.

## 2. Canon Sources (Authorities)

This document is an index and coordination layer. It does not replace the sources below.

| Canon Source ID | Document | Domain of Authority |
|---|---|---|
| MDM_WORK_TYPE_CANON_v1 | `docs/MDM_WORK_TYPE_CANON_v1.md` + `criteria_matrix_v1.0.0_work_type_to_criteria_status_master_data_management_MDM.json` | Work-type IDs, criteria applicability (R/O/NA/C), MDM semantics |
| WORK_TYPE_REGISTRY_v1 | `docs/WORK_TYPE_REGISTRY.md` | Work-type display labels |
| CRITERIA_KEYS_v1 | `schemas/criteria-keys.ts` + `docs/governance/CRITERIA_KEYS.md` | Canonical 13 evaluation criteria IDs |
| CRITERIA_13_v1 | `functions/13_STORY_CRITERIA.md.ts` | Criteria definitions, rubrics, and evaluative meaning |
| WAVE_CANON_v1 | `functions/WAVE_GUIDE.md.ts` + `functions/WAVE_TEST_CASES.json.ts` | WAVE tiers, wave identifiers, revision semantics |
| VOICE_CANON_v1 | `functions/VOICE_PRESERVATION_CANON.md.ts` | Voice, stance, preservation rules |
| SCHEMA_NAMING_CANON_v1 | `docs/SCHEMA_CODE_NAMING_GOVERNANCE.md` | One-concept–one-key naming rules |
| JOB_CONTRACT_v1 | `docs/JOB_CONTRACT_v1.md` + `docs/CANON_PHASE_STATUS_LOCKED.md` | Canonical job status and phase status vocabulary |

**Rule.** Together, these sources define the legal vocabulary of the system. This document indexes them and records banned aliases.

## 3. Domain Index

### 3.1 Evaluation Criteria Canon (13 Axes)

**Source:** CRITERIA_KEYS_v1; CRITERIA_13_v1

**Canonical IDs (only valid keys):**

- concept
- narrativeDrive
- character
- voice
- sceneConstruction
- dialogue
- theme
- worldbuilding
- pacing
- proseControl
- tone
- narrativeClosure
- marketability

**Invalid aliases (non-exhaustive; banned as keys):**

| Canonical key | Invalid aliases | Boundary note |
|---|---|---|
| narrativeDrive | plot, stakes, momentum, tensionLevel | Ingredients vs. overall propulsion |
| proseControl | craft, clarity, style, lineQuality | Line-level execution only |
| character | characterArc, protagonistDepth | Use `character` only |
| sceneConstruction | structure, beats, threeAct | Scene-level structure |
| tone | authority, mood, vibe | Authority lives with tone + voice canon |
| narrativeClosure | payoff, ending, resolution | End-state resolution only |
| marketability | marketFit, commercial | Separate from MDM `marketability` scope |

**Rule.** No automatic aliasing. Unknown keys are errors.

### 3.2 MDM Criteria & Work Types

**Source:** MDM_WORK_TYPE_CANON_v1; WORK_TYPE_REGISTRY_v1

**Canonical MDM Criterion IDs:**
hook, voice, character, conflict, theme, pacing, dialogue, worldbuilding, stakes, linePolish, marketFit, keepGoing, technical

**Status codes:** R, O, NA, C (only)

**Canonical Work Type IDs (from `criteria_matrix_v1.0.0_work_type_to_criteria_status_master_data_management_MDM.json`):**

- personalEssayReflection
- memoirVignette
- novelChapter
- shortStory
- featureScreenplay
- scriptSceneFilmTv
- flashFictionMicro
- proseScene
- otherUserDefined

**Rule.** IDs are canonical in storage and routing. UI labels may vary.

### 3.3 WAVE Revision System

**Source:** WAVE_v11

**Canonical tiers:** early, mid, late

**Rule.** Use tier IDs and wave IDs only; no ad-hoc names.

### 3.4 Voice & Stance

**Source:** VOICE_CANON_v1

**Rule.** Use only canonical voice/stance mode keys defined in the Voice Canon. Do not invent new identifiers.

### 3.5 Jobs, Phases, Flags

**Source:** JOB_CONTRACT_v1; SCHEMA_NAMING_CANON_v1

**Canonical JobStatus values (storage):** `queued`, `running`, `complete`, `failed`.

**Rule.** One concept → one key. No alternate status/phase identifiers. Do not persist display-only values.

## 4. Rules of Use

1. **Canonical-only in storage & routing.**
2. **Descriptive language allowed in rationales/UI, never as keys.**
3. **No automatic aliasing.**
4. **New terms require ratification + version bump.**

## 5. Enforcement Hooks

- Machine canon derives from this index.
- Validators reject unknown or banned keys.
- CI audits fail on drift.
- AI must follow `AI_GOVERNANCE.md`.
