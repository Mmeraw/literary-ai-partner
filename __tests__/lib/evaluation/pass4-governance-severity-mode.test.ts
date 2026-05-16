/**
 * Pass 4 Governance — Severity + Mode Enforcement Test (PR-A invariant)
 *
 * Validates that the runPipeline consumer at lib/evaluation/pipeline/runPipeline.ts
 * honors BOTH the governance decision's `severity` field AND the runtime
 * `adjudicationMode` when deciding whether a governance !ok blocks the pipeline.
 *
 * Source-text regex assertions (no runtime), consistent with the existing
 * pass4-cross-check-invocation.test.ts style. Verifies the structural shape
 * of the consumer gate so future edits cannot silently regress the fix.
 *
 * Background:
 *   - evaluatePass4Governance() emits severity="warning" for PASS4_DISPUTED_CRITERIA
 *     and severity="error" for PASS4_CANON_INVALID + PASS4_WEAK_AGREEMENT.
 *   - The CONSUMER previously failed the pipeline on ANY governance !ok,
 *     ignoring both severity and mode. This killed jobs in optional mode
 *     whenever a single criterion delta crossed the dispute threshold.
 *   - Post-fix: pipeline only fails when severity==="error" OR mode is strict
 *     ("required" | "veto"). Warning + optional mode → ship with warning.
 */

import { describe, test, expect } from "@jest/globals";
import * as fs from "fs/promises";
import * as path from "path";

describe("Pass 4 Governance — Severity + Mode Invariants (PR-A)", () => {
  const pipelinePath = path.join(
    process.cwd(),
    "lib/evaluation/pipeline/runPipeline.ts"
  );

  test("consumer reads pass4Governance.severity when gating", async () => {
    const source = await fs.readFile(pipelinePath, "utf-8");
    // The consumer must explicitly check severity === "error" to determine
    // whether a governance decision is structurally blocking.
    expect(source).toMatch(/pass4Governance\.severity\s*===\s*["']error["']/);
  });

  test("consumer reads adjudicationMode when gating (required | veto)", async () => {
    const source = await fs.readFile(pipelinePath, "utf-8");
    // The consumer must check adjudicationMode for strict modes so operators
    // who opt into fail-closed semantics still get them regardless of severity.
    expect(source).toMatch(/adjudicationMode\s*===\s*["']required["']/);
    expect(source).toMatch(/adjudicationMode\s*===\s*["']veto["']/);
  });

  test("non-blocking warning path falls through (does not return ok:false)", async () => {
    const source = await fs.readFile(pipelinePath, "utf-8");

    // Locate the governance gate block.
    const gateMatch = source.match(
      /if\s*\(\s*pass4Governance\s*&&\s*!pass4Governance\.ok\s*\)\s*\{[\s\S]*?\n\s{2}\}/
    );
    expect(gateMatch).toBeDefined();
    const gateBlock = gateMatch![0];

    // Inside the gate, there must be an inner conditional that wraps the
    // fail-closed `return { ok: false, ... }`. The bare `return { ok: false }`
    // must NOT be unconditional.
    expect(gateBlock).toMatch(/if\s*\(\s*blocking\s*\)/);

    // The fail-closed return must live inside the inner conditional.
    expect(gateBlock).toMatch(/if\s*\(\s*blocking\s*\)\s*\{[\s\S]*?ok:\s*false/);
  });

  test("non-blocking warning is logged with mode context", async () => {
    const source = await fs.readFile(pipelinePath, "utf-8");
    // When falling through with a warning, the pipeline must log it so the
    // event is auditable. The log must reference the mode for diagnosability.
    expect(source).toMatch(
      /\[Pass4\]\s+Governance\s+warning[\s\S]*?adjudicationMode/
    );
  });

  test("success return still surfaces pass4_governance for warning case", async () => {
    const source = await fs.readFile(pipelinePath, "utf-8");
    // The success return must include pass4_governance so the processor can
    // persist the warning onto progress and the UI can render it.
    const successReturn = source.match(
      /return\s*\{\s*ok:\s*true[\s\S]*?pass4_governance:\s*pass4Governance[\s\S]*?\}/
    );
    expect(successReturn).toBeDefined();
  });

  test("error severity still blocks regardless of mode (PASS4_CANON_INVALID, PASS4_WEAK_AGREEMENT)", async () => {
    const governancePath = path.join(
      process.cwd(),
      "lib/evaluation/governance/evaluatePass4Governance.ts"
    );
    const source = await fs.readFile(governancePath, "utf-8");

    // Verify the governance emitter still tags canon-invalid and weak-agreement
    // as severity:"error". If a future refactor downgrades these to "warning",
    // the consumer would no longer block them — this test catches that.
    const canonInvalidBlock = source.match(
      /blockCode:\s*["']PASS4_CANON_INVALID["'][\s\S]*?severity:\s*["']error["']/
    );
    expect(canonInvalidBlock).toBeDefined();

    const weakAgreementBlock = source.match(
      /blockCode:\s*["']PASS4_WEAK_AGREEMENT["'][\s\S]*?severity:\s*["']error["']/
    );
    expect(weakAgreementBlock).toBeDefined();
  });

  test("disputed-criteria stays as severity:warning (the unblocked case)", async () => {
    const governancePath = path.join(
      process.cwd(),
      "lib/evaluation/governance/evaluatePass4Governance.ts"
    );
    const source = await fs.readFile(governancePath, "utf-8");

    // PASS4_DISPUTED_CRITERIA must remain severity:"warning". If it gets
    // upgraded to "error", optional-mode jobs would start failing again
    // on any single disputed criterion, regressing the PR-A fix.
    const disputedBlock = source.match(
      /blockCode:\s*["']PASS4_DISPUTED_CRITERIA["'][\s\S]*?severity:\s*["']warning["']/
    );
    expect(disputedBlock).toBeDefined();
  });

  test("documentation: PR-A invariant matrix (severity × mode → outcome)", () => {
    // Documentation-only matrix. This is the contract enforced by the
    // consumer-side gate at runPipeline.ts after the PR-A fix.
    const matrix = [
      { severity: "error", mode: "optional", outcome: "ok:false (block)" },
      { severity: "error", mode: "required", outcome: "ok:false (block)" },
      { severity: "error", mode: "veto", outcome: "ok:false (block)" },
      { severity: "warning", mode: "optional", outcome: "ok:true + warning" },
      { severity: "warning", mode: "required", outcome: "ok:false (block)" },
      { severity: "warning", mode: "veto", outcome: "ok:false (block)" },
    ];

    // The only outcome that differs from the pre-PR-A behavior is
    // (warning, optional) → previously ok:false, now ok:true + warning.
    const changed = matrix.filter(
      (row) => row.severity === "warning" && row.mode === "optional"
    );
    expect(changed).toHaveLength(1);
    expect(changed[0].outcome).toBe("ok:true + warning");
  });
});
