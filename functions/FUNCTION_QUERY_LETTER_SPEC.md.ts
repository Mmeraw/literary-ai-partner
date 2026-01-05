# Function Spec: generateQueryLetter
**5-Field Contract** | **Phase:** 0 Complete | **Version:** 1.0.0

---

## 1. INPUTS

**Accepted Types:**
- `manuscriptId`: string (required, reference to Manuscript entity)
- `agentName`: string (optional, personalization)
- `agencyName`: string (optional, personalization)
- `authorBio`: string (optional, overrides extracted bio)
- `comparableTitles`: array of strings (optional, suggested comps)
- `customHook`: string (optional, custom opening line)

**Size Limits:**
- Input manuscript: minimum 40,000 words (full manuscript required)
- Output query letter: 350-450 words (industry standard)

**Visible Ingestion:**
- QueryLetter page shows manuscript selection dropdown
- Optional fields visible with tooltips
- Manuscript metadata displayed (title, genre, word count)
- Generation progress shown with spinner

**Validation at Entry:**
- matrixPreflight validates manuscript >= 40,000 words
- If manuscript < 40k: block with "INSUFFICIENT_INPUT - query requires full manuscript"
- Manuscript MUST have spine_evaluation completed
- If no spine: block with "manuscript must be evaluated first"

---

## 2. ROUTING

**Pipeline Selection:**
- Query generation requires full_manuscript scale ONLY
- No routing variations—single path

**Routing Logic:**
```
IF manuscript.wordCount < 40000 THEN BLOCK (full manuscript required)
IF manuscript.spine_evaluation is NULL THEN BLOCK (evaluation required)
ELSE proceed to query generation
```

**Content Extraction:**
1. Extract hook from spine_evaluation or first chapter
2. Extract plot summary from synopsis or spine
3. Extract stakes/conflict from spine analysis
4. Use author bio if provided, else extract from user profile

---

## 3. VALIDATION

**Hard Fails (Block Execution):**
- Manuscript < 40,000 words
- Manuscript not evaluated (no spine)
- Manuscript not found
- User not authenticated

**Soft Fails (Warn but Proceed):**
- No author bio available (generic bio generated)
- No comparable titles provided (LLM suggests comps)

**Validation Sequence:**
1. Auth check (401 if fails)
2. Manuscript retrieval (404 if not found)
3. matrixPreflight (422 if < 40k words)
4. Spine evaluation check (422 if missing)
5. Optional field validation (warn if missing)

**Visibility:**
- All validation failures return standardized refusal response
- Missing optional fields shown as "optional—will use defaults"
- Evaluation requirement shown prominently if missing

---

## 4. OUTPUTS

**Artifact Type:** QueryLetter (JSON + formatted text)

**Required Fields:**
```json
{
  "queryLetter": "string (formatted text with paragraphs)",
  "wordCount": "number (350-450 target)",
  "sections": {
    "greeting": "string",
    "hook": "string",
    "pitch": "string (200-250 words)",
    "bio": "string (50-100 words)",
    "closing": "string"
  },
  "metadata": {
    "manuscriptTitle": "string",
    "genre": "string",
    "wordCount": "number",
    "comparables": "array"
  }
}
```

**Format:**
- JSON response with `{ success: true, queryLetter: {...} }`
- Success: 200 OK
- Validation block: 422 Unprocessable Entity

**Gating:**
- Word count MUST be 350-450 words (industry standard)
- Pitch section MUST be 200-250 words (enforced by LLM schema)
- Bio MUST be 50-100 words
- NO spoilers—ending not revealed
- Agent personalization if provided (name/agency)

**Storage:**
- Saved to user's query letter collection
- Versioned (user can regenerate with tweaks)

---

## 5. AUDIT

**Required Events:**
- Event: QUERY_LETTER_GENERATED (success) or QUERY_LETTER_BLOCKED (blocked)
- Entity: EvaluationAuditEvent

**Required Fields:**
```json
{
  "event_id": "evt_{timestamp}_{random}",
  "request_id": "{manuscript_id}_query",
  "timestamp_utc": "ISO 8601",
  "function_id": "generateQueryLetter",
  "canon_hash": "QUERY_LETTER_SPEC_v1.0",
  "governance_version": "1.0.0",
  "user_email": "user@example.com",
  "manuscript_id": "{id}",
  "manuscript_word_count": "{number}",
  "agent_name": "{name or null}",
  "agency_name": "{agency or null}",
  "output_word_count": "{number}",
  "matrix_preflight_allowed": true,
  "llm_invoked": true
}
```

**Sentry Integration:**
- Errors captured with manuscript and personalization context

---

## Canon Reference

- Governed by: `QUERY_LETTER_SPEC.md` v1.0
- Input validation: `PHASE_1_GOVERNANCE_EVIDENCE.md`

---

## Test Coverage

- Manual QA: Generate query for various genres
- Word count validation automated

**Acceptance Criteria:**
✅ Blocks manuscript < 40,000 words  
✅ Requires evaluated manuscript  
✅ Generates 350-450 word query  
✅ Includes all required sections  
✅ No spoilers beyond midpoint  
✅ Agent personalization works  
✅ Audit event logged