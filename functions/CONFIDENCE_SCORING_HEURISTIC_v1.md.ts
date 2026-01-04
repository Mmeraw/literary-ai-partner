# CONFIDENCE SCORING HEURISTIC v1
**Deterministic · Explainable · Auditable**

**Status:** Approved  
**Version:** 1.0  
**Date:** 2026-01-04  
**Authority:** RevisionGrade Constitutional Framework

---

## Purpose

The Confidence Scoring Heuristic quantifies how certain the system is that an evaluative claim is correct given the evidence available in the manuscript.

**It measures:**
- Evidentiary sufficiency
- Consistency
- Structural coherence

**It does NOT measure:**
- Literary merit
- Market taste
- Agent preference

---

## A. Core Design Principles

### 1. Deterministic
Same input → same score. Always.

### 2. Explainable
Every score can be decomposed and shown to a human.

### 3. Conservative
Ambiguity lowers confidence; it is never "filled in."

### 4. Composable
Claim-level confidence rolls up to section- and manuscript-level confidence.

---

## B. What Gets a Confidence Score

A confidence score is assigned to **every evaluative claim**, for example:
- "Utku functions as the antagonist"
- "The protagonist's goal is clearly established by page 20"
- "The midpoint structurally reverses stakes"

**No claim = no score.**  
**No score = no release.**

---

## C. Scoring Dimensions (v1)

Each claim is scored across five dimensions, each normalized to 0–1.

### 1. Textual Evidence Presence (E)

Is there explicit textual support?

| Score | Meaning |
|-------|---------|
| 1.0 | Direct, explicit statements or actions |
| 0.5 | Indirect or implied support |
| 0.0 | Inferred without textual grounding |

---

### 2. Evidence Consistency (C)

Does the evidence remain consistent across the manuscript?

| Score | Meaning |
|-------|---------|
| 1.0 | Consistent across scenes/chapters |
| 0.5 | Minor contradictions or drift |
| 0.0 | Conflicting signals |

---

### 3. Structural Alignment (S)

Does the claim align with recognized narrative structures given the genre?

| Score | Meaning |
|-------|---------|
| 1.0 | Strong alignment |
| 0.5 | Partial / unconventional alignment |
| 0.0 | No clear alignment |

**Note:** Unconventional ≠ wrong, but it lowers confidence.

---

### 4. Ambiguity Load (A) — PENALTY

How much unresolved ambiguity exists?

| Score | Meaning |
|-------|---------|
| 0.0 | No ambiguity |
| 0.5 | Some unresolved ambiguity |
| 1.0 | High ambiguity |

**This is a penalty term, not a reward.**

---

### 5. Inference Dependency (I) — PENALTY

How much does the claim rely on inference rather than text?

| Score | Meaning |
|-------|---------|
| 0.0 | No inference |
| 0.5 | Moderate inference |
| 1.0 | Heavy inference |

---

## D. Confidence Formula (v1)

```
RawScore = (E + C + S) / 3
Penalty = (A + I) / 2

Confidence = RawScore × (1 − Penalty)
```

Normalized to 0–1, then expressed as 0–100%.

---

## E. Confidence Bands

| Band | Range | System Behavior |
|------|-------|-----------------|
| High | ≥95% | Eligible for "Ready" |
| Medium | 80–94% | Conditional |
| Low | <80% | Not Ready |

**Hard rule:** Anything below 95% requires explicit author acceptance.

---

## F. Why This Works (Strategically)

- **Auditors** can inspect it
- **Authors** can understand it
- **Investors** can trust it
- **Engineers** can implement it
- **ML** can later replace components, not logic

This is the correct v1.

---

## G. Implementation Contract

### Data Contracts

**Claim**
```typescript
{
  claimId: string;
  claimType: enum; // ROLE_ASSIGNMENT, PLOT_POINT, POV, STAKES, etc.
  textSpans: Span[];
  chapterRefs: string[];
  evidenceNotes: string[];
  flags: Flag[]; // AMBIGUOUS, INFERRED, CONFLICTING, etc.
}
```

**Span**
```typescript
{
  startIndex: int;
  endIndex: int;
  source: enum; // MANUSCRIPT, METADATA
  confidenceHint: enum; // DIRECT_QUOTE, DIRECT_ACTION, IMPLIED, NONE
}
```

**ConfidenceResult**
```typescript
{
  claimId: string;
  dimensions: { E, C, S, A, I }; // each in [0,1]
  rawScore: float; // [0,1]
  penalty: float; // [0,1]
  confidence: float; // [0,1]
  confidencePct: int; // 0–100
  band: enum; // HIGH, MEDIUM, LOW
  requiresAuthorAcceptance: bool;
  reasons: string[]; // human-readable trace
}
```

---

## H. Dimension Scoring Rules (Deterministic)

### Evidence Presence

```typescript
function scoreEvidencePresence(claim): (score, reasons) {
  if (claim.textSpans.isEmpty()) {
    return (0.0, ["No textual evidence spans provided."]);
  }
  
  maxHint = max(claim.textSpans.confidenceHint);
  
  if (maxHint == DIRECT_QUOTE || maxHint == DIRECT_ACTION) {
    return (1.0, ["Direct textual evidence found (quote/action)."]);
  }
  
  if (maxHint == IMPLIED) {
    return (0.5, ["Evidence is implied rather than explicit."]);
  }
  
  return (0.0, ["Evidence spans exist but are not attributable to text."]);
}
```

### Evidence Consistency

```typescript
function scoreEvidenceConsistency(claim, manuscriptIndex): (score, reasons) {
  contradictions = countContradictions(claim, manuscriptIndex);
  drift = countDriftSignals(claim, manuscriptIndex);
  
  if (contradictions == 0 && drift == 0) {
    return (1.0, ["No contradictions or drift detected."]);
  }
  
  if (contradictions == 0 && drift > 0) {
    return (0.5, ["Minor drift detected across references."]);
  }
  
  return (0.0, ["Conflicting evidence detected across references."]);
}
```

### Structural Alignment

```typescript
function scoreStructuralAlignment(claim, genreProfile): (score, reasons) {
  alignment = computeAlignment(claim, genreProfile); // STRONG, PARTIAL, NONE
  
  if (alignment == STRONG) {
    return (1.0, ["Strong alignment with genre structure expectations."]);
  }
  
  if (alignment == PARTIAL) {
    return (0.5, ["Partial/unconventional alignment with structure expectations."]);
  }
  
  return (0.0, ["No clear alignment with structure expectations."]);
}
```

### Ambiguity Penalty

```typescript
function scoreAmbiguityPenalty(claim): (score, reasons) {
  if (claim.flags.contains(AMBIGUOUS)) {
    ambLevel = quantifyAmbiguity(claim); // LOW, MED, HIGH
    
    if (ambLevel == LOW) return (0.3, ["Some ambiguity present."]);
    if (ambLevel == MED) return (0.5, ["Moderate ambiguity present."]);
    return (1.0, ["High ambiguity present."]);
  }
  
  return (0.0, ["No ambiguity flags present."]);
}
```

### Inference Penalty

```typescript
function scoreInferencePenalty(claim): (score, reasons) {
  if (claim.flags.contains(INFERRED)) {
    inferLevel = quantifyInference(claim); // LOW, MED, HIGH
    
    if (inferLevel == LOW) return (0.3, ["Some inference required."]);
    if (inferLevel == MED) return (0.5, ["Moderate inference required."]);
    return (1.0, ["Heavy inference required."]);
  }
  
  return (0.0, ["No inference flags present."]);
}
```

---

## I. Final Confidence Calculation

```typescript
function computeConfidence(
  claim, 
  manuscriptIndex, 
  genreProfile, 
  thresholdPct = 95
): ConfidenceResult {
  
  (E, eReasons) = scoreEvidencePresence(claim);
  (C, cReasons) = scoreEvidenceConsistency(claim, manuscriptIndex);
  (S, sReasons) = scoreStructuralAlignment(claim, genreProfile);
  (A, aReasons) = scoreAmbiguityPenalty(claim);
  (I, iReasons) = scoreInferencePenalty(claim);

  rawScore = (E + C + S) / 3.0;
  penalty = (A + I) / 2.0;

  confidence = clamp(rawScore * (1.0 - penalty), 0.0, 1.0);
  confidencePct = round(confidence * 100);

  if (confidencePct >= 95) band = HIGH;
  else if (confidencePct >= 80) band = MEDIUM;
  else band = LOW;

  requiresAuthorAcceptance = (confidencePct < thresholdPct);

  return ConfidenceResult(
    claimId: claim.claimId,
    dimensions: {E, C, S, A, I},
    rawScore: rawScore,
    penalty: penalty,
    confidence: confidence,
    confidencePct: confidencePct,
    band: band,
    requiresAuthorAcceptance: requiresAuthorAcceptance,
    reasons: eReasons + cReasons + sReasons + aReasons + iReasons
  );
}
```

---

## J. Release Gate Integration

```typescript
function canRelease(outputBundle, thresholdPct = 95): (allowed, reason) {
  // outputBundle contains claims[] with confidence results
  
  if (any claimResult is missing confidence metadata) {
    return (false, "BLOCKED: Missing confidence metadata.");
  }

  // any "Ready" label must require ALL "readiness-critical" claims >= threshold
  readinessCritical = filterClaims(
    outputBundle.claims, 
    claimIsReadinessCritical
  );

  if (any readinessCritical.confidencePct < thresholdPct) {
    return (
      false, 
      "BLOCKED: Below-threshold readiness-critical claim(s) require author acceptance."
    );
  }

  return (true, "OK");
}
```

---

## K. Approved Parameters (2026-01-04)

| Parameter | Value |
|-----------|-------|
| **Confidence Threshold** | 95% |
| **Algorithm Type** | Evidence-based heuristic (deterministic) |
| **Band Boundaries** | High ≥95%, Medium 80-94%, Low <80% |
| **Acceptance Requirement** | Below 95% requires explicit author opt-in |
| **ML Deferral** | v2+ (not v1) |

---

**Authority:** RevisionGrade Constitutional Framework  
**Binding Status:** Release-Blocking  
**Next Review:** After 1000 production evaluations (calibration validation)