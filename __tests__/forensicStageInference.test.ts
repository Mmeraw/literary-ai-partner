/**
 * Forensic Stage Inference — unit tests
 *
 * Validates that the SIPOC Forensic View correctly infers stage results for
 * failed jobs using artifact evidence and phase highwater marks.
 *
 * Key scenario: A job with artifacts through pass12_handoff_v1 and
 * job.phase = "template_completeness_gate" should render earlier stages as
 * inferred_pass and Quality Gate as failed/expanded.
 */

// --- Inline the helpers from the route (these are not exported) ---

const SIPOC_STAGES = [
  { id: "intake", label: "Intake", authority: "SIPOC S01" },
  { id: "routing_chunking", label: "Routing & Chunking", authority: "SIPOC S02" },
  { id: "phase_0_5a_seed", label: "Phase 0.5A — Story Map Seed", authority: "SIPOC S03" },
  { id: "phase_0_5b_seed", label: "Phase 0.5B — Editorial Seed", authority: "SIPOC S04" },
  { id: "pass1a_validation", label: "Pass 1A — Seed Guard", authority: "SIPOC S05" },
  { id: "pass1_craft", label: "Pass 1 — Craft Analysis", authority: "SIPOC S06" },
  { id: "pass1_2_handoff", label: "S06b — Handoff Gate", authority: "SIPOC S06b, Volume III §III.PL5, Doctrine #13" },
  { id: "pass2_editorial", label: "Pass 2 — Editorial Synthesis", authority: "SIPOC S07" },
  { id: "pass3_synthesis", label: "Pass 3 — Final Synthesis", authority: "SIPOC S08" },
  { id: "quality_gate", label: "Quality Gate (Pass 4)", authority: "SIPOC S09, Volume III §III.QG" },
  { id: "persistence_report", label: "Persistence & Report", authority: "SIPOC S10" },
  { id: "renderer", label: "Renderer (Webpage/PDF/DOCX/TXT)", authority: "SIPOC S11" },
] as const;

type StageResult = "pass" | "inferred_pass" | "fail" | "skip" | "not_reached" | "retry_pass" | "retry_fail";

function normalizeStage(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("0.5a") || s.includes("0_5a") || s.includes("story_map_seed")) return "phase_0_5a_seed";
  if (s.includes("0.5b") || s.includes("0_5b") || s.includes("dream_seed") || s.includes("editorial_seed")) return "phase_0_5b_seed";
  if (s.includes("1a") || s.includes("seed_guard")) return "pass1a_validation";
  if (s.includes("handoff") || s.includes("s06b")) return "pass1_2_handoff";
  if (s.includes("pass1") || s.includes("pass_1") || s.includes("phase_1")) return "pass1_craft";
  if (s.includes("pass2") || s.includes("pass_2") || s.includes("phase_2")) return "pass2_editorial";
  if (s.includes("pass3") || s.includes("pass_3") || s.includes("phase_3")) return "pass3_synthesis";
  if (s.includes("pass4") || s.includes("quality") || s.includes("qg") || s.includes("template_completeness")) return "quality_gate";
  if (s.includes("persist") || s.includes("report") || s.includes("finali")) return "persistence_report";
  if (s.includes("render") || s.includes("download")) return "renderer";
  if (s.includes("routing") || s.includes("chunk")) return "routing_chunking";
  if (s.includes("intake") || s.includes("submit")) return "intake";
  return s;
}

const ARTIFACT_STAGE_MAP: Record<string, string> = {
  story_map_seed_v1: "phase_0_5a_seed",
  evaluation_seed_v1: "phase_0_5b_seed",
  full_context_story_ledger_v1: "pass1a_validation",
  editorial_dream_seed_v1: "phase_0_5b_seed",
  phase1a_chunk_routing_manifest_v1: "pass1a_validation",
  pass1a_chunk_cache_v1: "pass1a_validation",
  seed_contradiction_report_v1: "pass1a_validation",
  pass1a_character_ledger_v1: "pass1a_validation",
  pass1a_story_layer_v1: "pass1a_validation",
  ledger_quality_report_v1: "pass1a_validation",
  accepted_story_ledger_v1: "pass1_craft",
  pass1_chunk_cache_v1: "pass1_craft",
  pass12_handoff_v1: "pass1_2_handoff",
  pass2_chunk_cache_v1: "pass2_editorial",
  pass3_preflight_draft_v1: "pass3_synthesis",
  evaluation_result_v2: "persistence_report",
  pass_outputs_diagnostic_v1: "quality_gate",
  quality_gate_diagnostics_v1: "quality_gate",
  resume_blocked_v1: "quality_gate",
};

function getArtifactReachedStages(artifacts: Array<{ artifact_type: string }>): Set<string> {
  const reached = new Set<string>();
  for (const a of artifacts) {
    const stage = ARTIFACT_STAGE_MAP[a.artifact_type];
    if (stage) reached.add(stage);
  }
  return reached;
}

function getPhaseHighwaterIndex(phase: string): number {
  const normalized = normalizeStage(phase);
  const idx = SIPOC_STAGES.findIndex((s) => s.id === normalized);
  return idx >= 0 ? idx : -1;
}

/**
 * Core stage-result inference logic (mirrors route.ts behavior)
 */
function inferStageResult(
  spec: (typeof SIPOC_STAGES)[number],
  specIdx: number,
  opts: {
    jobStatus: string;
    failedStageRaw: string;
    hasLogs: boolean;
    hasError: boolean;
    hasTimeline: boolean;
    artifactReached: Set<string>;
    phaseHighwater: number;
    hasRetryEvents: boolean;
    retrySucceeded: boolean;
  }
): StageResult {
  const isFailedStage = normalizeStage(opts.failedStageRaw) === spec.id;

  if (isFailedStage && opts.jobStatus === "failed") {
    if (opts.hasRetryEvents) {
      return opts.retrySucceeded ? "retry_pass" : "retry_fail";
    }
    return "fail";
  }

  if (opts.hasLogs || opts.hasTimeline) {
    return opts.hasError ? "fail" : "pass";
  }

  if (opts.jobStatus === "complete") {
    const isRendererOrLater = specIdx >= SIPOC_STAGES.length - 1;
    if (!isRendererOrLater) return "pass";
    return "not_reached";
  }

  if (opts.jobStatus === "failed") {
    if (opts.artifactReached.has(spec.id)) {
      return "inferred_pass";
    }
    if (opts.phaseHighwater >= 0 && specIdx < opts.phaseHighwater) {
      return "inferred_pass";
    }
  }

  return "not_reached";
}

// --- Tests ---

describe("Forensic Stage Inference", () => {
  describe("normalizeStage", () => {
    it("maps template_completeness_gate to quality_gate", () => {
      expect(normalizeStage("template_completeness_gate")).toBe("quality_gate");
    });

    it("maps TEMPLATE_COMPLETENESS_GATE_FAILED to quality_gate", () => {
      expect(normalizeStage("TEMPLATE_COMPLETENESS_GATE_FAILED")).toBe("quality_gate");
    });

    it("maps pass4 to quality_gate", () => {
      expect(normalizeStage("pass4")).toBe("quality_gate");
    });

    it("maps quality_gate to quality_gate", () => {
      expect(normalizeStage("quality_gate")).toBe("quality_gate");
    });

    it("maps pass1_2_handoff variants correctly", () => {
      expect(normalizeStage("handoff")).toBe("pass1_2_handoff");
      expect(normalizeStage("s06b")).toBe("pass1_2_handoff");
    });
  });

  describe("getArtifactReachedStages", () => {
    it("identifies stages from artifact types", () => {
      const artifacts = [
        { artifact_type: "story_map_seed_v1" },
        { artifact_type: "evaluation_seed_v1" },
        { artifact_type: "pass12_handoff_v1" },
        { artifact_type: "pass2_chunk_cache_v1" },
      ];
      const reached = getArtifactReachedStages(artifacts);
      expect(reached.has("phase_0_5a_seed")).toBe(true);
      expect(reached.has("phase_0_5b_seed")).toBe(true);
      expect(reached.has("pass1_2_handoff")).toBe(true);
      expect(reached.has("pass2_editorial")).toBe(true);
      expect(reached.has("pass3_synthesis")).toBe(false);
    });
  });

  describe("getPhaseHighwaterIndex", () => {
    it("returns correct index for quality_gate phase", () => {
      const idx = getPhaseHighwaterIndex("template_completeness_gate");
      // quality_gate is at index 9
      expect(idx).toBe(9);
    });

    it("returns -1 for unknown phase", () => {
      expect(getPhaseHighwaterIndex("unknown_garbage")).toBe(-1);
    });
  });

  describe("Failed job with artifacts through pass12_handoff + phase=template_completeness_gate", () => {
    // This is the exact scenario from the bug fix:
    // Job 2446968a failed at quality_gate (template_completeness_gate),
    // but produced artifacts proving stages up through pass3 ran.
    const artifacts = [
      { artifact_type: "story_map_seed_v1" },
      { artifact_type: "evaluation_seed_v1" },
      { artifact_type: "full_context_story_ledger_v1" },
      { artifact_type: "editorial_dream_seed_v1" },
      { artifact_type: "phase1a_chunk_routing_manifest_v1" },
      { artifact_type: "pass1a_chunk_cache_v1" },
      { artifact_type: "seed_contradiction_report_v1" },
      { artifact_type: "pass1a_character_ledger_v1" },
      { artifact_type: "pass1a_story_layer_v1" },
      { artifact_type: "ledger_quality_report_v1" },
      { artifact_type: "accepted_story_ledger_v1" },
      { artifact_type: "pass1_chunk_cache_v1" },
      { artifact_type: "pass12_handoff_v1" },
      { artifact_type: "pass2_chunk_cache_v1" },
      { artifact_type: "pass3_preflight_draft_v1" },
      { artifact_type: "pass_outputs_diagnostic_v1" },
      { artifact_type: "quality_gate_diagnostics_v1" },
      { artifact_type: "resume_blocked_v1" },
    ];

    const artifactReached = getArtifactReachedStages(artifacts);
    const phaseHighwater = getPhaseHighwaterIndex("template_completeness_gate");

    const baseOpts = {
      jobStatus: "failed",
      failedStageRaw: "template_completeness_gate",
      hasLogs: false,
      hasError: false,
      hasTimeline: false,
      artifactReached,
      phaseHighwater,
      hasRetryEvents: false,
      retrySucceeded: false,
    };

    it("renders quality_gate as FAIL (the failed stage)", () => {
      const qualityGateSpec = SIPOC_STAGES[9]; // quality_gate
      const result = inferStageResult(qualityGateSpec, 9, baseOpts);
      expect(result).toBe("fail");
    });

    it("renders stages with artifact evidence as inferred_pass", () => {
      // pass1_2_handoff (index 6) has direct artifact evidence
      const handoffSpec = SIPOC_STAGES[6];
      const result = inferStageResult(handoffSpec, 6, baseOpts);
      expect(result).toBe("inferred_pass");
    });

    it("renders intake as inferred_pass via highwater (before quality_gate)", () => {
      // intake (index 0) has no artifact mapping but is before phaseHighwater(9)
      const intakeSpec = SIPOC_STAGES[0];
      const result = inferStageResult(intakeSpec, 0, baseOpts);
      expect(result).toBe("inferred_pass");
    });

    it("renders routing_chunking as inferred_pass via highwater", () => {
      const routingSpec = SIPOC_STAGES[1];
      const result = inferStageResult(routingSpec, 1, baseOpts);
      expect(result).toBe("inferred_pass");
    });

    it("renders persistence_report as not_reached (after failed stage)", () => {
      const persistSpec = SIPOC_STAGES[10]; // persistence_report
      const result = inferStageResult(persistSpec, 10, baseOpts);
      expect(result).toBe("not_reached");
    });

    it("renders renderer as not_reached (after failed stage)", () => {
      const rendererSpec = SIPOC_STAGES[11];
      const result = inferStageResult(rendererSpec, 11, baseOpts);
      expect(result).toBe("not_reached");
    });

    it("counts 9 passed/inferred stages and 1 failed", () => {
      const results = SIPOC_STAGES.map((spec, idx) =>
        inferStageResult(spec, idx, baseOpts)
      );
      const passed = results.filter((r) => r === "pass" || r === "inferred_pass");
      const failed = results.filter((r) => r === "fail");
      const notReached = results.filter((r) => r === "not_reached");

      expect(passed.length).toBe(9);
      expect(failed.length).toBe(1);
      expect(notReached.length).toBe(2);
    });

    it("correctly auto-expands quality_gate (the only failed stage)", () => {
      const results = SIPOC_STAGES.map((spec, idx) => ({
        id: spec.id,
        result: inferStageResult(spec, idx, baseOpts),
      }));
      const autoExpandIds = results
        .filter((s) => s.result === "fail" || s.result === "retry_fail")
        .map((s) => s.id);

      expect(autoExpandIds).toEqual(["quality_gate"]);
    });
  });

  describe("Completed job renders all stages as pass (not inferred)", () => {
    it("marks all stages as pass for a completed job", () => {
      const results = SIPOC_STAGES.slice(0, 11).map((spec, idx) =>
        inferStageResult(spec, idx, {
          jobStatus: "complete",
          failedStageRaw: "",
          hasLogs: false,
          hasError: false,
          hasTimeline: false,
          artifactReached: new Set<string>(),
          phaseHighwater: -1,
          hasRetryEvents: false,
          retrySucceeded: false,
        })
      );
      expect(results.every((r) => r === "pass")).toBe(true);
    });
  });

  describe("Stage with logs renders as pass (not inferred)", () => {
    it("prefers log evidence over artifact inference", () => {
      const spec = SIPOC_STAGES[6]; // pass1_2_handoff
      const result = inferStageResult(spec, 6, {
        jobStatus: "failed",
        failedStageRaw: "template_completeness_gate",
        hasLogs: true,
        hasError: false,
        hasTimeline: false,
        artifactReached: new Set(["pass1_2_handoff"]),
        phaseHighwater: 9,
        hasRetryEvents: false,
        retrySucceeded: false,
      });
      // Should be "pass" (log-proven), not "inferred_pass"
      expect(result).toBe("pass");
    });
  });
});
