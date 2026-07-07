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

if (errors.length > 0) {
  console.error('U2 proof validation failed ❌');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('U2 proof validation passed ✅');
