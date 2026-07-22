import fs from "fs";
import path from "path";

import {
  CANONICAL_OBLIGATION_STATES,
  EVIDENCE_KINDS,
  GAP_BUCKETS,
  deriveBoundaryEvidenceState,
  normalizeObligationState,
  type EvidenceManifest,
  type EvidenceObligation,
  REMEDIATION_AUDIT_STATES,
  type RemediationAudit,
} from "./evidenceModel";

const manifest = JSON.parse(
  fs.readFileSync(path.resolve("tests/fixtures/sipoc/evidence-obligations.v3.json"), "utf8"),
) as EvidenceManifest;
const remediationAudit = JSON.parse(
  fs.readFileSync(path.resolve("tests/sipoc/remediation-audit.v3.json"), "utf8"),
) as RemediationAudit;

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
    expect(manifest.obligations.some((item) => item.current_state === "satisfied_but_unmapped")).toBe(true);
  });

  test("accepts runtime_conflict only as a migration alias for implementation_conflict", () => {
    expect(CANONICAL_OBLIGATION_STATES).toContain("implementation_conflict");
    expect(CANONICAL_OBLIGATION_STATES).not.toContain("runtime_conflict");
    expect(normalizeObligationState("runtime_conflict")).toBe("implementation_conflict");
    expect(normalizeObligationState("implementation_conflict")).toBe("implementation_conflict");
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

  test("records Gate 15 as implementation-pending without making it auto-promotable", () => {
    const gate15 = manifest.obligations.find(
      (item) => item.id === "S10b_PHASE5_AUTHOR_EXPOSURE_GATE.failclosed.04",
    );
    expect(gate15).toMatchObject({
      current_state: "implementation_conflict",
      gap_bucket: "implementation_gap",
      remediation_class: "runtime",
      enforcement_point: "lib/evaluation/authorExposureCertification.ts getAuthorExposureDecisionWithFinalExternalAudit + lib/evaluation/gate15/authorExposureGate15.ts evaluateGate15AuthorExposure",
    });
    expect(gate15?.current_state).not.toBe("satisfied");
    expect(gate15?.current_state).not.toBe("satisfied_but_unmapped");
    expect(normalizeObligationState(gate15?.current_state ?? "policy_conflict")).toBe("implementation_conflict");
    expect(gate15?.blocked_by).toBeUndefined();
    expect(gate15?.evidence_refs).toEqual([]);
  });

  test("audits remediation candidates without treating implementation as earned evidence", () => {
    const manifestIds = new Set(manifest.obligations.map((item) => item.id));
    expect(remediationAudit.schema_version).toBe(1);
    expect(remediationAudit.based_on_manifest_schema).toBe(manifest.schema_version);
    expect(remediationAudit.entries.map((entry) => entry.pull_request)).toEqual([1385, 1386, 1387, 1390, 1395]);
    for (const entry of remediationAudit.entries) {
      expect(REMEDIATION_AUDIT_STATES).toContain(entry.audit_state);
      expect(entry.capable_evidence_required).toBeTruthy();
      expect(entry.residual_gap).toBeTruthy();
      for (const id of entry.obligation_ids) {
        expect(manifestIds).toContain(id);
        expect(manifest.obligations.find((item) => item.id === id)?.current_state).not.toBe("satisfied");
      }
    }
  });

  test("does not map the Gate 15 implementation-conflict item to stale remediation candidates", () => {
    const mapped = remediationAudit.entries.flatMap((entry) => entry.obligation_ids);
    expect(mapped).not.toContain("S10b_PHASE5_AUTHOR_EXPOSURE_GATE.failclosed.04");
    const gate15 = manifest.obligations.find((item) => item.id === "S10b_PHASE5_AUTHOR_EXPOSURE_GATE.failclosed.04");
    expect(gate15).toMatchObject({ current_state: "implementation_conflict" });
    expect(gate15).not.toHaveProperty("blocked_by");
  });

  test("requires capable evidence for every mapped evidence kind", () => {
    const requirements = new Map(remediationAudit.entries.flatMap((entry) =>
      entry.obligation_ids.map((id) => [id, entry.capable_evidence_required] as const),
    ));
    expect(requirements.get("S03_CLAIM.failclosed.02")).toContain("two-session");
    expect(requirements.get("S11a_RENDERER_WEBPAGE.failclosed.03")).toContain("actual webpage consumer");
    expect(requirements.get("S11b_DOWNLOAD_PIPELINE.failclosed.03")).toContain("route evidence");
    expect(requirements.get("S10b_PHASE5_AUTHOR_EXPOSURE_GATE.failclosed.05")).toContain("public production call path");
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
