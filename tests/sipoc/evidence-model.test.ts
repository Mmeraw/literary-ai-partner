import fs from "fs";
import path from "path";

import {
  EVIDENCE_KINDS,
  GAP_BUCKETS,
  deriveBoundaryEvidenceState,
  type EvidenceManifest,
  type EvidenceObligation,
} from "./evidenceModel";

const manifest = JSON.parse(
  fs.readFileSync(path.resolve("tests/fixtures/sipoc/evidence-obligations.v3.json"), "utf8"),
) as EvidenceManifest;

describe("SIPOC v3 evidence model", () => {
  test("defines exactly the ratified four evidence kinds", () => {
    expect(EVIDENCE_KINDS).toEqual([
      "runtime_fail_closed",
      "static_architecture_invariant",
      "pure_predicate_contract",
      "integration_transactional",
    ]);
  });

  test("represents all 33 reviewed obligations with stable unique IDs", () => {
    expect(manifest.obligations).toHaveLength(33);
    expect(new Set(manifest.obligations.map((item) => item.id)).size).toBe(33);
    expect(manifest.obligations.some((item) => item.current_state === "satisfied")).toBe(false);
  });

  test("requires one recognized gap bucket and an exclusive expiry for every unresolved obligation", () => {
    for (const item of manifest.obligations.filter((value) => value.current_state !== "satisfied")) {
      expect(GAP_BUCKETS).toContain(item.gap_bucket);
      expect(item.expires_before_utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(item.gap).toBeTruthy();
    }
  });

  test("keeps all S03 claim obligations transactional and unproven", () => {
    const obligations = manifest.obligations.filter((item) => item.boundary === "S03_CLAIM");
    expect(obligations).toHaveLength(3);
    expect(obligations.every((item) => item.evidence_kind === "integration_transactional")).toBe(true);
    expect(obligations.every((item) => item.current_state === "representable_but_unproven")).toBe(true);
  });

  test("keeps Gate 15 isolated as an unresolved policy contradiction", () => {
    const gate15 = manifest.obligations.find(
      (item) => item.id === "S10b_PHASE5_AUTHOR_EXPOSURE_GATE.failclosed.04",
    );
    expect(gate15).toMatchObject({
      current_state: "policy_conflict",
      gap_bucket: "policy_contradiction",
      remediation_class: "policy",
      blocked_by: "gate_15_product_policy_ruling",
    });
  });

  test("never derives proven from an empty or partially satisfied obligation set", () => {
    expect(deriveBoundaryEvidenceState([]).proven).toBe(false);
    const sample = manifest.obligations.filter((item) => item.boundary === "S03_CLAIM");
    expect(deriveBoundaryEvidenceState(sample).proven).toBe(false);
  });

  test("derives proven only when every represented obligation is satisfied", () => {
    const sample = manifest.obligations
      .filter((item) => item.boundary === "S02_QUEUE")
      .map((item) => ({ ...item, current_state: "satisfied" as const, gap_bucket: null, gap: null, expires_before_utc: null }));
    expect(deriveBoundaryEvidenceState(sample as EvidenceObligation[])).toEqual({
      proven: true,
      total: 2,
      satisfied: 2,
      unresolved: [],
    });
  });
});
