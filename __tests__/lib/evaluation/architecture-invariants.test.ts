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

      expect(code).not.toContain("processEvaluationJob");
      expect(code).not.toContain("@/lib/evaluation/processor");
      expect(code).not.toContain("runPhase2Aggregation");
      expect(code).not.toContain("@/lib/jobs/phase2");
      expect(code).toContain('phase: "phase_2"');
      expect(code).toContain('phase_status: "queued"');
      expect(code).toContain('.eq("status", "running")');
      expect(code).toContain('.eq("phase", "phase_1a")');
      expect(code).not.toContain('.eq("phase_status", "complete")');
      expect(code).toContain("canonical_pipeline_queued");
      expect(code).toContain("status: 202");
    }
  });

  test("worker entrypoint is wired to canonical processor queue path", () => {
    const workerRoutePath = path.join(repoRoot, "app/api/workers/process-evaluations/route.ts");
    const code = fs.readFileSync(workerRoutePath, "utf8");

    expect(code).toContain("processQueuedJobs");
    expect(code).toContain("@/lib/evaluation/processor");
    expect(code).not.toContain("phase2Worker");
    expect(code).not.toContain("phase2Evaluation");
    expect(code).not.toContain("@/lib/jobs/phase2");
  });

  test("canonical createJob writes top-level phase fields for claim eligibility", () => {
    const storePath = path.join(repoRoot, "lib/jobs/jobStore.supabase.ts");
    const code = fs.readFileSync(storePath, "utf8");

    expect(code).toContain("phase: PHASES.PHASE_1A");
    expect(code).toContain("phase_status: JOB_STATUS.QUEUED");
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

  test("public homepage is native app-router page, not marketing-export redirect", () => {
    const homePagePath = path.join(repoRoot, "app/page.tsx");
    const homePageCode = fs.readFileSync(homePagePath, "utf8");

    expect(homePageCode).not.toContain("/marketing-export/main/index.html");
    expect(homePageCode).not.toContain("redirect(");
  });

  test("next config does not rewrite home or revise into marketing-export", () => {
    const nextConfigPath = path.join(repoRoot, "next.config.mjs");
    const nextConfigCode = fs.readFileSync(nextConfigPath, "utf8");

    const forbiddenStaticRouteRewrites = [
      /source:\s*["']\/["'][\s\S]*destination:\s*["']\/marketing-export\/main\/index\.html["']/,
      /source:\s*["']\/revise["'][\s\S]*destination:\s*["']\/marketing-export\/revise\/index\.html["']/,
    ];

    for (const pattern of forbiddenStaticRouteRewrites) {
      expect(nextConfigCode).not.toMatch(pattern);
    }
  });

  test("middleware gates only protected app/workflow routes", () => {
    const middlewarePath = path.join(repoRoot, "middleware.ts");
    const middlewareCode = fs.readFileSync(middlewarePath, "utf8");

    expect(middlewareCode).toContain("protectedPrefixes");
    expect(middlewareCode).toContain("/dashboard");
    expect(middlewareCode).toContain("/evaluate");
    expect(middlewareCode).toContain("/workbench");
    expect(middlewareCode).toContain("/private-beta");
    expect(middlewareCode).toContain("/reliability");
    expect(middlewareCode).toContain("/methodology");
    expect(middlewareCode).toContain("/privacy");
    expect(middlewareCode).toContain("/terms");
    expect(middlewareCode).toContain("/contact");
    expect(middlewareCode).not.toContain("/marketing-export");
    expect(middlewareCode).toContain("/revise");
    expect(middlewareCode).toContain("/login");
    expect(middlewareCode).toContain("/api/auth/callback");
    expect(middlewareCode).toContain("redirectUrl.pathname = '/private-beta'");
    expect(middlewareCode).toContain("if (basePath === '/') return pathname === '/'");
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
        violations.push({ file: path.relative(repoRoot, filePath), reason: "contains status: 'completed'" });
      }

      if (/phase_status\s*:\s*['\"]completed['\"]/.test(code)) {
        violations.push({ file: path.relative(repoRoot, filePath), reason: "contains phase_status: 'completed'" });
      }
    }

    expect(violations).toEqual([]);
  });

  test("processor uses strict discriminated union narrowing for PipelineResult (ok === false, not !ok)", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    expect(processorCode).toContain("pipelineResult.ok === false");
    expect(processorCode).not.toContain("if (!pipelineResult.ok)");
  });
});
