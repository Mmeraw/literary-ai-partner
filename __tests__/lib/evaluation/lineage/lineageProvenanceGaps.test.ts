import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { buildPass2SourceManifestFromChunks } from "@/lib/evaluation/pipeline/runPass2";
import { reconcilePass2ToPass3Lineage } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { RecommendationDispositionContractError } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type { Pass2SourceManifest, SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import type { RecommendationLineageOutcome } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";

import {
  LINEAGE_PUBLIC_FAILURE_CODE,
  classifyReconcilerIssues,
  mapReconcilerIssueToSubcode,
} from "@/lib/evaluation/lineage/lineageSubcodes";
import {
  buildRekickProvenanceEnvelope,
  fingerprintRekickEnvelope,
  validateRekickProvenance,
} from "@/lib/evaluation/lineage/rekickProvenance";
import {
  InMemoryAtomicLineageStore,
  LineageLedgerPersistenceError,
  buildLineageLedger,
  persistCanonicalResultWithLedger,
} from "@/lib/evaluation/lineage/atomicLedgerPersistence";

const BASE_PASS2_REC = {
  priority: "high" as const,
  action:
    "Rewrite the opening chapter so the protagonist's motivation is grounded in a concrete loss rather than an abstract dread.",
  expected_impact:
    "The reader feels immediate emotional stakes and stays anchored in the protagonist's perspective through the first act.",
  anchor_snippet:
    "She had always feared the dark, but the true dark was the empty chair at her mother's table.",
  issue_family: "characterization" as const,
  strategic_lever: "character_voice_differentiation" as const,
  revision_granularity: "scene" as const,
  mechanism: "The current opening tells the reader about a generalized fear instead of showing a specific loss.",
  specific_fix: "Ground the protagonist's motivation in a concrete loss at the opening.",
  reader_effect: "The reader feels immediate emotional stakes and stays anchored.",
  source_pass: 2 as const,
};

function makePass2Output(): SinglePassOutput {
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
  } as unknown as SinglePassOutput;
}

function makeManifest(): Pass2SourceManifest {
  return buildPass2SourceManifestFromChunks([{ chunk_index: 0, result: makePass2Output() }]);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("lineage subcodes (precise internal codes over stable public code)", () => {
  it("maps every known reconciler issue prefix to its precise subcode", () => {
    expect(mapReconcilerIssueToSubcode("outcome_missing_source_id")).toBe("LINEAGE_OUTCOME_MISSING_SOURCE_ID");
    expect(mapReconcilerIssueToSubcode("unknown:src-1")).toBe("LINEAGE_UNKNOWN_SOURCE");
    expect(mapReconcilerIssueToSubcode("duplicate:src-1")).toBe("LINEAGE_DUPLICATE_SOURCE");
    expect(mapReconcilerIssueToSubcode("missing:src-1")).toBe("LINEAGE_MISSING_SOURCE");
    expect(mapReconcilerIssueToSubcode("suppression_missing_governance:src-1")).toBe(
      "LINEAGE_SUPPRESSION_MISSING_GOVERNANCE",
    );
    expect(mapReconcilerIssueToSubcode("consolidation_missing_target:src-1")).toBe(
      "LINEAGE_CONSOLIDATION_MISSING_TARGET",
    );
    expect(mapReconcilerIssueToSubcode("consolidation_unknown_target:src-1")).toBe(
      "LINEAGE_CONSOLIDATION_UNKNOWN_TARGET",
    );
    expect(mapReconcilerIssueToSubcode("consolidation_self_target:src-1")).toBe(
      "LINEAGE_CONSOLIDATION_SELF_TARGET",
    );
    expect(mapReconcilerIssueToSubcode("consolidation_target_missing:src-1")).toBe(
      "LINEAGE_CONSOLIDATION_TARGET_MISSING",
    );
    expect(mapReconcilerIssueToSubcode("unresolved_surviving_target:src-1")).toBe(
      "LINEAGE_UNRESOLVED_SURVIVING_TARGET",
    );
    expect(mapReconcilerIssueToSubcode("unknown_outcome:src-1")).toBe("LINEAGE_UNKNOWN_OUTCOME");
  });

  it("classifies an unrecognized issue as LINEAGE_UNCLASSIFIED without throwing", () => {
    expect(mapReconcilerIssueToSubcode("brand_new_token:x")).toBe("LINEAGE_UNCLASSIFIED");
  });

  it("dedups subcodes, preserves first-seen order, and pins the public code", () => {
    const result = classifyReconcilerIssues([
      "missing:a",
      "missing:b",
      "unknown:c",
      "",
      "missing:d",
    ]);
    expect(result.public_failure_code).toBe(LINEAGE_PUBLIC_FAILURE_CODE);
    expect(result.subcodes).toEqual(["LINEAGE_MISSING_SOURCE", "LINEAGE_UNKNOWN_SOURCE"]);
  });

  it("classifies REAL reconciler issues from an actual fail-closed reconciliation", () => {
    const pass2 = makePass2Output();
    pass2.source_manifest = makeManifest();
    let caught: RecommendationDispositionContractError | null = null;
    try {
      // No current criteria and no lineage → every source is unaccounted → throws.
      reconcilePass2ToPass3Lineage(pass2, [] as never, [] as never);
    } catch (err) {
      caught = err as RecommendationDispositionContractError;
    }
    expect(caught).toBeInstanceOf(RecommendationDispositionContractError);
    expect(caught!.failureCode).toBe(LINEAGE_PUBLIC_FAILURE_CODE);
    const issues = (caught!.details.issues as string[]) ?? [];
    expect(issues.length).toBeGreaterThan(0);
    const classified = classifyReconcilerIssues(issues);
    expect(classified.public_failure_code).toBe(LINEAGE_PUBLIC_FAILURE_CODE);
    expect(classified.subcodes).toContain("LINEAGE_MISSING_SOURCE");
  });
});

describe("re-kick provenance envelope (identity/provenance must survive a re-kick)", () => {
  it("validates an unchanged manifest as provenance-preserving", () => {
    const manifest = makeManifest();
    const envelope = buildRekickProvenanceEnvelope(manifest, "attempt-1");
    expect(envelope.source_count).toBe(manifest.source_count);
    const result = validateRekickProvenance(envelope, clone(manifest));
    expect(result.valid).toBe(true);
    expect(result.subcodes).toEqual([]);
  });

  it("is deterministic: identical manifests fingerprint identically", () => {
    const a = buildRekickProvenanceEnvelope(makeManifest(), "attempt-1");
    const b = buildRekickProvenanceEnvelope(makeManifest(), "attempt-1");
    expect(fingerprintRekickEnvelope(a)).toBe(fingerprintRekickEnvelope(b));
  });

  it("flags a dropped source as LINEAGE_REKICK_PROVENANCE_MISMATCH", () => {
    const manifest = makeManifest();
    const envelope = buildRekickProvenanceEnvelope(manifest, "attempt-1");
    const rekick = clone(manifest);
    rekick.records = rekick.records.slice(1);
    rekick.source_count = rekick.records.length;
    const result = validateRekickProvenance(envelope, rekick);
    expect(result.valid).toBe(false);
    expect(result.subcodes).toContain("LINEAGE_REKICK_PROVENANCE_MISMATCH");
  });

  it("flags an introduced source as LINEAGE_REKICK_PROVENANCE_MISMATCH", () => {
    const manifest = makeManifest();
    const envelope = buildRekickProvenanceEnvelope(manifest, "attempt-1");
    const rekick = clone(manifest);
    rekick.records = [
      ...rekick.records,
      { ...rekick.records[0], source_id: `${rekick.records[0].source_id}-injected` },
    ];
    rekick.source_count = rekick.records.length;
    const result = validateRekickProvenance(envelope, rekick);
    expect(result.valid).toBe(false);
    expect(result.subcodes).toContain("LINEAGE_REKICK_PROVENANCE_MISMATCH");
  });

  it("flags a rewritten chunk hash as the forbidden LINEAGE_CHUNK_HASH_MISMATCH", () => {
    const manifest = makeManifest();
    const envelope = buildRekickProvenanceEnvelope(manifest, "attempt-1");
    const rekick = clone(manifest);
    rekick.records[0].origin_chunk_hash = "rewritten-hash";
    const result = validateRekickProvenance(envelope, rekick);
    expect(result.valid).toBe(false);
    expect(result.subcodes).toContain("LINEAGE_CHUNK_HASH_MISMATCH");
    expect(result.details.some((d) => d.startsWith("chunk_hash_rewrite:"))).toBe(true);
  });

  it("flags source-set fingerprint drift even when ids and counts match", () => {
    const manifest = makeManifest();
    const envelope = buildRekickProvenanceEnvelope(manifest, "attempt-1");
    const rekick = clone(manifest);
    rekick.source_set_fingerprint = "tampered-fingerprint";
    const result = validateRekickProvenance(envelope, rekick);
    expect(result.valid).toBe(false);
    expect(result.subcodes).toContain("LINEAGE_REKICK_PROVENANCE_MISMATCH");
    expect(result.details).toContain("source_set_fingerprint_drift");
  });
});

describe("atomic canonical-result + no-prose ledger persistence", () => {
  const canonical = { attempt_id: "attempt-1", manuscript_id: "7519", payload_fingerprint: "fp-1" };
  const outcomes: RecommendationLineageOutcome[] = [
    { source_id: "src-b", outcome: "materialized", canonical_opportunity_id: "src-b" },
    {
      source_id: "src-a",
      outcome: "suppressed",
      governing_rule: "score_10_suppression",
      rationale: "This opportunity is already fully realized in the manuscript.",
      evidence: "Chapter 3 already executes this beat.",
    },
    { source_id: "src-c", outcome: "consolidated", consolidated_into_source_id: "src-b" },
  ];

  it("builds a deterministic, source-id-sorted, no-prose ledger", () => {
    const ledger = buildLineageLedger(outcomes);
    expect(ledger.map((e) => e.source_id)).toEqual(["src-a", "src-b", "src-c"]);
    const suppressed = ledger.find((e) => e.source_id === "src-a")!;
    // Prose is referenced by digest, never stored verbatim.
    expect(suppressed.rationale_ref).toMatch(/^sha256:[0-9a-f]{64}$/);
    const serialized = JSON.stringify(ledger);
    expect(serialized).not.toContain("already fully realized");
    expect(serialized).not.toContain("Chapter 3");
  });

  it("persists both canonical result and ledger under a single version bump", async () => {
    const store = new InMemoryAtomicLineageStore();
    const ledger = await persistCanonicalResultWithLedger(store, canonical, outcomes);
    expect(store.version).toBe(1);
    expect(store.canonicalResults.get("attempt-1")).toBeDefined();
    expect(store.ledgers.get("attempt-1")).toHaveLength(ledger.length);
  });

  it("writes NEITHER record and stays at version 0 when the ledger write faults", async () => {
    const store = new InMemoryAtomicLineageStore("before_ledger");
    await expect(persistCanonicalResultWithLedger(store, canonical, outcomes)).rejects.toBeInstanceOf(
      LineageLedgerPersistenceError,
    );
    expect(store.version).toBe(0);
    expect(store.canonicalResults.size).toBe(0);
    expect(store.ledgers.size).toBe(0);
  });

  it("writes NEITHER record when the canonical write faults, surfacing the public code + subcode", async () => {
    const store = new InMemoryAtomicLineageStore("before_canonical");
    let caught: LineageLedgerPersistenceError | null = null;
    try {
      await persistCanonicalResultWithLedger(store, canonical, outcomes);
    } catch (err) {
      caught = err as LineageLedgerPersistenceError;
    }
    expect(caught).toBeInstanceOf(LineageLedgerPersistenceError);
    expect(caught!.failureCode).toBe(LINEAGE_PUBLIC_FAILURE_CODE);
    expect(caught!.subcode).toBe("LINEAGE_LEDGER_PERSISTENCE_FAILED");
    expect(store.version).toBe(0);
    expect(store.canonicalResults.size).toBe(0);
    expect(store.ledgers.size).toBe(0);
  });
});
