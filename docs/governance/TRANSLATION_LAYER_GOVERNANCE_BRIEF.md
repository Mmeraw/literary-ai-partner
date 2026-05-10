# Translation Layer Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Scope**: The boundary layer that converts internal protected IP into user-facing public language
**Owner**: Mmeraw  
**Created**: 2026-05-10
**References**: DREAM_OUTPUT_SPEC.md, EVALUATION_HANDOFF_SUCCESS_SPEC.md, AI_GOVERNANCE.md

---

## Brief Visibility Classification

**This document is itself classified [PROTECTED].**

This brief specifies IP-protection mechanisms and governance boundaries. Specific canonical identifiers, structures, mappings, registry contents, and implementation patterns are intentionally omitted from this document and maintained only within protected registries and implementation layers outside this brief.

This brief may be cited in internal RevisionGrade governance and adjudication contexts but must not be reproduced verbatim outside of internal governance or referenced in user-facing systems, CI logs, or public documentation.

---

## Executive Summary

The translation layer is the most architecturally consequential governance boundary in RevisionGrade. It is what allows the full internal system to deliver its full intelligence to users **without exposing a single proprietary identifier or internal architectural detail**.

Without the translation layer, internal methodology would leak into every user-facing surface. With it, the user sees a smart, principled evaluation tool whose sophistication derives from protected architecture they cannot (and need not) see.

This brief locks the translation layer itself as a critical protected component and establishes the governance boundaries that keep it intact. The brief uses abstract category names for protected identifiers; the specific identifiers, structures, and mappings live in a separate protected registry with appropriate access controls.

---

## Translation Layer Definition

**The translation layer is the set of rules, registries, and boundary functions that ensure:**

1. Every protected identifier (internal reference codes, architecture names, system field names) is **mapped to and rendered as** user-facing plain-language equivalents.
2. Every user-facing string, response payload, exported artifact, and error message is **validated to contain zero protected identifiers**.
3. Every internal signal is **translated to user-comprehensible language** (e.g., internal failure classification becomes "Evaluation could not complete due to insufficient manuscript signal").
4. Every system decision is **grounded in editorial/craft language**, not architecture or implementation details.

The translation layer exists at the boundary between:
- **Internal IP**: Canonical system infrastructure, method orchestration, governance topology — all [PROTECTED]
- **User surface**: Public language, 13-criteria framing, plain editorial guidance — all [PUBLIC]

---

## Protected Identifier Categories

The translation layer protects seven categories of internal identifiers. Each category, if exposed to the user, would reveal core system architecture or methodology. The specific identifiers within each category are tracked in the protected translation registry; this brief refers to categories only.

### Category 1: Wave-Class Identifiers [PROTECTED]

Internal references to specific archived evaluation techniques, organized by phase or semantic grouping. These take the form of structured codes that reveal the granularity and organization of the canonical evaluation system.

- **Leak risk**: Exposing these would reveal the breadth and specificity of the internal evaluation taxonomy.
- **Never exposed in**: revision priorities, status messages, export payloads, error logs, or any user-facing surface.
- **Translation**: Technique names are rendered in plain craft language without any internal reference.

### Category 2: Gate-Class Identifiers and Failure Codes [PROTECTED]

Internal identifiers for governance checkpoints and their reason codes. These reveal the internal quality-assurance topology and decision criteria.

- **Leak risk**: If visible, reveals the governance architecture and specific failure classifications.
- **Never exposed in**: evaluation results, confidence statements, status pages, exported artifacts, or error messages.
- **Translation**: Checkpoint results are translated to user language ("Evaluation passed all quality checks" or "We couldn't verify the evaluation with sufficient confidence").

### Category 3: Doctrine-Class Identifiers and Registry Codes [PROTECTED]

Internal identifiers for preservation rules, voice protection logic, escalation protocols, and loss mitigation doctrine. These reveal the existence of specialized protection subsystems.

- **Leak risk**: Reveals the methodology for protecting user content and authorship integrity.
- **Never exposed in**: reasoning text, confidence derivations, content preservation statements, or any artifact.
- **Translation**: Protection mechanisms are rendered as "We protected your distinctive voice in these passages" without revealing internal logic.

### Category 4: Scoring-Architecture Field Names [PROTECTED]

Internal field names for ledger systems, composite score calculations, and readiness evaluations. These reveal the underlying scoring topology and how multiple signals are combined.

- **Leak risk**: Reveals dual-track scoring logic and internal calculation methodology.
- **Never exposed in**: user-facing scores, export payloads, telemetry visible to users, or system descriptions.
- **Translation**: Scores are presented using user-comprehensible labels per the translation registry, never internal field names.

### Category 5: Pass-Orchestration Terminology [PROTECTED]

Internal identifiers for evaluation passes, convergence logic, divergence rules, and truth resolution protocols. These reveal the multi-stage evaluation methodology and model orchestration.

- **Leak risk**: Reveals the evaluation's internal multi-pass structure and consensus-building methodology.
- **Never exposed in**: evaluation descriptions, methodology statements, or documentation visible to users.
- **Translation**: Evaluation rigor is conveyed in editorial language if explained at all, never referencing internal orchestration.

### Category 6: Instrumentation Field Names [PROTECTED]

Internal telemetry field names for signal sufficiency, content representation, evidence density, and governance state tracking. These reveal the internal observability architecture.

- **Leak risk**: If visible, reveals instrumentation granularity and architecture observation points.
- **Never exposed in**: user-visible diagnostics, exported reports, or telemetry fields accessible to users.
- **Translation**: Signal sufficiency ("Evaluated 78% of your manuscript directly") is conveyed in plain language without field names or telemetry schema.

### Category 7: Canon Volume References [PROTECTED]

Internal references to the extent and structure of the canonical doctrine and system specification. These reveal the scope of internal documentation.

- **Leak risk**: Reveals the breadth of the internal methodology canon.
- **Never exposed in**: any user-facing text, documentation, or system description.
- **Translation**: System rigor is demonstrated through output quality, not internal reference density.

---

## Protected Translation Registry

The translation registry is itself a protected artifact, stored separately from this brief at a location with appropriate access controls. It is the **canonical mapping directory** that ensures every internal identifier has a verified public-language equivalent and that translation is consistent, auditable, and governance-locked.

### Registry Location and Access

- **Location**: `lib/translation/canonical-registry.ts` (or equivalent internal path with access controls)
- **Access**: Internal RevisionGrade team only; not publicly readable
- **Governance**: PROPOSED LOCK status; changes require governance PR with cross-reference to internal identifier being mapped

### Registry Structure

The registry uses the following abstract structure (not concrete contents):

```yaml
translation_registry:
  <identifier_category>:
    <specific_internal_identifier>:
      public_name: <plain-language label for user-facing output>
      public_description: <plain-language guidance or explanation>
      dependency_context: <plain-language rationale for ordering, if applicable>
      usage_context: [list of allowed user-facing contexts]
      never_use: [list of forbidden contexts]
```

Each category (wave-class, gate-class, doctrine-class, scoring-architecture, pass-orchestration, instrumentation, canon-volume) maintains its own mapping section. The registry enforces bidirectional consistency: every internal identifier has exactly one public equivalent; every public label maps back to exactly one internal identifier.

When the CI guard validates user-facing code, it reads identifier patterns from this protected registry programmatically, never from this brief.

---

## Boundary Functions (Translation Layer Implementation)

The translation layer is enforced at **four critical boundaries**:

### Boundary 1: Output Translation Function

**What it does:** Converts internal artifacts (wave-class identifiers, scoring values, governance checkpoint results, preservation rules) into user-facing output (plain language, 13-criterion scores, revision guidance).

**Contract**: Takes internal artifact with all protected identifiers as input; produces user-facing JSON/PDF payload with zero protected identifiers as output.

**Enforcement**:
- All protected identifiers are mapped through the protected translation registry
- Output payload is validated to contain only public-language labels
- All system decisions are expressed in editorial/craft language only
- No internal field names, codes, or architectural terminology appear in output

**Never contains in output**: protected identifier, architecture code, internal field name, orchestration terminology, instrumentation reference.

### Boundary 2: Export Sanitization Function

**What it does:** Strips or translates protected identifiers from any exported artifact (PDF, JSON, CSV, downloadable report) before file generation or delivery.

**Enforcement**:
- Every protected identifier is either **removed** or **translated** using the protected translation registry
- Sanitization runs **before** file generation (fail-closed principle)
- Post-generation validation confirms zero protected identifiers in output
- Dependency graphs, orchestration logic, and governance state are never exported
- Only user-comprehensible labels and manuscript-anchored guidance are exported

### Boundary 3: Error Handler / User-Facing Diagnostics

**What it does:** Ensures error messages, status indicators, and diagnostic output never leak protected identifiers or system internals.

**Enforcement**:
- All error, status, and diagnostic messages are pre-translated to user language only
- Internal diagnostics (system state, code paths, orchestration details) are logged to internal systems only
- User sees only: plain-language description of what happened and next-step guidance
- No exception messages, stack traces, internal identifiers, architecture terminology, or system instrumentation is surfaced to users
- Error handler validation confirms zero protected-identifier leakage across realistic error scenarios

### Boundary 4: CI Guard (Non-Optional Enforcement)

**What it does:** Automated linting that fails any PR if a protected identifier is detected in user-facing code paths, strings, or export functions.

**Protected identifier patterns**: The CI guard reads pattern specifications from the protected translation registry, not from this brief. The registry maintains a curated list of regex patterns and identifier families that must never appear in user-facing code.

**Scopes checked**:
- All user-facing string literals in frontend code
- All response payloads in API routes annotated `@PublicAPI`
- All error messages in user-facing error handlers
- All exported artifact templates and generators
- All telemetry fields exposed to client/user context
- All AI prompt references in public code paths

**Failure mode**: If any protected identifier is detected, the CI check **fails the PR** with explicit guidance:
```
❌ CI GUARD FAILURE: Protected identifier detected
   File: src/api/evaluation-export.ts:234
   Context: User-facing export payload
   Fix: Consult translation registry for public-language equivalent
   References: lib/translation/canonical-registry.ts
```

**Escape valve**: None. If a protected identifier must appear in a code file (e.g., for internal logging), it must be gated behind a non-public code path and annotated `@InternalOnly`. The CI guard will verify the gating.

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

> **No protected identifier — including system codes, architecture terminology, governance names, methodology references, structural documentation, or internal implementation details — may appear in any user-facing surface, exported artifact, API response, user-visible telemetry, error message, status indicator, or downloadable report.**

This is not a guideline. It is the boundary that makes IP protection real. Without this enforcement, internal methodology is visible. With it, users experience a sophisticated tool without seeing the methodology that makes it sophisticated.

---

## Success Criteria for Translation Layer Lock

- [ ] Protected translation registry exists at a specified location with access controls; brief documents its location and governance posture.
- [ ] All four boundary functions (output translation, export sanitization, error handler, CI guard) are specified with acceptance tests.
- [ ] CI guard reads identifier patterns from the protected registry and fails any PR that introduces a protected identifier into user-facing code.
- [ ] At least one real evaluation export (PDF or JSON) is generated and audited to confirm zero protected identifiers.
- [ ] Translation registry pass-through tests confirm bidirectional mapping (every internal ID has a public equivalent; every public label maps to exactly one internal ID).
- [ ] Error handler produces realistic error scenarios with zero protected identifier leaks.
- [ ] Developer documentation makes the four boundaries, the protected registry, and the Single Most Important Rule explicit and non-negotiable.

---

## Non-Goals

This brief specifies governance boundaries and mechanisms. It does **not** require:

- ❌ Changes to internal canonical systems or execution logic
- ❌ Changes to internal governance topology or verification criteria
- ❌ Changes to internal scoring methodology or confidence derivation
- ❌ Changes to internal preservation or protection subsystems
- ❌ Real implementation of boundary functions (specification only; implementation phase follows)

This brief locks the membrane. Implementation will follow in subsequent PR cycles.

---

## Causal Position in the System

The translation layer is the **enforcement boundary** that enables these locked specs:

- DREAM_OUTPUT_SPEC.md → defines user-facing diagnostic structure
- EVALUATION_HANDOFF_SUCCESS_SPEC.md → defines IP protection as first-class constraint
- **TRANSLATION_LAYER_GOVERNANCE_BRIEF.md** → locks the mechanisms that enforce IP protection at every boundary (translation registry, four boundary functions, CI guard)

Every future PR that produces user-facing output must satisfy this translation layer: zero protected identifiers in any direction.

---

## Refs

Refs DREAM_OUTPUT_SPEC.md, EVALUATION_HANDOFF_SUCCESS_SPEC.md, AI_GOVERNANCE.md, governance/DREAM_OUTPUT_SPEC (locked), governance/EVALUATION_HANDOFF_SUCCESS_SPEC (locked)
