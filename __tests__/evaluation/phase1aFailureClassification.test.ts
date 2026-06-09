/**
 * Phase 1A Failure Classification — regression tests
 *
 * Ensures that non-ledger Phase 1A errors are NOT mislabeled as PASS1A_LEDGER_MISSING.
 * Previously, ALL Phase 1A catch-block errors were classified as PASS1A_LEDGER_MISSING
 * regardless of actual cause (OpenAI timeout, rate limit, transition failure, etc.).
 *
 * This test suite validates that classifyPhase1aFailure returns the correct
 * failure code based on the error message content.
 */

import { classifyPhase1aFailure } from "@/lib/evaluation/pipeline/phase1aFailureClassification";

describe("classifyPhase1aFailure", () => {
  describe("PASS1A_LEDGER_MISSING — only for actual missing ledger conditions", () => {
    it("returns PASS1A_LEDGER_MISSING when error mentions accepted_story_ledger", () => {
      const result = classifyPhase1aFailure(
        "No accepted_story_ledger_v1 found for job abc123"
      );
      expect(result.code).toBe("PASS1A_LEDGER_MISSING");
      expect(result.bucket).toBe("ledger");
    });

    it("returns PASS1A_LEDGER_MISSING when error mentions ledger missing", () => {
      const { code } = classifyPhase1aFailure(
        "Story ledger missing after phase completion"
      );
      expect(code).toBe("PASS1A_LEDGER_MISSING");
    });

    it("returns PASS1A_LEDGER_MISSING for Error objects about missing ledger", () => {
      const result = classifyPhase1aFailure(
        new Error("accepted_story_ledger lookup returned empty")
      );
      expect(result.code).toBe("PASS1A_LEDGER_MISSING");
      expect(result.bucket).toBe("ledger");
    });
  });

  describe("PHASE1A_HANDOFF_TRANSITION_FAILED — transition/handoff errors", () => {
    it("classifies 'Phase 1A → review_gate transition failed' correctly", () => {
      const result = classifyPhase1aFailure(
        "Phase 1A → review_gate transition failed: row update returned 0 rows"
      );
      expect(result.code).toBe("PHASE1A_HANDOFF_TRANSITION_FAILED");
      expect(result.bucket).toBe("transition");
    });

    it("classifies 'Phase 1A → phase_2 transition failed' correctly", () => {
      const { code, bucket } = classifyPhase1aFailure(
        "Phase 1A → phase_2 transition failed: concurrent update"
      );
      expect(code).toBe("PHASE1A_HANDOFF_TRANSITION_FAILED");
      expect(bucket).toBe("transition");
    });

    it("classifies handoff failed errors correctly", () => {
      const { code } = classifyPhase1aFailure(
        "Phase 1A handoff failed due to lease expiry"
      );
      expect(code).toBe("PHASE1A_HANDOFF_TRANSITION_FAILED");
    });
  });

  describe("PASS1A_TIMEOUT — timeout-related errors", () => {
    it("classifies 'timeout' errors correctly", () => {
      const result = classifyPhase1aFailure(
        "OpenAI API request timeout after 120000ms"
      );
      expect(result.code).toBe("PASS1A_TIMEOUT");
      expect(result.bucket).toBe("timeout");
    });

    it("classifies 'timed out' errors correctly", () => {
      const { code } = classifyPhase1aFailure(
        "Connection timed out waiting for response"
      );
      expect(code).toBe("PASS1A_TIMEOUT");
    });

    it("classifies 'deadline' errors correctly", () => {
      const { code } = classifyPhase1aFailure(
        "Phase deadline exceeded: 300s maximum"
      );
      expect(code).toBe("PASS1A_TIMEOUT");
    });
  });

  describe("PASS1A_RATE_LIMIT — rate/quota-related errors", () => {
    it("classifies 'rate' errors correctly", () => {
      const result = classifyPhase1aFailure(
        "Rate limit exceeded for model gpt-4o"
      );
      expect(result.code).toBe("PASS1A_RATE_LIMIT");
      expect(result.bucket).toBe("provider");
    });

    it("classifies '429' errors correctly", () => {
      const { code } = classifyPhase1aFailure(
        "HTTP 429 Too Many Requests from OpenAI"
      );
      expect(code).toBe("PASS1A_RATE_LIMIT");
    });

    it("classifies 'quota' errors correctly", () => {
      const { code } = classifyPhase1aFailure(
        "Quota exceeded for organization"
      );
      expect(code).toBe("PASS1A_RATE_LIMIT");
    });
  });

  describe("PHASE1A_POLICY_BLOCK — governance/policy errors", () => {
    it("classifies governance block errors correctly", () => {
      const result = classifyPhase1aFailure(
        "Governance rail blocked story layer output"
      );
      expect(result.code).toBe("PHASE1A_POLICY_BLOCK");
      expect(result.bucket).toBe("policy");
    });

    it("classifies guard failures correctly", () => {
      const { code } = classifyPhase1aFailure(
        "Phase 0 duration guard failed: minimum 12s not reached"
      );
      expect(code).toBe("PHASE1A_POLICY_BLOCK");
    });
  });

  describe("PASS1A_PROVIDER_ERROR — provider-specific errors", () => {
    it("classifies OpenAI errors correctly", () => {
      const result = classifyPhase1aFailure(
        "OpenAI internal server error: model overloaded"
      );
      expect(result.code).toBe("PASS1A_PROVIDER_ERROR");
      expect(result.bucket).toBe("provider");
    });
  });

  describe("PHASE1A_FAILED — fallback for unknown errors", () => {
    it("classifies generic errors as PHASE1A_FAILED", () => {
      const result = classifyPhase1aFailure(
        "Cannot read properties of null (reading 'entries')"
      );
      expect(result.code).toBe("PHASE1A_FAILED");
      expect(result.bucket).toBe("unknown");
    });

    it("classifies network errors as PHASE1A_FAILED", () => {
      const { code } = classifyPhase1aFailure(
        "ECONNRESET: socket hang up"
      );
      expect(code).toBe("PHASE1A_FAILED");
    });

    it("handles unknown/null input gracefully", () => {
      const result = classifyPhase1aFailure(null);
      expect(result.code).toBe("PHASE1A_FAILED");
      expect(result.message).toBe("");
      expect(result.bucket).toBe("unknown");
    });
  });

  describe("message preservation", () => {
    it("preserves the original error message in result", () => {
      const msg = "Phase 1A → review_gate transition failed: concurrent write";
      const result = classifyPhase1aFailure(msg);
      expect(result.message).toBe(msg);
    });

    it("extracts message from Error objects", () => {
      const err = new Error("OpenAI API request timeout after 120000ms");
      const result = classifyPhase1aFailure(err);
      expect(result.message).toBe("OpenAI API request timeout after 120000ms");
    });
  });

  describe("regression: non-ledger errors must NOT be labeled PASS1A_LEDGER_MISSING", () => {
    const nonLedgerErrors = [
      "OpenAI API request timeout after 120000ms",
      "Rate limit exceeded for model gpt-4o",
      "HTTP 429 Too Many Requests",
      "Cannot read properties of null (reading 'entries')",
      "Phase 1A → phase_2 transition failed: row update returned 0 rows",
      "Phase 1A → review_gate transition failed: concurrent update",
      "Unexpected server error from OpenAI: internal_error",
      "ECONNRESET: socket hang up",
      "JSON parse boundary error: incomplete response",
      "AbortError: The operation was aborted",
      "Phase deadline exceeded: 300s maximum",
      "Governance rail blocked story layer output",
      "Phase 1A handoff failed due to lease expiry",
    ];

    it.each(nonLedgerErrors)(
      "does NOT classify '%s' as PASS1A_LEDGER_MISSING",
      (errMsg) => {
        const { code } = classifyPhase1aFailure(errMsg);
        expect(code).not.toBe("PASS1A_LEDGER_MISSING");
      }
    );
  });
});
