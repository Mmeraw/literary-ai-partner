import type { PassResults, GovernanceContext, GovernanceResult } from './types';

/**
 * Sufficiency Gate: If a scene already passes function/theme/tone/structure,
 * no WAVE execution is needed. Returns true if scene is sufficient.
 */
export function isSceneSufficient(passResults: PassResults): boolean {
  return (
    passResults.function === 'PASS' &&
    passResults.theme === 'PASS' &&
    passResults.tone === 'PASS' &&
    passResults.structure === 'PASS'
  );
}

/**
 * Pipeline adapter: wraps isSceneSufficient for run-revision-pipeline.ts
 * Stub — full PassResults not yet available from GovernanceContext.
 * Returns pass: true (permissive) until wired to evaluation artifacts.
 */
export function checkSufficiencyGate(_ctx: GovernanceContext): GovernanceResult {
  // TODO: Extract PassResults from evaluation artifacts in ctx
  return { pass: true, reason: 'Sufficiency gate stub — always passes until wired' };
}
