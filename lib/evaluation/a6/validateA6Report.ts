import type { A6EvaluationReport } from "./types";

export function validateA6Report(report: A6EvaluationReport, sourceText: string): void {
  for (const criterion of report.criteria) {
    if (!criterion.reasoning.trim()) {
      throw new Error(`A6_INVALID_REASONING:${criterion.name}`);
    }
    if (criterion.evidence_refs.length === 0) {
      throw new Error(`A6_MISSING_EVIDENCE_REFS:${criterion.name}`);
    }
  }

  const provenanceIds = new Set(report.provenance.map((p) => p.anchor_id));

  for (const criterion of report.criteria) {
    for (const ref of criterion.evidence_refs) {
      if (!provenanceIds.has(ref)) {
        throw new Error(`A6_ORPHAN_REASONING_REF:${criterion.name}:${ref}`);
      }
    }
  }

  for (const entry of report.provenance) {
    if (entry.start_offset < 0 || entry.end_offset <= entry.start_offset) {
      throw new Error(`A6_INVALID_PROVENANCE_OFFSETS:${entry.anchor_id}`);
    }

    const resolved = sourceText.slice(entry.start_offset, entry.end_offset);
    if (resolved !== entry.source_excerpt) {
      throw new Error(`A6_PHANTOM_ANCHOR:${entry.anchor_id}`);
    }

    if (entry.used_for.length === 0) {
      throw new Error(`A6_UNUSED_PROVENANCE:${entry.anchor_id}`);
    }
  }
}
