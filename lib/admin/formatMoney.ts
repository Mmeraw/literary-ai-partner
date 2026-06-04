/**
 * Shared money formatting for CostOps dashboards.
 *
 * Values are passed in as USD cents. Positive sub-cent amounts are rendered
 * with a cent suffix so tiny but real spend never collapses to `$0.00`.
 */

function normalizeMoneyValue(value: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatUsdFromCents(cents: number): string {
  const normalized = normalizeMoneyValue(cents);
  const abs = Math.abs(normalized);

  if (abs === 0) return "$0.00";

  if (abs < 1) {
    const prefix = normalized < 0 ? "-" : "";
    return `${prefix}${abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}¢`;
  }

  const dollars = normalized / 100;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
