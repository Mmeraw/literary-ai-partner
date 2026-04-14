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

  test("run-phase2 API routes are pure queue triggers (no inline execution)", () => {
    const runPhase2Routes = [
      "app/api/admin/jobs/[jobId]/run-phase2/route.ts",
      "app/api/jobs/[jobId]/run-phase2/route.ts",
    ];

    for (const relativePath of runPhase2Routes) {
      const filePath = path.join(repoRoot, relativePath);
      const code = fs.readFileSync(filePath, "utf8");

      // Routes must NOT inline-execute the pipeline
      expect(code).not.toContain("processEvaluationJob");
      expect(code).not.toContain("@/lib/evaluation/processor");
      expect(code).not.toContain("runPhase2Aggregation");
      expect(code).not.toContain("@/lib/jobs/phase2");
      // Routes must write canonical phase_2 queue state
      expect(code).toContain('phase: "phase_2"');
      expect(code).toContain('phase_status: "queued"');
      // Non-force updates must use CAS predicates (no loose update-by-id)
      expect(code).toContain('.eq("status", "running")');
      expect(code).toContain('.eq("phase", "phase_1")');
      expect(code).toContain('.eq("phase_status", "complete")');
      expect(code).toContain("canonical_pipeline_queued");
      expect(code).toContain("status: 202");
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

  test("scripts using runPipeline do not access legacy PipelineResult.criteria", () => {
    const scriptsRoot = path.join(repoRoot, "scripts");

    const collectTsFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectTsFiles(fullPath));
          continue;
        }
        if (entry.isFile() && fullPath.endsWith(".ts")) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const tsFiles = collectTsFiles(scriptsRoot);
    const violatingFiles = [];

    for (const filePath of tsFiles) {
      const code = fs.readFileSync(filePath, "utf8");

      if (!code.includes("runPipeline(")) {
        continue;
      }

      if (/(pipelineResult|result)\.criteria\b/.test(code)) {
        violatingFiles.push(path.relative(repoRoot, filePath));
      }
    }

    expect(violatingFiles).toEqual([]);
  });

  test("evaluation runtime uses canonical job status vocabulary (never 'completed')", () => {
    const rootsToScan = [
      path.join(repoRoot, "lib/evaluation"),
      path.join(repoRoot, "app/api/jobs"),
      path.join(repoRoot, "app/api/admin/jobs"),
      path.join(repoRoot, "app/api/workers/process-evaluations"),
      path.join(repoRoot, "workers"),
    ];

    const collectCodeFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) {
        return [];
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectCodeFiles(fullPath));
          continue;
        }

        if (entry.isFile() && /\.(ts|tsx)$/.test(fullPath)) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const runtimeFiles = rootsToScan.flatMap(collectCodeFiles);
    const violations: Array<{ file: string; reason: string }> = [];

    for (const filePath of runtimeFiles) {
      const code = fs.readFileSync(filePath, "utf8");

      if (/status\s*:\s*['\"]completed['\"]/.test(code)) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          reason: "contains status: 'completed'",
        });
      }

      if (/phase_status\s*:\s*['\"]completed['\"]/.test(code)) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          reason: "contains phase_status: 'completed'",
        });
      }
    }

    expect(violations).toEqual([]);
  });

  test("processor uses strict discriminated union narrowing for PipelineResult (ok === false, not !ok)", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    // Must use strict equality check so TypeScript narrows the union under strict:false
    expect(processorCode).toContain("pipelineResult.ok === false");
    // Must NOT use the negation form which does not narrow under strict:false
    expect(processorCode).not.toContain("if (!pipelineResult.ok)");
  });
});
