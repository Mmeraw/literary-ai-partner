/**
 * Eval 2.0 bounded provider roles.
 *
 * Scope: contract-only role declarations for asymmetric verification rails.
 * Do not import runtime provider clients, routes, prompts, OpenAI, Perplexity,
 * Supabase, workers, or pipeline processors here.
 */

export type ProviderRole =
  | 'primary_editorial_engine'
  | 'external_factual_auditor'
  | 'external_compliance_checker';

export type VerificationFeatureFlags = {
  /** Enables the Phase 0 preflight factual/plausibility audit gate. */
  ENABLE_EXTERNAL_FACT_AUDIT: boolean;
  /** Enables the Phase 4 deterministic cross-check rail on synthesized reports. */
  ENABLE_EXTERNAL_REPORT_CROSSCHECK: boolean;
};

export const DEFAULT_VERIFICATION_FLAGS: VerificationFeatureFlags = {
  ENABLE_EXTERNAL_FACT_AUDIT: false,
  ENABLE_EXTERNAL_REPORT_CROSSCHECK: false,
};

export function assertPrimaryEditorialProvider(provider: ProviderRole): void {
  if (provider !== 'primary_editorial_engine') {
    throw new Error(
      `Security Gate Violation: ${provider} cannot inject unstructured prose into Phase 2/3 synthesis`,
    );
  }
}
