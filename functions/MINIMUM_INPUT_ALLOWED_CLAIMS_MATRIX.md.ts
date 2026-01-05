# MINIMUM INPUT → ALLOWED CLAIMS MATRIX
**Phase 1 Foundation Document**  
**Version:** 1.0.0  
**Status:** BINDING — Non-Negotiable for All Evaluations  
**Last Updated:** 2026-01-05

---

## PURPOSE

This matrix enforces the **"dirty data is impossible"** doctrine by explicitly defining:
- What the system **may claim** at each input scale
- What **confidence level** is justified
- When the system **must refuse** to generate output

**Rule:** If an input does not support a claim, the system MUST NOT make that claim — regardless of user request.

**Critical Implementation Rule:** Scope validation MUST execute **before any LLM call**. This prevents hallucinated intermediate reasoning, avoids post-hoc filtering, and keeps audit logs clean.

**Governance Note:** Word count bands are **governance thresholds**, not UX hints. These are hard enforcement boundaries that cannot be treated as soft guidance.

---

## MATRIX

| Input Size | Word Count Range | Allowed Outputs | Max Confidence | Must Refuse | Enforcement Trigger |
|-----------|------------------|-----------------|----------------|-------------|---------------------|
| **Paragraph** | 50–250 words | • Topic identification<br>• Surface-level notes<br>• Genre hint (low confidence, surface signals only)<br>• Single-moment analysis | **Low** (≤40%) | • Synopsis<br>• Pitch/logline<br>• Full arc claims<br>• Character development assessment<br>• Structural analysis<br>• Market positioning | Input length < 250 words AND request includes prohibited output |
| **Scene** | 250–2,000 words | • Scene-level analysis<br>• Immediate tension assessment<br>• Moment-specific critique<br>• Limited character observation (behavioral only, no arc inference)<br>• Voice sample notes | **Medium** (≤65%) | • Full synopsis<br>• Complete character arcs<br>• Manuscript-level structural claims<br>• Thematic coherence (unless explicit)<br>• Market comps | Input length < 2,000 words AND request requires narrative completeness |
| **Chapter** | 2,000–8,000 words | • Chapter structural signals<br>• Pacing within chapter<br>• Character presence in segment<br>• Partial arc hints<br>• WAVE flags (segment-specific) | **Medium-High** (≤75%) | • Full manuscript synopsis<br>• Complete thematic assessment<br>• Definitive market positioning<br>• Full character arc claims<br>• Ending resolution analysis | Input is single chapter AND request assumes full manuscript context |
| **Multi-Chapter / Novella** | 8,000–40,000 words | • Partial manuscript analysis<br>• Emerging patterns<br>• Structural tendencies<br>• Provisional thematic notes<br>• Conservative market hints | **High** (≤85%) | • Definitive ending assessment<br>• Complete narrative judgment<br>• Full competitive positioning<br>• High-confidence agent pitches | Input < 40,000 words AND request assumes completeness |

**Rationale for 85% cap:** Confidence remains capped below full-manuscript levels because narrative closure, thematic resolution, and market positioning cannot be confirmed without an ending.

| **Full Manuscript** | 40,000+ words | • All evaluation outputs<br>• Synopsis (all lengths)<br>• Pitch/logline<br>• Query letter (**requires Full Manuscript**)<br>• Agent package (**requires Full Manuscript**)<br>• Market positioning<br>• Full structural analysis | **High** (≤95%) | • Claims beyond manuscript scope<br>• Invented biographical details<br>• Market guarantees<br>• Sales predictions | Only when input justifies claim AND confidence threshold met |

---

## CONFIDENCE DEGRADATION RULES

### Rule 1: Length-Based Caps
- Confidence CANNOT exceed the max allowed for input size
- Even if analysis is "certain," cap applies
- Example: A brilliant 500-word scene cannot receive >65% confidence on ANY claim

### Rule 2: Scope Mismatch Penalty
If request scope exceeds input scale:
- Confidence drops by **-30 percentage points**
- Output must include explicit warning: `"This analysis is constrained by limited input. Confidence reflects available text only."`

### Rule 3: Structural Incompleteness
If input lacks narrative resolution:
- Claims about endings/arcs: **BLOCKED**
- Thematic coherence: **Downgraded to "emerging patterns"**
- Character development: **"Observed trajectory, incomplete"**

---

## REFUSAL LANGUAGE (MANDATORY)

When input is insufficient, the system MUST use this exact language structure:

```
❌ INSUFFICIENT INPUT

This request requires [SCOPE_NEEDED] to support [CLAIM_TYPE].

Current input: [INPUT_SIZE] ([WORD_COUNT] words)
Minimum required: [MINIMUM_NEEDED]

**What we can provide:**
• [ALLOWED_OUTPUT_1]
• [ALLOWED_OUTPUT_2]

**What we cannot provide:**
• [BLOCKED_OUTPUT_1] — requires complete narrative
• [BLOCKED_OUTPUT_2] — requires character arc resolution
```

**Example (Paragraph → Synopsis Request):**
```
❌ INSUFFICIENT INPUT

This request requires a complete narrative to support synopsis generation.

Current input: Paragraph (180 words)
Minimum required: Full chapter or manuscript (2,000+ words)

**What we can provide:**
• Topic identification
• Genre hint (surface signals only)
• Surface-level notes

**What we cannot provide:**
• Synopsis — requires plot structure
• Pitch/logline — requires complete arc
• Market positioning — requires full narrative context
```

---

## WAVE ENFORCEMENT FLAGS

### New WAVE Signals Required for Phase 1

| WAVE Signal | Trigger Condition | Action |
|-------------|------------------|--------|
| **SCOPE_INSUFFICIENT** | Request type > input size supports | Block output + show refusal message |
| **CONFIDENCE_CAPPED** | Analysis confidence would exceed input-based max | Force cap + append warning |
| **STRUCTURE_INCOMPLETE** | Narrative lacks resolution | Downgrade all arc/thematic claims |
| **HALLUCINATION_RISK** | Request asks for details not present in input | Refuse + explain what's missing |
| **VOICE_INSUFFICIENT** | Sample too small for voice assessment | Refuse voice-preservation modes |

---

## ACCEPTANCE CRITERIA (Phase 1 Exit Gates)

For Phase 1 to pass, the following MUST be true:

✅ **Test 1: Paragraph → Synopsis Refusal**
- Input: 200-word paragraph
- Request: "Generate synopsis"
- Expected: `SCOPE_INSUFFICIENT` block + refusal message

✅ **Test 2: Scene → Query Letter Refusal**
- Input: 1,500-word scene
- Request: "Generate query letter"
- Expected: Block + explanation of missing elements

✅ **Test 3: Chapter → Manuscript Claims Refusal**
- Input: Single 4,000-word chapter
- Request: "Assess ending resolution"
- Expected: `STRUCTURE_INCOMPLETE` block

✅ **Test 4: Confidence Cap Enforcement**
- Input: Brilliant 800-word scene
- Request: Standard evaluation
- Expected: Confidence ≤65% regardless of quality

✅ **Test 5: Allowed Output Generation**
- Input: 1,200-word scene
- Request: "Scene-level analysis"
- Expected: Success + confidence ≤65%

**Failure = Phase 1 does not pass.**

---

## INTEGRATION WITH EXISTING GOVERNANCE

### Relationship to SLAs
- SLAs define **what must always be true**
- This matrix defines **where violations are most likely**
- Violations of this matrix = SLA breaches

### Relationship to 13 Criteria
- Criteria remain unchanged
- This matrix constrains **when criteria can be applied**
- Example: "Character Development" criterion still exists, but cannot be evaluated on a paragraph

### Relationship to WAVE
- WAVE signals remain unchanged
- This matrix adds **scope enforcement signals**
- WAVE now includes input-size awareness

---

## IMPLEMENTATION CHECKLIST

**Functions to Update:**
- [ ] `evaluateQuickSubmission.js` — add scope checks before LLM call
- [ ] `evaluateFullManuscript.js` — enforce caps even for complete works
- [ ] `generateSynopsis.js` — block if input < 2,000 words
- [ ] `generateQueryLetterPackage.js` — **requires Full Manuscript (40,000+ words)** — any attempt with smaller input = matrix violation
- [ ] `generateQueryPitches.js` — block if input insufficient

**Schema Changes:**
- [ ] Add `input_word_count` to all evaluation audit events
- [ ] Add `scope_validation_passed` boolean
- [ ] Add `confidence_capped_reason` field
- [ ] Add `refusal_trigger` enum

**UI Changes:**
- [ ] Show refusal messages prominently (not as errors)
- [ ] Display allowed alternative outputs
- [ ] Explain minimum input requirements before upload

---

## EXAMPLES (CORRECT BEHAVIOR)

### Example 1: Paragraph Input (Conservative Refusal)
**Input:** 180-word opening paragraph of a novel  
**User Request:** "Give me a synopsis and pitch"  
**System Response:**
```
❌ INSUFFICIENT INPUT

This request requires a complete narrative to support synopsis and pitch generation.

Current input: Paragraph (180 words)
Minimum required: Full manuscript (40,000+ words)

**What we can provide:**
• Opening hook assessment
• Genre identification (low confidence, surface signals only)
• Voice sample notes

**To get synopsis/pitch:** Please upload the full manuscript.
```

### Example 2: Scene Input (Correct Confidence Cap)
**Input:** 1,400-word brilliantly written scene  
**User Request:** Standard evaluation  
**System Response:**
```
✅ EVALUATION COMPLETE

Overall Score: 8.2/10
Confidence: 62% ← [Capped due to input size]

⚠️ Note: This analysis is based on a single scene (1,400 words). 
Confidence cannot exceed 65% for partial input. Upload the full 
manuscript for higher-confidence evaluation.

**Scene-Level Strengths:**
• Exceptional dialogue rhythm
• Clear tension escalation
• Strong sensory detail

**Cannot assess (insufficient input):**
• Full character arcs
• Structural pacing across manuscript
• Thematic coherence
```

### Example 3: Full Manuscript (All Outputs Allowed)
**Input:** 85,000-word complete novel  
**User Request:** Query letter package  
**System Response:**
```
✅ GENERATION COMPLETE

All components generated successfully:
• Synopsis (3 lengths)
• Query letter
• Pitch variations
• Market comparables
• Author bio integration

Confidence: 89% ← [Justified by complete input]
```

---

## VIOLATION REPORTING

If a violation of this matrix occurs in production:
1. **Log to Sentry** with tag: `matrix_violation`
2. **Capture evidence:** input size, request type, output generated
3. **Block affected request type** until fix is deployed
4. **Audit trail** must include `matrix_compliance` field

---

## PHASE 1 SUCCESS METRIC

**The system passes Phase 1 when:**
- 100% of insufficient-input requests are blocked
- 0% of outputs exceed input-justified confidence
- Refusal messages are clear, helpful, and non-apologetic
- Users understand what they need to provide

**The goal is not perfection — it's honesty.**

---

**End of Matrix v1.0.0**