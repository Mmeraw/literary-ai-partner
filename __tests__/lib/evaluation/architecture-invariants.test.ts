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

  test("recommendation-disposition runtime has one authority and no purged fallbacks", () => {
    const collectLiveRuntimeFiles = (relativeRoot: string): string[] => {
      const absoluteRoot = path.join(repoRoot, relativeRoot);
      if (!fs.existsSync(absoluteRoot)) return [];

      const collected: string[] = [];
      const visit = (absolutePath: string) => {
        for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
          const child = path.join(absolutePath, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === "__tests__") continue;
            visit(child);
            continue;
          }
          if (!/\.(?:ts|tsx)$/.test(entry.name)) continue;
          if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) continue;
          collected.push(path.relative(repoRoot, child).replaceAll("\\", "/"));
        }
      };
      visit(absoluteRoot);
      return collected;
    };

    const protectedRuntimeFiles = [
      ...collectLiveRuntimeFiles("lib/evaluation"),
      ...collectLiveRuntimeFiles("workers"),
      ...collectLiveRuntimeFiles("app/api"),
    ];

    const purgedAuthorityPatterns = [
      /\blegacy_read\b/,
      /\bcontractMode\b/,
      /\brecoverHandoffRecommendationsFromChunkCache\b/,
      /\bMISSING_TOP_RECOMMENDATIONS\b/,
      /\bNO_RECOMMENDATIONS\b/,
      /\bINVALID_HIGH_SCORE_RECOMMENDATIONS\b/,
      /\bisMeaningfulRecommendation\b/,
      /\bcountMeaningfulRecommendations\b/,
    ];

    const violations: Array<{ file: string; authority: string }> = [];
    for (const relativePath of protectedRuntimeFiles) {
      const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      for (const pattern of purgedAuthorityPatterns) {
        if (pattern.test(code)) {
          violations.push({ file: relativePath, authority: pattern.source });
        }
      }
    }
    expect(violations).toEqual([]);

    const canonicalConsumers: Record<string, string[]> = {
      "lib/evaluation/artifactConsistencyGate.ts": [
        "countMeaningfulOpportunityRecommendations",
        "hasGovernedOpportunityCoverage",
      ],
      "lib/evaluation/pipeline/evaluationCertificationGate.ts": [
        "analyzeGovernedOpportunityCoverage",
        "countMeaningfulOpportunityRecommendations",
      ],
      "lib/evaluation/pipeline/runPass2.ts": [
        "analyzeGovernedOpportunityCoverage",
        "countMeaningfulOpportunityRecommendations",
      ],
      "lib/evaluation/pipeline/runPass3Synthesis.ts": [
        "analyzeGovernedOpportunityCoverage",
        "countMeaningfulOpportunityRecommendations",
        "reconcileRecommendationDispositionAfterMutation",
      ],
      "lib/evaluation/pipeline/runPipeline.ts": [
        "countMeaningfulOpportunityRecommendations",
        "reconcileRecommendationDispositionAfterMutation",
      ],
      "lib/evaluation/pipeline/templateCompletenessGate.ts": [
        "analyzeGovernedOpportunityCoverage",
        "countMeaningfulOpportunityRecommendations",
      ],
      "lib/evaluation/persistEvaluationResultV2.ts": [
        "analyzeGovernedOpportunityCoverage",
        "countMeaningfulOpportunityRecommendations",
      ],
      "lib/evaluation/signal/criterionObservability.ts": [
        "analyzeGovernedOpportunityCoverage",
        "countMeaningfulOpportunityRecommendations",
        "reconcileRecommendationDispositionAfterMutation",
      ],
    };

    for (const [relativePath, requiredAuthorities] of Object.entries(canonicalConsumers)) {
      const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(code).toContain("@/lib/evaluation/policy/opportunityDiscoveryPolicy");
      for (const authority of requiredAuthorities) {
        expect(code).toMatch(new RegExp(`\\b${authority}\\s*\\(`));
      }
    }
  });

  test("current recommendation writes cross the sole canonical narrowing bridge", () => {
    const strictTypeAuthorities: Record<string, string[]> = {
      "lib/evaluation/pipeline/types.ts": [
        "CurrentPass2Output",
        "CurrentSynthesisOutput",
      ],
      "schemas/evaluation-result-v2.ts": ["CurrentEvaluationResultV2"],
      "lib/evaluation/pipeline/runPass2.ts": [
        "CurrentPass2Output",
        "requireCurrentRecommendationDisposition",
      ],
      "lib/evaluation/pipeline/runPass3Synthesis.ts": [
        "CurrentSynthesisOutput",
        "requireCurrentRecommendationDisposition",
      ],
      "lib/evaluation/pipeline/runPipeline.ts": [
        "CurrentEvaluationResultV2",
        "requireCurrentRecommendationDisposition",
      ],
      "lib/evaluation/persistEvaluationResultV2.ts": [
        "CurrentEvaluationResultV2",
        "requireCurrentRecommendationDisposition",
      ],
      "lib/evaluation/processor.ts": ["requireCurrentEvaluationResultWrite"],
    };

    for (const [relativePath, requiredAuthorities] of Object.entries(strictTypeAuthorities)) {
      const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      for (const authority of requiredAuthorities) {
        expect(code).toContain(authority);
      }
      expect(code).not.toMatch(/\bas\s+(?:unknown\s+as\s+)?Current(?:Pass2|Synthesis|EvaluationResult|RecommendationDisposition)/);
    }

    const policyCode = fs.readFileSync(
      path.join(repoRoot, "lib/evaluation/policy/opportunityDiscoveryPolicy.ts"),
      "utf8",
    );
    expect(policyCode.match(/as unknown as WithCurrentRecommendationDisposition/g)).toHaveLength(1);
  });

  test("current-write result integration suites cannot bypass the strict fixture", () => {
    const processorSuites = [
      "__tests__/lib/evaluation/processor.canonical-pipeline.test.ts",
      "__tests__/lib/evaluation/processor.chunk-routing.test.ts",
      "__tests__/lib/evaluation/processor.contamination-guard.test.ts",
      "__tests__/smoke/short-form-kickback.submit-smoke.test.ts",
    ];

    for (const relativePath of processorSuites) {
      const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(code).toContain("makeCurrentProcessorEvaluationResult");
      expect(code).toContain("currentProcessorEvaluationResult");
    }

    const canonicalSuite = fs.readFileSync(
      path.join(repoRoot, processorSuites[0]),
      "utf8",
    );
    expect(canonicalSuite).toMatch(
      /synthesisToEvaluationResultV2:[\s\S]*mockCurrentProcessorEvaluationResult\(synthesisToEvaluationResultV2Mock/,
    );
  });

  test("current-write integration suites share strict current synthesis authority", () => {
    const realSynthesisSuites = [
      "__tests__/lib/config/evaluation-pass-routing.test.ts",
      "__tests__/lib/evaluation/criminality-v2-regression.test.ts",
      "__tests__/lib/evaluation/englishVariantResolved.test.ts",
      "__tests__/lib/evaluation/pipeline/confidenceLevelPolicy.test.ts",
      "__tests__/lib/evaluation/pipeline/external-adjudication-status.test.ts",
      "__tests__/lib/evaluation/pipeline/long-form-certification-hardening.test.ts",
      "__tests__/lib/evaluation/pipeline/yellowWallpaperSynthesisToResultV2.test.ts",
      "__tests__/lib/evaluation/processor.real-gate.test.ts",
      "__tests__/lib/evaluation/processor.adjudication-ecg-failure-codes.test.ts",
      "tests/evaluation/pipeline/pipeline-independence.test.ts",
    ];

    for (const relativePath of realSynthesisSuites) {
      const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(code).toContain("makeCurrentProcessorSynthesisOutput");
      expect(code).not.toContain("makeRealSynthesisOutput");
    }
  });

  test("raw Pass 3 success fixtures cannot bypass canonical disposition construction", () => {
    const rawPass3Suites = [
      "__tests__/lib/evaluation/pipeline/pass3-backfill-quality.test.ts",
      "__tests__/lib/evaluation/pipeline/pass3-editorial-specificity-triple.test.ts",
      "lib/evaluation/pipeline/__tests__/pass3-truncation-retry.test.ts",
      "__tests__/lib/evaluation/pipeline/prose-control-anchor-floor.test.ts",
      "tests/lib/evaluation/packet-evidence-consumption.test.ts",
      "tests/lib/evaluation/pipeline/pass3-clamp-stranded-connector.test.ts",
      "tests/lib/evaluation/pipeline/pass3-recommendation-length.test.ts",
      "tests/lib/evaluation/pipeline/surface-integrity.test.ts",
    ];

    for (const relativePath of rawPass3Suites) {
      const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(code).toMatch(/buildCurrentRawPass3(?:Response|Criterion|Json)/);
      expect(code).toContain("currentPass3Response");
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

    expect(code).toContain("phase: PHASES.PHASE_0");
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
    expect(middlewareCode).toContain("/reliability");
    expect(middlewareCode).toContain("/methodology");
    expect(middlewareCode).toContain("/privacy");
    expect(middlewareCode).toContain("/terms");
    expect(middlewareCode).toContain("/contact");
    expect(middlewareCode).not.toContain("/marketing-export");
    expect(middlewareCode).toContain("/revise");
    expect(middlewareCode).toContain("/login");
    expect(middlewareCode).toContain("/api/auth/callback");
    expect(middlewareCode).toContain("redirectUrl.pathname = '/login'");
    expect(middlewareCode).toContain("redirectUrl.pathname = '/dashboard'");
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

      if (/status\s*:\s*['"]completed['"]/.test(code)) {
        violations.push({ file: path.relative(repoRoot, filePath), reason: "contains status: 'completed'" });
      }

      if (/phase_status\s*:\s*['"]completed['"]/.test(code)) {
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

  test("processor does not persist non-canonical progress phase_status='blocked'", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    expect(processorCode).not.toContain("phase_status: 'blocked'");
  });

  test("phase_1a review gate handoff is wired through phase-architecture-v2 helper", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    expect(processorCode).toContain("@/lib/evaluation/phase-architecture-v2/reviewGateHandoff");
    expect(processorCode).toContain("buildReviewGateHandoff(");
  });

  test("phase_1a handoff update treats stale-worker 0-row races as benign", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    const handoffStart = processorCode.indexOf("const { data: phase1aHandoffRow, error: phase1aHandoffErr } = await supabase");
    const handoffEnd = processorCode.indexOf("if (phase1aHandoffErr)", handoffStart);
    expect(handoffStart).toBeGreaterThan(-1);
    expect(handoffEnd).toBeGreaterThan(handoffStart);

    const handoffUpdate = processorCode.slice(handoffStart, handoffEnd);
    expect(handoffUpdate).toContain(".maybeSingle()");
    expect(handoffUpdate).not.toContain(".single()");
  });

  test("admin reset RPC clears full claim ownership metadata", () => {
    const migrationPath = path.join(repoRoot, "supabase/migrations/20260524120000_fix_admin_reset_to_phase0.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain("claimed_by           = NULL");
    expect(migrationSql).toContain("claimed_at           = NULL");
    expect(migrationSql).toContain("lease_token          = NULL");
    expect(migrationSql).toContain("lease_until          = NULL");
  });

  // ── Gate 15 blocking policy invariants ──────────────────────────────────
  // Gate 15 is a pre-persistence invariant: it must run BEFORE
  // persistEvaluationResultV2 and must never exist as a post-completion
  // lifecycle mutation.

  /** Extract text between two section markers (or to end of file if no end marker). */
  function sectionBetween(source: string, startMarker: string, endMarker?: string): string {
    const startIdx = source.indexOf(startMarker);
    if (startIdx === -1) return "";
    const endIdx = endMarker ? source.indexOf(endMarker, startIdx + startMarker.length) : -1;
    return endIdx > startIdx
      ? source.substring(startIdx, endIdx)
      : source.substring(startIdx);
  }

  test("pre-persistence gate ordering: Artifact Consistency < Gate 15 (advisory) < persistenceLock < persistEvaluationResultV2", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    // All four landmarks must exist
    const artifactConsistencyIdx = processorCode.indexOf("Artifact Consistency Gate v1");
    const gate15Idx = processorCode.indexOf("Gate 15 Pre-Finalization Advisory");
    const persistLockIdx = processorCode.indexOf("declarePersistenceLock('persistence/after-template-completeness')");
    const persistRpcIdx = processorCode.indexOf("await persistEvaluationResultV2(");
    expect(artifactConsistencyIdx).toBeGreaterThan(-1);
    expect(gate15Idx).toBeGreaterThan(-1);
    expect(persistLockIdx).toBeGreaterThan(-1);
    expect(persistRpcIdx).toBeGreaterThan(-1);

    // Strict ordering: Artifact Consistency < Gate 15 (advisory) < persistence lock < persistEvaluationResultV2
    expect(artifactConsistencyIdx).toBeLessThan(gate15Idx);
    expect(gate15Idx).toBeLessThan(persistLockIdx);
    expect(persistLockIdx).toBeLessThan(persistRpcIdx);
  });

  test("Gate 15 advisory section: runs audit, persists artifact, but does NOT block evaluation", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    // The Gate 15 section (between header and persistence lock) must exist
    const preRpcSection = sectionBetween(
      processorCode,
      "Gate 15 Pre-Finalization Advisory",
      "declarePersistenceLock('persistence/after-template-completeness')",
    );
    expect(preRpcSection.length).toBeGreaterThan(0);

    // Must call runGate15Audit
    expect(preRpcSection).toContain("runGate15Audit(manuscriptText");

    // Must persist the artifact
    expect(preRpcSection).toContain("gate_15_audit_v1");
    expect(preRpcSection).toContain("upsertEvaluationArtifact");

    // Must be advisory-only: no markFailed, no return success:false
    expect(preRpcSection).not.toContain("markFailed(");
    expect(preRpcSection).not.toContain("success: false");
    expect(preRpcSection).not.toContain("GATE 15 BLOCKED");

    // Must declare advisory_only in the persisted artifact
    expect(preRpcSection).toContain("advisory_only: true");
    expect(preRpcSection).toContain("ADVISORY FAIL (non-blocking)");
  });

  test("Canon Governance advisory section (Phase 3 WAVE path): no lifecycle mutations for Gate 15", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    // Section bounded: from advisory header to the Finalization Quality Guard header
    const advisorySection = sectionBetween(
      processorCode,
      "Canon Governance Runner (advisory \u2014 Gate 15 blocking is pre-RPC)",
      "Finalization Quality Guard (Phase 3 / WAVE-only path)",
    );
    expect(advisorySection.length).toBeGreaterThan(0);

    // This section must NOT contain any lifecycle-mutating Gate 15 patterns
    expect(advisorySection).not.toContain("QUALITY_GATE15_FAILED");
    expect(advisorySection).not.toContain("quality_issue_detected");
    expect(advisorySection).not.toContain("markFailed");
    expect(advisorySection).not.toContain("GATE15_MECHANICAL_PURITY_FAILED");
  });

  test("Canon Governance advisory section (inline path): no lifecycle mutations for Gate 15", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    // Section bounded: from inline advisory header to the next return statement
    const inlineAdvisorySection = sectionBetween(
      processorCode,
      "Canon Governance Runner (advisory layers \u2014 Gate 15 already ran pre-RPC)",
      "evaluation already finalized via atomic RPC",
    );
    expect(inlineAdvisorySection.length).toBeGreaterThan(0);

    // This section must NOT contain any lifecycle-mutating Gate 15 patterns
    expect(inlineAdvisorySection).not.toContain("QUALITY_GATE15_FAILED");
    expect(inlineAdvisorySection).not.toContain("quality_issue_detected");
    expect(inlineAdvisorySection).not.toContain("markFailed");
    expect(inlineAdvisorySection).not.toContain("GATE15_MECHANICAL_PURITY_FAILED");
  });

  test("Finalization Quality Guard section: no QUALITY_GATE15_FAILED violation", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    // Section bounded: from Finalization Quality Guard header to the next major section
    // (phase_3 WAVE complete log or PHASE 1A header)
    const fqgSection = sectionBetween(
      processorCode,
      "Finalization Quality Guard (Phase 3 / WAVE-only path)",
      "phase_3 WAVE complete",
    );
    expect(fqgSection.length).toBeGreaterThan(0);

    // Must not contain any Gate 15 violation code
    expect(fqgSection).not.toContain("QUALITY_GATE15_FAILED");
    expect(fqgSection).not.toContain("GATE15_MECHANICAL_PURITY_FAILED");
  });

  test("no stale comments about Gate 15 feeding into post-completion guards", () => {
    const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    expect(processorCode).not.toContain("Gate 15 FAIL now feeds into the Finalization Quality Guard");
    expect(processorCode).not.toContain("Gate 15 FAIL now feeds into the Quality Guard");
    // QUALITY_GATE15_FAILED must not exist anywhere in processor.ts
    expect(processorCode).not.toContain("QUALITY_GATE15_FAILED");
  });
});
