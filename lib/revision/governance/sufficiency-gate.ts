import type { PassResults } from './types';

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
