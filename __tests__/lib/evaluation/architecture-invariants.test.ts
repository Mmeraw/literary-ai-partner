export {};

const fs = require("fs");
const path = require("path");

describe("evaluation architecture invariants", () => {
  const repoRoot = path.resolve(__dirname, "../../..");

  test("live processor path is wired to canonical runPipeline", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    expect(processorCode).toContain("runPipeline");
    expect(processorCode).toContain("synthesisToEvaluationResult");
    expect(processorCode).toContain("await runPipeline(");
    expect(processorCode).not.toContain("generateAIEvaluation(");
    expect(processorCode).not.toContain("import OpenAI from");
  });

  test("evaluation compatibility logic is centralized in shared policy module", () => {
    const policyPath = path.join(repoRoot, "lib/evaluation/policy.ts");
    const policyCode = fs.readFileSync(policyPath, "utf8");

    expect(policyCode).toContain("buildOpenAIOutputTokenParam");
    expect(policyCode).toContain("buildOpenAITemperatureParam");

    const filesThatMustImportPolicy = [
      "lib/evaluation/processor.ts",
      "lib/evaluation/pipeline/runPass1.ts",
      "lib/evaluation/pipeline/runPass2.ts",
      "lib/evaluation/pipeline/runPass3Synthesis.ts",
      "workers/phase2Evaluation.ts",
    ];

    for (const relativePath of filesThatMustImportPolicy) {
      const filePath = path.join(repoRoot, relativePath);
      const code = fs.readFileSync(filePath, "utf8");
      expect(code).toContain("@/lib/evaluation/policy");
      expect(code).not.toMatch(/function\s+buildOpenAIOutputTokenParam\s*\(/);
      expect(code).not.toMatch(/function\s+buildOpenAITemperatureParam\s*\(/);
    }
  });

  test("run-phase2 API routes are wired to canonical processor path", () => {
    const runPhase2Routes = [
      "app/api/admin/jobs/[jobId]/run-phase2/route.ts",
      "app/api/jobs/[jobId]/run-phase2/route.ts",
    ];

    for (const relativePath of runPhase2Routes) {
      const filePath = path.join(repoRoot, relativePath);
      const code = fs.readFileSync(filePath, "utf8");

      expect(code).toContain("processEvaluationJob");
      expect(code).toContain("@/lib/evaluation/processor");
      expect(code).not.toContain("runPhase2Aggregation");
      expect(code).not.toContain("@/lib/jobs/phase2");
    }
  });

  test("worker entrypoint is wired to canonical processor queue path", () => {
    const workerRoutePath = path.join(
      repoRoot,
      "app/api/workers/process-evaluations/route.ts",
    );
    const code = fs.readFileSync(workerRoutePath, "utf8");

    expect(code).toContain("processQueuedJobs");
    expect(code).toContain("@/lib/evaluation/processor");
    expect(code).not.toContain("phase2Worker");
    expect(code).not.toContain("phase2Evaluation");
    expect(code).not.toContain("@/lib/jobs/phase2");
  });

  test("production entrypoints do not import legacy phase2 evaluator authorities", () => {
    const filesToProtect = [
      "app/api/workers/process-evaluations/route.ts",
      "app/api/admin/jobs/[jobId]/run-phase2/route.ts",
      "app/api/jobs/[jobId]/run-phase2/route.ts",
      "lib/evaluation/processor.ts",
    ];

    const forbiddenImportPatterns = [
      /workers\/phase2Worker/,
      /workers\/phase2Evaluation/,
      /@\/lib\/jobs\/phase2/,
      /@\/lib\/evaluation\/phase2/,
    ];

    for (const relativePath of filesToProtect) {
      const filePath = path.join(repoRoot, relativePath);
      const code = fs.readFileSync(filePath, "utf8");

      for (const pattern of forbiddenImportPatterns) {
        expect(code).not.toMatch(pattern);
      }
    }
  });

  test("legacy phase2 worker is hard-disabled unless explicitly re-enabled", () => {
    const workerPath = path.join(repoRoot, "workers/phase2Worker.ts");
    const workerCode = fs.readFileSync(workerPath, "utf8");

    expect(workerCode).toContain("ENABLE_LEGACY_PHASE2_WORKER");
    expect(workerCode).toContain("Legacy phase2 worker is disabled");
    expect(workerCode).toContain("process.exit(1)");

    const workerStartScript = path.join(repoRoot, "scripts/worker-start.sh");
    const workerStartCode = fs.readFileSync(workerStartScript, "utf8");
    expect(workerStartCode).toContain("ENABLE_LEGACY_PHASE2_WORKER");
    expect(workerStartCode).toContain("Legacy Phase 2 worker is disabled by default");
  });

  test("root page remains fail-closed behind private-beta gate", () => {
    const homePagePath = path.join(repoRoot, "app/page.tsx");
    const homePageCode = fs.readFileSync(homePagePath, "utf8");

    expect(homePageCode).toContain('getAuthenticatedUser');
    expect(homePageCode).toContain('redirect("/dashboard")');
    expect(homePageCode).toContain('redirect("/private-beta")');
    expect(homePageCode).not.toContain("Professional Literary Evaluation & Revision");
    expect(homePageCode).not.toContain("Get Started");
  });

  test("middleware keeps private-beta lock while allowing tester login flow", () => {
    const middlewarePath = path.join(repoRoot, "middleware.ts");
    const middlewareCode = fs.readFileSync(middlewarePath, "utf8");

    expect(middlewareCode).toContain("/private-beta");
    expect(middlewareCode).toContain("/login");
    expect(middlewareCode).toContain("/api/auth/callback");
    expect(middlewareCode).toContain("redirectUrl.pathname = '/private-beta'");
  });
});
