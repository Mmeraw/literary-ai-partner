#!/usr/bin/env node
import fs from 'node:fs';

const raw = fs.readFileSync(0, 'utf8');
if (!raw.trim()) {
  console.error('U2 proof input is empty; pipe JSON proof into stdin.');
  process.exit(1);
}

let proof;
try {
  proof = JSON.parse(raw);
} catch (error) {
  console.error('Failed to parse U2 proof JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = [];
const warnings = [];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const getPath = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
const requireValue = (path, predicate, message) => {
  const value = getPath(proof, path);
  if (!predicate(value)) {
    errors.push(`${path}: ${message}`);
  }
};

// ── Core proof assertions (required on all proofs) ───────────────────────────

requireValue('job', isObject, 'missing object');
requireValue('job.status', (value) => value === 'complete', 'must equal "complete" for closure proof');
requireValue('u2Proof', isObject, 'missing object');
requireValue('u2Proof.confidenceLabel', isNonEmptyString, 'must be a non-empty string');
requireValue('u2Proof.confidenceReasons', isNonEmptyArray, 'must be a non-empty array');
requireValue('u2Proof.propagation', (value) => value !== null && value !== undefined, 'must be present (not null/undefined)');
requireValue('u2Proof.anchors', isNonEmptyArray, 'must be a non-empty array');
requireValue('u2Proof.reasonCodes', isNonEmptyArray, 'must be a non-empty array');

requireValue('verificationChecklist', isObject, 'missing object');

const checklist = proof?.verificationChecklist;
if (isObject(checklist)) {
  const requiredChecklistKeys = [
    'bottomWeaknessInSummary',
    'confidenceBannerMatchesLabel',
    'noFalseHighConfidenceAuthority',
  ];

  for (const key of requiredChecklistKeys) {
    const value = checklist[key];
    if (value !== 'PASS') {
      errors.push(`verificationChecklist.${key}: expected "PASS", got ${JSON.stringify(value)}`);
    }
  }
}

// ── G1 Invariant: dual-confidence signal governance ─────────────────────────
//
// The system carries two distinct confidence signals. This block asserts the
// invariant that governs their relationship so future contributors cannot
// "simplify" the architecture by trying to make them always match.
//
// Signal A: evaluation_result.governance.confidence_label
//   Source:  runPipeline.deriveGovernanceConfidenceFromCriteria()
//   Meaning: criterion-level evaluation quality — how confident the pipeline
//            is in the LLM output across all criteria.
//   Usage:   MUST drive the user-facing banner (vm.integrityBanner) and ViewModel.
//            MUST NOT be replaced by gate_enforcement.confidence for display.
//
// Signal B: progress.gate_enforcement.confidence
//   Source:  persistEvaluationResultV2.deriveBoundaryConfidence()
//            → lib/governance/confidenceDerivation.deriveConfidence()
//   Meaning: structural/boundary integrity — did the artifact pass the pipeline's
//            artifact validation gate cleanly.
//   Usage:   Internal audit signal only. MUST NOT be surfaced to users.
//
// Invariant rules:
//   1. Both signals MUST be present in the proof pack.
//   2. If they agree: acceptable (coherent outcome).
//   3. If they diverge: acceptable only when g1_comparison.divergence_is_intentional
//      is explicitly true AND a non-empty divergence_explanation is provided.
//   4. The user-facing banner MUST be driven by Signal A (er_confidence_label),
//      confirmed by the confidenceBannerMatchesLabel checklist item.
//
// Documented: U2-003 inspection report + live proof 2026-07-07.

const g1 = proof?.g1_comparison;
if (g1 !== undefined && g1 !== null) {
  // g1_comparison block is optional (older proofs won't have it).
  // When present, enforce the documented invariant.
  if (!isNonEmptyString(g1.er_confidence_label)) {
    errors.push('g1_comparison.er_confidence_label: must be a non-empty string when g1_comparison is present');
  }
  if (!isNonEmptyString(g1.ge_confidence_label)) {
    errors.push('g1_comparison.ge_confidence_label: must be a non-empty string when g1_comparison is present');
  }
  const signalsMatch = g1.er_confidence_label === g1.ge_confidence_label;
  if (!signalsMatch) {
    // Divergence is allowed only when explicitly declared intentional with explanation.
    if (g1.divergence_is_intentional !== true) {
      errors.push(
        `g1_comparison: er_confidence_label (${g1.er_confidence_label}) differs from ` +
        `ge_confidence_label (${g1.ge_confidence_label}) but divergence_is_intentional is not true — ` +
        'mark intentional and add divergence_explanation, or investigate unexpected divergence'
      );
    }
    if (!isNonEmptyString(g1.divergence_explanation)) {
      errors.push('g1_comparison.divergence_explanation: required when signals diverge');
    }
  }
  // Regardless of divergence: assert the user-facing signal is documented.
  if (!isNonEmptyString(g1.user_facing_signal)) {
    errors.push('g1_comparison.user_facing_signal: must document which signal drives the user-facing banner');
  }
  if (!isNonEmptyString(g1.internal_gate_signal)) {
    errors.push('g1_comparison.internal_gate_signal: must document that gate signal is internal-only');
  }
}

// ── RCA-U2-006: Pass 2 anchor enforcement (optional until schema migration complete) ──
//
// pass2EvidenceAnchors is emitted by collect-u2-proof.mjs v2+ (G2/G3 fix).
// Older proof packs will not have this block — validation is skipped for them.
// Once all active proof generators emit the new structure, flip the top-level
// requireValue() to make the block mandatory.
//
// When present, this block proves:
//   - criteria[].evidence[].snippet is the source (not recommendations[].anchor_snippet)
//   - NO_TEXTUAL_ANCHOR in reason_codes[] means the Pass 2 score cap fired
//   - Each criterion's anchor check outcome is individually recorded
//
// Complementary: see scripts/test-has-textual-anchor.mjs for deterministic
// unit-level proof that all hasTextualAnchor() branches fire correctly (G1).

const pass2Anchors = proof?.u2Proof?.pass2EvidenceAnchors;
const pass2Summary = proof?.u2Proof?.pass2Summary;

if (pass2Anchors !== undefined && pass2Anchors !== null) {
  if (!Array.isArray(pass2Anchors)) {
    errors.push('u2Proof.pass2EvidenceAnchors: must be an array when present');
  } else {
    // Each entry must have the required shape
    pass2Anchors.forEach((entry, i) => {
      if (!isObject(entry)) {
        errors.push(`u2Proof.pass2EvidenceAnchors[${i}]: must be an object`);
        return;
      }
      if (!Array.isArray(entry.evidenceSnippetLengths)) {
        errors.push(`u2Proof.pass2EvidenceAnchors[${i}].evidenceSnippetLengths: must be an array`);
      }
      if (!Array.isArray(entry.pass2ReasonCodes)) {
        errors.push(`u2Proof.pass2EvidenceAnchors[${i}].pass2ReasonCodes: must be an array`);
      }
      if (typeof entry.wouldPassAnchorCheck !== 'boolean') {
        errors.push(`u2Proof.pass2EvidenceAnchors[${i}].wouldPassAnchorCheck: must be a boolean`);
      }
    });

    // Warn (not error) if NO_TEXTUAL_ANCHOR has never fired — this is the G1 gap.
    // The deterministic fixture (test-has-textual-anchor.mjs) closes G1 independently.
    const anyNoTextualAnchor = pass2Anchors.some(
      (c) => Array.isArray(c.pass2ReasonCodes) && c.pass2ReasonCodes.includes('NO_TEXTUAL_ANCHOR')
    );
    if (!anyNoTextualAnchor) {
      warnings.push(
        'u2Proof.pass2EvidenceAnchors: NO_TEXTUAL_ANCHOR has not fired in this proof job. ' +
        'Pass 2 score cap is unexercised in production. ' +
        'G1 closure requires scripts/test-has-textual-anchor.mjs to pass.'
      );
    }
  }
}

if (pass2Summary !== undefined && pass2Summary !== null) {
  if (!isObject(pass2Summary)) {
    errors.push('u2Proof.pass2Summary: must be an object when present');
  } else {
    if (typeof pass2Summary.totalCriteria !== 'number') {
      errors.push('u2Proof.pass2Summary.totalCriteria: must be a number');
    }
    if (typeof pass2Summary.allCriteriaHaveEvidence !== 'boolean') {
      errors.push('u2Proof.pass2Summary.allCriteriaHaveEvidence: must be a boolean');
    }
    if (typeof pass2Summary.anyNoTextualAnchorFired !== 'boolean') {
      errors.push('u2Proof.pass2Summary.anyNoTextualAnchorFired: must be a boolean');
    }
    if (typeof pass2Summary.anyScoreCapped !== 'boolean') {
      errors.push('u2Proof.pass2Summary.anyScoreCapped: must be a boolean');
    }
  }
}

// ── RCA-U2-006: Artifact gate HOLD (optional until schema migration complete) ──
//
// artifactGate is emitted by collect-u2-proof.mjs v2+ (G3 fix).
// Proves the artifact gate layer independently from Pass 2 enforcement.
// EVIDENCE-MISSING-1 / INTERP-MISSING-1 are HOLD codes — they must not appear
// in gateEnforcementReasonCodes (which is populated only on FAIL paths).
//
// When present:
//   - holdFired: did the artifact gate emit a HOLD for this job?
//   - reasonCodes: the HOLD reason codes (EVIDENCE-MISSING-1, INTERP-MISSING-1, ...)
//   - gateEnforcementReasonCodes: must be [] on the PASS path

const artifactGate = proof?.u2Proof?.artifactGate;

if (artifactGate !== undefined && artifactGate !== null) {
  if (!isObject(artifactGate)) {
    errors.push('u2Proof.artifactGate: must be an object when present');
  } else {
    if (typeof artifactGate.holdFired !== 'boolean') {
      errors.push('u2Proof.artifactGate.holdFired: must be a boolean');
    }
    if (!Array.isArray(artifactGate.reasonCodes)) {
      errors.push('u2Proof.artifactGate.reasonCodes: must be an array');
    }
    if (!Array.isArray(artifactGate.gateEnforcementReasonCodes)) {
      errors.push('u2Proof.artifactGate.gateEnforcementReasonCodes: must be an array');
    }

    // Structural invariant: HOLD codes must NOT appear in gateEnforcementReasonCodes.
    // On the PASS path backwardRelook.reasonCodes is [], so these codes are only
    // visible in governance.warnings — not in gate_enforcement.reason_codes.
    const holdCodes = ['EVIDENCE-MISSING-1', 'INTERP-MISSING-1'];
    const geCodes = Array.isArray(artifactGate.gateEnforcementReasonCodes)
      ? artifactGate.gateEnforcementReasonCodes
      : [];
    const leakedCodes = holdCodes.filter((c) => geCodes.includes(c));
    if (leakedCodes.length > 0) {
      errors.push(
        `u2Proof.artifactGate.gateEnforcementReasonCodes: HOLD codes ${JSON.stringify(leakedCodes)} ` +
        'must not appear in gate_enforcement.reason_codes on the PASS path — ' +
        'these are non-blocking HOLD codes surfaced only in governance.warnings'
      );
    }
  }
}

// ── Results ──────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  console.warn('U2 proof warnings:');
  for (const warning of warnings) {
    console.warn(`⚠  ${warning}`);
  }
}

if (errors.length > 0) {
  console.error('U2 proof validation failed ❌');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('U2 proof validation passed ✅');
