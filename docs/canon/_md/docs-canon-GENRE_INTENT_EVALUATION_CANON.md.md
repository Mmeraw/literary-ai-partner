**docs/canon/GENRE\_INTENT\_EVALUATION\_CANON.md**

**GENRE & INTENT EVALUATION CANON (V1)**

**Status**

**Binding doctrine (interpretive layer)**
This canon defines how **genre and authorial intent** modulate evaluation **without altering WAVE truth conditions**.

**1. Purpose**

RevisionGrade evaluates manuscripts using a universal canon (WAVE).
However, **what “good” looks like varies by genre and intent**.

This canon establishes:

**Evaluation = WAVE Canon × Authorial Intent × Genre Context**

* WAVE = invariant truth layer
* Intent/Genre = interpretation layer
* Governance = enforcement layer (fail-closed)

**2. Non-Negotiable Invariants**

Genre/intent **MUST NOT**:

* change scoring scales
* bypass quality gates
* permit generic reasoning
* introduce alternative criteria
* allow invalid artifacts to persist

**If it is not enforced, it is not real.**

Genre/intent **MAY**:

* adjust interpretation of signals
* adjust severity of findings
* adjust recommendation framing
* classify absence vs. weakness
* protect intentional nonstandard language/structure

**3. Definitions**

**3.1 Genre (Context Layer)**

A classification of narrative expectations and stylistic norms.

Examples:

* literary\_fiction
* commercial\_thriller
* suspense
* fantasy
* science\_fiction
* historical
* hybrid (multi-genre)

**3.2 Authorial Intent (Intent Layer)**

Declared or inferred goals of the work:

* literary / aesthetic
* commercial / market-driven
* experimental / transgressive
* hybrid

**3.3 Evaluation Mode (Posture Layer)**

Independent of genre:

* **transgressive** (risk-tolerant, exploratory)
* **balanced** (default)
* **conservative/commercial** (market-aligned strictness)

**4. Evaluation Model**

Every evaluation must explicitly track:

evaluationIntent: {
 genre: string
 secondaryGenres: string[]
 intent: string
 mode: "transgressive" | "balanced" | "conservative"
 source: "auto" | "user\_confirmed" | "user\_overridden"
 confidence: number
}

**5. Genre Detection & Confirmation**

**5.1 Detection (Pass 1)**

The system infers genre using signals:

* prose density / lyricism
* dialogue density
* pacing patterns
* narrative scope (intimate vs epic)
* speculative elements
* structural form

**5.2 User Confirmation (Pre-Pass 2)**

The system must:

1. Present detected genre
2. Ask for confirmation (yes/no)
3. Offer alternatives / dropdown if rejected

**5.3 Status Tracking**

genreStatus:
 | "auto\_detected"
 | "user\_confirmed"
 | "user\_overridden"
 | "unknown"

**6. Interpretation Rules (Core)**

**6.1 Dialogue**

| **Condition** | **Interpretation** |
| --- | --- |
| Literary | Low dialogue may be intentional |
| Thriller | Low dialogue is a pacing risk |
| Hybrid | Evaluate balance, not absolute level |

**Rule**: Absence ≠ weakness. Must classify:

* absent
* sparse (intentional)
* insufficient (problematic)

**6.2 Speech (Slang, Dialect, Transgression)**

Must classify:

* intentional voice signal
* character-specific idiolect
* narrative contamination
* overcorrection risk

**Rule**:

Nonstandard language is protected if intentional.

**6.3 Voice**

Must evaluate:

* voice consistency
* voice drift
* voice flattening risk

**Genre effect**:

| **Genre** | **Expectation** |
| --- | --- |
| Literary | High variation / lyrical |
| Commercial | Controlled clarity |
| Experimental | permitted instability |

**6.4 POV & Thought Boundary**

Must explicitly classify:

* POV mode (1st, 3rd close, omniscient, hybrid)
* thought rendering (direct, free indirect, italicized)
* boundary integrity (clean vs leakage)

**Rule**:

Interiority is not “slow pacing” unless it violates intent.

**6.5 Pacing**

Must distinguish:

* deliberate pacing
* drag
* structural imbalance

**Genre effect**:

| **Genre** | **Expectation** |
| --- | --- |
| Thriller | acceleration |
| Literary | modulation |
| Epic/Fantasy | expansion |

**7. Required Mechanistic Output (Criterion 4 binding)**

Criterion 4 MUST output structured fields:

povAnalysis: {
 povMode: string
 thoughtBoundary: "stable" | "leaky" | "mixed"
 renderingMode: string[]
}

voiceAnalysis: {
 consistency: "stable" | "drifting"
 driftRisk: number
 flatteningRisk: number
}

dialogueAnalysis: {
 presence: "absent" | "sparse" | "active"
 attributionProfile: string
 speakerClarity: number
}

speechAnalysis: {
 nonstandardUsage: boolean
 protected: boolean
 transgressive: boolean
}

**8. Quality Gate Integration**

**8.1 Gate 15.1 (Structural)**

Must validate:

* attribution mechanisms
* rendering clarity
* dialogue mechanics

**Genre-aware rule**:
Sparse dialogue must not auto-fail.

**8.2 Gate 15.2 (Meaning / Protection)**

Must protect:

* dialect
* slang
* transgressive speech
* interior cognition
* literary pacing

**Rule**:

Prevent genre-blind overcorrection.

**9. Failure Modes**

**9.1 Genre-Blind Evaluation (BLOCK)**

Occurs when:

* dialogue flagged without context
* pacing flagged without genre
* slang corrected without analysis

**9.2 Generic Reasoning (BLOCK)**

Still enforced:

* mechanism language required
* no high-level vague claims

**9.3 Unknown Genre (DEGRADED)**

If genre not confirmed:

* mark evaluation degraded
* reduce confidence
* proceed with caution

**10. Pass-Level Responsibilities**

**Pass 1**

* detect genre
* extract signals

**Pass 2**

* evaluate using genre-aware interpretation

**Pass 3**

* reconcile differences without flattening
* preserve dual interpretations if hybrid

**Pass 4**

* verify consistency
* ensure gates align with genre-aware logic

**11. Hybrid & Multi-Genre Handling**

System must:

* allow multiple genres
* avoid forcing single classification
* present dual evaluation interpretations where needed

**12. Revision Routing (Future Binding)**

Gate failures must map to:

* POV repair modules
* dialogue enhancement modules
* voice preservation modules
* pacing alignment modules

**13. Relationship to Existing Canon**

This file **extends but does not replace**:

* Volume I (WAVE)
* Volume II (criteria)
* Volume VI (trust layer)
* Gate 15.1
* Gate 15.2

**14. Implementation Order (Binding)**

1. Canon (this file) ✅
2. Criterion 4 structured output
3. Pass 2/3 prompt binding
4. Gate consumption update
5. Tests
6. UI confirmation

**🔒 Final Principle**

Genre shapes interpretation.
Canon defines truth.
Governance enforces both.

**If you want next**

I’ll map this directly into:

* Volume I insertion blocks
* Volume II per-criterion edits
* Gate 15.1 / 15.2 patch language
* exact TypeScript interfaces

Just say: **“propagate into volumes”**

Top of Form

Bottom of Form
