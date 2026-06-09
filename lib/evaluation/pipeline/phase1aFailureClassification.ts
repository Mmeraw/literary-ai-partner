/**
 * Phase 1A Failure Classification — Pure, Dependency-Light
 *
 * Classifies Phase 1A errors into specific failure codes with typed buckets.
 * Previously ALL Phase 1A errors were blanket-labeled PASS1A_LEDGER_MISSING
 * regardless of actual cause. This module provides diagnostic accuracy.
 *
 * IMPORTANT: This module must NOT import from processor.ts or runPipeline.ts.
 * It is pure string classification logic only.
 */

export type Phase1aFailureBucket =
  | 'ledger'
  | 'transition'
  | 'provider'
  | 'timeout'
  | 'policy'
  | 'unknown';

export type Phase1aFailureResult = {
  code: string;
  message: string;
  bucket: Phase1aFailureBucket;
};

/**
 * Classify a Phase 1A error into a specific failure code.
 * Only returns PASS1A_LEDGER_MISSING when the error message indicates
 * an actual missing accepted_story_ledger condition.
 *
 * Accepts unknown (safe cast) or string input.
 */
export function classifyPhase1aFailure(err: unknown): Phase1aFailureResult {
  const message = typeof err === 'string'
    ? err
    : err instanceof Error
      ? err.message
      : String(err ?? '');

  const lower = message.toLowerCase();

  // Actual missing ledger condition
  if (lower.includes('accepted_story_ledger') || (lower.includes('ledger') && lower.includes('missing'))) {
    return { code: 'PASS1A_LEDGER_MISSING', message, bucket: 'ledger' };
  }

  // Phase transition / handoff failures
  if (lower.includes('transition failed') || (lower.includes('handoff') && lower.includes('failed'))) {
    return { code: 'PHASE1A_HANDOFF_TRANSITION_FAILED', message, bucket: 'transition' };
  }

  // Timeout / deadline exceeded
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('deadline')) {
    return { code: 'PASS1A_TIMEOUT', message, bucket: 'timeout' };
  }

  // Rate limiting / quota
  if (lower.includes('rate') || lower.includes('429') || lower.includes('quota')) {
    return { code: 'PASS1A_RATE_LIMIT', message, bucket: 'provider' };
  }

  // Policy / governance blocks
  if (lower.includes('governance') || lower.includes('policy') || lower.includes('guard')) {
    return { code: 'PHASE1A_POLICY_BLOCK', message, bucket: 'policy' };
  }

  // Provider errors (OpenAI / API)
  if (lower.includes('openai') || lower.includes('api') || lower.includes('500') || lower.includes('503')) {
    return { code: 'PASS1A_PROVIDER_ERROR', message, bucket: 'provider' };
  }

  // Unknown / uncategorized
  return { code: 'PHASE1A_FAILED', message, bucket: 'unknown' };
}
