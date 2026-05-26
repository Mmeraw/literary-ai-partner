import type { ProviderRole } from '../orchestration/providerContracts';
import { assertPrimaryEditorialProvider } from '../orchestration/providerContracts';

export type SynthesisInputPayload = {
  provider: ProviderRole;
  content: string;
};

/**
 * Rigid gatekeeper for Phase 2/3 literary synthesis.
 *
 * Contract:
 * - primary_editorial_engine is the only provider allowed to inject prose.
 * - external_factual_auditor and external_compliance_checker may only emit
 *   bounded verification artifacts outside synthesis.
 */
export function compileFinalSynthesis(inputs: SynthesisInputPayload[]): string {
  const primaryInputs = inputs.filter((input) => input.provider === 'primary_editorial_engine');

  if (primaryInputs.length === 0) {
    throw new Error('Synthesis Failure: Missing input from primary_editorial_engine');
  }

  if (primaryInputs.length > 1) {
    throw new Error('Synthesis Failure: Expected exactly one primary_editorial_engine input');
  }

  const rogueInputs = inputs.filter((input) => input.provider !== 'primary_editorial_engine');
  if (rogueInputs.length > 0) {
    const offendingProviders = [...new Set(rogueInputs.map((input) => input.provider))].join(', ');
    throw new Error(
      `Security Gate Violation: Unsanctioned provider input detected in Phase 3 synthesis. ` +
        `Offending providers: ${offendingProviders}. ` +
        'External providers cannot inject unstructured prose into final synthesis.',
    );
  }

  assertPrimaryEditorialProvider(primaryInputs[0].provider);
  return primaryInputs[0].content;
}
