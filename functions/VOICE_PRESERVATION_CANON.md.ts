# REVISIONGRADE™
# VOICE & DIALOGUE PRESERVATION — CANON SPECIFICATION

**Status:** LOCKED  
**Audience:** Base44 Engineering, QA, Product, Compliance  
**Applies To:** Upload, Evaluate, Revise workflows (all manuscript types)

---

## 1. PURPOSE (NON-NEGOTIABLE)

RevisionGrade™ evaluates narrative craft, not linguistic conformity.

Character dialogue and non-standard speech are treated as **intentional authorial voice by default**.

This document defines **binding system behavior** and supersedes any prior assumptions or "best practices."

---

## 2. CORE CANON RULES

### Rule 1 — Dialogue Is Intentional by Default
- Quoted dialogue and character idiolects must be preserved verbatim.
- Non-standard grammar, slang, repetition, dialect, youth or ESL rhythms are **intentional craft**.
- Dialogue must not be rewritten, normalized, or corrected unless the user explicitly requests it.

### Rule 2 — Voice Is Evaluated as Craft, Not Correctness
Evaluation focuses on:
- **Clarity** (is meaning inferable)
- **Consistency** (is the voice internally coherent)
- **Effect** (does the voice serve psychology, power, or context)

Correctness, polish, and standardization are **never assumed goals**.

### Rule 3 — No Identity Inference
- The system must not infer or label intelligence, class, race, education, or background from speech.
- Identity-coded descriptors (e.g., "ghetto," "urban," "uneducated") are **prohibited**.

---

## 3. MICROSCOPIC DEFINITIONS (ENGINEERING-GRADE)

**Dialogue**  
Any text enclosed in quotation marks (straight or curly) or explicitly marked as character speech.

**Idiolect**  
A character's consistent speech pattern, including diction, grammar, rhythm, repetition, and slang.

**Rewrite (Forbidden by Default)**  
Any suggested replacement text that alters wording inside a dialogue span.

**Clarity Note (Allowed)**  
A non-prescriptive comment indicating possible ambiguity without providing replacement wording.

---

## 4. VOICE PRESERVATION LEVELS (LOCKED DEFINITIONS)

### A. Maximum Preservation
- Dialogue and idiolects are **untouchable**
- No grammar, diction, or style suggestions inside dialogue
- Only clarity notes when meaning is genuinely ambiguous
- Narration/exposition evaluated normally

### B. Balanced (DEFAULT)
- Dialogue preserved **verbatim**
- Clarity or consistency issues may be flagged
- No rewrite suggestions by default
- Narration/exposition receives normal craft feedback

### C. Polish-Focused
- Dialogue still preserved unless user explicitly enables normalization
- Narration, exposition, summaries may receive stronger polish
- Dialogue rewrites require a separate, explicit user action

---

## 5. EXPLICIT USER OVERRIDE (ONLY WAY TO REWRITE DIALOGUE)

Dialogue normalization is permitted only when the user checks:

**"Normalize dialogue toward standard usage (user-requested)"**

- Default: **OFF**
- Must be opt-in
- Must be logged
- Must be labeled clearly in output

**Any dialogue rewrite without this flag is a system defect.**

---

## 6. PAGE PLACEMENT (V1 — LOCKED)

### MUST APPEAR
1. **Upload / Manuscript Setup**
   - Sets Work-level `voice_preservation_level`
   - Default: Balanced

2. **Evaluate**
   - Read-only display + optional override
   - Override never silently changes Work default

3. **Revise**
   - Advanced settings (collapsed)
   - Explicit dialogue normalization checkbox required

### MUST NOT APPEAR
- Synopsis
- Query
- Pitch
- Agent Package

These inherit silently from the Work-level setting.

---

## 7. DATA MODEL (REQUIRED FIELDS)

```
voice_preservation_level: "maximum" | "balanced" | "polish"
user_requested_dialogue_normalization: boolean (default false)
```

---

## 8. SLA COMMITMENTS (USER-FACING GUARANTEES)

- **100% dialogue preservation** unless user explicitly requests normalization
- **Zero silent dialogue rewrites**
- **No identity-based language sanitization**
- **Clear labeling** when normalization is user-initiated

**Violation constitutes a service failure.**

---

## 9. QA ACCEPTANCE CRITERIA (RELEASE-BLOCKING)

A build must fail if:
- Dialogue text differs from input and `user_requested_dialogue_normalization=false`
- House Voice alters dialogue
- Grammar/spell linting produces rewrite suggestions inside dialogue
- Identity-coded descriptors appear in output

**Mandatory QA test categories:**
- Dialogue immutability
- Level switching with confirmation
- Work-level inheritance
- Explicit override logging

---

## 10. MISTAKE-PROOFING (DEFENSIVE CONTROLS)

### Hard Guards
- Dialogue spans are **write-protected** unless override flag is `true`
- Rewrite generator must check override flag before emitting replacements

### Audit Logging (MANDATORY)
Log per run:
- `voice_preservation_level`
- `dialogue_rewrites_emitted`
- `user_requested_dialogue_normalization`

If:
```
dialogue_rewrites_emitted > 0
AND user_requested_dialogue_normalization = false
→ automatic QA failure
```

---

## 11. CONTRACTUAL ENFORCEMENT (BASE44)

Any automated dialogue rewrite, normalization, or sanitization without explicit user request constitutes:
- A QA failure
- A governance breach
- A contractual violation under the SOW Addendum

---

## 12. SINGLE NORTH-STAR STATEMENT

**RevisionGrade evaluates voice as craft, not correctness. Dialogue is preserved unless the author explicitly asks otherwise.**

---

## STATUS

This document is **CANON**.

It is binding across Base44 and RevisionGrade internal engineering, QA, product, and compliance.