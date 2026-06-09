import {
  getGateFailurePolicy,
  buildRetryContext,
  buildQuarantineArtifact,
} from "@/lib/evaluation/pipeline/selfCorrectionPolicy";
import { maxSelfRecoveryAttemptsForFailureCode } from "@/lib/evaluation/processor";

describe("Self-Correction Policy", () => {
  describe("getGateFailurePolicy", () => {
    it("returns max_retries=1 for HANDOFF_ codes", () => {
      const policy = getGateFailurePolicy("HANDOFF_SCAFFOLD_RESIDUE");
      expect(policy.max_retries).toBe(1);
      expect(policy.persist_quarantine_artifact).toBe(true);
      expect(policy.severity).toBe("high");
    });

    it("returns max_retries=1 for all HANDOFF_ variants", () => {
      const codes = [
        "HANDOFF_SCAFFOLD_RESIDUE",
        "HANDOFF_INCOMPLETE_SENTENCE",
        "HANDOFF_BROKEN_MODAL",
        "HANDOFF_GENERIC_LANGUAGE",
        "HANDOFF_MISSING_EVIDENCE_ANCHOR",
      ];
      for (const code of codes) {
        const policy = getGateFailurePolicy(code);
        expect(policy.max_retries).toBe(1);
      }
    });

    it("returns max_retries=0 for QG_ codes (deterministic, no retry)", () => {
      const policy = getGateFailurePolicy("QG_INDEPENDENCE_VIOLATION");
      expect(policy.max_retries).toBe(0);
      expect(policy.severity).toBe("critical");
    });

    it("returns max_retries=0 for DOWNLOAD_ codes", () => {
      const policy = getGateFailurePolicy("DOWNLOAD_PARITY_FAILED");
      expect(policy.max_retries).toBe(0);
    });

    it("provides user-safe message that hides internals", () => {
      const policy = getGateFailurePolicy("HANDOFF_BROKEN_MODAL");
      expect(policy.user_safe_message).not.toContain("HANDOFF");
      expect(policy.user_safe_message).not.toContain("modal");
      expect(policy.user_safe_message).toContain("quality");
    });

    it("never exposes error codes in user-safe messages", () => {
      const codes = [
        "HANDOFF_SCAFFOLD_RESIDUE",
        "QG_INDEPENDENCE_VIOLATION",
        "DOWNLOAD_PARITY_FAILED",
        "REC_INTEGRITY_MALFORMED",
      ];
      for (const code of codes) {
        const policy = getGateFailurePolicy(code);
        expect(policy.user_safe_message).not.toContain(code);
      }
    });
  });

  describe("maxSelfRecoveryAttemptsForFailureCode integration", () => {
    it("returns 1 for HANDOFF_ codes (retry once, then terminal)", () => {
      expect(maxSelfRecoveryAttemptsForFailureCode("HANDOFF_SCAFFOLD_RESIDUE")).toBe(1);
      expect(maxSelfRecoveryAttemptsForFailureCode("HANDOFF_BROKEN_MODAL")).toBe(1);
      expect(maxSelfRecoveryAttemptsForFailureCode("HANDOFF_INCOMPLETE_SENTENCE")).toBe(1);
      expect(maxSelfRecoveryAttemptsForFailureCode("HANDOFF_GENERIC_LANGUAGE")).toBe(1);
      expect(maxSelfRecoveryAttemptsForFailureCode("HANDOFF_MISSING_EVIDENCE_ANCHOR")).toBe(1);
    });

    it("returns 0 for QG_ codes (never retry)", () => {
      expect(maxSelfRecoveryAttemptsForFailureCode("QG_INDEPENDENCE_VIOLATION")).toBe(0);
    });

    it("returns 0 for terminal failures", () => {
      expect(maxSelfRecoveryAttemptsForFailureCode("POLICY_VIOLATION_EVIDENCE")).toBe(0);
      expect(maxSelfRecoveryAttemptsForFailureCode("PASS4_CANON_INVALID")).toBe(0);
    });
  });

  describe("buildRetryContext", () => {
    it("builds a complete retry context with failure reason", () => {
      const ctx = buildRetryContext({
        gate: "Pass 1/2 Handoff Gate",
        stageId: "S06b",
        violationCodes: ["HANDOFF_SCAFFOLD_RESIDUE", "HANDOFF_BROKEN_MODAL"],
        affectedFields: ["rationale", "action"],
        attemptNumber: 1,
      });

      expect(ctx.failed_gate).toBe("Pass 1/2 Handoff Gate");
      expect(ctx.stage_id).toBe("S06b");
      expect(ctx.violation_codes).toHaveLength(2);
      expect(ctx.attempt_number).toBe(1);
      expect(ctx.retry_instruction).toContain("rejected");
      expect(ctx.retry_instruction).toContain("placeholder");
      expect(ctx.retry_instruction).toContain("terminal punctuation");
    });

    it("caps violation descriptions to prevent prompt bloat", () => {
      const ctx = buildRetryContext({
        gate: "TestGate",
        stageId: "S00",
        violationCodes: Array(10).fill("HANDOFF_SCAFFOLD_RESIDUE"),
        affectedFields: [],
        attemptNumber: 1,
      });

      // violation_codes is the full list, but the instruction only describes 5
      expect(ctx.violation_codes).toHaveLength(10);
      // The instruction text has bounded length (5 described + static suffix)
      expect(ctx.retry_instruction.length).toBeLessThan(600);
    });
  });

  describe("buildQuarantineArtifact", () => {
    it("builds a quarantine record with proper metadata", () => {
      const artifact = buildQuarantineArtifact({
        gate: "Pass 1/2 Handoff Gate",
        stageId: "S06b",
        violationCodes: ["HANDOFF_SCAFFOLD_RESIDUE"],
        attemptNumber: 1,
        content: { criteria: [{ key: "dialogue", rationale: "[PLACEHOLDER]" }] },
      });

      expect(artifact.artifact_type).toBe("quarantine_s06b");
      expect(artifact.gate).toBe("Pass 1/2 Handoff Gate");
      expect(artifact.violation_codes).toContain("HANDOFF_SCAFFOLD_RESIDUE");
      expect(artifact.quarantined_at).toBeTruthy();
      expect(artifact.content).toBeDefined();
    });

    it("preserves raw content for admin inspection", () => {
      const badContent = { raw: "The manuscript shows [PLACEHOLDER] in pacing." };
      const artifact = buildQuarantineArtifact({
        gate: "TestGate",
        stageId: "S06b",
        violationCodes: ["HANDOFF_SCAFFOLD_RESIDUE"],
        attemptNumber: 1,
        content: badContent,
      });

      expect(artifact.content).toEqual(badContent);
    });
  });

  describe("policy invariants", () => {
    it("HANDOFF codes are NOT in terminal failure list (they get 1 retry first)", () => {
      // If HANDOFF_ were terminal, maxSelfRecoveryAttempts would return 0
      // Policy says they get 1 retry, so they must NOT be terminal
      expect(maxSelfRecoveryAttemptsForFailureCode("HANDOFF_SCAFFOLD_RESIDUE")).toBeGreaterThan(0);
    });

    it("QG_ codes ARE terminal (0 retries)", () => {
      expect(maxSelfRecoveryAttemptsForFailureCode("QG_INDEPENDENCE_VIOLATION")).toBe(0);
    });

    it("monotonic strictness: policy never allows more than 1 retry for content gates", () => {
      const contentGateCodes = [
        "HANDOFF_SCAFFOLD_RESIDUE",
        "HANDOFF_BROKEN_MODAL",
        "HANDOFF_GENERIC_LANGUAGE",
        "HANDOFF_MISSING_EVIDENCE_ANCHOR",
        "HANDOFF_INCOMPLETE_SENTENCE",
      ];
      for (const code of contentGateCodes) {
        const policy = getGateFailurePolicy(code);
        expect(policy.max_retries).toBeLessThanOrEqual(1);
      }
    });
  });
});
