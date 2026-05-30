import { __testing } from "@/lib/revision/workbenchQueue";
import type { DiagnosticFinding } from "@/lib/revision/types";

function makeFinding(overrides: Partial<DiagnosticFinding> = {}): DiagnosticFinding {
  return {
    id: overrides.id ?? "finding-1",
    evaluation_job_id: overrides.evaluation_job_id ?? "eval-1",
    manuscript_version_id: overrides.manuscript_version_id ?? "mv-1",
    artifact_id: overrides.artifact_id ?? null,
    criterion_key: overrides.criterion_key ?? "PACING",
    wave_id: overrides.wave_id ?? null,
    finding_type: overrides.finding_type ?? "diagnostic_finding",
    severity: overrides.severity ?? "medium",
    confidence: overrides.confidence ?? 0.8,
    location_ref: overrides.location_ref ?? null,
    chunk_id: overrides.chunk_id ?? null,
    chapter_index: overrides.chapter_index ?? null,
    paragraph_index: overrides.paragraph_index ?? null,
    sentence_index: overrides.sentence_index ?? null,
    original_text: overrides.original_text ?? null,
    evidence_excerpt: overrides.evidence_excerpt ?? null,
    diagnosis: overrides.diagnosis ?? "Long paragraph may dilute pacing or visual clarity for the reader.",
    recommendation: overrides.recommendation ?? "Condense repeated exposition beats.",
    action_hint: overrides.action_hint ?? "refine",
    status: overrides.status ?? "open",
    created_at: overrides.created_at ?? "2026-05-29T00:00:00.000Z",
  };
}

describe("workbench queue admission synthesis", () => {
  test("holds findings with missing evidence and no location/manuscript-wide support", () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({ id: "no-evidence", evidence_excerpt: null, original_text: null, location_ref: null, diagnosis: "Generic style issue." }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.held).toBe(1);
    expect(result.synthesis.admitted).toBe(0);
    expect(result.synthesis.clustered).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });

  test("clusters repeated generic findings at threshold and suppresses duplicates", () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({ id: "r1", evidence_excerpt: "Paragraph 1 excerpt" }),
      makeFinding({ id: "r2", evidence_excerpt: "Paragraph 2 excerpt" }),
      makeFinding({ id: "r3", evidence_excerpt: "Paragraph 3 excerpt" }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.clustered).toBe(1);
    expect(result.synthesis.suppressed).toBe(2);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].id.startsWith("cluster:")).toBe(true);
    expect(result.opportunities[0].scope).toBe("Manuscript");
  });

  test("keeps findings individual when repetition is below clustering threshold", () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({ id: "i1", evidence_excerpt: "excerpt one" }),
      makeFinding({ id: "i2", evidence_excerpt: "excerpt two" }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.admitted).toBe(2);
    expect(result.synthesis.clustered).toBe(0);
    expect(result.synthesis.suppressed).toBe(0);
    expect(result.opportunities).toHaveLength(2);
    expect(result.opportunities.every((item) => !item.id.startsWith("cluster:"))).toBe(true);
  });

  test("treats manuscript-wide support as actionable evidence", () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({
        id: "manuscript-wide",
        evidence_excerpt: null,
        original_text: null,
        location_ref: null,
        diagnosis: "This pattern appears across the manuscript and creates drag.",
      }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.held).toBe(0);
    expect(result.opportunities).toHaveLength(1);
  });
});
