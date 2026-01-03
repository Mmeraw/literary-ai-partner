# REVISIONGRADE™ EVALUATION ENTRY & ROUTING — CANON SPECIFICATION ADDENDUM

**Document Title:** RevisionGrade™ Evaluation Entry & Routing — Canon Specification Addendum  
**Status:** LOCKED / BINDING  
**Applies to:** Engineering, QA, Product, Infrastructure  
**Effective:** Immediately upon acceptance

---

## A. SCOPE & INTENT

RevisionGrade™ shall provide a **single unified evaluation entry point** for all writing submissions ("Evaluate").

Users will **not be required** to select content format (scene, chapter, manuscript, screenplay).

Format detection and routing shall be performed **automatically and invisibly** by the system.

This addendum **supersedes any prior UI or workflow assumptions** related to evaluation entry.

---

## B. CANON RULES (NON-NEGOTIABLE)

1. There shall be **one user-facing Evaluate entry point**.
2. All submissions are made through a **single page titled "Your Writing."**
3. The system **must automatically determine** submission type and route accordingly.
4. Two backend pipelines shall remain **distinct:**
   - Quick Evaluation Pipeline
   - Full Manuscript Pipeline
5. Users **must never be exposed** to routing logic or forced to choose a format.
6. Revision remains **gated behind completed Evaluation**.

---

## C. REQUIRED ROUTING LOGIC

### Pipeline A — Quick Evaluation

**Used for:**
- Scenes
- Partial or full chapters
- Screenplay excerpts
- Full screenplays (non-episodic)

**Behavior:**
- Synchronous processing
- Immediate results

### Pipeline B — Full Manuscript

**Used for:**
- Complete novels or long-form manuscripts

**Behavior:**
- Asynchronous processing
- Automatic chapter splitting
- Progress tracking

**Routing decision is final and invisible to the user.**

---

## D. SLA COMMITMENTS

Base44 guarantees:
- **100% automatic format detection**
- **Zero user-required format selection**
- **No evaluation failure due to format ambiguity**
- **Revision access only after evaluation completion**

Any deviation constitutes a **contractual breach**.

---

## E. QA & ENFORCEMENT

**Release-blocking failures include:**
- Multiple Evaluate entry points
- Required user format selection
- Incorrect pipeline routing
- Revision initiation without evaluation

---

## F. CANON STATEMENT

**"Evaluation has one user entry point; format detection and pipeline routing are automatic and invisible."**

---

## BASE44 INTERNAL MEMO — EVALUATE PROCESS IS CANON AND RELEASE-BLOCKING

**Audience:** Base44 Product Management, Engineering, Quality Assurance, Platform Leadership

RevisionGrade™ defines the EVALUATE process as a **canonical, non-optional platform surface**.

This memo clarifies intent so there is no ambiguity during implementation.

### What this means in practice

- There is **one user-facing EVALUATE entry point**.
- Users **never select format** (scene, chapter, manuscript, screenplay).
- The system performs **automatic format detection**.
- Routing to evaluation pipelines is **invisible to the user**.
- Revision is **gated behind completed evaluation**.
- Violations are **release-blocking**, not advisory.

### Why this matters

This design:
- Reduces user cognitive load
- Prevents long-term user interface drift
- Eliminates false precision and user error
- Mirrors professional editorial workflows
- Protects RevisionGrade™ brand trust

### Enforcement expectation

These rules are enforced through:
- Work tracking requirements
- Automated checks
- Quality Assurance sign-off

They are **not subject to discretionary interpretation**.