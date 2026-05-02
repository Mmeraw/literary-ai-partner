# RevisionGrade — **Gate 15.2 PR4 Layer 2 Functional Review Specification**

## Scope

PR4 only

## Purpose

Resolve ambiguity and edge cases after PR2 classification and before PR3 enforcement.

This layer performs:

- second-pass evaluation

- conflict resolution

- ambiguity arbitration

- classification correction

---

## 1. Objective

PR4 must:

- review LOW and MEDIUM confidence classifications

- resolve MIXED cases

- correct misclassification (especially behavior vs inventory)

- arbitrate conflicts between competing signals

- upgrade or downgrade classification confidence

- pass final classifications to PR3

PR4 does NOT:

- perform initial detection (PR2)

- enforce edits (PR3)

- render UI (PR5)

---

## 2. Position in Pipeline

```

Wave 15

→ Gate 15.1

→ Gate 15.2 PR2 (classification)

→ Gate 15.2 PR4 (review)

→ Gate 15.2 PR3 (enforcement)

→ Wave 16

```

---

## 3. Core Responsibility

PR4 answers:

> “Is this classification actually correct given context?”

NOT:

> “What is this line doing?” (PR2)

> “Should we allow this edit?” (PR3)

---

# 🧠 4. When PR4 Triggers

PR4 activates when:

- confidence = LOW or MEDIUM

- classification = MIXED

- failureModeCandidate present

- multiple competing signals detected

---

# ⚖️ 5. Conflict Resolution Rules

---

## 5.1 Behavior vs Inventory Conflict (CRITICAL)

### Rule

If detail appears logistical but includes:

- decision

- hesitation

- contradiction

→ classify as BEHAVIOR

---

### Example

Text:

He checked the fuel gauge again. Still half. Still not enough.

PR2 Output:

INVENTORY ❌

PR4 Correction:

BEHAVIOR ✅

---

---

## 5.2 Voice vs Noise Conflict

### Rule

If nonstandard speech is:

- readable

- consistent

→ classify as VOICE (protect)

---

### Example

Text:

“Ya ain’t gonna make it.”

PR2 Output:

NOISE ❌

PR4 Correction:

BEHAVIOR / VOICE ✅

---

---

## 5.3 Panic vs Redundancy Conflict

### Rule

If repetition reflects urgency → BEHAVIOR

If repetition adds nothing → NOISE

---

### Example

Text:

“No time. No time. No time.”

PR2 Output:

NOISE ❌

PR4 Correction:

BEHAVIOR ✅

---

---

## 5.4 Performance vs Error Conflict

### Rule

If structure shows rhythm or persona → FORCE

---

### Example

Text:

“Goad ’em, throat ’em, gang-banger time”

PR2 Output:

NOISE ❌

PR4 Correction:

FORCE ✅

---

---

## 5.5 Body vs Filler Conflict

### Rule

If physical detail reflects:

- stress

- degradation

- emotional state

→ BEHAVIOR

Otherwise → NOISE

---

### Example

Text:

His hands wouldn’t stop shaking.

→ BEHAVIOR

---

Text:

He blinked his eyes.

→ NOISE

---

---

# 🔍 6. Context Expansion Logic

PR4 may evaluate:

- previous lines

- next lines

- repeated patterns

---

### Rule

```

if (line meaning unclear):

evaluate surrounding context

```

---

### Example

Text:

He counted again.

Context:

He counted the cans again. Twelve. Still not enough.

→ BEHAVIOR

---

---

# 📊 7. Confidence Adjustment

PR4 may:

- upgrade LOW → MEDIUM or HIGH

- downgrade MEDIUM → LOW

- maintain HIGH

---

### Rule

```

if signals align → increase confidence

if conflict remains → lower confidence

```

---

# 🔁 8. Reclassification Rules

PR4 can override PR2 classification:

| From | To |

|------|----|

| INVENTORY | BEHAVIOR |

| NOISE | BEHAVIOR |

| NOISE | FORCE |

| MIXED | BEHAVIOR |

| MIXED | FORCE |

---

# ⚠️ 9. Failure Mode Resolution

PR4 must resolve:

- surface\_inventory\_misclassification

- voice\_normalization\_risk

- panic\_cognition\_risk

- performance\_flattening\_risk

---

### Example

PR2 flagged:

surface\_inventory\_misclassification

PR4 must:

- analyze deeper

- correct classification

- remove risk flag if resolved

---

# 📦 10. Output Contract

```ts

export interface Gate15\_2ReviewedClassification {

lineNumber: number;

matchedText: string;

finalClass: "FORCE" | "BEHAVIOR" | "INVENTORY" | "NOISE" | "MIXED";

action: "PROTECT" | "TRIM" | "CUT" | "REVIEW";

confidence: "high" | "medium" | "low";

rationale: string;

adjusted: boolean;

originalClass?: string;

}

```

---

# 🧪 11. Test Cases (Expanded)

---

## Case 1 — False Inventory

Input:

He counted the cans again. Twelve. Still not enough.

PR2:

INVENTORY ❌

PR4:

BEHAVIOR ✅

---

## Case 2 — Slang Misread

Input:

“For who?”

PR2:

NOISE ❌

PR4:

VOICE → PROTECT

---

## Case 3 — Panic Repetition

Input:

“No time. No time.”

PR2:

NOISE ❌

PR4:

BEHAVIOR ✅

---

## Case 4 — Chant

Input:

“Slice and dice, a toadstone would be nice”

PR2:

NOISE ❌

PR4:

FORCE ✅

---

## Case 5 — True Noise

Input:

He nodded his head.

PR2:

NOISE ✅

PR4:

NO CHANGE

---

## Case 6 — Mixed Resolution

Input:

Camp description + checking

PR2:

MIXED

PR4:

BEHAVIOR (dominant)

---

# ✅ 12. Done Definition

PR4 is complete when:

- ambiguous cases resolved

- classifications corrected

- confidence adjusted

- failure modes handled

- output ready for PR3

---

# 🚀 13. Final System Effect

After PR4:

- system becomes context-aware

- false positives reduced

- edge cases handled

- classification becomes reliable

---

# 🔒 14. Canonical Summary

PR4 ensures:

- the system does not act on shallow classification

- meaning is correctly interpreted

- ambiguity is resolved before enforcement

---

## 🔥 Final Truth

PR2 gives the system awareness

PR3 gives it authority

PR4 gives it:

> \*\*judgment\*\*
