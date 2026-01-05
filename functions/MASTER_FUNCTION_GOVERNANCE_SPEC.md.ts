# MASTER FUNCTION GOVERNANCE SPECIFICATION
**RevisionGrade™ — Complete Architecture Truth Contract**

Version: 1.0.0  
Date: 2026-01-05  
Owner: Product/Governance  
Status: CANONICAL

---

## Purpose
This document defines the authoritative five-field contract (Inputs/Routing/Validation/Outputs/Audit) for every user-facing function in RevisionGrade. Base44 runtime behavior MUST conform to these specifications.

## Contract Structure
Each function specifies:
- **Inputs**: Accepted types, size limits, visible ingestion (no silent parsing)
- **Routing**: Pipeline selection (quick/full), preflight enforcement
- **Validation**: Hard fails (block) + Soft fails (warn) with user visibility
- **Outputs**: Exact artifacts, format constraints, confidence/NA gating
- **Audit**: Required log events with function ID, canon hash, key parameters

---

# FUNCTION 1: EVALUATE

## FLOW 1.1: YourWriting → Quick Evaluation (Scene/Paragraph)

### INPUTS
- **Accepted Formats**: .docx, .txt, pasted text
- **Word Range**: 50-5,000 words
- **Size Limits**: 3,000 word hard cap for quick eval
- **Visible Ingestion**: YES - user sees text area or upload button
- **Silent Parsing**: PROHIBITED
- **User-Provided Metadata**:
  - Title (required)
  - Evaluation mode: standard/transgressive/trauma_memoir
  - Language variant: en-US/en-UK/en-CA/en-AU
  - Voice preservation: maximum/balanced/polish

### ROUTING
- **Entry Point**: `pages/YourWriting.js`
- **Detection**: `detectWorkType.js` → work type confirmation dialog
- **Preflight**: `matrixPreflight()` → MUST execute before LLM
- **Runtime Function**: `evaluateQuickSubmission.js`
- **Model Class**: Quick evaluation / governance-enforced
- **Criteria Routing**: `validateWorkTypeMatrix.js` → builds criteria plan

### VALIDATION

**Hard Fails (Block execution):**
- <50 words → `INSUFFICIENT_INPUT` with refusal message
- >5,000 words → redirect to full manuscript upload
- Work type not confirmed → `EVALUATION_BLOCKED` gate
- Unsupported file type → error banner

**Soft Fails (Warn but allow):**
- Mixed language detected → warning banner
- Transgressive/trauma memoir mode → confirmation dialog required

**Preflight Blocks:**
- matrixPreflight returns `allowed: false` → no LLM call
- User-facing code: `INSUFFICIENT_INPUT`
- Block reasons: `SCOPE_INSUFFICIENT`, `MATRIX_VIOLATION`

### OUTPUTS
- **Artifact**: Evaluation Summary (Quick)
- **Format**: JSON object with:
  - `overallScore` (0-10, confidence-capped)
  - `agentVerdict` (string)
  - `manuscriptTier` (developmental/refinement/professional)
  - `agentSnapshot` (null if disabled for NA-locked work types)
  - `criteria` (array, NA-filtered by criterion_id)
  - `revisionRequests` (array, NA-filtered)
  - `waveHits` (array, NA-scrubbed)
  - `thoughtTagSuggestions` (array)
  - `overusedWordHits` (array)
  - `matrix_preflight` (audit fields)
  - `work_type_routing` (MDM compliance fields)

**Confidence Gating:**
- Paragraph: max 40/100 (4.0/10)
- Scene: max 65/100 (6.5/10)
- Chapter: max 75/100 (7.5/10)
- Multi-chapter: max 85/100 (8.5/10)
- Full manuscript: max 95/100 (9.5/10)

**NA Gating (MDM Rule M4):**
- Criteria with status=NA → blocked from output
- Revision requests for NA criteria → blocked
- WAVE hits referencing NA terms → text-scrubbed
- agentSnapshot → disabled if core drivers (conflict/dialogue/worldbuilding) all NA

### AUDIT
- **Event Name**: `EVAL_QUICK_RUN`
- **Entity**: `EvaluationAuditEvent`
- **Function ID**: `evaluateQuickSubmission`
- **Canon Hash**: `EVALUATE_ENTRY_CANON_v1.2`
- **Required Fields**:
  - `event_id`, `request_id`, `timestamp_utc`
  - `detected_format`, `routed_pipeline` (quick)
  - `user_email`, `evaluation_mode`
  - `detected_work_type`, `final_work_type_used`
  - `matrix_version`, `criteria_plan`
  - `validators_run`, `validators_failed`, `failure_codes`
  - `submission_id` (if saved)
  - **Preflight fields**:
    - `matrix_preflight_allowed` (true/false)
    - `matrix_compliance` (true/false)
    - `llm_invoked` (true/false)
    - `llm_invocation_reason` (preflight_passed/null)
    - `input_word_count`, `input_scale`, `max_confidence_allowed`

---

## FLOW 1.2: YourWriting → Full Manuscript Evaluation

### INPUTS
- **Accepted Formats**: .docx, .pdf, .txt, .rtf
- **Word Range**: 40,000+ words (full manuscript)
- **Size Limits**: No upper limit (handles novels)
- **Visible Ingestion**: YES - upload button, file name displayed
- **Silent Parsing**: PROHIBITED
- **User-Provided Metadata**: Same as quick eval

### ROUTING
- **Entry Point**: `pages/YourWriting.js`
- **Detection**: Word count check → route to full pipeline
- **Upload**: `ingestUploadedFileToText.js` → text extraction
- **Splitting**: `splitManuscript.js` → chapter segmentation
- **Runtime Functions**:
  1. `evaluateFullManuscript.js` (orchestrator)
  2. `evaluateSpine.js` (narrative backbone)
  3. `evaluateThirteenCriteria.js` (per chapter)
  4. `evaluateWaveFlags.js` (per chapter)
- **Model Class**: Full evaluation / multi-phase

### VALIDATION

**Hard Fails:**
- <40,000 words → redirect to quick eval
- File extraction failure → error message
- Unsupported file type → error banner

**Soft Fails:**
- Chapter splitting ambiguity → manual review flag

### OUTPUTS
- **Artifact**: Full Manuscript Report
- **Format**: Manuscript entity with:
  - `spine_score` (0-10)
  - `spine_evaluation` (structure analysis)
  - `revisiongrade_overall` (composite: spine + WAVE)
  - `continuity_report` (Story Architecture Layer)
  - `evaluation_progress` (real-time tracking)
  - `status` (uploaded/splitting/summarizing/evaluating/ready/failed)

**Per-Chapter Outputs:**
- Chapter entity with evaluation scores
- WAVE flags (craft issues)
- Criteria scores (13 dimensions)

**Confidence Gating:**
- Full manuscript: max 95/100 (9.5/10)

### AUDIT
- **Event Name**: `EVAL_FULL_MANUSCRIPT`
- **Entity**: `EvaluationAuditEvent`
- **Function ID**: `evaluateFullManuscript`
- **Canon Hash**: `EVALUATE_ENTRY_CANON_v1.2`
- **Required Fields**: Same as quick eval + `manuscript_id`

---

# FUNCTION 2: WAVE (Craft Analysis)

## FLOW 2.1: Revise → WAVE Revision Session

### INPUTS
- **Accepted**: Existing submission (from history)
- **Word Range**: Matches original submission
- **Visible Ingestion**: User selects from submission history
- **Silent Parsing**: PROHIBITED
- **User-Provided Metadata**: Voice preservation mode (maximum/balanced/polish)

### ROUTING
- **Entry Point**: `pages/History.js` → "Start Revising" button
- **Runtime Function**: `generateRevisionSuggestions.js`
- **Voice Guard**: `voiceGuard.js` → applies preservation rules
- **Model Class**: Revision / voice-protected

### VALIDATION

**Hard Fails:**
- No evaluation exists → "Evaluate first" message
- Submission deleted → 404 error

**Soft Fails:**
- Low evaluation score → warning about revision readiness

### OUTPUTS
- **Artifact**: RevisionSession entity
- **Format**:
  - `suggestions` (array of edit cards)
  - `current_wave` (wave number in sequence)
  - `current_position` (suggestion index)
  - `style_mode` (neutral/lyrical/rhythmical/literary/commercial)
  - `status` (in_progress/completed/paused)

**Per-Suggestion Output:**
- `original_text`, `suggested_text`
- `why_flagged`, `why_this_fix`
- `status` (pending/accepted/rejected)
- `alternatives` (optional)

**Voice Preservation Gating:**
- Maximum: minimal changes, preserve quirks
- Balanced: moderate polish, keep voice
- Polish: aggressive cleanup, standard voice

### AUDIT
- **Event Name**: `WAVE_REVISION_START`
- **Entity**: RevisionSession
- **Function ID**: `generateRevisionSuggestions`
- **Canon Hash**: `WAVE_GUIDE_v2.1`
- **Required Fields**: `submission_id`, `voice_mode`, `wave_count`

---

# FUNCTION 3: SCREENPLAY

## FLOW 3.1: ScreenplayFormatter → Novel to Screenplay

### INPUTS
- **Accepted**: Pasted text, .docx
- **Word Range**: 2,000+ words (chapter minimum)
- **Visible Ingestion**: YES - text area or upload
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/ScreenplayFormatter.js`
- **Runtime Function**: `formatScreenplay.js`
- **Model Class**: Screenplay conversion

### VALIDATION

**Hard Fails:**
- <2,000 words → error message
- Non-narrative text → "unsuitable content" error

**Soft Fails:**
- Dialogue-heavy vs action-heavy → adaptation note

### OUTPUTS
- **Artifact**: Screenplay text
- **Format**: WriterDuet-compliant formatting
- **Standards**: `SCREENPLAY_QUALITY_STANDARD_CANON.md`

### AUDIT
- **Event Name**: `SCREENPLAY_CONVERSION`
- **Function ID**: `formatScreenplay`
- **Canon Hash**: `SCREENPLAY_QUALITY_STANDARD_v1.0`
- **Required Fields**: `input_word_count`, `output_format`

---

# FUNCTION 4: REVISION (Segment-Level)

## FLOW 4.1: Revise → Accept/Reject Suggestions

### INPUTS
- **Accepted**: RevisionSession with suggestions
- **User Actions**: Accept, reject, request alternatives

### ROUTING
- **Entry Point**: `pages/Revise.js`
- **Runtime Functions**: 
  - `generateAlternatives.js` (if alternatives requested)
  - Session update (Base44 SDK)

### VALIDATION

**Hard Fails:**
- Session not found → 404 error

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: Updated RevisionSession
- **Format**: Current text with accepted changes applied

### AUDIT
- **Event Name**: `REVISION_ACTION`
- **Required Fields**: `action_type` (accept/reject/alternatives), `suggestion_id`

---

# FUNCTION 5: OUTPUT GENERATION

## FLOW 5.1: Synopsis → Generate Synopsis

### INPUTS
- **Accepted**: Existing manuscript (40k+ words)
- **Word Range**: Full manuscript required
- **Visible Ingestion**: User selects from manuscript list
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/Synopsis.js`
- **Preflight**: `matrixPreflight()` → checks manuscript word count
- **Runtime Function**: `generateSynopsis.js`
- **Model Class**: Synopsis generation

### VALIDATION

**Hard Fails:**
- <40,000 words → `INSUFFICIENT_INPUT`
- No manuscript selected → error message

**Soft Fails:**
- Incomplete evaluation → warning banner

### OUTPUTS
- **Artifact**: Synopsis text (300-2000 words)
- **Format**: Structured narrative summary
- **Standards**: `SYNOPSIS_SPEC.json`

### AUDIT
- **Event Name**: `SYNOPSIS_GENERATED`
- **Function ID**: `generateSynopsis`
- **Canon Hash**: `SYNOPSIS_SPEC_v1.0`
- **Required Fields**: `manuscript_id`, `synopsis_length`

---

## FLOW 5.2: QueryLetter → Generate Query Letter

### INPUTS
- **Accepted**: Manuscript file URL (.docx, .pdf, .txt, .rtf)
- **Word Range**: 40,000+ words
- **Visible Ingestion**: YES - file upload
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/QueryLetter.js`
- **Preflight**: `matrixPreflight()` → validates full manuscript
- **Runtime Function**: `generateQueryLetterPackage.js`
- **Model Class**: Query package generation

### VALIDATION

**Hard Fails:**
- <40,000 words → `INSUFFICIENT_INPUT`
- File extraction failure → error message
- Preflight block → user-facing refusal

**Soft Fails:**
- No bio provided → uses manuscript data only

### OUTPUTS
- **Artifact**: Query letter text
- **Format**: Professional query letter with:
  - Hook paragraph
  - Synopsis paragraph
  - Bio paragraph
  - Comparable titles
  - Agent suggestions (optional)

**Confidence Gating:**
- Query letter requires full manuscript (95% max confidence)

### AUDIT
- **Event Name**: `QUERY_LETTER_GENERATED`
- **Function ID**: `generateQueryLetterPackage`
- **Canon Hash**: `QUERY_LETTER_SPEC_v1.0`
- **Required Fields**: `manuscript_file_url`, `word_count`, `preflight_allowed`

---

## FLOW 5.3: PitchGenerator → Generate Pitch Deck

### INPUTS
- **Accepted**: Manuscript ID or text
- **Word Range**: 40,000+ words
- **Visible Ingestion**: User selects manuscript
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/PitchGenerator.js`
- **Runtime Function**: `generateQueryPitches.js`
- **Model Class**: Pitch generation

### VALIDATION

**Hard Fails:**
- <40,000 words → error message

**Soft Fails:**
- No comps provided → generates from manuscript

### OUTPUTS
- **Artifact**: Pitch deck (PDF or slides)
- **Format**: Film/TV pitch structure
- **Standards**: `FILM_PITCH_DECK_QUALITY_STANDARD.md`

### AUDIT
- **Event Name**: `PITCH_DECK_GENERATED`
- **Function ID**: `generateQueryPitches`
- **Canon Hash**: `PITCH_DECK_SPEC_v1.0`

---

## FLOW 5.4: Comparables → Generate Market Comps

### INPUTS
- **Accepted**: Manuscript ID
- **Word Range**: Full manuscript
- **Visible Ingestion**: User selects manuscript

### ROUTING
- **Entry Point**: `pages/Comparables.js`
- **Runtime Function**: `generateComparables.js`
- **Model Class**: Market analysis

### VALIDATION

**Hard Fails:**
- No manuscript selected → error message

**Soft Fails:**
- Niche genre → warning about limited comps

### OUTPUTS
- **Artifact**: ComparativeReport entity
- **Format**: List of comparable titles with analysis
- **Standards**: `COMPARABLES_CANON_SPEC.md`

### AUDIT
- **Event Name**: `COMPS_GENERATED`
- **Function ID**: `generateComparables`
- **Canon Hash**: `COMPARABLES_SPEC_v1.0`

---

## FLOW 5.5: CompletePackage → Generate Agent Package

### INPUTS
- **Accepted**: Manuscript file URL
- **Word Range**: 40,000+ words
- **Visible Ingestion**: File upload
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/CompletePackage.js`
- **Preflight**: `matrixPreflight()` → full manuscript required
- **Runtime Function**: `generateCompletePackage.js`
- **Model Class**: Complete package generation

### VALIDATION

**Hard Fails:**
- <40,000 words → `INSUFFICIENT_INPUT`
- Preflight block → refusal message

**Soft Fails:**
- Incomplete bio → uses manuscript data only

### OUTPUTS
- **Artifact**: Agent package ZIP with:
  - Query letter
  - Synopsis (short + long)
  - Author bio
  - Comparable titles
  - Manuscript file
- **Format**: Professional submission package

**Confidence Gating:**
- Agent package requires full manuscript (95% max confidence)

### AUDIT
- **Event Name**: `AGENT_PACKAGE_GENERATED`
- **Function ID**: `generateCompletePackage`
- **Canon Hash**: `AGENT_PACKAGE_SPEC_v1.0`

---

# FUNCTION 6: BIOGRAPHY

## FLOW 6.1: Biography → Generate Author Bio

### INPUTS
- **Accepted**: LinkedIn URL or manual text
- **Word Range**: N/A (profile-based)
- **Visible Ingestion**: YES - URL input field
- **Silent Parsing**: PROHIBITED (LinkedIn scraping explicit)

### ROUTING
- **Entry Point**: `pages/Biography.js`
- **Runtime Functions**:
  - `extractLinkedInBio.js` (if URL provided)
  - `uploadAndGenerateBio.js` (if manual text)
- **Model Class**: Bio generation

### VALIDATION

**Hard Fails:**
- Invalid LinkedIn URL → error message
- No input provided → error message

**Soft Fails:**
- Limited LinkedIn data → warning banner

### OUTPUTS
- **Artifact**: Author bio text (150-300 words)
- **Format**: Professional third-person bio

### AUDIT
- **Event Name**: `BIO_GENERATED`
- **Function ID**: `uploadAndGenerateBio`
- **Required Fields**: `input_type` (linkedin/manual), `word_count`

---

# FUNCTION 7: STORYGATE STUDIO

## FLOW 7.1: StoryGate → Film Submission

### INPUTS
- **Accepted**: Project metadata + supporting file
- **File Types**: .pdf, .docx
- **Visible Ingestion**: YES - explicit form submission
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/StorygateStudio.js`
- **Runtime Function**: `submitStoryGateFilm.js`
- **Model Class**: Submission intake

### VALIDATION

**Hard Fails:**
- Required fields missing → form validation error
- File too large → size limit message

**Soft Fails:**
- Optional fields missing → warning

### OUTPUTS
- **Artifact**: StoryGateFilmSubmission entity
- **Format**: Submission record with status
- **Status Flow**: submitted → under_review → approved/declined

### AUDIT
- **Event Name**: `STORYGATE_SUBMISSION`
- **Function ID**: `submitStoryGateFilm`
- **Required Fields**: `project_title`, `creator_email`, `submission_status`

---

## FLOW 7.2: CreatorStoryGate → Create Listing

### INPUTS
- **Accepted**: Manuscript ID
- **Visible Ingestion**: User selects manuscript

### ROUTING
- **Entry Point**: `pages/CreateStoryGateListing.js`
- **Runtime Function**: `createStoryGateListing.js`
- **Model Class**: Listing creation

### VALIDATION

**Hard Fails:**
- No manuscript selected → error message
- Manuscript not evaluated → block with message

**Soft Fails:**
- Low evaluation score → warning

### OUTPUTS
- **Artifact**: ProjectListing entity
- **Format**: Discoverable listing with metadata

### AUDIT
- **Event Name**: `LISTING_CREATED`
- **Function ID**: `createStoryGateListing`
- **Required Fields**: `manuscript_id`, `visibility`, `creator_email`

---

## FLOW 7.3: Industry User Verification

### INPUTS
- **Accepted**: Verification request form
- **Visible Ingestion**: Admin queue page

### ROUTING
- **Entry Point**: `pages/AdminVerificationQueue.js`
- **Runtime Function**: `handleVerification.js`
- **Model Class**: Admin action

### VALIDATION

**Hard Fails:**
- Not admin user → 403 Forbidden

**Soft Fails:**
- Incomplete verification data → warning

### OUTPUTS
- **Artifact**: Updated IndustryUser entity
- **Format**: Verification status change

### AUDIT
- **Event Name**: `INDUSTRY_USER_VERIFIED`
- **Function ID**: `handleVerification`
- **Required Fields**: `user_email`, `verified_by`, `verification_status`

---

# FUNCTION 8: MANUSCRIPT MANAGEMENT

## FLOW 8.1: UploadWork → Manuscript Upload

### INPUTS
- **Accepted**: .docx, .pdf, .txt, .rtf
- **Word Range**: 40,000+ words
- **Visible Ingestion**: YES - upload button
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: `pages/UploadWork.js`
- **Runtime Functions**:
  - `ingestUploadedFileToText.js` → text extraction
  - `splitManuscript.js` → chapter segmentation
- **Model Class**: File processing

### VALIDATION

**Hard Fails:**
- Unsupported file type → error message
- File extraction failure → error message
- <40,000 words → redirect to quick eval

**Soft Fails:**
- Chapter detection ambiguity → manual review

### OUTPUTS
- **Artifact**: Manuscript entity + Chapter entities
- **Format**: Full text stored, chapters indexed

### AUDIT
- **Event Name**: `MANUSCRIPT_UPLOADED`
- **Function ID**: `splitManuscript`
- **Required Fields**: `manuscript_id`, `word_count`, `chapter_count`

---

## FLOW 8.2: ManuscriptDashboard → View Manuscript

### INPUTS
- **Accepted**: Manuscript ID (from URL)
- **Visible Ingestion**: User navigates to manuscript page

### ROUTING
- **Entry Point**: `pages/ManuscriptDashboard.js`
- **Runtime Functions**: None (read-only display)

### VALIDATION

**Hard Fails:**
- Manuscript not found → 404 error
- Not authorized → 403 Forbidden

**Soft Fails:**
- Evaluation in progress → progress banner

### OUTPUTS
- **Artifact**: Dashboard UI with manuscript data
- **Format**: Scores, chapters, analysis display

### AUDIT
- **Event Name**: `MANUSCRIPT_VIEWED`
- **Required Fields**: `manuscript_id`, `user_email`

---

## FLOW 8.3: Clone Manuscript for Revision

### INPUTS
- **Accepted**: Manuscript ID
- **Visible Ingestion**: "Clone for revision" button

### ROUTING
- **Entry Point**: `pages/ManuscriptDashboard.js`
- **Runtime Function**: `cloneManuscript.js`

### VALIDATION

**Hard Fails:**
- Manuscript not finalized → error message

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: New Manuscript entity (clone)
- **Format**: Copy with `parent_manuscript_id` reference

### AUDIT
- **Event Name**: `MANUSCRIPT_CLONED`
- **Function ID**: `cloneManuscript`
- **Required Fields**: `parent_manuscript_id`, `new_manuscript_id`

---

## FLOW 8.4: Mark Manuscript Final

### INPUTS
- **Accepted**: Manuscript ID
- **Visible Ingestion**: "Mark as Final" button

### ROUTING
- **Entry Point**: `pages/ManuscriptDashboard.js`
- **Runtime Function**: `markManuscriptFinal.js`

### VALIDATION

**Hard Fails:**
- Already finalized → error message

**Soft Fails:**
- Low evaluation score → confirmation dialog

### OUTPUTS
- **Artifact**: Updated Manuscript entity
- **Format**: `is_final: true`, `finalized_at`, `finalized_by`

### AUDIT
- **Event Name**: `MANUSCRIPT_FINALIZED`
- **Function ID**: `markManuscriptFinal`
- **Required Fields**: `manuscript_id`, `finalized_by`

---

# FUNCTION 9: FILE PROCESSING

## FLOW 9.1: File Upload → Text Extraction

### INPUTS
- **Accepted**: .docx, .pdf, .txt, .rtf
- **Size Limits**: 50MB max
- **Visible Ingestion**: YES - upload progress bar
- **Silent Parsing**: PROHIBITED

### ROUTING
- **Entry Point**: Multiple pages (YourWriting, UploadWork)
- **Runtime Functions**:
  - `ingestUploadedFileToText.js` → orchestrator
  - `convertDocxToText.js` → DOCX parsing
- **Model Class**: File processing

### VALIDATION

**Hard Fails:**
- Unsupported file type → error message
- File too large → size limit error
- Extraction failure → error message

**Soft Fails:**
- Partial extraction → warning with truncated text

### OUTPUTS
- **Artifact**: Extracted text string
- **Format**: Plain text

### AUDIT
- **Event Name**: `FILE_EXTRACTED`
- **Function ID**: `ingestUploadedFileToText`
- **Required Fields**: `file_type`, `file_size`, `word_count_extracted`

---

# FUNCTION 10: VALIDATION & TESTING

## FLOW 10.1: Admin → Run WAVE Validation

### INPUTS
- **Accepted**: Admin action (no file input)
- **Visible Ingestion**: Admin button click

### ROUTING
- **Entry Point**: `pages/ValidationReport.js`
- **Runtime Function**: `testWaveValidation.js`

### VALIDATION

**Hard Fails:**
- Not admin user → 403 Forbidden

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: Validation report
- **Format**: Test results JSON

### AUDIT
- **Event Name**: `WAVE_VALIDATION_RUN`
- **Function ID**: `testWaveValidation`
- **Required Fields**: `test_count`, `passed_count`, `failed_count`

---

# FUNCTION 11: ANALYTICS & FEEDBACK

## FLOW 11.1: Analytics → Track Page Visit

### INPUTS
- **Accepted**: Page visit event
- **Visible Ingestion**: Automatic (user navigates)
- **Silent Parsing**: ALLOWED (analytics tracking)

### ROUTING
- **Entry Point**: `components/AnalyticsTracker.js` (runs on every page)
- **Runtime Function**: `storeEvaluationSignals.js` (disabled)

### VALIDATION

**Hard Fails:**
- None (analytics are non-blocking)

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: Analytics entity
- **Format**: Page visit record with metadata

### AUDIT
- **Event Name**: `PAGE_VISIT`
- **Required Fields**: `page`, `path`, `user_id`, `session_id`, `device_type`

---

## FLOW 11.2: Feedback → Submit User Feedback

### INPUTS
- **Accepted**: Feedback form submission
- **Visible Ingestion**: YES - feedback widget

### ROUTING
- **Entry Point**: `components/FeedbackWidget.js`
- **Runtime Function**: `analyzeFeedback.js`

### VALIDATION

**Hard Fails:**
- None (feedback is always accepted)

**Soft Fails:**
- Empty feedback → warning

### OUTPUTS
- **Artifact**: Feedback record
- **Format**: User feedback with rating/comment

### AUDIT
- **Event Name**: `FEEDBACK_SUBMITTED`
- **Function ID**: `analyzeFeedback`
- **Required Fields**: `submission_id`, `rating`, `feedback_text`

---

# FUNCTION 12: PAYMENTS (STRIPE)

## FLOW 12.1: Pricing → Create Checkout Session

### INPUTS
- **Accepted**: Plan selection (Basic/Pro/Professional)
- **Visible Ingestion**: YES - plan selection button

### ROUTING
- **Entry Point**: `pages/Pricing.js`
- **Runtime Function**: `createCheckoutSession.js`

### VALIDATION

**Hard Fails:**
- User not authenticated → redirect to login

**Soft Fails:**
- Already subscribed → warning banner

### OUTPUTS
- **Artifact**: Stripe checkout session URL
- **Format**: Redirect URL to Stripe hosted checkout

### AUDIT
- **Event Name**: `CHECKOUT_SESSION_CREATED`
- **Function ID**: `createCheckoutSession`
- **Required Fields**: `user_email`, `plan_id`, `session_id`

---

## FLOW 12.2: Stripe Webhook → Handle Payment Events

### INPUTS
- **Accepted**: Stripe webhook payload
- **Visible Ingestion**: NO - server-to-server
- **Silent Parsing**: REQUIRED (webhook signature validation)

### ROUTING
- **Entry Point**: Stripe webhook URL
- **Runtime Function**: `stripeWebhook.js`

### VALIDATION

**Hard Fails:**
- Invalid signature → 400 error
- Unknown event type → log and ignore

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: User subscription status update
- **Format**: Database record update

### AUDIT
- **Event Name**: `STRIPE_WEBHOOK_RECEIVED`
- **Function ID**: `stripeWebhook`
- **Required Fields**: `event_type`, `customer_id`, `subscription_status`

---

# FUNCTION 13: UTILITIES & HELPERS

## FLOW 13.1: Generate Canon Hash

### INPUTS
- **Accepted**: Canon document content
- **Visible Ingestion**: NO - internal utility

### ROUTING
- **Runtime Function**: `generateCanonHash.js`

### VALIDATION

**Hard Fails:**
- Missing canon content → error

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: SHA-256 hash string
- **Format**: Hex string (64 characters)

### AUDIT
- **Event Name**: `CANON_HASH_GENERATED`
- **Function ID**: `generateCanonHash`
- **Required Fields**: `canon_file`, `hash_value`

---

## FLOW 13.2: Transition Document State

### INPUTS
- **Accepted**: Document ID + new state
- **Visible Ingestion**: NO - internal utility

### ROUTING
- **Runtime Function**: `transitionDocumentState.js`

### VALIDATION

**Hard Fails:**
- Invalid state transition → error

**Soft Fails:**
- None

### OUTPUTS
- **Artifact**: Updated Document entity
- **Format**: New state + state_history entry

### AUDIT
- **Event Name**: `DOCUMENT_STATE_TRANSITION`
- **Function ID**: `transitionDocumentState`
- **Required Fields**: `document_id`, `from_state`, `to_state`, `transitioned_by`

---

# GLOBAL GOVERNANCE RULES

## Platform Standards (Apply to All Functions)

### Multi-Model Governance
- Reference: `MULTI_MODEL_GOVERNANCE_STANDARD.md`
- All LLM calls must specify model class
- Confidence must be logged with model provenance

### Defensive Engineering
- Reference: `DEFENSIVE_ENGINEERING_STANDARD.md`
- All functions must have try/catch error handling
- All errors must be logged to Sentry
- User-facing errors must be clear and actionable

### Defensive Error Handling
- Reference: `DEFENSIVE_ERROR_HANDLING_STANDARD.md`
- Never return raw error messages to users
- All 500 errors must be caught and surfaced clearly
- All error responses must include error codes

### Slur Governance
- Reference: `SLUR_GOVERNANCE_DOC.md`
- All text inputs must pass slur detection
- Detected slurs must trigger moderation flow
- No slur content may be stored or processed

### PSC Detection
- Reference: `PSC_DETECTION_GUIDE.md`
- Protected Special Content (child safety) detection required
- PSC triggers immediate block + report
- No PSC content may be evaluated or stored

### Voice Preservation
- Reference: `VOICE_PRESERVATION_CANON.md`
- All revision suggestions must respect voice mode
- Maximum preservation: minimal changes only
- Polish mode: aggressive cleanup allowed

### AI Routing
- Reference: `AI_ROUTING_SPEC.md`
- Quick eval: lightweight model, governance-enforced
- Full eval: multi-phase, heavyweight models
- All routing decisions must be auditable

---

# PHASE 1 COMPLIANCE CHECKLIST

## Preflight Enforcement (CRITICAL)
- [ ] matrixPreflight() executes before ALL LLM evaluation calls
- [ ] matrixPreflight() blocks insufficient input with user-facing refusal
- [ ] Confidence caps enforced per input scale
- [ ] Audit logs include preflight fields: `matrix_preflight_allowed`, `matrix_compliance`, `llm_invoked`

## Work Type Routing (MDM Canon v1)
- [ ] detectWorkType() runs before evaluation
- [ ] User confirms or overrides detected work type
- [ ] final_work_type_used required before evaluation proceeds
- [ ] NA criteria enforcement: criterion_id-based blocking + agentSnapshot suppression

## Audit Trail Completeness
- [ ] All function calls emit audit events to EvaluationAuditEvent
- [ ] All audit events include: function_id, canon_hash, timestamp_utc, user_email
- [ ] All preflight blocks logged with block_reason and refusal_message
- [ ] All LLM calls logged with llm_invocation_reason

## User-Visible Validation
- [ ] All hard fails display clear error messages
- [ ] All soft fails display warning banners
- [ ] All file uploads show progress indicators
- [ ] All processing states show real-time progress

## No Silent Behavior
- [ ] No file parsing without explicit user upload action
- [ ] No LLM calls without user-initiated request
- [ ] No confidence inflation beyond input scale limits
- [ ] No NA criteria leakage into outputs

---

# VERSION CONTROL

## Document Version: 1.0.0
**Date**: 2026-01-05  
**Status**: CANONICAL - LOCKED

## Change History
- 2026-01-05: Initial creation - comprehensive five-field contracts for all 13 functions

## Freeze Notice
This document defines the authoritative truth contract for RevisionGrade. Changes require:
1. Governance approval
2. Version increment
3. Audit trail entry
4. Base44 implementation mapping update

---

# ENFORCEMENT MODEL

## Governance Owner Responsibilities
- Define and freeze five-field contracts (this document)
- Approve all changes to contracts
- Verify Base44 runtime compliance

## Base44 (Platform) Responsibilities
- Implement runtime behavior matching contracts
- Provide evidence of compliance (logs, test results)
- Fix discrepancies when runtime ≠ spec
- Never reinterpret or "clarify" contracts without governance approval

## Dispute Resolution
When runtime behavior deviates from this spec:
1. Governance cites specific section + expected behavior
2. Base44 provides evidence (logs, code, test results)
3. If mismatch confirmed → Base44 fixes runtime
4. If spec is ambiguous → Governance clarifies and versions up

---

**END OF MASTER FUNCTION GOVERNANCE SPECIFICATION**