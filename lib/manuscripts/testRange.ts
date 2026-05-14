/**
 * Test manuscript ID range.
 *
 * Pre-launch operations policy (see OPERATIONS.md): manuscripts with
 * `id >= 9000` are reserved for stress tests, harness runs, and fixture-driven
 * evaluations. Real user manuscripts always live in `id < 9000`.
 *
 * Admin dashboards filter `manuscript_id < 9000` by default and expose a
 * "Show test manuscripts" toggle (query-param) to include them.
 */

export const TEST_MANUSCRIPT_ID_MIN = 9000;

/**
 * Returns true when the manuscript id falls in the reserved test range.
 *
 * Accepts numeric or string-numeric ids. Non-finite / non-parseable values
 * (NaN, "abc", null after coercion) return false — they are not test rows
 * for the purposes of the admin filter and are left for normal display.
 */
export function isTestManuscript(manuscriptId: number | string): boolean {
  const id =
    typeof manuscriptId === 'string'
      ? Number.parseInt(manuscriptId, 10)
      : manuscriptId;
  return Number.isFinite(id) && id >= TEST_MANUSCRIPT_ID_MIN;
}
