/**
 * Candidate Regeneration Loop — RevisionGrade
 *
 * For grounded, preflight-passed cards whose A/B/C candidates failed the
 * quality gate, attempt one regeneration pass using the hydration pipeline
 * before final withholding.
 *
 * Contract:
 * - At most MAX_REGEN_ATTEMPTS calls per card batch.
 * - Fail closed: if quality still does not pass after regeneration, cards are
 *   withheld with reason code candidate_quality_failed_after_regen.
 * - No canned fallback prose admitted — if hydration returns empty or fails
 *   quality again the card is blocked, not shown.
 * - Privacy: no prose emitted in returned reason codes.
 */

import { hydrateLedgerCandidates, type HydrationOpportunity } from './candidateHydration';
import { evaluateCardQuality, type CardQualityResult } from './candidateQuality';

/** Maximum single regeneration attempt per batch. */
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
 * Attempt to regenerate candidates for quality-failed cards and re-evaluate.
 * Returns healed candidates where quality now passes, and maps
 * still-failed IDs to their merged failure reason codes.
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
      // Non-fatal: mark all as still failed
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

      const qualityResult: CardQualityResult = evaluateCardQuality(
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
        stillFailed.set(opp.opportunity_id, [
          'candidate_quality_failed_after_regen',
          ...('reasons' in qualityResult ? qualityResult.reasons : []),
        ]);
      }
    }
  }

  // Any not yet healed or explicitly failed → mark as failed
  for (const opp of opportunities) {
    if (!healed.has(opp.opportunity_id) && !stillFailed.has(opp.opportunity_id)) {
      stillFailed.set(opp.opportunity_id, ['candidate_quality_failed_after_regen']);
    }
  }

  return { healed, stillFailed };
}
