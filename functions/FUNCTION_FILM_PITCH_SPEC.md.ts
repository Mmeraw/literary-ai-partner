# Function Spec: generateFilmPitchDeck
**5-Field Contract** | **Phase:** 0 Complete | **Version:** 1.0.0

---

## 1. INPUTS

**Accepted Types:**
- `manuscriptId`: string (required, reference to Manuscript entity)
- `pitchType`: enum (feature | series | limited_series) - default: feature
- `targetAudience`: enum (mainstream | prestige | indie | genre) - default: mainstream
- `visualStyle`: string (optional, e.g., "neo-noir", "epic fantasy")
- `comparableFilms`: array of strings (optional, film/show titles)

**Size Limits:**
- Input manuscript: minimum 40,000 words (full manuscript required)
- Output pitch deck: 8-12 slides (structured JSON)

**Visible Ingestion:**
- FilmAdaptation or PitchGenerator page shows manuscript selection
- Pitch type selector visible (feature vs series)
- Target audience dropdown
- Optional fields for customization
- Generation progress shown (multi-phase)

**Validation at Entry:**
- matrixPreflight validates manuscript >= 40,000 words
- Manuscript MUST have spine_evaluation completed
- Manuscript type should be novel or screenplay

---

## 2. ROUTING

**Pipeline Selection:**
- Film pitch requires full_manuscript scale ONLY
- No routing variations—single path

**Routing Logic:**
```
IF manuscript.wordCount < 40000 THEN BLOCK (full manuscript required)
IF manuscript.spine_evaluation is NULL THEN BLOCK (evaluation required)
IF pitchType = "series" AND manuscript.continuity_report is NULL THEN WARN (series requires continuity analysis)
ELSE proceed to pitch generation
```

**Content Extraction:**
1. Logline from spine_evaluation
2. Character arcs from spine or continuity report
3. Thematic elements from evaluation
4. Act structure from spine (adapt to film structure)
5. Visual/tonal notes from style analysis

---

## 3. VALIDATION

**Hard Fails (Block Execution):**
- Manuscript < 40,000 words
- Manuscript not evaluated (no spine)
- Manuscript not found
- Invalid pitchType parameter
- User not authenticated

**Soft Fails (Warn but Proceed):**
- No comparable films provided (LLM suggests comps)
- No visual style specified (extracted from manuscript)
- Series pitch without continuity report (proceeds but warns)

**Validation Sequence:**
1. Auth check (401 if fails)
2. Manuscript retrieval (404 if not found)
3. matrixPreflight (422 if < 40k words)
4. Spine evaluation check (422 if missing)
5. Pitch type validation (400 if invalid)
6. Optional field validation (warn if missing)

**Visibility:**
- All validation failures return standardized refusal response
- Missing optional fields shown with defaults
- Series pitch warning shown if continuity missing

---

## 4. OUTPUTS

**Artifact Type:** FilmPitchDeck (JSON + structured slides)

**Required Fields:**
```json
{
  "pitch_id": "string (UUID)",
  "manuscriptId": "string",
  "pitchType": "feature | series | limited_series",
  "slides": [
    {
      "slideNumber": 1,
      "type": "title",
      "content": {
        "title": "string",
        "logline": "string (25 words max)",
        "visualKey": "string"
      }
    },
    {
      "slideNumber": 2,
      "type": "genre_tone",
      "content": {
        "genre": "string",
        "tone": "string",
        "comparables": ["film1", "film2", "film3"]
      }
    },
    {
      "slideNumber": 3,
      "type": "story_summary",
      "content": {
        "acts": ["act1 summary", "act2 summary", "act3 summary"]
      }
    },
    {
      "slideNumber": 4-8,
      "type": "characters | themes | visuals | market | creative_team"
    }
  ],
  "metadata": {
    "manuscriptTitle": "string",
    "targetAudience": "string",
    "estimatedRuntime": "number (minutes)",
    "generated_at": "ISO 8601"
  }
}
```

**Format:**
- JSON response with `{ success: true, pitchDeck: {...} }`
- Success: 200 OK
- Validation block: 422 Unprocessable Entity

**Gating:**
- MUST include 8-12 slides (no more, no less)
- Logline MUST be ≤25 words
- Each slide MUST have type + content
- Comparables MUST be real films/shows (validated via LLM)
- Visual style MUST align with genre/tone

**Storage:**
- Saved to user's pitch deck collection
- Versioned (user can regenerate with different parameters)

---

## 5. AUDIT

**Required Events:**
- Event: FILM_PITCH_GENERATED (success) or FILM_PITCH_BLOCKED (blocked)
- Entity: EvaluationAuditEvent

**Required Fields:**
```json
{
  "event_id": "evt_{timestamp}_{random}",
  "request_id": "{manuscript_id}_filmpitch",
  "timestamp_utc": "ISO 8601",
  "function_id": "generateFilmPitchDeck",
  "canon_hash": "FILM_PITCH_DECK_QUALITY_STANDARD_v1.0",
  "governance_version": "1.0.0",
  "user_email": "user@example.com",
  "manuscript_id": "{id}",
  "pitch_type": "feature | series | limited_series",
  "target_audience": "mainstream | prestige | indie | genre",
  "slide_count": "{number}",
  "comparables_provided": true | false,
  "matrix_preflight_allowed": true,
  "llm_invoked": true
}
```

**Sentry Integration:**
- Errors captured with manuscript and pitch context

---

## Canon Reference

- Governed by: `FILM_PITCH_DECK_QUALITY_STANDARD.md` v1.0
- Input validation: `PHASE_1_GOVERNANCE_EVIDENCE.md`

---

## Test Coverage

- Manual QA: Generate pitch for novel → feature, novel → series
- Slide structure validation automated

**Acceptance Criteria:**
✅ Blocks manuscript < 40,000 words  
✅ Requires evaluated manuscript  
✅ Generates 8-12 slides  
✅ Logline ≤25 words  
✅ All slide types present  
✅ Comparables validated  
✅ Audit event logged