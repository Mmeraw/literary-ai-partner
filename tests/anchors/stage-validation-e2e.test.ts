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

type SuccessCase = {
  id: string;
  source_text: string;
  candidates: EvaluationProposalCandidate[];
  expected_output: string;
};

type FailureCase = {
  id: string;
  description: string;
  run: () => unknown;
  expected_code: RevisionFailureCode;
};

type SuccessCaseResult = {
  id: string;
  ingest_count: number;
  extracted_count: number;
  validated_count: number;
  applied_count: number;
  expected_output: string;
  actual_output: string;
  output_match: boolean;
  repeat_output_match: boolean;
  repeat_pipeline_identity_match: boolean;
};

type FailureCaseResult = {
  id: string;
  description: string;
  classified_code: RevisionFailureCode;
  envelope_phase: "phase_2";
  expected_code_match: boolean;
};

type StageValidationMetrics = {
  success_case_total: number;
  success_case_passed: number;
  failure_case_total: number;
  failure_case_passed: number;
  ingest_count_total: number;
  extracted_count_total: number;
  validated_count_total: number;
  applied_count_total: number;
  repeated_run_identity_passed: boolean;
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
  success_cases: SuccessCaseResult[];
  failure_cases: FailureCaseResult[];
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

function executeSuccessCase(c: SuccessCase): SuccessCaseResult {
  const normalized1 = normalizeProposalCandidates(
    `session-stage25-${c.id}-1`,
    c.candidates,
    c.source_text,
  );
  const accepted1 = normalized1.map((input, idx) =>
    toAcceptedProposal(input, `stage25-${c.id}-${idx + 1}`),
  );

  const preflight1 = preflightAcceptedChanges(c.source_text, accepted1);
  const applied1 = applyProposalsBatchStrict(c.source_text, accepted1);

  const normalized2 = normalizeProposalCandidates(
    `session-stage25-${c.id}-2`,
    c.candidates,
    c.source_text,
  );
  const accepted2 = normalized2.map((input, idx) =>
    toAcceptedProposal(input, `stage25-${c.id}-repeat-${idx + 1}`),
  );

  const preflight2 = preflightAcceptedChanges(c.source_text, accepted2);
  const applied2 = applyProposalsBatchStrict(c.source_text, accepted2);

  const pipelineIdentity1 = JSON.stringify({
    normalized: normalized1.map((n) => ({
      start_offset: n.start_offset,
      end_offset: n.end_offset,
      before_context: n.before_context,
      after_context: n.after_context,
      anchor_text_normalized: n.anchor_text_normalized,
    })),
    preflight: preflight1.map((p) => ({
      start_offset: p.start_offset,
      end_offset: p.end_offset,
      original_text: p.original_text,
      proposed_text: p.proposed_text,
    })),
    output: applied1.output_text,
  });

  const pipelineIdentity2 = JSON.stringify({
    normalized: normalized2.map((n) => ({
      start_offset: n.start_offset,
      end_offset: n.end_offset,
      before_context: n.before_context,
      after_context: n.after_context,
      anchor_text_normalized: n.anchor_text_normalized,
    })),
    preflight: preflight2.map((p) => ({
      start_offset: p.start_offset,
      end_offset: p.end_offset,
      original_text: p.original_text,
      proposed_text: p.proposed_text,
    })),
    output: applied2.output_text,
  });

  return {
    id: c.id,
    ingest_count: c.candidates.length,
    extracted_count: normalized1.length,
    validated_count: preflight1.length,
    applied_count: applied1.applied_count,
    expected_output: c.expected_output,
    actual_output: applied1.output_text,
    output_match: applied1.output_text === c.expected_output,
    repeat_output_match: applied1.output_text === applied2.output_text,
    repeat_pipeline_identity_match: pipelineIdentity1 === pipelineIdentity2,
  };
}

function executeFailureCase(c: FailureCase): FailureCaseResult {
  let err: unknown = null;
  try {
    c.run();
  } catch (error) {
    err = error;
  }

  if (!err) {
    throw new Error(`Failure case '${c.id}' did not fail closed.`);
  }

  const classified = classifyApplyFailure(err);
  const envelope = buildApplyFailureEnvelope(err, {
    stage: "phase_2_5_validation_matrix",
    case_id: c.id,
  });

  return {
    id: c.id,
    description: c.description,
    classified_code: classified.code,
    envelope_phase: envelope.phase,
    expected_code_match: classified.code === c.expected_code,
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
    "- fail-closed classification on bad inputs",
    "- repeated-run byte identity",
    "- persisted machine-readable evidence",
    "",
    "## Metrics",
    "",
    `- success_case_total: ${artifact.metrics.success_case_total}`,
    `- success_case_passed: ${artifact.metrics.success_case_passed}`,
    `- failure_case_total: ${artifact.metrics.failure_case_total}`,
    `- failure_case_passed: ${artifact.metrics.failure_case_passed}`,
    `- ingest_count_total: ${artifact.metrics.ingest_count_total}`,
    `- extracted_count_total: ${artifact.metrics.extracted_count_total}`,
    `- validated_count_total: ${artifact.metrics.validated_count_total}`,
    `- applied_count_total: ${artifact.metrics.applied_count_total}`,
    `- repeated_run_identity_passed: ${artifact.metrics.repeated_run_identity_passed}`,
    `- pass: ${artifact.metrics.pass}`,
    "",
    "## Success cases",
    "",
    ...artifact.success_cases.map(
      (c) =>
        `- ${c.id}: output_match=${c.output_match}, repeat_output_match=${c.repeat_output_match}, repeat_pipeline_identity_match=${c.repeat_pipeline_identity_match}`,
    ),
    "",
    "## Failure cases",
    "",
    ...artifact.failure_cases.map(
      (c) =>
        `- ${c.id}: classified_code=${c.classified_code}, expected_code_match=${c.expected_code_match}`,
    ),
    "",
  ].join("\n");

  writeFileSync(mdPath, md);
}

describe("Phase 2.5 stage validation", () => {
  test("proves deterministic multi-case anchor-to-apply pipeline under canonical fail-closed conditions", () => {
    const successCases: SuccessCase[] = [
      {
        id: "happy-single-proposal",
        source_text:
          "Opening line.\nHero enters the room and looks around carefully.\nClosing line.",
        candidates: [
          {
            location_ref: "scene:1",
            rule: "proseControl",
            action: "refine",
            original_text: "Hero enters the room and looks around carefully.",
            proposed_text: "Hero steps into the room, scanning every corner.",
            justification: "Improve pacing and precision.",
            severity: "medium",
          },
        ],
        expected_output:
          "Opening line.\nHero steps into the room, scanning every corner.\nClosing line.",
      },
      {
        id: "happy-multi-proposal-unicode",
        source_text:
          "The café stayed open late.\nShe paused—then answered without hesitation.",
        candidates: [
          {
            location_ref: "scene:2a",
            rule: "proseControl",
            action: "refine",
            original_text: "café stayed open late",
            proposed_text: "bistro stayed open late",
            justification: "Sharper setting word choice.",
            severity: "low",
          },
          {
            location_ref: "scene:2b",
            rule: "cadence",
            action: "refine",
            original_text: "paused—then answered",
            proposed_text: "paused, then answered",
            justification: "Smooth punctuation rhythm.",
            severity: "low",
          },
        ],
        expected_output:
          "The bistro stayed open late.\nShe paused, then answered without hesitation.",
      },
      {
        id: "literary-prose",
        source_text:
          "The river moved slowly through the valley, carrying with it the memory of storms long past. The air smelled faintly of pine and wet stone.",
        candidates: [
          {
            location_ref: "prose:1a",
            rule: "word-choice",
            action: "refine",
            original_text: "slowly",
            proposed_text: "steadily",
            justification: "More precise cadence.",
            severity: "low",
          },
          {
            location_ref: "prose:1b",
            rule: "word-choice",
            action: "refine",
            original_text: "faintly",
            proposed_text: "subtly",
            justification: "More evocative sensory language.",
            severity: "low",
          },
        ],
        expected_output:
          "The river moved steadily through the valley, carrying with it the memory of storms long past. The air smelled subtly of pine and wet stone.",
      },
      {
        id: "dialogue-punctuation",
        source_text:
          '"You said you\'d be here," she whispered \u2014 but the room was empty. "Where are you?"',
        candidates: [
          {
            location_ref: "dialogue:1a",
            rule: "punctuation",
            action: "refine",
            original_text: "whispered \u2014 but",
            proposed_text: "whispered, but",
            justification: "Smooth dialogue rhythm.",
            severity: "low",
          },
          {
            location_ref: "dialogue:1b",
            rule: "proseControl",
            action: "refine",
            original_text: "Where are you?",
            proposed_text: "Where are you now?",
            justification: "Adds urgency.",
            severity: "low",
          },
        ],
        expected_output:
          '"You said you\'d be here," she whispered, but the room was empty. "Where are you now?"',
      },
      {
        id: "multi-paragraph-spacing",
        source_text: "He opened the door.\n\nNothing moved.\n\nThen, somewhere deeper inside, something shifted.",
        candidates: [
          {
            location_ref: "para:1a",
            rule: "word-choice",
            action: "refine",
            original_text: "Nothing moved.",
            proposed_text: "Nothing stirred.",
            justification: "More evocative action word.",
            severity: "low",
          },
          {
            location_ref: "para:1b",
            rule: "word-choice",
            action: "refine",
            original_text: "something shifted",
            proposed_text: "something breathed",
            justification: "Heightens tension with organic imagery.",
            severity: "low",
          },
        ],
        expected_output:
          "He opened the door.\n\nNothing stirred.\n\nThen, somewhere deeper inside, something breathed.",
      },
    ];

    const overlapSource = "abcdefg";
    const overlapCandidates: CreateChangeProposalInput[] = [
      {
        revision_session_id: "session-overlap",
        location_ref: "ov:1",
        rule: "proseControl",
        action: "refine",
        original_text: "bcd",
        proposed_text: "BCD",
        justification: "Overlap case",
        severity: "medium",
        start_offset: 1,
        end_offset: 4,
        before_context: "a",
        after_context: "efg",
      },
      {
        revision_session_id: "session-overlap",
        location_ref: "ov:2",
        rule: "proseControl",
        action: "refine",
        original_text: "cde",
        proposed_text: "CDE",
        justification: "Overlap case",
        severity: "medium",
        start_offset: 2,
        end_offset: 5,
        before_context: "ab",
        after_context: "fg",
      },
    ];

    const failureCases: FailureCase[] = [
      {
        id: "malformed-ingest",
        description: "Malformed candidate rejected at ingest normalization",
        expected_code: RevisionFailureCode.PARSE_ERROR,
        run: () =>
          normalizeProposalCandidates(
            "session-stage25-bad-ingest",
            [
              {
                location_ref: "scene:bad",
                rule: "proseControl",
                action: "refine",
                original_text: "Hero enters the room and looks around carefully.",
                proposed_text: "",
                justification: "Malformed test case",
                severity: "medium",
              },
            ],
            successCases[0].source_text,
          ),
      },
      {
        id: "extraction-mismatch",
        description: "Mismatched original_text fails extraction contract",
        expected_code: RevisionFailureCode.ANCHOR_MISS,
        run: () => {
          const normalized = normalizeProposalCandidates(
            "session-stage25-extract-mismatch",
            successCases[0].candidates,
            successCases[0].source_text,
          );
          const accepted = normalized.map((input, idx) =>
            toAcceptedProposal(input, `extract-mismatch-${idx + 1}`),
          );
          accepted[0] = {
            ...accepted[0],
            original_text: "Hero enters the room and looks around carefully!",
          };
          preflightAcceptedChanges(successCases[0].source_text, accepted);
        },
      },
      {
        id: "apply-preflight-overlap",
        description: "Overlapping ranges rejected during preflight",
        expected_code: RevisionFailureCode.OFFSET_CONFLICT,
        run: () => {
          const accepted = overlapCandidates.map((input, idx) =>
            toAcceptedProposal(input, `ov-${idx + 1}`),
          );
          applyProposalsBatchStrict(overlapSource, accepted);
        },
      },
    ];

    const successResults = successCases.map(executeSuccessCase);
    const failureResults = failureCases.map(executeFailureCase);

    const metrics: StageValidationMetrics = {
      success_case_total: successResults.length,
      success_case_passed: successResults.filter(
        (c) => c.output_match && c.repeat_output_match && c.repeat_pipeline_identity_match,
      ).length,
      failure_case_total: failureResults.length,
      failure_case_passed: failureResults.filter((c) => c.expected_code_match).length,
      ingest_count_total: successResults.reduce((sum, c) => sum + c.ingest_count, 0),
      extracted_count_total: successResults.reduce((sum, c) => sum + c.extracted_count, 0),
      validated_count_total: successResults.reduce((sum, c) => sum + c.validated_count, 0),
      applied_count_total: successResults.reduce((sum, c) => sum + c.applied_count, 0),
      repeated_run_identity_passed: successResults.every((c) => c.repeat_pipeline_identity_match),
      pass:
        successResults.every(
          (c) => c.output_match && c.repeat_output_match && c.repeat_pipeline_identity_match,
        ) && failureResults.every((c) => c.expected_code_match),
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
      success_cases: successResults,
      failure_cases: failureResults,
    };

    writeStageValidationArtifacts(artifact);

    if (process.env.PACK_25_REPORT_DIR) {
      const outDir = path.isAbsolute(process.env.PACK_25_REPORT_DIR)
        ? process.env.PACK_25_REPORT_DIR
        : path.join(process.cwd(), process.env.PACK_25_REPORT_DIR);
      expect(existsSync(path.join(outDir, "pack25_stage_validation_report.json"))).toBe(true);
      expect(existsSync(path.join(outDir, "pack25_stage_validation_report.md"))).toBe(true);
    }

    expect(metrics.success_case_total).toBe(5);
    expect(metrics.success_case_passed).toBe(5);
    expect(metrics.failure_case_total).toBe(3);
    expect(metrics.failure_case_passed).toBe(3);
    expect(metrics.repeated_run_identity_passed).toBe(true);
    expect(metrics.pass).toBe(true);

    const failureCodeById = new Map(
      failureResults.map((r) => [r.id, r.classified_code]),
    );
    expect(failureCodeById.get("malformed-ingest")).toBe(RevisionFailureCode.PARSE_ERROR);
    expect(failureCodeById.get("extraction-mismatch")).toBe(RevisionFailureCode.ANCHOR_MISS);
    expect(failureCodeById.get("apply-preflight-overlap")).toBe(RevisionFailureCode.OFFSET_CONFLICT);
  });
});
