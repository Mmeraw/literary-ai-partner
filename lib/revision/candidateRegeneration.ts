/**
 * Candidate Regeneration helpers — RevisionGrade
 *
 * Contains both:
 * - admission-gate regeneration helper for ReviseAdmissionOpportunity
 * - ledger quality-failure regeneration loop that reuses candidate hydration
 */

import { hydrateLedgerCandidates, type HydrationOpportunity } from './candidateHydration';
import { evaluateCardQuality, type LedgerCardQualityResult } from './candidateQuality';
import { runReviseAdmissionGate, type ReviseAdmissionOpportunity } from './reviseAdmissionGate';

export interface RegeneratedCandidates {
  candidate_text_a: string;
  candidate_text_b: string;
  candidate_text_c: string;
}

export interface CandidateRegenerator {
  (opportunity: ReviseAdmissionOpportunity, attempt: number): Promise<RegeneratedCandidates>;
}

export interface RegenerationResult {
  opportunity: ReviseAdmissionOpportunity;
  admitted: boolean;
  attempts: number;
  reasons: string[];
}

export async function regenerateUntilAdmitted(
  opportunity: ReviseAdmissionOpportunity,
  regenerate: CandidateRegenerator,
  maxAttempts = 2,
): Promise<RegenerationResult> {
  let current = { ...opportunity };
  let admission = runReviseAdmissionGate(current);

  if (admission.admission_status === 'admission_passed') {
    return { opportunity: current, admitted: true, attempts: 0, reasons: [] };
  }

  const eligibleForRegeneration =
    current.grounding_status === 'supported' &&
    current.preflight_status === 'passed' &&
    current.context_quality === 'clean' &&
    admission.passedCandidateCount < 2;

  if (!eligibleForRegeneration) {
    return { opportunity: current, admitted: false, attempts: 0, reasons: admission.reasons };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const regenerated = await regenerate(current, attempt);
    current = { ...current, ...regenerated };
    admission = runReviseAdmissionGate(current);

    if (admission.admission_status === 'admission_passed') {
      return { opportunity: current, admitted: true, attempts: attempt, reasons: [] };
    }
  }

  return {
    opportunity: current,
    admitted: false,
    attempts: maxAttempts,
    reasons: Array.from(new Set([...admission.reasons, 'CANDIDATE_QUALITY_FAILED_AFTER_REGENERATION'])),
  };
}

/** Maximum single regeneration attempt per ledger batch. */
const MAX_REGEN_ATTEMPTS = 1;

export type RegenCandidate = {
  opportunity_id: string;
  evidence_anchor: string;
  rationale: string;
  revision_operation?: string;
  evaluation_mode?: string;
  manuscript_context?: string;
};

export type RegenResult = {
  /** Opportunities that passed quality after regeneration — replace originals. */
  healed: Map<
    string,
    {
      candidate_text_a: string;
      candidate_text_b: string;
      candidate_text_c: string;
    }
  >;
  /** Opportunities that still failed after regeneration — should be blocked. */
  stillFailed: Map<string, string[]>;
};

/**
 * Attempt to regenerate candidates for quality-failed ledger cards and re-evaluate.
 * Returns healed candidates where quality now passes, and maps still-failed IDs
 * to merged privacy-safe failure reason codes.
 */
export async function regenerateCandidatesForQualityFailed(
  opportunities: RegenCandidate[],
  openaiApiKey: string,
): Promise<RegenResult> {
  const healed = new Map<string, { candidate_text_a: string; candidate_text_b: string; candidate_text_c: string }>();
  const stillFailed = new Map<string, string[]>();

  if (opportunities.length === 0 || !openaiApiKey.trim()) {
    for (const opp of opportunities) {
      stillFailed.set(opp.opportunity_id, ['candidate_quality_failed_after_regen']);
    }
    return { healed, stillFailed };
  }

  const hydrationInput: HydrationOpportunity[] = opportunities.map((opp) => ({
    opportunity_id: opp.opportunity_id,
    evidence_anchor: opp.evidence_anchor,
    rationale: opp.rationale,
    revision_operation: opp.revision_operation,
    evaluation_mode: opp.evaluation_mode,
    manuscript_context: opp.manuscript_context,
  }));

  for (let attempt = 0; attempt < MAX_REGEN_ATTEMPTS; attempt++) {
    let hydrationResult;
    try {
      hydrationResult = await hydrateLedgerCandidates(hydrationInput, openaiApiKey);
    } catch {
      for (const opp of opportunities) {
        if (!healed.has(opp.opportunity_id)) {
          stillFailed.set(opp.opportunity_id, ['candidate_quality_failed_after_regen']);
        }
      }
      break;
    }

    for (const opp of opportunities) {
      if (healed.has(opp.opportunity_id)) continue;

      const generated = hydrationResult.candidates.get(opp.opportunity_id);
      if (!generated) {
        stillFailed.set(opp.opportunity_id, ['candidate_quality_failed_after_regen']);
        continue;
      }

      const qualityResult: LedgerCardQualityResult = evaluateCardQuality(
        generated.candidate_text_a,
        generated.candidate_text_b,
        generated.candidate_text_c,
        opp.evidence_anchor,
        opp.rationale,
      );

      if (qualityResult.pass) {
        healed.set(opp.opportunity_id, generated);
        stillFailed.delete(opp.opportunity_id);
      } else {
        const failedQualityResult = qualityResult as Extract<LedgerCardQualityResult, { pass: false }>;
        stillFailed.set(opp.opportunity_id, [
          'candidate_quality_failed_after_regen',
          ...failedQualityResult.reasons,
        ]);
      }
    }
  }

  for (const opp of opportunities) {
    if (!healed.has(opp.opportunity_id) && !stillFailed.has(opp.opportunity_id)) {
      stillFailed.set(opp.opportunity_id, ['candidate_quality_failed_after_regen']);
    }
  }

  return { healed, stillFailed };
}
