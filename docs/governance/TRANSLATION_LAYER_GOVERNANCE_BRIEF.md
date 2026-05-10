# Translation Layer Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Scope**: The boundary layer that converts internal protected IP into user-facing public language
**Owner**: Mmeraw  
**Created**: 2026-05-10
**References**: DREAM_OUTPUT_SPEC.md, EVALUATION_HANDOFF_SUCCESS_SPEC.md, AI_GOVERNANCE.md

---

## Executive Summary

The translation layer is the most architecturally consequential governance boundary in RevisionGrade. It is what allows the full system — the 62-wave WAVE canon, paired gates, 13-criterion engine, ritual registry, anchor lock system — to deliver its full intelligence to users **without exposing a single proprietary identifier or internal architectural detail**.

Without the translation layer, the system's protected IP would leak into every user-facing surface. With it, the user sees a smart, principled evaluation tool shaped by sophisticated methodology they cannot (and need not) see.

This brief locks the translation layer itself as a critical protected component and establishes the governance boundaries that keep it intact.

---

## Translation Layer Definition

**The translation layer is the set of rules, registries, and boundary functions that ensure:**

1. Every protected identifier (wave ID, gate ID, doctrine code, Tsunami name, ledger field name) is **mapped to and rendered as** user-facing plain-language equivalents.
2. Every user-facing string, response payload, exported artifact, and error message is **validated to contain zero protected identifiers**.
3. Every internal signal is **translated to user-comprehensible language** (e.g., Gate 15.1 failure becomes "Evaluation could not complete due to insufficient manuscript signal").
4. Every system decision is **grounded in editorial/craft language**, not architecture or implementation details.

The translation layer exists at the boundary between:
- **Internal IP**: The 62-wave canon, both ledgers, ritual registry, gate logic, pass system, doctrine entries — all [PROTECTED]
- **User surface**: Public language, 13-criteria framing, plain editorial guidance — all [PUBLIC]

---

## The Protected Identifiers That Must Never Leak

### Highest-Leak Categories (Must Be Guarded)

These identifiers, if visible to the user, immediately reveal the system's internal architecture or methodology:

#### 1. **Wave IDs and Tsunami Names** [PROTECTED]
- Identifiers: `WAVE-31-LW`, `WAVE-55-L`, `Tsunami-1`, `Tsunami-2`, etc.
- Leak risk: If a user sees "WAVE-31-LW" in any output, they know a 62-wave canonical system exists, and they know the specific wave architecture.
- Never exposed in: revision priorities, status messages, export payloads, error logs, UI text, or any user-facing surface.
- Translation: Wave names are rendered in plain craft language ("Strengthen Chapter Endings to Maintain Reader Pull") without any wave reference.

#### 2. **Gate IDs and Gate Logic** [PROTECTED]
- Identifiers: `Gate 15.1`, `Gate 15.2`, reason codes like `Q1`, `DIALOGUE_ATTRIBUTION_FAIL`, `OVERCORRECTION_BLOCK`, etc.
- Leak risk: If visible, reveals paired-gate governance architecture and dialogue/overcorrection firewall methodology.
- Never exposed in: evaluation results, confidence statements, status pages, exported artifacts, or error messages.
- Translation: Gate results are translated to user language ("Evaluation passed all quality checks" or "The evaluation could not complete because we couldn't verify dialogue attribution with sufficient confidence").

#### 3. **Doctrine Codes and Registry IDs** [PROTECTED]
- Identifiers: `RITUAL-EDITOR-1`, `VOICE-LAW-1`, `ANCHOR-LAW-1`, `JUDGMENT-LAW-1`, `REC-1A`, etc.
- Leak risk: Reveals ritual registry, anchor lock system, Lost World doctrine, and voice preservation methodology.
- Never exposed in: reasoning text, confidence derivations, ritual mention, or any artifact.
- Translation: Ritual/anchor protection is rendered as "We protected your distinctive voice in these passages" without revealing the ritual registry or anchor lock system.

#### 4. **Ledger Field Names and Scoring Architecture** [PROTECTED]
- Identifiers: `Ledger A`, `Ledger B`, `weighted_composite_score`, `two_ledger_composite`, `WAVE_readiness_score`, etc.
- Leak risk: Reveals two-ledger architecture, weighted composite methodology, and dual-track scoring logic.
- Never exposed in: user-facing scores, export payloads, telemetry fields visible to the user, or system descriptions.
- Translation: Scores are presented as "Craft Score" and "Editorial Score" (simple, user-comprehensible) without revealing the ledger calculation or composition logic.

#### 5. **Pass System Details** [PROTECTED]
- Identifiers: `Pass 1`, `Pass 2`, `Pass 3`, `Pass 4`, pass-specific prompt fragments, convergence logic, divergence rules, etc.
- Leak risk: Reveals multi-pass evaluation methodology, model orchestration, and truth resolution architecture.
- Never exposed in: evaluation description, methodology statements, or any documentation visible to users.
- Translation: Evaluation quality is simply stated ("Evaluated with multi-AI consensus for accuracy") if explained at all, without naming passes or internal orchestration.

#### 6. **SIPOC Telemetry Field Names** [PROTECTED]
- Identifiers: `chunk_coverage_pct`, `representation_compression_ratio`, `dark_criteria`, `evidence_density_score`, `chunk_count`, `compression_governance_state`, etc.
- Leak risk: If visible, reveals internal instrumentation and architecture observation points.
- Never exposed in: user-visible diagnostics, exported reports, or telemetry fields the user can see.
- Translation: Signal sufficiency is conveyed in plain language ("Evaluated 78% of your manuscript directly; 22% was summarized for context") without exposing field names or telemetry schema.

#### 7. **Volume References** [PROTECTED]
- Identifiers: `Volume I`, `Volume II-A`, `Volume III`, `Volume V`, `Volume VI`, etc.
- Leak risk: Reveals the extent of the internal doctrine canon and system specification.
- Never exposed in: any user-facing text, documentation, or system description.

---

## Translation Registry (Canonical Component)

The translation registry is itself a protected artifact. It is the **mapping directory** that ensures every internal identifier has a public-language equivalent and that the translation is consistent, auditable, and governance-locked.

### Registry Structure

```yaml
translation_registry:
  wave_translations:
    WAVE-31-LW:
      public_name: "Strengthen Chapter Endings to Maintain Reader Pull"
      public_description: "Your chapter endings need to carry forward unresolved tension..."
      dependency_context: "First in dependency chain; enables downstream revisions"
      usage_context: ["revision_priority", "guidance_statement"]
      never_use: ["user_export", "user_message", "error_output"]
    WAVE-55-L:
      public_name: "Deepen Character Motivation Arcs"
      ...
  
  gate_translations:
    Gate-15-1:
      code_name: "Dialogue Attribution Purity"
      user_pass: "Passed identity verification checks"
      user_fail: "Could not verify dialogue attribution with sufficient confidence"
      never_expose: ["code_name", "internal_logic"]
    Gate-15-2:
      code_name: "Overcorrection Firewall"
      user_pass: "Verified no overcorrection"
      user_fail: "Detected overcorrection risk"
  
  doctrine_translations:
    RITUAL-EDITOR-1:
      public_label: "voice_preservation_ritual"
      user_message: "We protected your distinctive voice in these passages"
      telemetry_label: null  # Never expose to user telemetry
    REC-1A:
      public_label: "escalation_preservation"
      user_message: null  # Transparent to user; no message needed
  
  ledger_translations:
    Ledger-A:
      public_name: "Craft Readiness Score"
      public_description: "How well your manuscript demonstrates craft execution"
    Ledger-B:
      public_name: "Editorial Readiness Score"
      public_description: "How ready your manuscript is for reader response"
  
  telemetry_translations:
    chunk_coverage_pct:
      user_label: "Direct Evaluation Coverage"
      user_message_template: "Evaluated {{pct}}% of your manuscript directly"
    dark_criteria:
      user_label: "Insufficient Signal"
      user_message_template: "{{count}} criteria couldn't be scored due to insufficient manuscript evidence"
    representation_compression_ratio:
      user_label: null  # Internal only; no user exposure
```

### Registry Governance

1. **Canonical authority**: The translation registry is locked (PROPOSED LOCK → LOCKED). Changes require a separate governance PR with cross-reference to the internal identifier being mapped.
2. **Bidirectional validation**: Every wave ID, gate ID, doctrine code, ledger name, and telemetry field must have a registry entry. Every public label must map back to exactly one internal identifier.
3. **Audit trail**: Registry changes are tracked with version history, owner, and rationale.
4. **Additive expansion**: New internal identifiers can be added to the system, but each must have a translation registry entry before any user-facing surface uses the identifier.

---

## Boundary Functions (Translation Layer Implementation)

The translation layer is enforced at **four critical boundaries**:

### Boundary 1: Output Translation Function

**What it does:** Converts internal artifact (wave IDs, ledger values, gate results, ritual decisions) into user-facing output (plain language, 13-criterion scores, revision guidance).

**Input**: Internal evaluation payload with all protected identifiers
```json
{
  "wave_execution_plan": [
    { "wave_id": "WAVE-31-LW", "status": "pass", "confidence": 0.92 },
    { "wave_id": "WAVE-55-L", "status": "pass" }
  ],
  "gate_15_1_result": "PASS",
  "gate_15_2_result": "PASS",
  "ledger_a_score": 7.5,
  "ledger_b_score": 8.1,
  "ritual_registry": [{ "code": "RITUAL-EDITOR-1", "applied": true }]
}
```

**Output**: User-facing payload with zero protected identifiers
```json
{
  "evaluation_status": "CERTIFIED",
  "overall_score": 7.8,
  "revision_priorities": [
    {
      "rank": 1,
      "title": "Strengthen Chapter Endings to Maintain Reader Pull",
      "description": "Your chapter endings need to carry forward unresolved tension...",
      "effort": "medium",
      "impact": "high",
      "why_first": "This stabilizes the foundation for downstream revisions"
    }
  ],
  "quality_assurance": "Evaluation passed all quality checks",
  "voice_protection": "We protected your distinctive voice in these passages"
}
```

**Never contains**: wave ID, gate ID, doctrine code, ledger name, ritual code, pass number, internal telemetry field.

### Boundary 2: Export Sanitization Function

**What it does:** Strips or translates protected identifiers from any exported artifact (PDF, JSON, CSV, downloadable report) before the file leaves the system.

**Rules**:
- Every occurrence of a protected identifier is either **removed** or **translated** using the translation registry.
- The function runs **before** file generation, not after (fail-closed).
- Exported artifacts are validated post-generation to confirm zero protected identifiers.

**Examples**:
- If internal telemetry includes `"chunk_coverage_pct": 78`, the export translates this to user message: "Evaluated 78% of your manuscript directly."
- If internal artifact contains `gate_result: "Gate-15-1 PASS"`, the export renders: "Passed identity verification checks."
- Wave dependency graph is never exported; only the user-facing revision priority order is exported.

### Boundary 3: Error Handler / User-Facing Diagnostics

**What it does:** Ensures error messages, status indicators, and diagnostic output never leak protected identifiers.

**Rules**:
- Every error, status, or diagnostic message is pre-translated to user language.
- Internal errors (e.g., "Pass 2 convergence failed with Q1 attribution density exceeded") are logged internally only.
- User sees: "The evaluation could not complete. This is rare and usually temporary. Please try again, or contact support if the issue persists."
- No exception message, stack trace, internal identifier, or architectural detail is surfaced to the user.

**Validation**: Error handler is tested to confirm zero protected identifiers leak in 1000+ error scenarios.

### Boundary 4: CI Guard (Non-Optional Enforcement)

**What it does:** Automated linting that fails any PR if a protected identifier is detected in user-facing code paths, strings, or export functions.

**Protected identifier patterns** (non-exhaustive; extends with registry):
```regex
# Wave IDs
WAVE-\d+-[A-Z]+
Tsunami-\d+

# Gate IDs
Gate[-_ ]15[._][12]
[A-Z]\d[_-]FAIL|[A-Z]\d[_-]PASS

# Doctrine codes
RITUAL-[A-Z]+
VOICE-LAW-\d+
ANCHOR-LAW-\d+
JUDGMENT-LAW-\d+
REC-\d+[A-Z]

# Ledger/architectural field names
ledger_[ab]
two_ledger
weighted_composite
representation_compression_ratio
chunk_coverage_pct
dark_criteria
Pass\s[1-4]
```

**Scopes checked**:
- All user-facing string literals in frontend code
- All response payloads in API routes annotated `@PublicAPI`
- All error messages in user-facing error handlers
- All exported artifact templates and generators
- All telemetry fields exposed to client/user context
- All AI prompt references in public code paths

**Failure mode**: If any protected identifier is detected, the CI check **fails the PR** with explicit detail:
```
❌ CI GUARD FAILURE: Protected identifier detected
   File: src/api/evaluation-export.ts:234
   Pattern: "WAVE-31-LW"
   Context: User-facing export payload
   Fix: Use translation_registry to render as public-language equivalent
   References: docs/governance/TRANSLATION_LAYER_GOVERNANCE_BRIEF.md
```

**Escape valve**: None. If a protected identifier must appear in a code file (e.g., for internal logging), it must be gated behind a non-public code path validator and annotated `@InternalOnly`. The CI guard will verify the gating.

---

## Highest-Leak Identifiers: Explicit Registry (Seed)

To operationalize the CI guard immediately, lock these as the seed registry of highest-leak identifiers that must never appear in user-facing code:

### Wave IDs (Never User-Exposed)
- `WAVE-31-LW` (Scene-to-Scene Pressure Carry)
- `WAVE-55-L` (Character Motivation Arcs)
- All 62 WAVE-* identifiers per canon
- `Tsunami-1`, `Tsunami-2`, etc.

### Gate IDs (Never User-Exposed)
- `Gate 15.1`, `Gate-15.1`, `Gate_15_1`
- `Gate 15.2`, `Gate-15.2`, `Gate_15_2`
- Reason codes: `Q1`, `DIALOGUE_ATTRIBUTION_FAIL`, `OVERCORRECTION_BLOCK`, etc.

### Doctrine/Ritual Codes (Never User-Exposed)
- `RITUAL-EDITOR-1`, `RITUAL-*` pattern
- `VOICE-LAW-1`, `VOICE-LAW-*` pattern
- `ANCHOR-LAW-1`, `ANCHOR-LAW-*` pattern
- `JUDGMENT-LAW-1`, `JUDGMENT-LAW-*` pattern
- `REC-1A`, `REC-1B` (escalation logic identifiers)
- `LOST-WORLD-*` (doctrine references)

### Ledger/Scoring Field Names (Never User-Exposed)
- `Ledger A`, `Ledger B`, `ledger_a`, `ledger_b`
- `weighted_composite_score`, `two_ledger_composite`, `WAVE_readiness_score`
- `craft_score` (internal; "Craft Readiness Score" for public)
- `editorial_score` (internal; "Editorial Readiness Score" for public)

### Pass System (Never User-Exposed)
- `Pass 1`, `Pass 2`, `Pass 3`, `Pass 4`
- `convergence_logic`, `divergence_rules`, `truth_resolution`
- `perplexity_adjudication`, `model_consensus`

### SIPOC Telemetry (Never User-Exposed)
- `chunk_coverage_pct` (translate to "Direct Evaluation Coverage %" in user message)
- `representation_compression_ratio` (internal only; no user exposure)
- `dark_criteria` (translate to "Insufficient Signal" count in user message)
- `evidence_density_score` (internal only)
- `compression_governance_state` (internal diagnostic only)

### Volume References (Never User-Exposed)
- `Volume I`, `Volume II-A`, `Volume III`, `Volume V`, `Volume VI`
- Any other internal canon document reference

---

## User-Facing Surface: Allow-Listed Public Language

In contrast to the protected list above, **these terms and concepts are publicly visible** and may appear in user-facing surfaces:

- The 13 Story Criteria names (public IP)
- Craft scores, Editorial scores, overall scores (user-comprehensible labels per registry)
- Fit/gap framing ("Your manuscript is strong on X, but gaps on Y")
- Anchored evidence (chapter, scene, percentile from user's manuscript)
- Reader-impact language ("the reader loses motivation at p.47")
- Revision recommendations ("consider adding a sensory anchor to ground the reader")
- Status indicators: `CERTIFIED`, `CANDIDATE`, `BLOCKED`, `PAUSED`
- Confidence: "High", "Medium", "Low" (derived from penalties, not internal telemetry)
- Signal sufficiency: "Evaluated 78% of your manuscript directly" (no field names)
- Revision priorities in craft language (without wave IDs or dependency graph terminology)
- Lifecycle state: "In Progress", "Complete", "Ready for Revision"

---

## Architecture Principle: The Single Most Important Rule

> **No proprietary identifier, doctrine name, registry code, wave number, gate number, Tsunami designation, canon reference, prompt fragment, or internal architectural concept may appear in any user-facing surface, exported artifact, API response, telemetry field exposed to the user, error message, status indicator, or downloadable report.**

This is not a guideline. It is the boundary that makes IP protection real. Without it, the entire canon is visible. With it, the user sees a sophisticated tool and nothing of the methodology that makes it sophisticated.

---

## Success Criteria for Translation Layer Lock

- [ ] Translation registry is created and canonicalized (PROPOSED LOCK status, requires approval before becoming LOCKED).
- [ ] All four boundary functions (output translation, export sanitization, error handler, CI guard) are specified with acceptance tests.
- [ ] CI guard is operational and fails the test build if a protected identifier is detected in user-facing code.
- [ ] At least one real evaluation export (PDF or JSON) is generated and audited to confirm zero protected identifiers.
- [ ] Translation registry pass-through tests confirm bidirectional mapping (every internal ID has a public equivalent; every public label maps to exactly one internal ID).
- [ ] Error handler produces 1000+ test error scenarios with zero protected identifier leaks.
- [ ] Developer documentation makes the four boundaries and the Single Most Important Rule explicit and non-negotiable.

---

## Non-Goals

What this brief does **not** require:

- ❌ Changes to the 62-wave canon or WAVE execution system.
- ❌ Changes to Gate 15.1/15.2 logic or governance.
- ❌ Changes to the two-ledger scoring architecture or weighted composite formula.
- ❌ Changes to ritual registry or anchor lock system.
- ❌ Real implementation of boundary functions (specification only; next PR will implement).

This brief specifies the boundary. Implementation will follow in the next PR cycle.

---

## Causal Position in the System

The translation layer is the **outcome boundary** for these locked specs:

- DREAM_OUTPUT_SPEC.md → defines the user-facing diagnostic structure (dream output)
- EVALUATION_HANDOFF_SUCCESS_SPEC.md → defines IP protection as first-class constraint (Two-Tier Visibility Doctrine)
- **TRANSLATION_LAYER_GOVERNANCE_BRIEF.md** → locks the mechanisms that enforce IP protection (translation layer, registry, boundaries, CI guard)

Future PRs (Editorial Output Layer, Passage Anchoring, Prioritization Layer) will implement against these three locked specs. The translation layer ensures every user-facing output from those PRs is IP-safe.

---

## Refs

Refs DREAM_OUTPUT_SPEC.md, EVALUATION_HANDOFF_SUCCESS_SPEC.md, AI_GOVERNANCE.md, governance/DREAM_OUTPUT_SPEC (locked), governance/EVALUATION_HANDOFF_SUCCESS_SPEC (locked)
