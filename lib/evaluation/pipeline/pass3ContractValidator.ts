/**
 * Pass 3 output contract validation and normalization.
 * Applied immediately after raw model JSON response.
 * 
 * Validates semantic fields and submission_readiness on fresh outputs.
 * Normalizes all semantic enum values.
 * Compute redundancy_key deterministically.
 */

import type { SynthesisOutput, SynthesizedCriterion } from './types';
import { normalizeIssueFamily, normalizeStrategicLever, normalizeRevisionGranularity, buildRedundancyKey } from './normalization';

/**
 * Custom error type for Pass 3 contract violations.
 * Makes parse-boundary failures easy to identify in logs and tests.
 */
export class Pass3ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Pass3ContractError';
  }
}

/**
 * Validate that a single recommendation has all required semantic fields.
 * Called for fresh Pass 3 output only (not legacy artifacts).
 */
export function assertRecommendationSemanticFields(
  rec: SynthesizedCriterion['recommendations'][0],
  criterionKey: string,
  index: number,
): void {
  if (!rec.issue_family) {
    throw new Pass3ContractError(
      `[Pass3] criterion[${criterionKey}] recommendation[${index}] missing issue_family`,
    );
  }
  if (!rec.strategic_lever) {
    throw new Pass3ContractError(
      `[Pass3] criterion[${criterionKey}] recommendation[${index}] missing strategic_lever`,
    );
  }
  if (!rec.revision_granularity) {
    throw new Pass3ContractError(
      `[Pass3] criterion[${criterionKey}] recommendation[${index}] missing revision_granularity`,
    );
  }
}

/**
 * Validate submission_readiness on overall synthesis block.
 * Called for fresh Pass 3 output only.
 */
export function assertSubmissionReadiness(overall: SynthesisOutput['overall']): void {
  if (!overall.submission_readiness) {
    throw new Pass3ContractError(`[Pass3] overall missing submission_readiness`);
  }
}

/**
 * Normalize and validate a fresh Pass 3 output.
 * This is the parse boundary: nothing downstream sees unnormalized values.
 * 
 * 1. Normalize all semantic enum fields.
 * 2. Build redundancy_key deterministically.
 * 3. Assert required fields on fresh output.
 * 4. Return the hydrated synthesis object ready for downstream logic.
 */
export function normalizeAndValidatePass3Output(
  synthesis: unknown,
  isFreshOutput = true,
): SynthesisOutput {
  if (!synthesis || typeof synthesis !== 'object') {
    throw new Pass3ContractError('[Pass3] response is not an object');
  }

  const output = synthesis as SynthesisOutput;

  // Normalize and validate each criterion's recommendations
  if (Array.isArray(output.criteria)) {
    for (const criterion of output.criteria) {
      if (!Array.isArray(criterion.recommendations)) {
        continue;
      }

      for (let i = 0; i < criterion.recommendations.length; i++) {
        const rec = criterion.recommendations[i];

        // Normalize semantic fields
        if (rec.issue_family !== undefined) {
          rec.issue_family = normalizeIssueFamily(rec.issue_family);
        }
        if (rec.strategic_lever !== undefined) {
          rec.strategic_lever = normalizeStrategicLever(rec.strategic_lever);
        }
        if (rec.revision_granularity !== undefined) {
          rec.revision_granularity = normalizeRevisionGranularity(rec.revision_granularity);
        }

        // Assert required fields on fresh output
        if (isFreshOutput) {
          assertRecommendationSemanticFields(rec, criterion.key, i);
        }

        // Build redundancy_key if semantic fields are present
        if (rec.issue_family && rec.strategic_lever && rec.revision_granularity) {
          rec.redundancy_key = buildRedundancyKey(
            rec.issue_family,
            rec.strategic_lever,
            rec.revision_granularity,
          );
        }
      }
    }
  }

  // Normalize and validate overall block
  if (output.overall) {
    // Assert submission_readiness on fresh output
    if (isFreshOutput) {
      assertSubmissionReadiness(output.overall);
    }
  }

  return output;
}
