# WAVE Revision System Guide

## WAVE 61 - Reflexive Pronouns & Redundancy Rule

### Core Principle
Certain English words become redundant when the meaning is already clear from context. They dilute tension, clarity, and authority.

### Major Culprits
- **Reflexive pronouns**: himself, herself, themselves, ourselves
- **Possessive emphasis**: own
- **Filler words**: just, as if, like (comparative), them (when unclear)

### Decision Rule (CRITICAL)

**Reflexive ≠ automatically bad**

- **Reflexive + no narrative function** → flag + suggest revision
- **Reflexive + embodiment/voice function** → keep line; no suggestion (or low-priority note only)

### How the Rule Functions

#### 1. Reflexive Pronouns (himself, herself, themselves, ourselves)
**Keep when:**
- Action is truly reflexive: "He cut himself."
- Adding deliberate emphasis: "He did it himself, after all that."

**Remove when:**
- Verb already signals who receives action
- ❌ "He nodded to himself." → ✔ "He nodded."
- Exception: if implying introspection, self-reassurance, or private ritual

#### 2. "Own" (her own hands, his own room)
**Keep when:**
- Signaling contrast or autonomy: "He finally walked into a room of his own."

**Remove when:**
- No contrast exists: ❌ "He walked into his own room." → ✔ "He walked into his room."

#### 3. "Just" (universal clutter word)
**Keep when:**
- Signaling immediacy: "He just arrived."
- Part of voice/internal thought: "I just needed one clean breath."

**Remove when:**
- Used as filler: ❌ "He just stood there." → ✔ "He stood there."

#### 4. "As if" / "Like" (comparative hedging)
**Keep when:**
- Comparison illuminates: "The night pressed in like a held breath."

**Remove when:**
- Comparison stalls: ❌ "The night was as if it were closing in." → ✔ "The night closed in."

**Rule:** Comparisons should illuminate, not stall.

#### 5. "Them" when redundant
**Keep when:**
- Specificity needed for clarity

**Remove when:**
- Object is implied: ❌ "The wind pushed them forward." → ✔ "The wind pushed forward."
- Creates ambiguity about who is being acted upon

### Professional Guiding Principle
**If removing the word strengthens the sentence without altering meaning or intent, cut it.**

Writers use these words unconsciously as:
- Hesitation markers
- Emphasis crutches
- Rhythm padding
- Internal thought placeholders

Agents and editors spot them immediately.

---

## Implementation Gate (Engineering)

### Two-Stage Pipeline Required

**Stage 1: Detect risk patterns** (candidates only)
- Reflexives, "as if," softeners, fillers

**Stage 2: WAVE contextual validation** (authorization)
- Interpret through embodiment, intimacy, psychological cohesion, POV voice, agency

### Gating Rule (CRITICAL)
If WAVE classifies a flagged phrase as serving **embodiment / intimacy / agency reinforcement / character voice**, then:
- Suppress or downgrade the warning
- Do NOT auto-generate a "fix"

### Generate Revision Only When BOTH:
1. Pattern matched by risk scanner, AND
2. WAVE context says "not justified" (no narrative function / clarity gain)

### Acceptance Criteria
✅ Reflexives/"as if" that reinforce embodiment/voice → NO auto-rewrite
✅ Generic "remove reflexive" suggestions → ONLY when WAVE classifies as redundant/weakening

**Treat scanner output as candidates, not decisions. WAVE must authorize all rewrites.**