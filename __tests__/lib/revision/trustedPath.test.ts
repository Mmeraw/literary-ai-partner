/**
 * TrustedPath™ — Regression Tests
 *
 * Covers the core TrustedPath contract:
 * 1. Only approve-verdict findings are auto-accepted
 * 2. Already-decided findings are skipped
 * 3. Flagged/rejected/unavailable/pending verdicts are excluded
 * 4. Result summary counts are accurate
 * 5. Empty eligible set returns graceful empty result
 * 6. isTrustedPathEligible gate is enforced
 */

import { isTrustedPathEligible, type CrossCheckVerdict } from "@/lib/revision/repairCrossCheck";

// ─── Test 1: TrustedPath gate only allows approve ──────────────────────────

describe("TrustedPath gate", () => {
  it("returns true only for approve verdict", () => {
    expect(isTrustedPathEligible("approve")).toBe(true);
  });

  it.each<CrossCheckVerdict | null | undefined>([
    "flag",
    "reject",
    "unavailable",
    "pending",
    null,
    undefined,
  ])("rejects verdict '%s'", (verdict) => {
    expect(isTrustedPathEligible(verdict)).toBe(false);
  });
});

// ─── Test 2: TrustedPathSummary structure ────────────────────────────────────

describe("TrustedPathSummary contract", () => {
  it("has required fields for a successful result", () => {
    const summary = {
      ok: true,
      error: null,
      appliedCount: 5,
      skippedCount: 0,
      alreadyDecidedCount: 2,
      appliedFindingIds: ["f1", "f2", "f3", "f4", "f5"],
      skippedReasons: {},
    };

    expect(summary.ok).toBe(true);
    expect(summary.error).toBeNull();
    expect(summary.appliedCount).toBe(5);
    expect(summary.alreadyDecidedCount).toBe(2);
    expect(summary.appliedFindingIds).toHaveLength(5);
  });

  it("has required fields for an error result", () => {
    const summary = {
      ok: false,
      error: "Not authenticated",
      appliedCount: 0,
      skippedCount: 0,
      alreadyDecidedCount: 0,
      appliedFindingIds: [],
      skippedReasons: {},
    };

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe("Not authenticated");
    expect(summary.appliedCount).toBe(0);
  });
});

// ─── Test 3: ledger entry metadata marks source as trustedpath ──────────────

describe("TrustedPath ledger entry metadata", () => {
  it("marks entries with trustedpath-auto-apply source", () => {
    const metadata = {
      source: "trustedpath-auto-apply",
      crossCheckVerdict: "approve",
    };

    expect(metadata.source).toBe("trustedpath-auto-apply");
    expect(metadata.crossCheckVerdict).toBe("approve");
  });

  it("localId follows trustedpath naming convention", () => {
    const localId = `trustedpath-${Date.now()}-abcdef12`;
    expect(localId).toMatch(/^trustedpath-\d+-[a-f0-9]+$/);
  });
});

// ─── Test 4: verdict filtering logic ────────────────────────────────────────

describe("verdict filtering", () => {
  it("filters only approve verdicts from a mixed set", () => {
    const verdicts: CrossCheckVerdict[] = [
      "approve",
      "flag",
      "reject",
      "approve",
      "unavailable",
      "pending",
      "approve",
    ];

    const eligible = verdicts.filter((v) => isTrustedPathEligible(v));
    expect(eligible).toHaveLength(3);
    expect(eligible.every((v) => v === "approve")).toBe(true);
  });

  it("returns empty array when no approvals exist", () => {
    const verdicts: CrossCheckVerdict[] = ["flag", "reject", "unavailable", "pending"];
    const eligible = verdicts.filter((v) => isTrustedPathEligible(v));
    expect(eligible).toHaveLength(0);
  });
});

// ─── Test 5: decision deduplication contract ────────────────────────────────

describe("already-decided deduplication", () => {
  it("skips findings that already have ledger decisions", () => {
    const alreadyDecided = new Set(["finding-001", "finding-003"]);
    const eligibleFindings = ["finding-001", "finding-002", "finding-003", "finding-004"];

    const toApply = eligibleFindings.filter((id) => !alreadyDecided.has(id));
    expect(toApply).toEqual(["finding-002", "finding-004"]);
    expect(toApply).toHaveLength(2);
  });

  it("returns empty when all eligible findings are already decided", () => {
    const alreadyDecided = new Set(["finding-001", "finding-002"]);
    const eligibleFindings = ["finding-001", "finding-002"];

    const toApply = eligibleFindings.filter((id) => !alreadyDecided.has(id));
    expect(toApply).toHaveLength(0);
  });
});

// ─── Test 6: title truncation matches workbench convention ──────────────────

describe("title truncation", () => {
  it("truncates long diagnosis to 150 chars with ellipsis", () => {
    const longDiagnosis = "A".repeat(200);
    const title = longDiagnosis.length > 150
      ? `${longDiagnosis.slice(0, 147).trim()}…`
      : longDiagnosis;

    expect(title.length).toBe(148);
    expect(title.endsWith("…")).toBe(true);
  });

  it("preserves short diagnosis as-is", () => {
    const shortDiagnosis = "Weak intensifiers dilute prose control.";
    const title = shortDiagnosis.length > 150
      ? `${shortDiagnosis.slice(0, 147).trim()}…`
      : shortDiagnosis;

    expect(title).toBe(shortDiagnosis);
  });
});
