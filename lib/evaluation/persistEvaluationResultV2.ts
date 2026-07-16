import { buildPhaseLogPatch } from '@/lib/evaluation/phaseLog';
import { getGateFailurePolicy, buildRetryContext, buildQuarantineArtifact } from '@/lib/evaluation/pipeline/selfCorrectionPolicy';
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationResultV2, ScoreAdjustmentV2 } from "@/schemas/evaluation-result-v2";
import { JOB_STATUS, type JobStatus } from "@/lib/jobs/types";
import {
  normalizeEvaluationJobStatus,
  normalizeEvaluationValidityStatus,
} from "@/lib/evaluation/status";
import { validateEvaluationArtifact as validateStructuralArtifact } from "@/lib/evaluation/validateEvaluationArtifact";
import { deriveConfidence, type ConfidenceResult } from "@/lib/governance/confidenceDerivation";
import { buildExcellenceFilter } from "@/lib/evaluation/pipeline/buildExcellenceFilter";
import { buildScoreLedger, computeAuthorityComposite } from "@/lib/evaluation/pipeline/buildScoreLedger";
import type { ArtifactGateResult, ArtifactValidationSummary, EvaluationArtifact } from "@/lib/evaluation/pipeline/types";
import { validateEvaluationArtifact } from "@/lib/evaluation/pipeline/validateEvaluationArtifact";
import { EVALUATION_ARTIFACT_VALIDATION_FAILED } from "@/lib/evaluation/pipeline/failures";
import {
  assertReportPersistenceAllowed,
  runEvaluationBackwardRelook,
  type EvaluationBackwardRelookDecision,
} from "@/lib/evaluation/backwardRelook";
import { applyShortFormEvidenceGate, runShortFormEvidenceGate } from "@/lib/evaluation/pipeline/shortFormEvidenceGate";
import { runShortFormFinalSanityCheck } from "@/lib/evaluation/pipeline/shortFormFinalSanityCheck";
import { mistakeProofText } from "@/lib/evaluation/reportRenderSafety";
import { FORBIDDEN_PATTERNS, getForbiddenCodes } from "@/lib/evaluation/reportForbiddenPatterns";

function assertPersistableEvaluationResultShape(evaluationResult: EvaluationResultV2): void {
  const missing: string[] = [];

  if (evaluationResult.schema_version !== "evaluation_result_v2") {
    missing.push("schema_version=evaluation_result_v2");
  }
  if (!evaluationResult.engine || typeof evaluationResult.engine.model !== "string" || evaluationResult.engine.model.trim().length === 0) {
    missing.push("engine.model");
  }
  if (!evaluationResult.overview || typeof evaluationResult.overview.one_paragraph_summary !== "string") {
    missing.push("overview.one_paragraph_summary");
  }
  if (!Array.isArray(evaluationResult.criteria)) {
    missing.push("criteria[]");
  }
  if (!evaluationResult.governance || !Array.isArray(evaluationResult.governance.warnings)) {
    missing.push("governance.warnings");
  }

  if (missing.length > 0) {
    throw new Error(
      `[PersistEvalV2] Refusing to persist incomplete evaluation_result_v2 payload; missing=${missing.join(",")}`,
    );
  }
}

type PipelineFailureEnvelope = {
  failure_origin: string;
  error_code: string;
  error_message: string;
  reason_codes: string[];
  failed_at: string;
  pipeline_stage: string;
};

function isMissingSchemaCacheColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return code === "PGRST204" && message.includes(columnName) && message.includes("schema cache");
}

type BoundaryGateDecision = {
  decision: "PASS" | "FAIL";
  result: ArtifactGateResult;
  reason: string;
};

export type PersistEvaluationResultV2Result =
  | {
      persisted: true;
      artifactId: string;
      completedAt: string;
      gateDecision: "PASS";
      validationResult: ArtifactGateResult;
      confidence: ConfidenceResult;
    }
  | {
      persisted: false;
      completedAt: string;
      gateDecision: "FAIL";
      validationResult: ArtifactGateResult;
      confidence: ConfidenceResult;
      reason: string;
    };

type PropagationSummary =
  NonNullable<
    NonNullable<
      NonNullable<EvaluationResultV2["governance"]["transparency"]>["propagation_summary"]
    >
  >;

type BackwardRelookTrace = {
  grounding_status: EvaluationBackwardRelookDecision["status"];
  grounding_note: string | null;
  report_persistence: EvaluationBackwardRelookDecision["reportPersistence"];
  validity_status: EvaluationBackwardRelookDecision["validityStatus"];
  reason_codes: string[];
};

function readPropagationSummary(
  evaluationResult: EvaluationResultV2,
): PropagationSummary | undefined {
  return evaluationResult.governance?.transparency?.propagation_summary;
}

function buildBackwardRelookTrace(
  backwardRelook: EvaluationBackwardRelookDecision,
): BackwardRelookTrace {
  return {
    grounding_status: backwardRelook.status,
    grounding_note: backwardRelook.note,
    report_persistence: backwardRelook.reportPersistence,
    validity_status: backwardRelook.validityStatus,
    reason_codes: backwardRelook.reasonCodes,
  };
}

function attachBackwardRelookMetadata(
  evaluationResult: EvaluationResultV2,
  backwardRelook: EvaluationBackwardRelookDecision,
): EvaluationResultV2 {
  return {
    ...evaluationResult,
    governance: {
      ...evaluationResult.governance,
      transparency: {
        ...(evaluationResult.governance?.transparency ?? {}),
        backward_relook: buildBackwardRelookTrace(backwardRelook),
      },
    },
  };
}

function readManuscriptWordCount(progressSnapshot: Record<string, unknown>): number | null {
  const direct = progressSnapshot.manuscript_word_count;
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) return direct;
  const chunkRouting = progressSnapshot.chunk_routing;
  if (chunkRouting && typeof chunkRouting === "object" && !Array.isArray(chunkRouting)) {
    const routing = chunkRouting as Record<string, unknown>;
    const words = routing.manuscript_words ?? routing.source_manuscript_words;
    if (typeof words === "number" && Number.isFinite(words) && words > 0) return words;
  }
  return null;
}

function applyShortFormReadinessMetadata(
  evaluationResult: EvaluationResultV2,
  wordCount: number | null,
): { result: EvaluationResultV2; blockingReason: string | null } {
  if (typeof wordCount !== "number" || wordCount >= 25_000) {
    return { result: evaluationResult, blockingReason: null };
  }

  const evidenceGate = runShortFormEvidenceGate({
    wordCount,
    criteria: evaluationResult.criteria,
  });
  const gatedResult: EvaluationResultV2 = {
    ...evaluationResult,
    criteria: applyShortFormEvidenceGate(evaluationResult.criteria, evidenceGate),
  };
  const sanityCheck = runShortFormFinalSanityCheck({
    wordCount,
    evaluationResult: gatedResult,
    evidenceGate,
  });

  return {
    result: {
      ...gatedResult,
      governance: {
        ...gatedResult.governance,
        transparency: {
          ...(gatedResult.governance?.transparency ?? {}),
          short_form_evidence_gate: evidenceGate,
          short_form_final_sanity_check: sanityCheck,
          short_form_external_qa: {
            mode: process.env.SHORT_FORM_EXTERNAL_QA_MODE ?? "off",
            default_provider_call: false,
          },
        },
      },
    },
    blockingReason: sanityCheck.blocking
      ? `[ShortFormFinalSanityCheck] ${sanityCheck.codes.join(",")}`
      : null,
  };
}

function applyAuthorityCompositeCap(evaluationResult: EvaluationResultV2): EvaluationResultV2 {
  const criteriaForComposite = evaluationResult.criteria.map((criterion) => ({
    key: criterion.key,
    final_score_0_10: typeof criterion.score_0_10 === "number" ? criterion.score_0_10 : 0,
  }));
  const authorityComposite = computeAuthorityComposite(criteriaForComposite);
  const originalOverall = evaluationResult.overview.overall_score_0_100;

  if (!authorityComposite.capApplied || originalOverall === null) {
    return evaluationResult;
  }

  const cap_0_100 = Math.round(authorityComposite.score_0_10 * 10);
  if (cap_0_100 >= originalOverall) {
    return evaluationResult;
  }

  const adjustment: ScoreAdjustmentV2 = {
    reason: "AUTHORITY_CAP_APPLIED",
    composite_0_10: authorityComposite.score_0_10,
    threshold_0_10: authorityComposite.threshold,
    original_overall_0_100: originalOverall,
    capped_overall_0_100: cap_0_100,
    inputs: authorityComposite.originalCompositeInputs,
  };

  return {
    ...evaluationResult,
    overview: {
      ...evaluationResult.overview,
      overall_score_0_100: cap_0_100,
    },
    score_adjustments: [
      ...(evaluationResult.score_adjustments ?? []),
      adjustment,
    ],
  };
}

function buildArtifactForValidation(evaluationResult: EvaluationResultV2): EvaluationArtifact {
  const criteria = evaluationResult.criteria.map((criterion) => ({
    key: criterion.key,
    final_score_0_10: typeof criterion.score_0_10 === "number" ? criterion.score_0_10 : 0,
    reasoning: criterion.rationale,
    evidence: criterion.evidence.map((item) => `"${item.snippet}"`).join(" | "),
    interpretation: criterion.rationale,
  }));

  const ledger = buildScoreLedger({
    criteria: criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  const efg = buildExcellenceFilter({
    criteria: criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  return {
    criteria,
    ledger,
    efg,
  };
}

function evaluateQualityGate(validation: ArtifactValidationSummary): BoundaryGateDecision {
  if (validation.result === "PASS") {
    return {
      decision: "PASS",
      result: validation.result,
      reason: "Artifact validation result is PASS",
    };
  }

  return {
    decision: "FAIL",
    result: validation.result,
    reason: `Artifact validation result is ${validation.result}`,
  };
}

function deriveBoundaryConfidence(validation: ArtifactValidationSummary, gate: BoundaryGateDecision): ConfidenceResult {
  const reasonCodeSet = new Set(validation.reasonCodes);
  const criterionCompletenessPassed =
    !reasonCodeSet.has("CRIT-MISSING-ALL") && !reasonCodeSet.has("CRIT-MISSING-1");
  const anchorIntegrityPassed = !reasonCodeSet.has("EVIDENCE-MISSING-1");

  return deriveConfidence({
    criterionCompletenessPassed,
    anchorIntegrityPassed,
    governancePassed: gate.decision === "PASS",
    passConvergencePassed: gate.decision === "PASS",
    hasMaterialPassDisagreement: false,
    pass1UnresolvedWarningCount: 0,
    usedFallbackPath: false,
    executionDegraded: false,
    invalidOutput: gate.decision !== "PASS",
    quarantinedOutput: false,
    evidenceCoverage: reasonCodeSet.has("EVIDENCE-MISSING-1") ? "thin" : "strong",
  });
}

type PersistenceSanitizerMetrics = {
  replacements_total: number;
  touched_fields: number;
  by_pattern: Record<string, number>;
};

// Patterns now imported from shared registry (reportForbiddenPatterns.ts).
// This guarantees write-time sanitizer, read-time sanitizer, and parity gate
// can never drift.
const PERSISTENCE_SANITIZER_PATTERNS = FORBIDDEN_PATTERNS;

function createPersistenceSanitizerMetrics(): PersistenceSanitizerMetrics {
  const by_pattern: Record<string, number> = {};
  for (const code of getForbiddenCodes()) {
    by_pattern[code] = 0;
  }
  return {
    replacements_total: 0,
    touched_fields: 0,
    by_pattern,
  };
}

function sanitizeTextForPersistence(value: string, metrics?: PersistenceSanitizerMetrics): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  let repaired = normalized;
  for (const pattern of PERSISTENCE_SANITIZER_PATTERNS) {
    const matcher = new RegExp(pattern.source, "gi");
    const matches = repaired.match(matcher);
    if (matches && matches.length > 0 && metrics) {
      metrics.replacements_total += matches.length;
      metrics.by_pattern[pattern.code] += matches.length;
    }
    repaired = repaired.replace(matcher, pattern.replacement);
  }

  return mistakeProofText(repaired, "").trim();
}

function sanitizeNonEmptyTextForPersistence(value: string, metrics: PersistenceSanitizerMetrics): string {
  const cleaned = sanitizeTextForPersistence(value, metrics);
  const fallback = value.trim();
  const resolved = cleaned || fallback;
  if (resolved !== fallback) {
    metrics.touched_fields += 1;
  }
  return resolved;
}

function sanitizeEvaluationResultForPersistence(evaluationResult: EvaluationResultV2): {
  result: EvaluationResultV2;
  metrics: PersistenceSanitizerMetrics;
} {
  const metrics = createPersistenceSanitizerMetrics();

  return {
    result: {
      ...evaluationResult,
      overview: {
        ...evaluationResult.overview,
        one_paragraph_summary: sanitizeNonEmptyTextForPersistence(evaluationResult.overview.one_paragraph_summary, metrics),
        top_3_strengths: evaluationResult.overview.top_3_strengths.map((item) => sanitizeNonEmptyTextForPersistence(item, metrics)),
        top_3_risks: evaluationResult.overview.top_3_risks.map((item) => sanitizeNonEmptyTextForPersistence(item, metrics)),
      },
      criteria: evaluationResult.criteria.map((criterion) => ({
        ...criterion,
        rationale: sanitizeNonEmptyTextForPersistence(criterion.rationale, metrics),
        fit_summary: typeof criterion.fit_summary === "string"
          ? sanitizeNonEmptyTextForPersistence(criterion.fit_summary, metrics)
          : criterion.fit_summary,
        gap_summary: typeof criterion.gap_summary === "string"
          ? sanitizeNonEmptyTextForPersistence(criterion.gap_summary, metrics)
          : criterion.gap_summary,
        // evidence[*].snippet is manuscript content — never sanitize author text.
        // Only sanitize the editorial .note annotation.
        evidence: criterion.evidence.map((item) => ({
          ...item,
          note: typeof item.note === "string" ? sanitizeNonEmptyTextForPersistence(item.note, metrics) : item.note,
        })),
        recommendations: criterion.recommendations.map((recommendation) => ({
          ...recommendation,
          action: sanitizeNonEmptyTextForPersistence(recommendation.action, metrics),
          expected_impact: sanitizeNonEmptyTextForPersistence(recommendation.expected_impact, metrics),
          // anchor_snippet is a direct manuscript quotation — never sanitize author text.
          mechanism:
            typeof recommendation.mechanism === "string"
              ? sanitizeNonEmptyTextForPersistence(recommendation.mechanism, metrics)
              : recommendation.mechanism,
          specific_fix:
            typeof recommendation.specific_fix === "string"
              ? sanitizeNonEmptyTextForPersistence(recommendation.specific_fix, metrics)
              : recommendation.specific_fix,
          reader_effect:
            typeof recommendation.reader_effect === "string"
              ? sanitizeNonEmptyTextForPersistence(recommendation.reader_effect, metrics)
              : recommendation.reader_effect,
          symptom:
            typeof recommendation.symptom === "string"
              ? sanitizeNonEmptyTextForPersistence(recommendation.symptom, metrics)
              : recommendation.symptom,
          mistake_proofing:
            typeof recommendation.mistake_proofing === "string"
              ? sanitizeNonEmptyTextForPersistence(recommendation.mistake_proofing, metrics)
              : recommendation.mistake_proofing,
          potential_damage: Array.isArray(recommendation.potential_damage)
            ? recommendation.potential_damage
                .filter((item): item is string => typeof item === "string")
                .map((item) => sanitizeNonEmptyTextForPersistence(item, metrics))
            : recommendation.potential_damage,
        })),
      })),
      recommendations: {
        quick_wins: evaluationResult.recommendations.quick_wins.map((item) => ({
          ...item,
          action: sanitizeNonEmptyTextForPersistence(item.action, metrics),
          why: sanitizeNonEmptyTextForPersistence(item.why, metrics),
        })),
        strategic_revisions: evaluationResult.recommendations.strategic_revisions.map((item) => ({
          ...item,
          action: sanitizeNonEmptyTextForPersistence(item.action, metrics),
          why: sanitizeNonEmptyTextForPersistence(item.why, metrics),
        })),
      },
    },
    metrics,
  };
}

export async function persistEvaluationResultV2(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  evaluationResult: EvaluationResultV2;
  sourceHash: string;
  progressSnapshot: Record<string, unknown>;
  totalUnits: number;
  completedUnits: number;
  /** Optional heartbeat callback — prevents watchdog from killing the job during persistence. */
  onHeartbeat?: () => void;
  /** Execution phase for metadata tracking. Derived from progressSnapshot.phase when omitted. */
  executionPhase?: "phase_1a" | "phase_2" | "phase_3";
}): Promise<PersistEvaluationResultV2Result> {
  if (!Number.isFinite(params.manuscriptId) || params.manuscriptId <= 0) {
    throw new Error(`Invalid manuscript_id for persistEvaluationResultV2: ${params.manuscriptId}`);
  }
  // Derive execution phase: explicit param > progressSnapshot.phase > "phase_3" default
  const _persistPhase: string = params.executionPhase
    ?? (typeof params.progressSnapshot?.phase === "string" && params.progressSnapshot.phase
        ? params.progressSnapshot.phase
        : "phase_3");

  // Fail-closed hard guard: never let a stub/partial payload (e.g. ids-only)
  // proceed into transforms/persistence and risk canonical overwrite.
  assertPersistableEvaluationResultShape(params.evaluationResult);

  const wordCount = readManuscriptWordCount(params.progressSnapshot);
  const shortFormReadiness = applyShortFormReadinessMetadata(params.evaluationResult, wordCount);
  const persistenceSanitizer = sanitizeEvaluationResultForPersistence(
    applyAuthorityCompositeCap(shortFormReadiness.result),
  );
  let evaluationResult = persistenceSanitizer.result;

  if (persistenceSanitizer.metrics.replacements_total > 0 || persistenceSanitizer.metrics.touched_fields > 0) {
    console.info("[Eval2PersistenceSanitizer] contamination mitigation applied", {
      job_id: params.jobId,
      replacements_total: persistenceSanitizer.metrics.replacements_total,
      touched_fields: persistenceSanitizer.metrics.touched_fields,
      by_pattern: persistenceSanitizer.metrics.by_pattern,
    });
  }

  params.onHeartbeat?.();

  if (shortFormReadiness.blockingReason) {
    const rejectedAt = new Date().toISOString();
    const sanityResult = evaluationResult.governance?.transparency?.short_form_final_sanity_check as Record<string, unknown> | undefined;
    const violationCodes: string[] = Array.isArray(sanityResult?.codes) ? (sanityResult.codes as string[]) : [];

    // ── FIPOC KICK_MATRIX: attempt backward kick to phase_3 re-synthesis ────────────
    // For recoverable short-form sanity violations (LLM echoes of long-form terms),
    // re-queue the job for Phase 3 re-synthesis with an explicit prohibition
    // instruction. Budget: 1 kick per violation code (tracked in progress.kick_attempts).
    const kickableCodes = violationCodes.filter((code) => {
      const policy = getGateFailurePolicy(code);
      return policy.max_retries > 0;
    });

    if (kickableCodes.length > 0) {
      const progressState = params.progressSnapshot as Record<string, unknown>;
      const kickAttempts =
        typeof progressState.kick_attempts === 'object' && progressState.kick_attempts !== null
          ? (progressState.kick_attempts as Record<string, number>)
          : {};

      // Check whether any kickable code still has budget remaining
      const codeWithBudget = kickableCodes.find((code) => (kickAttempts[code] ?? 0) < 1);

      if (codeWithBudget) {
        const policy = getGateFailurePolicy(codeWithBudget);
        const attemptNumber = (kickAttempts[codeWithBudget] ?? 0) + 1;
        const retryCtx = buildRetryContext({
          gate: 'SHORT_FORM_FINAL_SANITY_CHECK',
          stageId: 'S07_PASS3',
          violationCodes: kickableCodes,
          affectedFields: ['overview', 'criteria[*].rationale'],
          attemptNumber,
        });

        const updatedKickAttempts = { ...kickAttempts, [codeWithBudget]: attemptNumber };
        const kickNow = new Date().toISOString();

        // Persist quarantine artifact so admin can inspect the failing output
        if (policy.persist_quarantine_artifact) {
          const quarantineArtifact = buildQuarantineArtifact({
            gate: 'SHORT_FORM_FINAL_SANITY_CHECK',
            stageId: 'S07_PASS3',
            violationCodes: kickableCodes,
            attemptNumber,
            content: evaluationResult,
          });
          // Best-effort — don't block the kick if artifact persistence fails
          await params.supabase
            .from('evaluation_artifacts')
            .insert({
              job_id: params.jobId,
              artifact_type: quarantineArtifact.artifact_type,
              content: quarantineArtifact,
              created_at: kickNow,
            })
            .then(({ error }) => {
              if (error) console.warn(`[ShortFormSanityKick] quarantine artifact persist failed: ${error.message}`);
            });
        }

        const { error: kickErr } = await params.supabase
          .from('evaluation_jobs')
          .update({
            status: JOB_STATUS.QUEUED,
            phase: 'phase_3',
            phase_status: JOB_STATUS.QUEUED,
            claimed_by: null,
            claimed_at: null,
            lease_token: null,
            lease_until: null,
            last_heartbeat_at: null,
            last_heartbeat: null,
            worker_pulse_at: null,
            failure_code: null,
            last_error: null,
            updated_at: kickNow,
            progress: {
              ...progressState,
              phase: 'phase_3',
              phase_status: JOB_STATUS.QUEUED,
              message: `Backward kick: re-queued for synthesis after ${codeWithBudget}`,
              kick_attempts: updatedKickAttempts,
              last_kick_at: kickNow,
              last_kick_failure_code: codeWithBudget,
              last_kick_violation_summary: retryCtx.retry_instruction,
              short_form_retry_instruction: retryCtx.retry_instruction,
            },
          })
          .eq('id', params.jobId);

        if (!kickErr) {
          console.warn(
            `[ShortFormSanityKick] ${params.jobId}: backward kick to phase_3 after ${codeWithBudget} ` +
            `(attempt ${attemptNumber}/1) — retry instruction injected`,
          );
          return {
            persisted: false,
            completedAt: kickNow,
            gateDecision: "FAIL",
            validationResult: "FAIL",
            confidence: deriveConfidence({
              criterionCompletenessPassed: false,
              anchorIntegrityPassed: false,
              governancePassed: false,
              passConvergencePassed: false,
              hasMaterialPassDisagreement: false,
              pass1UnresolvedWarningCount: 0,
              usedFallbackPath: false,
              executionDegraded: false,
              invalidOutput: false,
              quarantinedOutput: true,
              evidenceCoverage: "thin",
            }),
            reason: `[ShortFormSanityKick] kicked back to phase_3 for re-synthesis (${codeWithBudget})`,
          };
        }

        // If the kick DB write fails, fall through to terminal fail below
        console.error(`[ShortFormSanityKick] ${params.jobId}: kick requeue failed: ${kickErr.message} — falling through to terminal fail`);
      }
    }
    // ── End FIPOC kick path ────────────────────────────────────────────────────

    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    const invalidValidity = normalizeEvaluationValidityStatus("invalid");
    const failurePayloadBase = {
      status: failedStatus,
      validity_status: invalidValidity,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress: {
        ...params.progressSnapshot,
        finalized_at: rejectedAt,
        phase: "phase_2",
        phase_status: "failed",
        total_units: params.totalUnits,
        completed_units: params.completedUnits,
        message: "Evaluation rejected by short-form final sanity check",
        finished_at: rejectedAt,
        short_form_final_sanity_check: evaluationResult.governance?.transparency?.short_form_final_sanity_check,
      },
      evaluation_result: evaluationResult,
      evaluation_result_version: "evaluation_result_v2",
      last_error: shortFormReadiness.blockingReason,
      failure_code: "SHORT_FORM_FINAL_SANITY_BLOCKED",
      last_heartbeat: rejectedAt,
      last_heartbeat_at: rejectedAt,
      heartbeat_at: rejectedAt,
      failed_at: rejectedAt,
      updated_at: rejectedAt,
    };

    let { error: failureUpdateError } = await params.supabase
      .from("evaluation_jobs")
      .update(failurePayloadBase)
      .eq("id", params.jobId);

    if (failureUpdateError && isMissingSchemaCacheColumnError(failureUpdateError, "validity_status")) {
      ({ error: failureUpdateError } = await params.supabase
        .from("evaluation_jobs")
        .update({ ...failurePayloadBase, validity_status: undefined })
        .eq("id", params.jobId));
    }

    if (failureUpdateError) {
      throw new Error(`Short-form final sanity rejection update failed: ${failureUpdateError.message}`);
    }

    return {
      persisted: false,
      completedAt: rejectedAt,
      gateDecision: "FAIL",
      validationResult: "FAIL",
      confidence: deriveConfidence({
        criterionCompletenessPassed: false,
        anchorIntegrityPassed: false,
        governancePassed: false,
        passConvergencePassed: false,
        hasMaterialPassDisagreement: false,
        pass1UnresolvedWarningCount: 0,
        usedFallbackPath: false,
        executionDegraded: false,
        invalidOutput: true,
        quarantinedOutput: false,
        evidenceCoverage: "thin",
      }),
      reason: shortFormReadiness.blockingReason,
    };
  }

  params.onHeartbeat?.();

  const structuralValidation = validateStructuralArtifact(evaluationResult);

  if (!structuralValidation.ok) {
    const rejectedAt = new Date().toISOString();
    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    const invalidValidity = normalizeEvaluationValidityStatus("invalid");

    const confidence = deriveConfidence({
      criterionCompletenessPassed: false,
      anchorIntegrityPassed: false,
      governancePassed: false,
      passConvergencePassed: false,
      hasMaterialPassDisagreement: false,
      pass1UnresolvedWarningCount: 0,
      usedFallbackPath: false,
      executionDegraded: true,
      invalidOutput: true,
      quarantinedOutput: false,
      evidenceCoverage: "thin",
    });

    const issueCodes = structuralValidation.issues.map((issue) => issue.code);
    const failureMessage =
      `[Eval2BoundaryValidation] Artifact failed structural validation; ` +
      `issue_codes=${issueCodes.join(",") || "none"}`;

    const gateTrace = {
      validation_result: "FAIL",
      reason_codes: issueCodes,
      validated_at: rejectedAt,
      gate_decision: "FAIL",
      gate_reason: "Boundary structural validation failed",
      confidence,
      propagation: readPropagationSummary(evaluationResult),
      validation_issues: structuralValidation.issues,
    };

    const failurePayloadBase = {
      status: failedStatus,
      validity_status: invalidValidity,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress: {
        ...params.progressSnapshot,
        finalized_at: rejectedAt,
        phase: "phase_2",
        phase_status: "failed",
        total_units: params.totalUnits,
        completed_units: params.completedUnits,
        message: "Evaluation rejected by boundary structural validator",
        finished_at: rejectedAt,
        gate_enforcement: gateTrace,
      },
      last_error: failureMessage,
      failure_code: EVALUATION_ARTIFACT_VALIDATION_FAILED,
      last_heartbeat: rejectedAt,
      last_heartbeat_at: rejectedAt,
      heartbeat_at: rejectedAt,
      failed_at: rejectedAt,
      updated_at: rejectedAt,
    };

    let { error: failureUpdateError } = await params.supabase
      .from("evaluation_jobs")
      .update(failurePayloadBase)
      .eq("id", params.jobId);

    if (failureUpdateError && isMissingSchemaCacheColumnError(failureUpdateError, "validity_status")) {
      console.warn("[Eval2Boundary] stale schema cache; retrying structural validation rejection update without optional validity_status", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      ({ error: failureUpdateError } = await params.supabase
        .from("evaluation_jobs")
        .update({
          ...failurePayloadBase,
          validity_status: undefined,
        })
        .eq("id", params.jobId));
    }

    if (failureUpdateError) {
      throw new Error(`Structural validation rejection update failed: ${failureUpdateError.message}`);
    }

    return {
      persisted: false,
      completedAt: rejectedAt,
      gateDecision: "FAIL",
      validationResult: "FAIL",
      confidence,
      reason: failureMessage,
    };
  }

  const artifactForValidation = buildArtifactForValidation(evaluationResult);
  const validation = validateEvaluationArtifact(artifactForValidation, { mode: "enforce" });
  const gate = evaluateQualityGate(validation);
  const confidence = deriveBoundaryConfidence(validation, gate);

  if (gate.decision !== "PASS") {
    const gateRejectedAt = new Date().toISOString();
    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    const invalidValidity = normalizeEvaluationValidityStatus("invalid");
    const gateFailureMessage =
      `[Eval2BoundaryGate] ${gate.reason}; reason_codes=${validation.reasonCodes.join(",") || "none"}`;

    const gateTrace = {
      validation_result: validation.result,
      reason_codes: validation.reasonCodes,
      validated_at: validation.validatedAt,
      gate_decision: gate.decision,
      gate_reason: gate.reason,
      confidence,
      propagation: readPropagationSummary(evaluationResult),
    };

    const failurePayloadBase = {
      status: failedStatus,
      validity_status: invalidValidity,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress: {
        ...params.progressSnapshot,
        finalized_at: gateRejectedAt,
        phase: "phase_2",
        phase_status: "failed",
        total_units: params.totalUnits,
        completed_units: params.completedUnits,
        message: "Evaluation rejected by boundary quality gate",
        finished_at: gateRejectedAt,
        gate_enforcement: gateTrace,
      },
      last_error: gateFailureMessage,
      failure_code: "EVALUATION_GATE_REJECTED",
      last_heartbeat: gateRejectedAt,
      last_heartbeat_at: gateRejectedAt,
      heartbeat_at: gateRejectedAt,
      failed_at: gateRejectedAt,
      updated_at: gateRejectedAt,
    };

    let { error: failureUpdateError } = await params.supabase
      .from("evaluation_jobs")
      .update(failurePayloadBase)
      .eq("id", params.jobId);

    if (failureUpdateError && isMissingSchemaCacheColumnError(failureUpdateError, "validity_status")) {
      console.warn("[Eval2Boundary] stale schema cache; retrying gate rejection update without optional validity_status", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      ({ error: failureUpdateError } = await params.supabase
        .from("evaluation_jobs")
        .update({
          ...failurePayloadBase,
          validity_status: undefined,
        })
        .eq("id", params.jobId));
    }

    if (failureUpdateError) {
      throw new Error(`Gate rejection update failed: ${failureUpdateError.message}`);
    }

    console.warn("[Eval2Boundary] gate_rejected", {
      job_id: params.jobId,
      manuscript_id: params.manuscriptId,
      validation_result: validation.result,
      reason_codes: validation.reasonCodes,
      validated_at: validation.validatedAt,
      gate_decision: gate.decision,
      confidence,
    });

    return {
      persisted: false,
      completedAt: gateRejectedAt,
      gateDecision: "FAIL",
      validationResult: validation.result,
      confidence,
      reason: gateFailureMessage,
    };
  }

  const evaluationScope = evaluationResult.governance?.transparency?.evaluation_scope;
  const coverageSummary = evaluationResult.governance?.transparency?.coverage_summary;
  const explicitGroundingStatus =
    evaluationResult.governance?.transparency?.backward_relook?.grounding_status;
  const backwardRelook = runEvaluationBackwardRelook({
    structuralOk: structuralValidation.ok,
    boundaryGateDecision: gate.decision,
    reasonCodes: validation.reasonCodes,
    explicitGroundingStatus,
    manuscriptWideCertifiable:
      typeof evaluationScope?.manuscript_wide_certifiable === "boolean"
        ? evaluationScope.manuscript_wide_certifiable
        : null,
    partialEvaluation:
      typeof coverageSummary?.partial_evaluation === "boolean"
        ? coverageSummary.partial_evaluation
        : null,
  });

  try {
    assertReportPersistenceAllowed(backwardRelook);
  } catch (error) {
    const relookRejectedAt = new Date().toISOString();
    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    const invalidValidity = normalizeEvaluationValidityStatus(backwardRelook.validityStatus);
    const relookFailureMessage =
      error instanceof Error
        ? error.message
        : `[EvaluationBackwardRelook] report persistence blocked; grounding_status=${backwardRelook.status}`;

    const gateTrace = {
      validation_result: validation.result,
      reason_codes: backwardRelook.reasonCodes,
      validated_at: validation.validatedAt,
      gate_decision: gate.decision,
      gate_reason: gate.reason,
      confidence,
      propagation: readPropagationSummary(evaluationResult),
      backward_relook: buildBackwardRelookTrace(backwardRelook),
    };

    const failurePayloadBase = {
      status: failedStatus,
      validity_status: invalidValidity,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress: {
        ...params.progressSnapshot,
        finalized_at: relookRejectedAt,
        phase: "phase_2",
        phase_status: "failed",
        total_units: params.totalUnits,
        completed_units: params.completedUnits,
        message: "Evaluation rejected by Backward Relook grounding gate",
        finished_at: relookRejectedAt,
        gate_enforcement: gateTrace,
      },
      last_error: relookFailureMessage,
      failure_code: "EVALUATION_GATE_REJECTED",
      last_heartbeat: relookRejectedAt,
      last_heartbeat_at: relookRejectedAt,
      heartbeat_at: relookRejectedAt,
      failed_at: relookRejectedAt,
      updated_at: relookRejectedAt,
    };

    let { error: failureUpdateError } = await params.supabase
      .from("evaluation_jobs")
      .update(failurePayloadBase)
      .eq("id", params.jobId);

    if (failureUpdateError && isMissingSchemaCacheColumnError(failureUpdateError, "validity_status")) {
      console.warn("[PersistEvalV2] stale schema cache; retrying Backward Relook rejection update without optional validity_status", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      ({ error: failureUpdateError } = await params.supabase
        .from("evaluation_jobs")
        .update({
          ...failurePayloadBase,
          validity_status: undefined,
        })
        .eq("id", params.jobId));
    }

    if (failureUpdateError) {
      throw new Error(`Backward Relook rejection update failed: ${failureUpdateError.message}`);
    }

    return {
      persisted: false,
      completedAt: relookRejectedAt,
      gateDecision: "FAIL",
      validationResult: validation.result,
      confidence,
      reason: relookFailureMessage,
    };
  }

  params.onHeartbeat?.();

  const completionTime = new Date().toISOString();
  const completionStatus = normalizeEvaluationJobStatus(JOB_STATUS.COMPLETE) as JobStatus;
  const validValidity = normalizeEvaluationValidityStatus("valid");
  const persistedEvaluationResult = attachBackwardRelookMetadata(evaluationResult, backwardRelook);

  const gateTrace = {
    validation_result: validation.result,
    reason_codes: backwardRelook.reasonCodes,
    validated_at: validation.validatedAt,
    gate_decision: gate.decision,
    gate_reason: gate.reason,
    confidence,
    propagation: readPropagationSummary(evaluationResult),
    backward_relook: buildBackwardRelookTrace(backwardRelook),
    persistence_sanitizer: persistenceSanitizer.metrics,
  };

  const completionPayloadBase = {
    status: completionStatus,
    validity_status: validValidity,
    phase: _persistPhase,
    phase_status: "complete",
    total_units: params.totalUnits,
    completed_units: params.completedUnits,
    progress: {
      ...params.progressSnapshot,
      ...buildPhaseLogPatch(params.progressSnapshot as Record<string, unknown>, _persistPhase, 'passed', completionTime),
      finalized_at: completionTime,
      phase: _persistPhase,
      phase_status: "complete",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      message: "Evaluation complete",
      finished_at: completionTime,
      gate_enforcement: gateTrace,
    },
    evaluation_result: persistedEvaluationResult,
    evaluation_result_version: "evaluation_result_v2",
    last_heartbeat: completionTime,
    last_heartbeat_at: completionTime,
    heartbeat_at: completionTime,
    last_error: null,
    failure_code: null,
    updated_at: completionTime,
    completed_at: completionTime,
    phase2_completed_at: completionTime,
  };

  params.onHeartbeat?.();

  const { data: atomicRows, error: atomicError } = await params.supabase.rpc(
    "persist_evaluation_v2_atomic",
    {
      p_job_id: params.jobId,
      p_manuscript_id: params.manuscriptId,
      p_artifact_type: "evaluation_result_v2",
      p_artifact_content: persistedEvaluationResult,
      p_source_hash: params.sourceHash,
      p_artifact_version: "evaluation_result_v2",
      p_evaluation_result: persistedEvaluationResult,
      p_progress: completionPayloadBase.progress,
      p_completed_at: completionTime,
      p_phase2_completed_at: completionTime,
      p_validity_status: validValidity,
      p_total_units: params.totalUnits,
      p_completed_units: params.completedUnits,
      p_last_heartbeat: completionTime,
      p_last_heartbeat_at: completionTime,
      p_heartbeat_at: completionTime,
    },
  );

  if (atomicError) {
    throw new Error(`Atomic persistence failed: ${atomicError.message}`);
  }

  const atomicRow = Array.isArray(atomicRows) ? atomicRows[0] : undefined;
  if (!atomicRow || typeof atomicRow.artifact_id !== "string" || atomicRow.artifact_id.length === 0) {
    throw new Error("Atomic persistence returned no artifact_id");
  }

  return {
    persisted: true,
    artifactId: atomicRow.artifact_id,
    completedAt: completionTime,
    gateDecision: "PASS",
    validationResult: validation.result,
    confidence,
  };
}

export type FinalizeEvaluationFailureInput = {
  supabase: SupabaseClient;
  jobId: string;
  failureEnvelope: PipelineFailureEnvelope;
  lastError: string;
  failureCode?: string;
  phase: "phase_1a" | "phase_2" | "phase_3";
  totalUnits: number;
  completedUnits: number;
};

export type FinalizeEvaluationFailureOutput = {
  finalized: true;
  jobId: string;
  failureCode: string;
};

export async function finalizeEvaluationFailure(
  params: FinalizeEvaluationFailureInput,
): Promise<FinalizeEvaluationFailureOutput> {
  const now = new Date().toISOString();
  const failureCode = params.failureCode ?? params.failureEnvelope.error_code;

  const { data: existingJob, error: readError } = await params.supabase
    .from("evaluation_jobs")
    .select("progress, phase")
    .eq("id", params.jobId)
    .single();

  if (readError) {
    throw new Error(
      `[finalizeEvaluationFailure] read failed for job ${params.jobId}: ${readError.message}`,
    );
  }

  const existingProgress =
    existingJob?.progress && typeof existingJob.progress === "object"
      ? (existingJob.progress as Record<string, unknown>)
      : {};
  const existingPhase =
    typeof existingJob?.phase === "string" && existingJob.phase.length > 0
      ? existingJob.phase
      : params.phase;

  const progress = {
    ...existingProgress,
    phase: existingPhase,
    phase_status: "failed",
    total_units: params.totalUnits,
    completed_units: params.completedUnits,
    message: "Evaluation failed",
    failed_at: now,
    pipeline_failure_envelope: params.failureEnvelope,
  };

  const { error: updateError } = await params.supabase
    .from("evaluation_jobs")
    .update({
      status: normalizeEvaluationJobStatus(JOB_STATUS.FAILED),
      phase: existingPhase,
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress,
      last_error: params.lastError,
      failure_code: failureCode,
      updated_at: now,
      failed_at: now,
    })
    .eq("id", params.jobId);

  if (updateError) {
    throw new Error(
      `[finalizeEvaluationFailure] update failed for job ${params.jobId}: ${updateError.message}`,
    );
  }

  return {
    finalized: true,
    jobId: params.jobId,
    failureCode,
  };
}
