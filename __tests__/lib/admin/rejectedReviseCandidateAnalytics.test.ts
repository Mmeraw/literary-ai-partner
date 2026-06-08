import { aggregateRejectedReviseCandidateAnalytics } from "@/lib/admin/rejectedReviseCandidateAnalytics";

describe("aggregateRejectedReviseCandidateAnalytics", () => {
  it("aggregates rejection telemetry into counts and buckets without prose fields", () => {
    const result = aggregateRejectedReviseCandidateAnalytics([
      {
        metadata: {
          rejection_reasons: ["canon_authority_blocked", "hydration_input_incomplete"],
          criterion: "DIALOGUE",
          revision_operation: "replace_selected_passage",
          model: "gpt-4o-mini",
          prompt_version: "candidate_hydration_v1",
          candidate_anchor_overlap_scores: { a: 0.05, b: 0.28, c: 0.82 },
          candidate_word_counts: { a: 0, b: 18, c: 73 },
          hydration_result: "blocked_preflight",
          candidate_generation_status: "backend_filled_abc_v1",
        },
      },
      {
        metadata: {
          rejection_reasons: ["hydration_candidate_rejected_overlap"],
          criterion: "PACING",
          revision_operation: "compress_selected_passage",
          model: "gpt-4o-mini",
          prompt_version: "candidate_hydration_v1",
          candidate_anchor_overlap_scores: { a: 0.62, b: 0.51, c: 0.48 },
          candidate_word_counts: { a: 205, b: 99, c: 45 },
          hydration_result: "rejected_overlap",
          candidate_generation_status: "backend_filled_abc_v1_ai_hydrated_partial",
        },
      },
    ]);

    expect(result.total_rejected_events).toBe(2);
    expect(result.reason_code_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "canon_authority_blocked", count: 1 }),
        expect.objectContaining({ key: "hydration_input_incomplete", count: 1 }),
        expect.objectContaining({ key: "hydration_candidate_rejected_overlap", count: 1 }),
      ]),
    );
    expect(result.criterion_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "DIALOGUE", count: 1 }),
        expect.objectContaining({ key: "PACING", count: 1 }),
      ]),
    );
    expect(result.revision_operation_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "replace_selected_passage", count: 1 }),
        expect.objectContaining({ key: "compress_selected_passage", count: 1 }),
      ]),
    );

    expect(result.model_prompt_version_counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: "gpt-4o-mini", prompt_version: "candidate_hydration_v1", count: 2 }),
      ]),
    );

    expect(result.overlap_score_buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "0.00-0.09", count: 1 }),
        expect.objectContaining({ key: "0.25-0.49", count: 2 }),
        expect.objectContaining({ key: "0.50-0.74", count: 2 }),
        expect.objectContaining({ key: "0.75-1.00", count: 1 }),
      ]),
    );

    expect(result.candidate_word_count_buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "0", count: 1 }),
        expect.objectContaining({ key: "1-20", count: 1 }),
        expect.objectContaining({ key: "21-50", count: 1 }),
        expect.objectContaining({ key: "51-100", count: 2 }),
        expect.objectContaining({ key: "201+", count: 1 }),
      ]),
    );

    const serialized = JSON.stringify(result);
    const forbiddenKeys = [
      "evidence_anchor",
      "anchor_text",
      "candidate_text_a",
      "candidate_text_b",
      "candidate_text_c",
      "rationale",
      "manuscript_context",
      "source_excerpt",
      "dialogue",
      "character_name",
      "location_name",
    ];

    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(`\"${key}\"`);
    }
  });
});
