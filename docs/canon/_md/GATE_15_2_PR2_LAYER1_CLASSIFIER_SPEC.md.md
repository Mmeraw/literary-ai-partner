**GATE\_15\_2\_PR2\_LAYER1\_CLASSIFIER\_SPEC.md**

**RevisionGrade — Gate 15.2 PR2 Layer 1 Classifier Specification**

**Scope:** PR2 only
**Purpose:** Define the **Layer 1 detection and classification system** for Gate 15.2. This layer identifies candidate segments and performs initial functional classification before governance enforcement.

---

## 1. Objective

PR2 implements the first executable layer of Gate 15.2.

This layer must:

- detect candidate segments at risk of false-positive correction

- classify each segment into functional categories

- assign confidence levels

- generate rationale for classification

- flag potential failure modes

- pass structured output to PR3 (governance enforcement)

PR2 does NOT:

- allow or block edits (PR3)

- render UI (PR5)

- produce audit artifacts (PR6)

---

## 2. Layer Definition

Layer Name: Layer 1 — Detection & Functional Classification

Position:

Immediately after Gate 15.1 outputs

Input:

- structurally validated text

- Gate 15.1 metadata

Output:

- Gate15\_2Classification objects

---

## 3. Core Responsibility

Layer 1 answers:

> “What is this line doing?”

NOT:

> “Is this correct?”

---

# 🔍 4. Detection Pass (Candidate Identification)

The system must scan for the following triggers:

---

## 4.1 Nonstandard Speech Indicators

- slang (“for who”)

- truncation (“ya,” “everythin’”)

- dropped articles (“got Internet”)

- clipped syntax (“promise it be quick”)

---

## 4.2 Behavioral Detail Indicators

- hesitation (pause before action)

- reversal (intention vs action mismatch)

- resource decisions (spending, saving, withholding)

- micro-actions revealing internal state

---

## 4.3 Panic / Cognitive Compression

- repeated phrases

- fragmented syntax

- abrupt sentence breaks

- escalating thought loops

---

## 4.4 Performance Register Indicators

- rhyme or rhythm

- chant-like structure

- exaggerated persona voice

- stylized repetition

---

## 4.5 Inventory / Logistical Density

- object lists

- structural counts

- repeated environmental mapping

- procedural description without change

---

## 4.6 Physiological Signals

- breathing patterns

- shaking / tension

- repeated physical reactions

---

# ⚙️ 5. Candidate Extraction

```

if (trigger\_detected) {

create Gate15\_2Candidate

}

```

Segmentation:

- default → sentence level

- clause level → mixed signals

- multi-line → performance speech

---

# 🧠 6. Functional Classification

Each candidate must be classified as:

```

FORCE | BEHAVIOR | INVENTORY | NOISE | MIXED

```

---

# 📐 7. Classification Rules

---

## 7.1 FORCE

Trigger when:

- rhythmic structure present

- symbolic repetition

- tonal escalation

- ritual or chant pattern

```

if (rhythm\_detected || symbolic\_density\_high || structured\_repetition)

→ FORCE

```

---

## 7.2 BEHAVIOR

Trigger when:

- decision occurs

- hesitation occurs

- contradiction exists

- consequence implied

```

if (decision\_signal || contradiction\_signal || consequence\_signal)

→ BEHAVIOR

```

---

## 7.3 INVENTORY

Trigger when:

- static description

- list pattern

- no change over time

```

if (list\_pattern && no\_behavior && no\_force)

→ INVENTORY

```

---

## 7.4 NOISE

Trigger when:

- redundancy

- zero informational gain

- mechanical phrasing

```

if (redundant && no\_voice && no\_behavior && no\_force)

→ NOISE

```

---

## 7.5 MIXED

Trigger when:

- behavior or force exists alongside inventory

```

if ((behavior || force) && inventory\_present)

→ MIXED

```

---

# 🛡️ 8. Voice Protection Override (CRITICAL)

```

if (nonstandard\_speech\_detected) {

if (semantic\_clarity == true && consistency == true) {

suppress\_noise\_flag

prevent\_inventory\_classification

}

}

```

Prevents:

- dialect misclassification

- slang normalization

- truncation errors

---

# 📊 9. Confidence Scoring

Each classification must include:

```

high | medium | low

```

High:

- strong clear signal

Medium:

- partial overlap

Low:

- ambiguous / conflicting

---

# 🧾 10. Rationale Generation

Each classification must include a short explanation.

Examples:

- “phonetic dialect consistent with speaker”

- “decision reveals internal contradiction”

- “list structure without narrative function”

- “repetition indicates panic cognition”

---

# ⚠️ 11. Failure Mode Tagging

Flag risks (do NOT enforce yet):

```

surface\_inventory\_misclassification

voice\_normalization\_risk

panic\_cognition\_risk

performance\_flattening\_risk

```

---

# 📦 12. Output Contract

```ts

export interface Gate15\_2Classification {

lineNumber: number;

matchedText: string;

finalClass: "FORCE" | "BEHAVIOR" | "INVENTORY" | "NOISE" | "MIXED";

action: "PROTECT" | "TRIM" | "CUT" | "REVIEW";

rationale: string;

confidence: "high" | "medium" | "low";

failureModeCandidate?: string[];

}

```

---

# 📊 13. Action Mapping (Preliminary Only)

| Class | Suggested Action |

|------|----------------|

| FORCE | PROTECT |

| BEHAVIOR | PROTECT / TRIM |

| INVENTORY | CUT |

| NOISE | CUT |

| MIXED | TRIM |

Final decision happens in PR3.

---

# ⚠️ 14. Edge Case Handling

- dialect-heavy → bias PROTECT

- ritual-heavy → bias FORCE

- low context → reduce confidence

---

# ⚡ 15. Performance Requirements

- O(n) time complexity

- no deep semantic parsing

- heuristic-based classification

- defer ambiguity to PR3

---

# 🧪 16. TEST CASES (FULLY CONCRETE)

---

## Case 1 — Slang

Input:

“For who?”

Output:

VOICE → PROTECT

---

## Case 2 — Dialect

Input:

“Ya can’t believe everythin’ ya read.”

Output:

VOICE → PROTECT

---

## Case 3 — Behavioral (Cliff Example)

Input:

Cliff glanced at the gas prices, did the math in his head, and decided against buying the washer fluid.

Output:

BEHAVIOR → PROTECT

---

## Case 4 — Inventory

Input:

Three huts, two smokehouses, one storage shed.

Output:

INVENTORY → CUT

---

## Case 5 — Panic Cognition

Input:

“No time. No time.”

Output:

BEHAVIOR → PROTECT

---

## Case 6 — Performance

Input:

“Worship da blade…”

Output:

FORCE → PROTECT

---

## Case 7 — Body

Input:

His hands wouldn’t stop shaking.

Output:

BEHAVIOR → PROTECT

---

## Case 8 — Noise

Input:

He nodded his head.

Output:

NOISE → CUT

---

## Case 9 — Mixed

Input:

The camp had three huts... He checked each one twice.

Output:

MIXED → TRIM

---

# ✅ 17. Done Definition

PR2 is complete when:

- detection works across all triggers

- classification is consistent

- confidence assigned

- rationale present

- failure modes flagged

- all test cases pass

- no enforcement logic exists

---

# 🚀 18. Final System Effect

After PR2:

- system becomes \*\*function-aware\*\*

- false positives are detectable

- classification becomes auditable

- groundwork is ready for enforcement

---

# 🔒 19. Canonical Summary

PR2 transforms the system from:

rule-based detection

→ into

function-based classification

This is the layer that allows the system to understand meaning before acting.
