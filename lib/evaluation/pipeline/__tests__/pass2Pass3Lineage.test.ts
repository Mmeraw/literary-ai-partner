import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  buildPass2SourceManifest,
  buildPass2SourceManifestFromChunks,
} from "@/lib/evaluation/pipeline/runPass2";
import { reconcilePass2ToPass3Lineage } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { RecommendationDispositionContractError } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

const BASE_PASS2_REC = {
  priority: "high" as const,
  action: "Rewrite the opening chapter so the protagonist's motivation is grounded in a concrete loss rather than an abstract dread.",
  expected_impact: "The reader feels immediate emotional stakes and stays anchored in the protagonist's perspective through the first act.",
  anchor_snippet: "She had always feared the dark, but the true dark was the empty chair at her mother's table.",
  issue_family: "characterization" as const,
  strategic_lever: "character_voice_differentiation" as const,
  revision_granularity: "scene" as const,
  mechanism: "The current opening tells the reader about a generalized fear instead of showing a specific loss.",
  specific_fix: "Ground the protagonist's motivation in a concrete loss at the opening.",
  reader_effect: "The reader feels immediate emotional stakes and stays anchored.",
  source_pass: 2 as const,
};

function makePass2Output(): any {
  return {
    pass: 2,
    axis: "editorial_literary",
    model: "gpt-4o-mini",
    prompt_version: "pass2-test",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 6,
      rationale: `Test rationale for ${key}`,
      evidence: [{ snippet: "test evidence" }],
      recommendations: [{ ...BASE_PASS2_REC }],
      recommendation_status: "recommendation_provided" as const,
    })),
  };
}

function makePass3CriteriaFromPass2(pass2: any): any[] {
  return pass2.criteria.map((criterion: any) => ({
    key: criterion.key,
    craft_score: 6,
    editorial_score: 6,
    final_score_0_10: 6,
    score_delta: 0,
    final_rationale: criterion.rationale,
    pressure_points: ["test pressure"],
    decision_points: ["test decision"],
    consequence_status: "landed" as const,
    evidence: criterion.evidence,
    recommendation_status: "recommendation_provided" as const,
    recommendations: criterion.recommendations.map((rec: any) => ({
      priority: rec.priority,
      action: rec.action,
      expected_impact: rec.expected_impact,
      anchor_snippet: rec.anchor_snippet,
      issue_family: rec.issue_family,
      strategic_lever: rec.strategic_lever,
      revision_granularity: rec.revision_granularity,
      mechanism: rec.mechanism,
      specific_fix: rec.specific_fix,
      reader_effect: rec.reader_effect,
      symptom: rec.symptom,
      source_pass: 3 as const,
    })),
  }));
}

describe("Pass 2 source manifest", () => {
  it("captures one record per meaningful Pass 2 recommendation", () => {
    const pass2 = makePass2Output();
    const manifest = buildPass2SourceManifest(pass2, 0, 1);
    expect(manifest.records).toHaveLength(CRITERIA_KEYS.length);
    expect(manifest.chunk_count).toBe(1);
    expect(manifest.source_count).toBe(CRITERIA_KEYS.length);
    for (const record of manifest.records) {
      expect(record.source_id).toMatch(new RegExp(`^${record.criterion_key}:`));
      expect(record.origin_chunk_id).toBe(0);
      expect(record.origin_chunk_hash).toHaveLength(64);
      expect(record.source_fingerprint).toHaveLength(20);
      expect(record.source_version).toBeTruthy();
    }
  });

  it("aggregates 30 chunk manifests into a stable source-set fingerprint", () => {
    const indexedResults = Array.from({ length: 30 }, (_, chunk_index) => ({
      chunk_index,
      result: makePass2Output(),
    }));
    const manifest = buildPass2SourceManifestFromChunks(indexedResults);
    expect(manifest.chunk_count).toBe(30);
    expect(manifest.source_count).toBe(CRITERIA_KEYS.length);
    expect(manifest.source_set_fingerprint).toHaveLength(64);
    const firstRun = manifest.source_set_fingerprint;
    const secondRun = buildPass2SourceManifestFromChunks(indexedResults).source_set_fingerprint;
    expect(secondRun).toBe(firstRun);
  });

  it("returns identical manifest on replay", () => {
    const pass2 = makePass2Output();
    const first = buildPass2SourceManifest(pass2, 0, 1);
    const second = buildPass2SourceManifest(pass2, 0, 1);
    expect(second.source_set_fingerprint).toBe(first.source_set_fingerprint);
    expect(second.records.map((r) => r.source_id)).toEqual(first.records.map((r) => r.source_id));
  });
});

describe("Pass 2 -> Pass 3 lineage reconciliation", () => {
  it("materializes all sources when lineage is absent and every source matches a unique final recommendation", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    const result = reconcilePass2ToPass3Lineage(pass2, currentCriteria, []);
    expect(result.recommendationLineage).toHaveLength(CRITERIA_KEYS.length);
    expect(result.recommendationLineage.every((o) => o.outcome === "materialized")).toBe(true);
    for (const criterion of currentCriteria) {
      expect(criterion.recommendations[0]?.source_recommendation_ids).toHaveLength(1);
    }
  });

  it("reconciles a partial lineage while preserving explicit outcomes", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    const explicitSource = pass2.source_manifest.records.find(
      (record) => record.criterion_key === currentCriteria[0].key,
    )!.source_id;
    currentCriteria[0].recommendations[0].source_recommendation_ids = [explicitSource];
    const partialLineage = [{ source_id: explicitSource, outcome: "materialized" as const }];
    const result = reconcilePass2ToPass3Lineage(pass2, currentCriteria, partialLineage);
    expect(result.recommendationLineage).toHaveLength(CRITERIA_KEYS.length);
    const explicit = result.recommendationLineage.find((o) => o.source_id === explicitSource);
    expect(explicit?.outcome).toBe("materialized");
  });

  it("is idempotent: a second reconciliation with the same inputs makes no changes", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    const first = reconcilePass2ToPass3Lineage(pass2, currentCriteria, []);
    const second = reconcilePass2ToPass3Lineage(pass2, currentCriteria, first.recommendationLineage);
    expect(second.recommendationLineage).toEqual(first.recommendationLineage);
  });

  it("fails closed when a source cannot be matched to any final recommendation", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    currentCriteria[0].recommendations = [];
    currentCriteria[0].recommendation_status = "no_recommendation_warranted";
    currentCriteria[0].recommendation_status_rationale = "No safe recommendation.";
    expect(() => reconcilePass2ToPass3Lineage(pass2, currentCriteria, [])).toThrow(
      RecommendationDispositionContractError,
    );
  });

  it("fails closed for an unknown source id in explicit lineage", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    expect(() =>
      reconcilePass2ToPass3Lineage(pass2, currentCriteria, [
        { source_id: "unknown:deadbeef:1", outcome: "materialized" as const },
      ]),
    ).toThrow(RecommendationDispositionContractError);
  });

  it("fails closed for a duplicate source id in explicit lineage", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    const sourceId = pass2.source_manifest.records[0].source_id;
    expect(() =>
      reconcilePass2ToPass3Lineage(pass2, currentCriteria, [
        { source_id: sourceId, outcome: "materialized" as const },
        { source_id: sourceId, outcome: "suppressed" as const, governing_rule: "r1", rationale: "r" },
      ]),
    ).toThrow(RecommendationDispositionContractError);
  });

  it("fails closed when two sources compete for the same final recommendation", () => {
    const pass2 = makePass2Output();
    // Make two criteria share the same recommendation text so their sources fingerprint identically.
    pass2.criteria[0].recommendations = [{ ...BASE_PASS2_REC }];
    pass2.criteria[1].recommendations = [{ ...BASE_PASS2_REC }];
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    // Make only one surviving recommendation in the whole output.
    for (let i = 1; i < currentCriteria.length; i += 1) {
      currentCriteria[i].recommendations = [];
      currentCriteria[i].recommendation_status = "no_recommendation_warranted";
      currentCriteria[i].recommendation_status_rationale = "Consolidated.";
    }
    expect(() => reconcilePass2ToPass3Lineage(pass2, currentCriteria, [])).toThrow(
      RecommendationDispositionContractError,
    );
  });

  it("does not synthesize recommendation prose in the ledger", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = buildPass2SourceManifest(pass2, 0, 1);
    const currentCriteria = makePass3CriteriaFromPass2(pass2);
    const result = reconcilePass2ToPass3Lineage(pass2, currentCriteria, []);
    const ledgerJson = JSON.stringify(result.recommendationLineage);
    expect(ledgerJson).not.toContain(pass2.criteria[0].recommendations[0].action);
    expect(ledgerJson).not.toContain(pass2.criteria[0].recommendations[0].anchor_snippet);
  });
});
