/**
 * Shared money formatting for CostOps dashboards.
 *
 * Values are passed in as USD cents. The admin UI must display every amount
 * in one canonical unit: USD dollars. Do not mix `$` rows with `¢` rows,
 * because the visual table total then appears not to add up even when the
 * underlying cents math is correct.
 */

function normalizeMoneyValue(value: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Format a cent-denominated value as USD dollars.
 *
 * Precision rules:
 * - zero stays `$0.00`
 * - positive sub-dollar values keep up to 4 decimals so tiny real spend remains visible
 * - dollar-and-above values use standard currency cents
 */
export function formatUsdFromCents(cents: number): string {
  const normalizedCents = normalizeMoneyValue(cents);
  const dollars = normalizedCents / 100;
  const absDollars = Math.abs(dollars);

  if (absDollars === 0) return "$0.00";

  if (absDollars < 1) {
    return `${dollars < 0 ? "-" : ""}$${absDollars.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }

  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
