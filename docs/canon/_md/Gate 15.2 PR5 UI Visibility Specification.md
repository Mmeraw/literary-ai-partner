# RevisionGrade — **Gate 15.2 PR5 UI Visibility Specification**

## Scope

PR5 only

## Purpose

Define how Gate 15.2 decisions are presented to users.

This layer ensures:

- transparency

- explainability

- trust

- usability

---

## 1. Objective

PR5 must:

- surface classification results to users

- explain WHY edits are allowed or blocked

- distinguish between PROTECT / TRIM / CUT

- display failure modes

- expose reasoning without overwhelming

PR5 does NOT:

- perform classification (PR2)

- enforce rules (PR3)

- generate full audit packages (PR6)

---

## 2. Core Principle

> Users must understand not just WHAT happened, but WHY.

---

## 3. UI Layers

### 3.1 Inline Indicators

Each affected segment must show:

- classification label

- action label

- hover explanation

---

### Example

Text:

“For who?”

UI:

[PROTECT — Voice]

Hover:

“Nonstandard speech preserved to maintain character voice.”

---

---

### 3.2 Action Labels

| Label | Meaning |

|------|--------|

| PROTECT | cannot be edited |

| TRIM | partially editable |

| CUT | removable |

| REVIEW | needs human decision |

---

---

### 3.3 Color System

| Type | Color |

|------|------|

| FORCE | deep purple |

| BEHAVIOR | blue |

| INVENTORY | gray |

| NOISE | light red |

| MIXED | amber |

---

---

## 4. Explanation Panel

Clicking a segment reveals:

- classification

- rationale

- blocked edit (if applicable)

- rule applied

---

### Example

Text:

“No time. No time.”

Panel:

- Class: BEHAVIOR

- Reason: repetition reflects panic cognition

- Decision: BLOCK

- Rule: Panic Cognition Protection

---

---

## 5. Blocked Edit Feedback

When user attempts an invalid edit:

### Example

User Edit:

“No time.”

System Response:

❌ Edit blocked

Reason:

“This repetition encodes urgency and cognitive pressure. Removing it weakens behavior.”

---

---

## 6. Mixed Content UI

For MIXED:

- highlight only removable portions

- protect functional segments

---

### Example

Text:

Camp had three huts... He checked each one twice.

UI:

- huts → CUT

- checking → PROTECT

---

---

## 7. Zero Compression Display

When triggered:

UI Banner:

“No edits applied. High narrative density detected. Compression disabled.”

---

---

## 8. Failure Mode Display

If triggered:

- show warning badge

Example:

⚠ Possible misclassification risk detected

---

---

## 9. Confidence Display

Optional but recommended:

- HIGH → no indicator

- MEDIUM → subtle indicator

- LOW → “Needs Review”

---

---

## 10. Developer Mode (Optional)

Toggle view showing:

- raw classification

- confidence score

- failure flags

- rule IDs

---

---

## 11. Done Definition

PR5 is complete when:

- users see classification clearly

- explanations are understandable

- blocked edits are explained

- mixed content is visualized correctly

- zero compression is surfaced

---

## 12. Final Effect

PR5 ensures:

- trust

- clarity

- adoption

---

## 🔒 Canonical Summary

PR5 makes the system:

> \*\*visible, explainable, and usable\*\*
