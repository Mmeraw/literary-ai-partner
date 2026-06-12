process.env.EVAL_PASS_TIMEOUT_MS = "180000";
process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";

const fs = require("fs");
const path = require("path");

const {
  normalizeCriteria,
  normalizeOverviewFromAIResult,
  normalizeRecommendationsFromAIResult,
  isManuscriptTextLongEnough,
  getCalibrationProfile,
  assessEvaluationQuality,
  getValidatedWorkerBatchSize,
  resolveJobHardDeadlineMs,
  renewEvaluationJobLease,
  toPhaseV2ArtifactSet,
  derivePhaseV2ReviewGateProgress,
  shouldRequeueReviewGateBlock,
  shouldRequireStoryLedgerReviewGate,
} = require("../../../lib/evaluation/processor");
const { CRITERIA_KEYS } = require("../../../schemas/criteria-keys");

function buildCriterion(key: string, score: number) {
  return {
    key,
    score_0_10: score,
    rationale: `Rationale for ${key}`,
    evidence: [
      {
        snippet: `Evidence for ${key}`,
      },
    ],
    recommendations: [
      {
        priority: "medium",
        action: `Improve ${key}`,
        expected_impact: "Better quality",
      },
    ],
  };
}

function buildCriteriaSet(scoreByIndex?: (idx: number) => number, withEvidence = true) {
  return CRITERIA_KEYS.map((key: string, idx: number) => ({
    key,
    score_0_10: scoreByIndex ? scoreByIndex(idx) : 7,
    rationale: `Rationale ${key}`,
    evidence: withEvidence
      ? [{ snippet: `Concrete evidence snippet for ${key} with enough detail.` }]
      : [],
    recommendations: [
      {
        priority: "medium",
        action: `Improve ${key}`,
        expected_impact: "Improves quality",
      },
    ],
  }));
}

describe("normalizeCriteria", () => {
  test("normalizes object keyed by canonical criteria into ordered 13-item array", () => {
    const input = Object.fromEntries(
      [...CRITERIA_KEYS].reverse().map((key, idx) => [
        key,
        {
          score_0_10: (idx % 10) + 1,
          rationale: `Object rationale ${key}`,
          evidence: [{ snippet: `Object evidence ${key}` }],
          recommendations: [
            {
              priority: "high",
              action: `Object action ${key}`,
              expected_impact: "Object impact",
            },
          ],
        },
      ])
    );

    const output = normalizeCriteria(input);

    expect(output).toHaveLength(13);
    expect(output.map((c: any) => c.key)).toEqual(CRITERIA_KEYS);
    expect(output[0].score_0_10).toBeGreaterThan(0);
  });

  test("normalizes shuffled array order into canonical CRITERIA_KEYS order", () => {
    const shuffled = [...CRITERIA_KEYS]
      .slice()
      .reverse()
      .map((key, idx) => buildCriterion(key, (idx % 10) + 1));

    const output = normalizeCriteria(shuffled);

    expect(output).toHaveLength(13);
    expect(output.map((c: any) => c.key)).toEqual(CRITERIA_KEYS);
  });

  test("returns [] when any canonical key is missing (fail-closed)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const incomplete = Object.fromEntries(
      CRITERIA_KEYS.filter((key: string) => key !== "tone").map((key: string, idx: number) => [
        key,
        {
          score_0_10: (idx % 10) + 1,
          rationale: `Rationale ${key}`,
        },
      ])
    );

    const output = normalizeCriteria(incomplete);

    expect(output).toEqual([]);

    warn.mockRestore();
  });

  test("accepts legacy score field as number string and normalizes to score_0_10", () => {
    const input = Object.fromEntries(
      CRITERIA_KEYS.map((key: string) => [
        key,
        {
          score: "7/10",
          rationale: `Rationale ${key}`,
          evidence: [{ snippet: `Evidence ${key}` }],
          recommendations: [
            {
              priority: "medium",
              action: `Action ${key}`,
              expected_impact: `Impact ${key}`,
            },
          ],
        },
      ])
    );

    const output = normalizeCriteria(input);

    expect(output).toHaveLength(13);
    expect(output.every((c: any) => c.score_0_10 === 7)).toBe(true);
  });

  test("clamps out-of-range criterion scores", () => {
    const input = Object.fromEntries(
      CRITERIA_KEYS.map((key: string, idx: number) => [
        key,
        {
          score_0_10: idx % 2 === 0 ? 999 : -8,
          rationale: `Rationale ${key}`,
        },
      ])
    );

    const output = normalizeCriteria(input);

    expect(output).toHaveLength(13);
    expect(output.every((c: any) => c.score_0_10 >= 0 && c.score_0_10 <= 10)).toBe(true);
  });

  test("aggregates diagnostics for legacy/missing/clamped score handling", () => {
    const diagnostics = {
      usedLegacyScoreCount: 0,
      missingScoreCount: 0,
      clampedScoreCount: 0,
      overviewFallbackUsed: false,
      recommendationsFallbackUsed: false,
    };

    const input = Object.fromEntries(
      CRITERIA_KEYS.map((key: string, idx: number) => {
        if (idx < 5) {
          return [
            key,
            {
              score: "7/10",
              rationale: `Rationale ${key}`,
            },
          ];
        }

        if (idx < 9) {
          return [
            key,
            {
              score_0_10: 42,
              rationale: `Rationale ${key}`,
            },
          ];
        }

        return [
          key,
          {
            rationale: `Rationale ${key}`,
          },
        ];
      })
    );

    const output = normalizeCriteria(input, diagnostics);

    expect(output).toHaveLength(13);
    expect(diagnostics.usedLegacyScoreCount).toBe(5);
    expect(diagnostics.clampedScoreCount).toBe(4);
    expect(diagnostics.missingScoreCount).toBe(4);
  });
});

describe("normalizeOverviewFromAIResult", () => {
  test("supports top-level legacy shape and string overview", () => {
    const output = normalizeOverviewFromAIResult({
      verdict: "PASS",
      overall_score_0_100: "88",
      overview: "Strong narrative voice with commercial upside.",
      strengths: ["Voice", "Premise", "Pacing"],
      risks: ["Ending"],
    });

    expect(output.verdict).toBe("pass");
    expect(output.overall_score_0_100).toBe(88);
    expect(output.one_paragraph_summary).toMatch(/Strong narrative voice/);
    expect(output.top_3_strengths).toEqual(["Voice", "Premise", "Pacing"]);
    expect(output.top_3_risks).toEqual(["Ending"]);
  });

  test("falls back safely when overview fields are missing", () => {
    const diagnostics = {
      usedLegacyScoreCount: 0,
      missingScoreCount: 0,
      clampedScoreCount: 0,
      overviewFallbackUsed: false,
      recommendationsFallbackUsed: false,
    };
    const output = normalizeOverviewFromAIResult({}, diagnostics);

    expect(output.verdict).toBe("revise");
    expect(output.overall_score_0_100).toBe(70);
    expect(output.one_paragraph_summary).toBe("No summary available.");
    expect(diagnostics.overviewFallbackUsed).toBe(true);
  });
});

describe("normalizeRecommendationsFromAIResult", () => {
  test("maps suggestion/reason legacy fields to action/why", () => {
    const output = normalizeRecommendationsFromAIResult({
      recommendations: {
        quick_wins: [
          {
            suggestion: "Trim opening by 10%",
            reason: "Improves hook density",
            effort: "low",
            impact: "high",
          },
        ],
        strategic_revisions: [
          {
            action: "Reframe midpoint reversal",
            why: "Sharper causality",
            effort: "medium",
            impact: "high",
          },
        ],
      },
    });

    expect(output.quick_wins).toHaveLength(1);
    expect(output.quick_wins[0]).toEqual({
      action: "Trim opening by 10%",
      why: "Improves hook density",
      effort: "low",
      impact: "high",
    });
    expect(output.strategic_revisions).toHaveLength(1);
  });

  test("flags recommendation fallback when nothing usable is present", () => {
    const diagnostics = {
      usedLegacyScoreCount: 0,
      missingScoreCount: 0,
      clampedScoreCount: 0,
      overviewFallbackUsed: false,
      recommendationsFallbackUsed: false,
    };

    const output = normalizeRecommendationsFromAIResult({}, diagnostics);

    expect(output.quick_wins).toEqual([]);
    expect(output.strategic_revisions).toEqual([]);
    expect(diagnostics.recommendationsFallbackUsed).toBe(true);
  });
});

describe("isManuscriptTextLongEnough", () => {
  test("returns false for short text and true at threshold", () => {
    expect(isManuscriptTextLongEnough("one two three", 5)).toBe(false);
    expect(isManuscriptTextLongEnough("one two three four five", 5)).toBe(true);
    expect(isManuscriptTextLongEnough("  one   two   three   four   five  ", 5)).toBe(true);
  });
});

describe("getCalibrationProfile", () => {
  test("returns memoir profile for memoir work type", () => {
    const profile = getCalibrationProfile("Memoir");
    expect(profile.policyFamily).toBe("memoir");
    expect(profile.guidance.toLowerCase()).toContain("memoir");
  });

  test("returns poetry profile for poetry work type", () => {
    const profile = getCalibrationProfile("poetry");
    expect(profile.policyFamily).toBe("poetry");
  });

  test("falls back to standard profile", () => {
    const profile = getCalibrationProfile("novel");
    expect(profile.policyFamily).toBe("standard");
  });
});

describe("assessEvaluationQuality", () => {
  test("flags low-evidence and uniform-score patterns with confidence penalty", () => {
    const criteria = buildCriteriaSet(() => 7, false);
    const quality = assessEvaluationQuality(criteria);

    expect(quality.hasUniformScores).toBe(true);
    expect(quality.evidenceCoverageRatio).toBe(0);
    expect(quality.confidencePenalty).toBeGreaterThan(0);
    expect(quality.warnings.length).toBeGreaterThan(0);
  });

  test("keeps penalty near zero for healthy evidence and score spread", () => {
    const criteria = buildCriteriaSet((idx: number) => 3 + (idx % 6), true);
    const quality = assessEvaluationQuality(criteria);

    expect(quality.hasUniformScores).toBe(false);
    expect(quality.scoreSpread).toBeGreaterThan(1.5);
    expect(quality.evidenceCoverageRatio).toBe(1);
    expect(quality.confidencePenalty).toBe(0);
  });
});

describe("getValidatedWorkerBatchSize", () => {
  test("clamps invalid values to fallback", () => {
    expect(getValidatedWorkerBatchSize(undefined, 1)).toBe(1);
    expect(getValidatedWorkerBatchSize("0", 2)).toBe(2);
    expect(getValidatedWorkerBatchSize("999", 2)).toBe(2);
    expect(getValidatedWorkerBatchSize("not-a-number", 3)).toBe(3);
  });

  test("accepts bounded integer values", () => {
    expect(getValidatedWorkerBatchSize(1, 3)).toBe(1);
    expect(getValidatedWorkerBatchSize("5", 1)).toBe(5);
    expect(getValidatedWorkerBatchSize(3.9, 1)).toBe(3);
  });
});

describe("SLA helpers", () => {
  test("anchors hard deadline to started_at when started_at is valid", () => {
    const startedAt = "2026-04-24T19:07:55.650Z";
    const maxExecutionMs = 180000;

    const hardDeadlineMs = resolveJobHardDeadlineMs({
      startedAt,
      maxExecutionMs,
      fallbackNowMs: Date.parse("2026-04-24T20:00:00.000Z"),
    });

    expect(hardDeadlineMs).toBe(Date.parse(startedAt) + maxExecutionMs);
  });

  test("does not renew lease past hardDeadlineMs", async () => {
    const fixedNow = Date.parse("2026-04-24T19:07:55.650Z");
    const hardDeadlineMs = fixedNow + 1000;
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    const updateSpy = jest.fn();
    const eqStatusSpy = jest.fn().mockResolvedValue({ error: null });
    const eqIdSpy = jest.fn().mockReturnValue({
      eq: eqStatusSpy,
    });
    updateSpy.mockReturnValue({
      eq: eqIdSpy,
    });
    const supabase = {
      from: jest.fn().mockReturnValue({
        update: updateSpy,
      }),
    };

    await renewEvaluationJobLease({
      supabase,
      jobId: "job-lease-cap",
      leaseMs: 180000,
      stage: "test-stage",
      hardDeadlineMs,
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const payload = updateSpy.mock.calls[0][0];
    expect(payload).not.toHaveProperty('lease_expires_at');
    expect(payload.lease_until).toBeTruthy();
    expect(Date.parse(payload.lease_until)).toBeLessThanOrEqual(hardDeadlineMs);

    dateNowSpy.mockRestore();
  });
});

describe("Review Gate wiring helpers", () => {
  test("Story Ledger user-facing gate requires >= 25,000 words", () => {
    expect(shouldRequireStoryLedgerReviewGate(4412)).toBe(false);
    expect(shouldRequireStoryLedgerReviewGate(24999)).toBe(false);
    expect(shouldRequireStoryLedgerReviewGate(25000)).toBe(true);
    expect(shouldRequireStoryLedgerReviewGate(80000)).toBe(true);
    expect(shouldRequireStoryLedgerReviewGate(null)).toBe(false);
    expect(shouldRequireStoryLedgerReviewGate(undefined)).toBe(false);
  });

  test("maps phase v2 artifact refs from evaluation_artifacts rows using content.artifact_id fallback to row id", () => {
    const refs = toPhaseV2ArtifactSet([
      {
        artifact_type: "pass1a_story_layer_v1",
        id: "row-story",
        source_hash: "sha256:story",
        content: { artifact_id: "envelope-story" },
      },
      {
        artifact_type: "ledger_quality_report_v1",
        id: "row-quality",
        source_hash: "sha256:quality",
        content: {
          quality_report: {
            gate_ready_status: 'blocked',
            hard_fail_present: true,
          },
        },
      },
      {
        artifact_type: "pass3_preflight_draft_v1",
        id: "row-preflight",
        source_hash: "sha256:preflight",
        content: {
          artifact_id: "envelope-preflight",
          reducer_status: 'failed',
          preflight_authority: 'unavailable',
        },
      },
      {
        artifact_type: "pass12_handoff_v1",
        id: "handoff-artifact-id",
        source_hash: "handoff-source-hash",
        content: {
          artifact_type: "pass12_handoff_v1",
          handoff_type: "short_form_mode_bypass",
        },
      },
      {
        artifact_type: "accepted_story_ledger_v1",
        id: "accepted-ledger-artifact-id",
        source_hash: "accepted-ledger-source-hash",
        content: {
          artifact_type: "accepted_story_ledger_v1",
        },
      },
    ]);

    expect(refs.pass1a_story_layer_v1).toEqual({
      artifact_id: "envelope-story",
      source_hash: "sha256:story",
    });
    expect(refs.ledger_quality_report_v1).toEqual({
      artifact_id: "row-quality",
      source_hash: "sha256:quality",
    });
    expect(refs.pass3_preflight_draft_v1).toEqual({
      artifact_id: "envelope-preflight",
      source_hash: "sha256:preflight",
    });
    expect(refs.pass12_handoff_v1).toEqual({
      artifact_id: "handoff-artifact-id",
      source_hash: "handoff-source-hash",
    });
    expect(refs.accepted_story_ledger_v1).toEqual({
      artifact_id: "accepted-ledger-artifact-id",
      source_hash: "accepted-ledger-source-hash",
    });
    expect(refs.ledger_quality_gate_ready_status).toBe('blocked');
    expect(refs.ledger_quality_hard_fail_present).toBe(true);
    expect(refs.pass3_preflight_reducer_status).toBe('failed');
    expect(refs.pass3_preflight_authority).toBe('unavailable');
  });

  test("does not synthesize pass3a_completed_at when status is done and preflight artifact exists", () => {
    const doneDerived = derivePhaseV2ReviewGateProgress(
      {
        pass3a_status: "done",
        phase1a_batch_state: {
          preflight_status: "DONE",
        },
      },
      {
        hasPass3PreflightArtifact: true,
      },
    );

    expect(doneDerived.pass3a_status).toBe("done");
    expect(doneDerived.pass3a_completed_at).toBeUndefined();
  });

  test("does not synthesize degraded proof fields when degraded metadata is missing", () => {
    const degradedDerived = derivePhaseV2ReviewGateProgress(
      {
        pass3a_status: "degraded",
      },
      {
        hasPass3PreflightArtifact: false,
      },
    );

    expect(degradedDerived.pass3a_status).toBe("degraded");
    expect(degradedDerived.degraded_reason).toBeUndefined();
    expect(degradedDerived.degraded_reason_codes).toBeUndefined();
    expect(degradedDerived.degraded_at).toBeUndefined();
  });

  test("derives Pass 3A status from legacy preflight and artifact fallback only", () => {
    const doneFromLegacy = derivePhaseV2ReviewGateProgress(
      {
        phase1a_batch_state: {
          preflight_status: "DONE",
        },
      },
      {
        hasPass3PreflightArtifact: false,
      },
    );

    expect(doneFromLegacy.pass3a_status).toBe("done");

    const doneFromArtifactFallback = derivePhaseV2ReviewGateProgress(
      {
        phase1a_batch_state: {
          preflight_status: "NOT_STARTED",
        },
      },
      {
        hasPass3PreflightArtifact: true,
      },
    );

    expect(doneFromArtifactFallback.pass3a_status).toBe("done");
  });

  test("forces pass3a failed when preflight reducer failed even if artifact exists", () => {
    const failedFromReducer = derivePhaseV2ReviewGateProgress(
      {
        pass3a_status: 'done',
      },
      {
        hasPass3PreflightArtifact: true,
        reducerStatus: 'failed',
        preflightAuthority: 'unavailable',
      },
    );

    expect(failedFromReducer.pass3a_status).toBe('failed');
    expect(failedFromReducer.failed_reason).toBe('PASS3A_REDUCER_FAILED');
  });

  test("requeue policy only allows not-ready Pass3A blocks (technical blocks kick forward)", () => {
    expect(shouldRequeueReviewGateBlock("PASS3A_NOT_READY", "not_ready")).toBe(true);
    expect(shouldRequeueReviewGateBlock("PASS3A_HALF_WRITTEN", "not_ready")).toBe(true);

    // REVIEW_GATE_QUALITY_TECHNICAL_BLOCK no longer requeues — kicks forward instead
    expect(shouldRequeueReviewGateBlock("REVIEW_GATE_QUALITY_TECHNICAL_BLOCK", "gate_blocking")).toBe(false);

    expect(shouldRequeueReviewGateBlock("PASS3A_FAILED_BLOCKING", "gate_blocking")).toBe(false);
    expect(shouldRequeueReviewGateBlock("PASS3A_ARTIFACT_MISSING", "gate_blocking")).toBe(false);
    expect(shouldRequeueReviewGateBlock("PASS3A_COMPLETION_METADATA_MISSING", "gate_blocking")).toBe(false);
    expect(shouldRequeueReviewGateBlock("PASS3A_DEGRADED_PROOF_MISSING", "gate_blocking")).toBe(false);

    expect(shouldRequeueReviewGateBlock("PASS3A_NOT_READY", "gate_blocking")).toBe(false);
  });

  test("blocked review gate path preserves incoming preflight truth and supports fail-closed terminal blocks", () => {
    const processorPath = path.join(__dirname, "../../../lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    const blockedStart = processorCode.indexOf("if (reviewGateHandoffResult.ok === false)");
    const blockedEnd = processorCode.indexOf("const phase1aHandoffProgress =", blockedStart);

    expect(blockedStart).toBeGreaterThan(-1);
    expect(blockedEnd).toBeGreaterThan(blockedStart);

    const blockedSection = processorCode.slice(blockedStart, blockedEnd);

    expect(blockedSection).not.toContain("preflight_status: 'DONE'");
    expect(blockedSection).toContain("shouldRequeueReviewGateBlock(");
    expect(blockedSection).toContain("status: JOB_STATUS.FAILED");
    expect(blockedSection).toContain("status: JOB_STATUS.QUEUED");
  });

  test("short-form bypass path explicitly handles retryable technical gate blocks", () => {
    const processorPath = path.join(__dirname, "../../../lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    expect(processorCode).toContain("shortFormTechnicalBlockBypass");
    expect(processorCode).toContain("REVIEW_GATE_QUALITY_TECHNICAL_BLOCK");
    expect(processorCode).toContain("review_gate_skipped_short_form_technical_block");
    expect(processorCode).toContain("manuscript_under_25000_words_retryable_technical_block");
  });

  test("default phase_2 to phase_3 queue path requires durable pass12 handoff", () => {
    const processorPath = path.join(__dirname, "../../../lib/evaluation/processor.ts");
    const processorCode = fs.readFileSync(processorPath, "utf8");

    const defaultQueueStart = processorCode.indexOf("// Default path (phase_2 → queue phase_3 for next invocation).");
    const defaultQueueEnd = processorCode.indexOf("if (phase3QueueErr)", defaultQueueStart);

    expect(defaultQueueStart).toBeGreaterThan(-1);
    expect(defaultQueueEnd).toBeGreaterThan(defaultQueueStart);

    const defaultQueueSection = processorCode.slice(defaultQueueStart, defaultQueueEnd);
    const guardIndex = defaultQueueSection.indexOf("assertPass12HandoffExistsBeforePhase3Queue(");
    const updateIndex = defaultQueueSection.indexOf("status: JOB_STATUS.QUEUED");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(guardIndex);
  });
});
