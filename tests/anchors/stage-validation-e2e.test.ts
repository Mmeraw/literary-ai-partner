import { describe, expect, test } from "@jest/globals";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeProposalCandidates } from "@/lib/revision/proposals";
import {
  applyProposalsBatchStrict,
  preflightAcceptedChanges,
} from "@/lib/revision/applyBatch";
import {
  buildApplyFailureEnvelope,
  classifyApplyFailure,
} from "@/lib/revision/failureClassification";
import { RevisionFailureCode } from "@/lib/errors/revisionCodes";
import type {
  ChangeProposal,
  CreateChangeProposalInput,
  EvaluationProposalCandidate,
} from "@/lib/revision/types";

type StageValidationMetrics = {
  ingest_count: number;
  extracted_count: number;
  validated_count: number;
  applied_count: number;
  success_output_matches_expected: boolean;
  bad_input_classified_code: RevisionFailureCode;
  bad_input_failure_envelope_phase: "phase_2";
  pass: boolean;
};

type StageValidationArtifact = {
  metadata: {
    phase: "2.5";
    seed: number;
    run_mode: "deterministic";
    commit_sha: string;
    run_date_utc: string;
  };
  metrics: StageValidationMetrics;
  success_case: {
    source_text: string;
    expected_output: string;
    actual_output: string;
  };
  failure_case: {
    classified_code: RevisionFailureCode;
    envelope: ReturnType<typeof buildApplyFailureEnvelope>;
  };
};

function toAcceptedProposal(input: CreateChangeProposalInput, id: string): ChangeProposal {
  return {
    id,
    revision_session_id: input.revision_session_id,
    location_ref: input.location_ref,
    rule: input.rule,
    action: input.action,
    original_text: input.original_text,
    proposed_text: input.proposed_text,
    justification: input.justification,
    severity: input.severity,
    decision: "accepted",
    modified_text: null,
    start_offset: input.start_offset,
    end_offset: input.end_offset,
    before_context: input.before_context,
    after_context: input.after_context,
    anchor_text_normalized: input.anchor_text_normalized ?? null,
    created_at: new Date().toISOString(),
  };
}

function writeStageValidationArtifacts(artifact: StageValidationArtifact): void {
  const outDirEnv = process.env.PACK_25_REPORT_DIR;
  if (!outDirEnv) return;

  const outDir = path.isAbsolute(outDirEnv)
    ? outDirEnv
    : path.join(process.cwd(), outDirEnv);

  mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "pack25_stage_validation_report.json");
  const mdPath = path.join(outDir, "pack25_stage_validation_report.md");

  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));

  const md = [
    "# Phase 2.5 Stage Validation Report",
    "",
    "## Scope",
    "",
    "- ingest",
    "- extraction",
    "- validation",
    "- apply",
    "- fail-closed classification on bad input",
    "- persisted machine-readable evidence",
    "",
    "## Metrics",
    "",
    `- ingest_count: ${artifact.metrics.ingest_count}`,
    `- extracted_count: ${artifact.metrics.extracted_count}`,
    `- validated_count: ${artifact.metrics.validated_count}`,
    `- applied_count: ${artifact.metrics.applied_count}`,
    `- success_output_matches_expected: ${artifact.metrics.success_output_matches_expected}`,
    `- bad_input_classified_code: ${artifact.metrics.bad_input_classified_code}`,
    `- bad_input_failure_envelope_phase: ${artifact.metrics.bad_input_failure_envelope_phase}`,
    `- pass: ${artifact.metrics.pass}`,
    "",
  ].join("\n");

  writeFileSync(mdPath, md);
}

describe("Phase 2.5 stage validation", () => {
  test("proves full anchor-to-apply pipeline under canonical fail-closed conditions", () => {
    const sourceText =
      "Opening line.\nHero enters the room and looks around carefully.\nClosing line.";

    const candidates: EvaluationProposalCandidate[] = [
      {
        location_ref: "scene:1",
        rule: "clarity",
        action: "refine",
        original_text: "Hero enters the room and looks around carefully.",
        proposed_text: "Hero steps into the room, scanning every corner.",
        justification: "Improve pacing and precision.",
        severity: "medium",
      },
    ];

    const normalized = normalizeProposalCandidates(
      "session-stage25",
      candidates,
      sourceText,
    );

    const accepted = normalized.map((input, idx) =>
      toAcceptedProposal(input, `stage25-${idx + 1}`),
    );

    const preflight = preflightAcceptedChanges(sourceText, accepted);
    const applied = applyProposalsBatchStrict(sourceText, accepted);
    const expectedOutput =
      "Opening line.\nHero steps into the room, scanning every corner.\nClosing line.";

    let badInputError: unknown = null;
    try {
      normalizeProposalCandidates(
        "session-stage25-bad",
        [
          {
            location_ref: "scene:bad",
            rule: "clarity",
            action: "refine",
            original_text: "Hero enters the room and looks around carefully.",
            proposed_text: "",
            justification: "Malformed test case",
            severity: "medium",
          },
        ],
        sourceText,
      );
    } catch (error) {
      badInputError = error;
    }

    if (!badInputError) {
      throw new Error("Expected bad input normalization to fail closed.");
    }

    const classified = classifyApplyFailure(badInputError);
    const envelope = buildApplyFailureEnvelope(badInputError, {
      stage: "phase_2_5_validation",
      scenario: "malformed_candidate",
    });

    const metrics: StageValidationMetrics = {
      ingest_count: candidates.length,
      extracted_count: normalized.length,
      validated_count: preflight.length,
      applied_count: applied.applied_count,
      success_output_matches_expected: applied.output_text === expectedOutput,
      bad_input_classified_code: classified.code,
      bad_input_failure_envelope_phase: envelope.phase,
      pass:
        normalized.length === 1 &&
        preflight.length === 1 &&
        applied.applied_count === 1 &&
        applied.output_text === expectedOutput &&
        classified.code === RevisionFailureCode.PARSE_ERROR &&
        envelope.phase === "phase_2",
    };

    const artifact: StageValidationArtifact = {
      metadata: {
        phase: "2.5",
        seed: 42,
        run_mode: "deterministic",
        commit_sha: process.env.GIT_COMMIT_SHA ?? "unknown",
        run_date_utc: new Date().toISOString(),
      },
      metrics,
      success_case: {
        source_text: sourceText,
        expected_output: expectedOutput,
        actual_output: applied.output_text,
      },
      failure_case: {
        classified_code: classified.code,
        envelope,
      },
    };

    writeStageValidationArtifacts(artifact);

    if (process.env.PACK_25_REPORT_DIR) {
      const outDir = path.isAbsolute(process.env.PACK_25_REPORT_DIR)
        ? process.env.PACK_25_REPORT_DIR
        : path.join(process.cwd(), process.env.PACK_25_REPORT_DIR);
      expect(existsSync(path.join(outDir, "pack25_stage_validation_report.json"))).toBe(true);
      expect(existsSync(path.join(outDir, "pack25_stage_validation_report.md"))).toBe(true);
    }

    expect(metrics.ingest_count).toBe(1);
    expect(metrics.extracted_count).toBe(1);
    expect(metrics.validated_count).toBe(1);
    expect(metrics.applied_count).toBe(1);
    expect(metrics.success_output_matches_expected).toBe(true);
    expect(metrics.bad_input_classified_code).toBe(RevisionFailureCode.PARSE_ERROR);
    expect(metrics.bad_input_failure_envelope_phase).toBe("phase_2");
    expect(metrics.pass).toBe(true);
  });
});
