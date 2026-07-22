/**
 * Gate 15 Orchestrator — Chains Gate 15.1 → Gate 15.2 and produces the
 * combined gate_15_audit_v1 artifact.
 *
 * Canon execution order is mandatory:
 *   Wave 15 → Gate 15.1 → Gate 15.2 → Wave 16
 *
 * If Gate 15.1 fails, Gate 15.2 must NOT execute.
 * Gate 15.2 may NOT override structural failure from Gate 15.1.
 *
 * This orchestrator is a non-blocking post-evaluation layer.
 * It never fails the evaluation job — it only surfaces findings.
 */

import { runGate15_1, type Gate15_1Result, type GateStatus, GATE15_MIN_WORD_COUNT } from './gate15_1_validator';
import { runGate15_2, type Gate15_2Result } from './gate15_2_validator';

// ── Types ────────────────────────────────────────────────────────────────

export const GATE15_AUDIT_VALIDITY_DAYS = 90;
export const GATE15_AUDIT_VALIDITY_MS = GATE15_AUDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export function deriveGate15AuditValidUntil(timestamp: string): string {
  const generatedAt = Date.parse(timestamp);
  if (!Number.isFinite(generatedAt)) {
    throw new Error('Gate 15 audit timestamp must be parseable before deriving valid_until');
  }
  return new Date(generatedAt + GATE15_AUDIT_VALIDITY_MS).toISOString();
}

export interface Gate15AuditArtifact {
  version: 'gate_15_audit_v1';
  jobId: string;
  manuscriptId: string;
  wordCount: number;
  timestamp: string;
  valid_until: string;
  lineage_status: 'current';
  lineage: {
    artifact_type: 'gate_15_audit_v1';
    jobId: string;
    manuscriptId: string;
    timestamp: string;
  };
  activatedBecause?: string;
  skippedBecause?: string;
  overallStatus: GateStatus;
  gate15_1: Gate15_1Result;
  gate15_2: Gate15_2Result;
  summaryFindings: string[];
}

// ── Orchestrator ─────────────────────────────────────────────────────────

export function runGate15Audit(
  manuscriptText: string,
  jobId: string,
  manuscriptId: string,
): Gate15AuditArtifact {
  const wordCount = manuscriptText.split(/\s+/).filter(Boolean).length;
  const timestamp = new Date().toISOString();

  // Run Gate 15.1
  const gate15_1 = runGate15_1(manuscriptText);

  // Gate 15.2: only runs if Gate 15.1 passed (canon: execution order mandatory)
  const gate15_1Passed = gate15_1.overallStatus === 'PASS';
  const gate15_2 = runGate15_2(manuscriptText, gate15_1Passed);

  // Determine overall status
  let overallStatus: GateStatus;
  if (gate15_1.overallStatus === 'SKIPPED') {
    overallStatus = 'SKIPPED';
  } else if (gate15_1.overallStatus === 'FAIL') {
    overallStatus = 'FAIL';
  } else {
    overallStatus = gate15_2.overallStatus;
  }

  // Build summary
  const summaryFindings: string[] = [];
  if (wordCount < GATE15_MIN_WORD_COUNT) {
    summaryFindings.push(`Gate 15 skipped: short-form manuscript (${wordCount.toLocaleString()} words)`);
  } else {
    summaryFindings.push(`Gate 15.1 (Mechanical Purity): ${gate15_1.overallStatus}`);
    if (gate15_1.summaryFindings.length > 0) {
      summaryFindings.push(...gate15_1.summaryFindings);
    }
    summaryFindings.push(`Gate 15.2 (Voice & Meaning Protection): ${gate15_2.overallStatus}`);
    if (gate15_2.summaryFindings.length > 0) {
      summaryFindings.push(...gate15_2.summaryFindings);
    }
  }

  return {
    version: 'gate_15_audit_v1',
    jobId,
    manuscriptId,
    wordCount,
    timestamp,
    valid_until: deriveGate15AuditValidUntil(timestamp),
    lineage_status: 'current',
    lineage: {
      artifact_type: 'gate_15_audit_v1',
      jobId,
      manuscriptId,
      timestamp,
    },
    activatedBecause: wordCount >= GATE15_MIN_WORD_COUNT ? 'long_form_25000_plus' : undefined,
    skippedBecause: wordCount < GATE15_MIN_WORD_COUNT ? `short_form_under_${GATE15_MIN_WORD_COUNT}_words` : undefined,
    overallStatus,
    gate15_1,
    gate15_2,
    summaryFindings,
  };
}
