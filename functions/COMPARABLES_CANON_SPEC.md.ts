# COMPARABLES CANON SPECIFICATION v1.0
**RevisionGrade / Base44 Platform**  
**Authority: Binding Technical Specification**

---

## PURPOSE
This document defines the authoritative structure, content requirements, and validation rules for Market Comparables analysis within RevisionGrade.

**Comparables Type:** ADVISORY (not authoritative)  
**Relationship to Primary Evaluation:** Contextual only; never overrides Spine, WAVE, or RevisionGrade™ scores

---

## WHAT COMPARABLES ARE

### Definition
A comparative literary report that benchmarks a manuscript against published bestsellers in the same genre using RevisionGrade's 13 Story Evaluation Criteria.

### Purpose
- Help authors understand how their work compares to market standards
- Identify specific strengths and weaknesses relative to successful titles
- Provide positioning guidance for query letters and agent submissions
- Offer strategic revision priorities based on genre norms

### What Comparables Are NOT
- NOT a substitute for Spine or WAVE evaluation
- NOT a prediction of commercial success
- NOT a definitive assessment (market trends shift)
- NOT prescriptive (authors may intentionally diverge from genre norms)

---

## REQUIRED INPUTS

### Minimum Viable Inputs (ONE of the following)
1. **Evaluated manuscript:** Full Spine + WAVE analysis complete
2. **Uploaded manuscript:** Full text (minimum 10,000 words) + manually selected genre
3. **Story outline:** Complete plot summary including ending + manually selected genre

### Required Metadata
- **Genre:** Must be one of the supported genres (no "auto" for uploads)
- **Title:** Manuscript or working title
- **Word count:** Approximate or exact

### Optional Enhancements
- **Subgenre:** Specific market niche (e.g., "cozy mystery" not just "mystery")
- **Comp titles:** Author-suggested comparables for reference
- **Target audience:** Specific demographic if applicable

---

## SUPPORTED GENRES

The following genres are supported for comparables generation:

- `thriller`
- `mystery`
- `literary_fiction`
- `romance`
- `fantasy`
- `sci_fi` (science fiction)
- `historical` (historical fiction)
- `horror`
- `ya` (young adult)
- `commercial_fiction`
- `women_fiction`
- `contemporary`

**"auto" detection:**
- Only allowed for evaluated manuscripts (not uploads)
- Uses Spine evaluation metadata to infer genre
- Fallback if detection uncertain: prompt user to select manually

---

## OUTPUT SCHEMA

### Strict JSON Schema (Mandatory)
```json
{
  "type": "object",
  "required": [
    "criteria_scores",
    "comparable_titles",
    "market_positioning",
    "revision_priorities"
  ],
  "additionalProperties": false,
  "properties": {
    "criteria_scores": {
      "type": "array",
      "minItems": 13,
      "maxItems": 13,
      "items": {
        "type": "object",
        "required": [
          "criterion",
          "manuscript_score",
          "genre_average",
          "above_average",
          "insight"
        ],
        "additionalProperties": false,
        "properties": {
          "criterion": {
            "type": "string",
            "enum": [
              "Voice & Style",
              "Opening Hook",
              "Character Development",
              "Dialogue",
              "Pacing",
              "Show Don't Tell",
              "Emotional Resonance",
              "Plot Structure",
              "Theme & Depth",
              "Sensory Details",
              "Scene Craft",
              "Market Readiness",
              "Comparative Positioning"
            ]
          },
          "manuscript_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          },
          "genre_average": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          },
          "above_average": {
            "type": "boolean"
          },
          "insight": {
            "type": "string",
            "minLength": 20,
            "maxLength": 300
          }
        }
      }
    },
    "comparable_titles": {
      "type": "array",
      "minItems": 5,
      "maxItems": 7,
      "items": {
        "type": "object",
        "required": ["title", "author", "justification"],
        "additionalProperties": false,
        "properties": {
          "title": {
            "type": "string",
            "minLength": 1
          },
          "author": {
            "type": "string",
            "minLength": 1
          },
          "year": {
            "type": "integer",
            "minimum": 2018,
            "maximum": 2026
          },
          "justification": {
            "type": "string",
            "minLength": 30,
            "maxLength": 200
          }
        }
      }
    },
    "market_positioning": {
      "type": "string",
      "minLength": 200,
      "maxLength": 1000
    },
    "revision_priorities": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "string",
        "minLength": 20,
        "maxLength": 200
      }
    }
  }
}
```

---

## CONTENT REQUIREMENTS

### 1. Criteria Scores (EXACTLY 13)
For each of the 13 Story Evaluation Criteria:

**Manuscript Score (0-10):**
- Based on manuscript analysis or evaluation data
- Must be justified by specific textual evidence
- Never invented or guessed

**Genre Average (0-10):**
- Represents typical performance in bestselling titles from 2018-2025
- Based on market research (Perplexity-sourced or knowledge base)
- Conservative estimates if uncertain

**Above Average (boolean):**
- TRUE if manuscript_score > genre_average
- FALSE otherwise

**Insight (20-300 characters):**
- 1-2 sentences positioning this criterion
- Specific and actionable
- No hype language ("you're crushing it!")
- No vague statements ("could be improved")

### 2. Comparable Titles (5-7 titles)
Real published titles from 2018-2025 that match:
- **Genre:** Same primary genre
- **Tone:** Similar emotional register
- **Structure:** Comparable narrative approach
- **Market success:** Bestseller list, award-winner, or critically acclaimed

**Justification (30-200 characters):**
- Why this title is comparable
- Specific match (tone, structure, theme, audience)
- Not just "same genre"

**Year (optional but recommended):**
- Publication year between 2018-2026
- Helps contextualize market trends

### 3. Market Positioning (200-1000 characters)
2-3 paragraphs summarizing:
- Overall comparative standing
- Strongest competitive advantages
- Areas requiring strategic revision for market readiness
- Positioning angle for query/pitch

**Style:**
- Professional, objective tone
- Specific and evidence-based
- Forward-looking (revision-oriented)
- No hype, no discouragement

### 4. Revision Priorities (3-5 items)
Strategic actions to improve market readiness:
- **Specific:** "Tighten pacing in middle act" not "improve pacing"
- **Actionable:** Clear what to do
- **Prioritized:** Most impactful revisions first
- **Genre-aligned:** Based on market norms

Each priority: 20-200 characters

---

## VALIDATION RULES

### Pre-Flight Checks (Block LLM call if failed)
- [ ] Genre is selected (not "auto" for uploads)
- [ ] Minimum input length: 10,000 characters OR evaluated manuscript
- [ ] Manuscript title provided
- [ ] Word count available (approximate ok)

### Post-Generation Validation (Block output if failed)
- [ ] Schema conformance: All required fields present
- [ ] Criteria count: Exactly 13 scores
- [ ] Score ranges: All scores 0-10 (inclusive)
- [ ] Comparable titles count: 5-7 titles
- [ ] Title years: All between 2018-2026 if provided
- [ ] Insight lengths: All between 20-300 characters
- [ ] Justification lengths: All between 30-200 characters
- [ ] Market positioning length: 200-1000 characters
- [ ] Revision priorities count: 3-5 items
- [ ] Revision priority lengths: All between 20-200 characters

### Content Integrity Checks
- [ ] No placeholder text ("More analysis here...")
- [ ] No invented plot details not in source material
- [ ] Comparable titles are real (not fabricated)
- [ ] Insights are specific (not generic "could be better")

---

## ERROR HANDLING

### Missing Required Inputs (400 Bad Request)
```json
{
  "success": false,
  "error": "MISSING_INPUTS",
  "details": "Cannot generate comparables without required information.",
  "missing": ["genre", "manuscript_text"],
  "next_action": "PROVIDE_MORE_INFO"
}
```

### LLM Output Failed Validation (422 Unprocessable Entity)
```json
{
  "success": false,
  "error": "GENERATION_FAILED",
  "details": "Unable to generate valid comparables analysis after retry.",
  "validation_failures": [
    "criteria_scores: Expected 13 items, got 11",
    "comparable_titles[2].justification: Too short (18 chars, min 30)"
  ],
  "next_action": "RETRY"
}
```

### Genre Auto-Detection Failed (400 Bad Request)
```json
{
  "success": false,
  "error": "GENRE_REQUIRED",
  "details": "Cannot auto-detect genre for uploaded manuscripts. Please select a genre manually.",
  "next_action": "SELECT_GENRE"
}
```

---

## REGENERATION PROTOCOL

### When Initial Generation Fails Validation
1. **Log failure** with full diagnostic data
2. **Build corrective prompt:**
   ```
   Your previous response failed validation.
   
   FAILURES TO FIX:
   - criteria_scores: Has 11 items, required exactly 13
   - comparable_titles[3].justification: "Same genre thriller" is too short (min 30 chars)
   - revision_priorities: Has 2 items, required minimum 3
   
   INSTRUCTIONS:
   - Include all 13 Story Evaluation Criteria
   - Expand justifications to explain WHY each title is comparable
   - Add at least one more strategic revision priority
   
   Do not invent manuscript details. Use only provided source material.
   Return valid JSON matching the schema.
   ```
3. **Call LLM again** (max 1 retry)
4. **Validate again**
5. **If still failing:** Return 422 error with detailed failures

---

## TEXT LENGTH CONSTRAINTS

### Input Capping (Prevent Truncation)
- **Maximum input:** 50,000 characters of manuscript text
- **Rationale:** Prevents fragmented LLM responses
- **User notification:** If manuscript > 50k chars, note "analysis based on opening sections"

**Implementation:**
```javascript
const MAX_INPUT_CHARS = 50000;
const textSample = manuscriptText.substring(0, MAX_INPUT_CHARS);
const wordCount = manuscriptText.split(/\s+/).length;

console.log(`Processing comparables: ${wordCount} words, using ${textSample.length} char sample`);
```

---

## AUDIT LOGGING

Every comparables generation must log:
```javascript
{
  timestamp: ISO8601,
  user_id: string,
  manuscript_id: string | 'uploaded',
  genre: string,
  word_count: number,
  input_length_chars: number,
  capped: boolean,
  model: string,
  attempt: 1 | 2,
  validation_passed: boolean,
  validation_failures: array,
  latency_ms: number,
  token_count: { prompt, completion, total }
}
```

---

## TESTING MATRIX

### Required Tests
| Test | Input | Expected Output |
|------|-------|----------------|
| Happy path | Valid manuscript + genre | Valid report, all fields present |
| Missing genre (upload) | Uploaded text, no genre | 400 error, "GENRE_REQUIRED" |
| Auto-detect genre | Evaluated manuscript | Detects genre from Spine metadata |
| Schema violation | LLM returns 11 criteria | Triggers regen with corrective prompt |
| Regen success | First attempt fails, second succeeds | Valid report returned |
| Hard fail | Both attempts fail | 422 error with validation failures |
| Text capping | 80k char manuscript | Uses first 50k chars, logs capping |

---

## COMPLIANCE CHECKLIST

Before shipping comparables feature:
- [ ] Strict JSON schema defined and enforced
- [ ] Pre-flight validation blocks invalid inputs
- [ ] Post-generation validation catches schema violations
- [ ] Auto-regeneration with corrective instructions implemented
- [ ] Hard fail returns 422 with detailed failures
- [ ] Text capping applied to prevent truncation
- [ ] Audit logging captures all required fields
- [ ] Unit tests cover all failure modes
- [ ] UI clearly labels as "Advisory: Market Context"
- [ ] Comparables never override primary evaluation scores

---

**Document Owner:** Michael J. Meraw / RevisionGrade Engineering  
**Last Updated:** 2026-01-02  
**Version:** 1.0