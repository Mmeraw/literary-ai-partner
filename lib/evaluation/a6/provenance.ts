import type {
  A6AnchorLike,
  A6CriterionInput,
  A6CriterionName,
  A6ProvenanceEntry,
} from "./types";

export function buildProvenance(
  criteria: A6CriterionInput[],
  anchors: A6AnchorLike[],
): A6ProvenanceEntry[] {
  const usage = new Map<string, Set<A6CriterionName>>();

  for (const criterion of criteria) {
    for (const ref of criterion.evidence_refs) {
      if (!usage.has(ref)) usage.set(ref, new Set<A6CriterionName>());
      usage.get(ref)!.add(criterion.name);
    }
  }

  return anchors
    .filter((anchor) => usage.has(anchor.anchor_id))
    .map((anchor) => ({
      anchor_id: anchor.anchor_id,
      start_offset: anchor.start_offset,
      end_offset: anchor.end_offset,
      source_excerpt: anchor.source_excerpt,
      used_for: Array.from(usage.get(anchor.anchor_id)!),
    }));
}
