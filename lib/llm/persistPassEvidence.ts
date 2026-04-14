/**
 * Shared pass evidence persistence contract.
 *
 * All passes (1/2/3/4) persist parse evidence through this single function.
 * Observability contract: passive only — logs structured evidence,
 * must not alter control flow or throw.
 */

// ── Shared persist contract ───────────────────────────────────────────────────

export type PersistPassEvidenceInput = {
  jobId?: string;
  pass: "pass1" | "pass2" | "pass3" | "pass4";
  status: "ok" | "failed";
  evidence: Record<string, unknown>;
};

/**
 * Persist parse evidence for a given pass.
 *
 * Current implementation: structured logging (passive observability).
 * Future: extend to write to a dedicated evidence table.
 *
 * MUST NOT throw. MUST NOT alter control flow.
 */
export function persistPassEvidence(input: PersistPassEvidenceInput): void {
  try {
    const { jobId, pass, status, evidence } = input;
    console.log("[persistPassEvidence]", {
      jobId: jobId ?? "(none)",
      pass,
      status,
      rawLen: typeof evidence["rawResponseText"] === "string"
        ? (evidence["rawResponseText"] as string).length
        : undefined,
      candidatesFound: evidence["candidatesFound"],
      parseFailureCode: evidence["parseFailureCode"] ?? null,
      finishReason: (evidence["telemetry"] as Record<string, unknown> | null)?.["finishReason"] ?? undefined,
    });
  } catch {
    // Observability must never crash the caller
  }
}
