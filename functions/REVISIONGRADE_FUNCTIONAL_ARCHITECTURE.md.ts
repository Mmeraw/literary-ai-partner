# REVISIONGRADE™ FUNCTIONAL ARCHITECTURE (CANON)

**Status:** CANON / BINDING  
**Applies to:** Product, Engineering, QA, Documentation  
**Purpose:** Complete functional pipeline specification for RevisionGrade™  
**Last Updated:** 2026-01-03

---

## OVERVIEW

RevisionGrade™ is a **multi-layer evaluation and output generation system** for creative writing. It accepts any writing format (scene, chapter, screenplay, manuscript) and produces professional-grade analysis and submission materials.

**Core Principle:** One entry point → Smart detection → Dual pipeline → Multi-format output

---

## LAYER 1: INPUT & INGESTION

### User Entry Points

**Primary Entry:**
- Page: `YourWriting` (canonical evaluation entry)
- Method: Direct paste OR file upload
- Formats accepted: .docx, .doc, .pdf, .txt

**Secondary Entries:**
- `UploadManuscript` (legacy full manuscript entry)
- `ScreenplayFormatter` (prose → screenplay conversion before eval)

### Ingestion Functions

**File Processing:**
- `ingestUploadedFileToText` — Extracts text from uploaded files
- `importDocx` — DOCX-specific extraction with formatting preservation
- `convertDocxToText` — Fallback plain text extraction

**Format Preservation:**
- RichTextEditor component preserves italics, bold, spacing
- HTML formatting maintained through pipeline
- Voice-critical formatting flagged for preservation

### Detection Logic

**Automatic Format Detection (CANON - EVALUATE_ENTRY_CANON):**
- Word count thresholds (>10k = full manuscript)
- Screenplay markers (INT./EXT., dialogue blocks, slug lines)
- Chapter headings/numbering detection
- Scene break patterns
- Structural density analysis

**Routing Decision:**
```
IF word_count > 10,000 AND chapter_structure_detected:
    → Full Manuscript Pipeline
ELSE:
    → Quick Evaluation Pipeline
```

---

## LAYER 2: EVALUATION PIPELINES

### Pipeline A: Quick Evaluation (Synchronous)

**Used for:**
- Scenes (any length)
- Single chapters
- Screenplay excerpts
- Short stories
- Full screenplays <10k words

**Function:** `evaluateQuickSubmission`

**Process:**
1. Create Submission entity
2. Run 13 Story Evaluation Criteria analysis
3. Run WAVE craft checks (line-level)
4. Calculate overall score
5. Generate immediate results
6. Return submissionId for report view

**Output:** Immediate synchronous response with full evaluation

---

### Pipeline B: Full Manuscript (Asynchronous)

**Used for:**
- Complete novels
- Long-form manuscripts >10k words
- Episodic screenplays

**Primary Function:** `evaluateFullManuscript`

**Process:**

**Phase 1: Splitting**
- Function: `splitManuscript`
- Creates Chapter entities from full text
- Preserves chapter order, titles, structure
- Status: `splitting` → `summarizing`

**Phase 2: Spine Evaluation (Structure)**
- Function: `evaluateSpine`
- Analyzes narrative structure across all chapters
- Creates chapter summaries for aggregate analysis
- Detects: pacing, arc progression, structural integrity
- Status: `summarizing` → `spine_evaluating` → `spine_complete`

**Phase 3: WAVE Analysis (Craft)**
- Function: `evaluateWaveFlags` (per chapter)
- Three-tier craft analysis: early/mid/late
- Line-level + structural checks
- Chapter-by-chapter progress tracking
- Status: `evaluating_chapters` → `ready` / `ready_with_errors`

**Phase 4: Aggregate Scoring**
- Combines spine score + WAVE scores
- Generates `revisiongrade_overall` (composite 0-10)
- Stores breakdown in `revisiongrade_breakdown`

**Progress Tracking:**
- Real-time `evaluation_progress` object
- Updates: chapters_total, chapters_summarized, chapters_wave_done
- Percent_complete calculation
- Current_step messaging
- Displayed in ManuscriptDashboard

---

## LAYER 3: CORE EVALUATION FUNCTIONS

### 13 Story Evaluation Criteria (Agent-Ready™)

**Function:** `evaluateThirteenCriteria`

**Criteria (from 13_STORY_CRITERIA.md):**
1. Opening Hook
2. Voice & Style
3. Character Development
4. Dialogue
5. Pacing
6. Show Don't Tell
7. Emotional Resonance
8. Plot Structure
9. Conflict & Stakes
10. Setting & World-Building
11. Theme & Subtext
12. Narrative Consistency
13. Market Readiness

**Output:** Per-criterion scores + aggregate agent-readiness score

---

### WAVE Revision System (Craft Analysis)

**Function:** `evaluateWaveFlags`

**WAVE Tiers (from WAVE_GUIDE.md):**

**Early Tier (foundational craft):**
- Sentence clarity
- Word economy
- Showing vs telling
- Action clarity
- POV consistency

**Mid Tier (structural craft):**
- Scene beats
- Tension arcs
- Dialogue tags
- Sensory details
- Transition quality

**Late Tier (polish):**
- Prose rhythm
- Voice consistency
- Subtext
- Paragraph flow
- Final polish checks

**Output:** Per-tier scores + flagged issues with line references

---

### Spine Evaluation (Story Architecture)

**Function:** `evaluateSpine`

**Analysis (from STORY_ARCHITECTURE_GUIDE.md):**
- Narrative continuity
- Arc progression
- Pacing across manuscript
- Structural integrity
- Chapter-to-chapter coherence

**Output:** Spine score (0-10) + structural report

---

### Transgressive Mode (Content-Aware Evaluation)

**Function:** Evaluation mode parameter routing

**Modes (from TRANSGRESSIVE_MODE_SPEC.md):**
- **Standard:** Agent-ready commercial analysis
- **Transgressive:** Craft over comfort, literary extreme
- **Trauma Memoir:** Survivor testimony, psychological truth

**Impact:** Changes evaluation lens, not content filtering

---

## LAYER 4: TRANSFORMATION & CONVERSION

### Screenplay Formatting

**Function:** `formatScreenplay`

**Detection & Conversion:**
- Auto-detects: prose, rough screenplay, formatted script
- Converts prose → visual action lines
- Fixes sluglines (INT./EXT.)
- Formats dialogue blocks
- Removes unfilmable descriptions
- Applies WriterDuet standards (WRITERDUET_FORMATTING_STANDARD.md)

**Output:** Industry-standard screenplay text

---

### Voice Preservation Routing

**Function:** `applyVoiceProtectionRouting`

**Levels (from VOICE_PRESERVATION_CANON.md):**
- **Maximum:** Minimal intervention, preserve raw voice
- **Balanced:** Clarity improvements, voice intact
- **Polish:** Professional editorial standards

**Application:**
- Narration edits allowed (House Voice)
- Dialogue LOCKED (voice-critical)
- Voice anchors detected and preserved

---

## LAYER 5: OUTPUT GENERATION

### Synopsis Generation

**Function:** `generateSynopsis`  
**QA Function:** `runSynopsisQA`

**Output Types:**
- Short (1 paragraph)
- Medium (2-3 paragraphs)
- Long (1 page)

**Process:**
1. Extract manuscript structure
2. Generate synopsis via LLM
3. Run QA validation
4. Store as Synopsis entity

---

### Query Letter Package

**Function:** `generateQueryLetterPackage`

**Components:**
- Query letter (agent-ready format)
- Logline
- Synopsis options
- Author bio reference
- Submission guidelines

**Process:**
1. Extract pitch fields via `extractPitchFields`
2. Generate query via `generateQueryLetter`
3. Apply voice anchors via `applyVoiceAnchorAndSchemaToPitch`
4. Package for download

---

### Film Pitch Deck

**Function:** `generateFilmPitchDeck`

**Components:**
- Logline
- One-page overview
- Beat-level summary
- Visual translation notes
- Tone/audience analysis
- Producer viability score

**Standard:** FILM_PITCH_DECK_QUALITY_STANDARD.md

---

### Market Comparables

**Function:** `generateComparables`

**Output:**
- 5-10 comparable titles
- Genre/market positioning
- Sales data references
- Audience overlap analysis

**Standard:** COMPARABLES_CANON_SPEC.md

---

### Author Biography

**Functions:**
- `extractLinkedInBio` — Pulls professional bio from LinkedIn
- `uploadAndGenerateBio` — Manual file upload + generation
- `generateAuthorBio` — AI-generated from context

**Output:** Professional author bio for submissions

---

### Complete Submission Package

**Function:** `generateCompletePackage`

**Includes:**
- Query letter
- Synopsis (all lengths)
- Author bio
- Market comparables
- Agent list (targeted)
- Submission checklist

**Prefill Function:** `prefillPackageFields`

---

## LAYER 6: REVISION & ITERATION

### Revision Generation

**Function:** `generateRevisionSuggestions`

**Process:**
1. Identify flagged issues from WAVE
2. Generate context-aware suggestions
3. Provide rationale per suggestion
4. Offer alternatives on request

**Output:** RevisionSession with suggestion array

---

### Revision Workflow

**Components:**
- RevisionSession entity (tracks state)
- SuggestionCard component (UI)
- RevisionControls component (accept/reject)
- DownloadOptions (export clean draft)

**States:**
- queued → running → paused → completed

---

### Version Control

**Entities:**
- OutputVersion (tracks versions of outputs)
- RevisionEvent (approval workflow)
- RevisionSegment (granular change tracking)

**Process:**
1. Base version created
2. Revisions proposed
3. User accepts/rejects
4. New version stored
5. Baseline updated on approval

---

## LAYER 7: STORYGATE STUDIO™ (MARKETPLACE)

### Creator Submission

**Function:** `submitStoryGateFilm`

**Process:**
1. Submit project details
2. Attach manuscript reference
3. Auto-score via RevisionGrade
4. Triage: Tier 1 (decline) / Tier 2 (hold) / Tier 3 (review)

**Threshold:** Grade 8-10 = Storygate consideration

---

### Industry Access

**Functions:**
- `createStoryGateListing` — Creator makes project discoverable
- `requestProjectAccess` — Industry user requests access
- `handleAccessRequest` — Creator approves/denies
- `checkProjectAccess` — Validates permissions

**Entities:**
- ProjectListing (visibility control)
- AccessUnlock (permission tracking)
- AccessLog (audit trail)

---

### Verification

**Function:** `handleVerification`

**Process:**
1. Industry user submits credentials
2. Admin reviews via AdminVerificationQueue
3. Approve/reject/revoke
4. Grant discoverable access

**Entity:** IndustryUser

---

## LAYER 8: ANALYTICS & MONITORING

### Analytics Tracking

**Component:** AnalyticsTracker

**Events:**
- Page views
- Evaluation submissions
- Output generation
- User feedback

**Entity:** Analytics

---

### Health Monitoring

**Function:** `checkRouteHealth`

**Monitors:**
- Page load status
- Title verification
- Response times
- Error detection

**Entity:** RouteHealthLog

---

### Feedback Collection

**Component:** FeedbackWidget

**Tracks:**
- Suggestion helpfulness
- Overall satisfaction
- User comments

**Function:** `analyzeFeedback`

---

## LAYER 9: GOVERNANCE & VALIDATION

### Voice Preservation Validation

**Function:** `voiceGuard`

**Checks:**
- Dialogue preservation (LOCKED)
- Voice anchor integrity
- Unauthorized modifications

**Output:** Audit log + QA pass/fail

---

### WAVE Label Validation

**Function:** `validateWaveLabels`

**Ensures:**
- Correct tier assignment
- Label consistency
- Detection accuracy

---

### Gold Standard Validation

**Function:** `validateGoldStandard`

**Tests:**
- Known-good manuscripts
- Regression detection
- Score stability

**Test Cases:** WAVE_TEST_CASES.json

---

## LAYER 10: MANUSCRIPT LIFECYCLE MANAGEMENT

### State Transitions

**Function:** `transitionDocumentState`

**Legal States:**
- UPLOADED → EVALUATED → REVISION_IN_PROGRESS → REVISED → RESCORED → LOCKED

**Entity:** Document (unified state machine)

---

### Finalization

**Function:** `markManuscriptFinal`

**Process:**
1. Lock manuscript for edits
2. Set `is_final` flag
3. Record finalization metadata
4. Enable output generation

---

### Cloning

**Function:** `cloneManuscript`

**Use Case:** Create new version for experimentation without losing original

---

## DATA FLOW SUMMARY

```
USER INPUT (YourWriting)
    ↓
DETECTION (auto-detect format)
    ↓
ROUTING (Quick vs Full Manuscript)
    ↓
EVALUATION (13 Criteria + WAVE + Spine)
    ↓
SCORING (composite grade 0-10)
    ↓
REVISION (optional, gated behind eval)
    ↓
OUTPUT GENERATION (query, synopsis, pitch, bio, comps)
    ↓
STORYGATE (optional marketplace listing)
    ↓
ANALYTICS & AUDIT (tracking + compliance)
```

---

## SERVICE-LEVEL CONTRACTS

### Quick Evaluation SLA
- Response time: <30 seconds
- Word limit: 3,000 (free) / unlimited (paid)
- Accuracy: 95%+ criteria detection

### Full Manuscript SLA
- Chapter splitting: <2 minutes
- Spine evaluation: <5 minutes
- WAVE per chapter: <2 minutes/chapter
- Progress updates: every 10 seconds

### Output Generation SLA
- Synopsis: <60 seconds
- Query letter: <90 seconds
- Film pitch: <2 minutes
- Complete package: <5 minutes

---

## ERROR HANDLING & RECOVERY

### Retry Logic
- Auto-retry on network failures
- Exponential backoff
- Max 3 retries before manual intervention

### Failure States
- `failed` status on entities
- Error messages stored
- User notified via toast
- Admin alerts on critical failures

### Audit Trail
- All operations logged
- Incident schema: EVALUATE_INCIDENT_LOG_SCHEMA.md
- Retention: 90 days raw, 2 years summaries

---

## INTEGRATION POINTS

### Core Integrations
- OpenAI (LLM analysis)
- Perplexity (research/comps)
- Stripe (payments)
- LinkedIn (bio extraction)

### Internal Services
- Base44 Auth (user management)
- Base44 Entities (database)
- Base44 Functions (backend)
- Base44 Integrations (LLM routing)

---

## CANONICAL REFERENCES

This architecture implements the following canon documents:

- EVALUATE_ENTRY_CANON.md (single entry, auto-detection)
- WAVE_GUIDE.md (craft analysis)
- 13_STORY_CRITERIA.md (agent evaluation)
- VOICE_PRESERVATION_CANON.md (dialogue protection)
- SCREENPLAY_QUALITY_STANDARD.md (screenplay formatting)
- FILM_PITCH_DECK_QUALITY_STANDARD.md (pitch generation)
- COMPARABLES_CANON_SPEC.md (market analysis)
- STORYGATE_FLOW_MAP.md (marketplace)

---

## COMPLIANCE CHECKLIST

✅ Single evaluation entry point  
✅ Automatic format detection  
✅ Invisible pipeline routing  
✅ Voice preservation enforced  
✅ Revision gated behind evaluation  
✅ Audit logging enabled  
✅ Error handling with retry  
✅ Progress tracking for async operations  
✅ Version control for outputs  
✅ Feedback collection integrated  

---

**END OF FUNCTIONAL ARCHITECTURE**

This document is CANONICAL and must be updated whenever functional changes are made to the RevisionGrade platform.