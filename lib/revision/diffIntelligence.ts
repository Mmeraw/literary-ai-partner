import { type WaveEntry, getWave } from "./waveRegistry";
import { type RevisionMode } from "./wavePlanner";

export type ProposedEdit = {
  waveId: number;
  editId: string;
  originalText: string;
  proposedText: string;
  scope: string;
  sentenceIndex: number;
  paragraphIndex: number;
  confidence: number;
  rationale: string;
  tags: string[];
};

export type DiffGroup = {
  groupId: string;
  waveIds: number[];
  edits: ProposedEdit[];
  conflictRisk: "low" | "medium" | "high";
  applyOrder: number;
  canMerge: boolean;
};

export type DiffReport = {
  rankedEdits: ProposedEdit[];
  groups: DiffGroup[];
  suppressedEdits: ProposedEdit[];
  totalEditCount: number;
  estimatedRisk: "low" | "medium" | "high";
  applySummary: string;
};

type Span = {
  start: number;
  end: number;
};

function scopeNarrowness(scope: string): number {
  const normalized = scope.trim().toLowerCase();
  if (normalized === "sentence") return 0;
  if (normalized === "paragraph") return 1;
  if (normalized === "scene") return 2;
  if (normalized === "chapter") return 3;
  return 4;
}

function countSentences(text: string): number {
  if (text.trim().length === 0) {
    return 1;
  }

  const punctuationSplits = text
    .split(/[.!?]+/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0).length;

  if (punctuationSplits > 0) {
    return punctuationSplits;
  }

  const lineSplits = text
    .split(/\n+/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0).length;

  return Math.max(1, lineSplits);
}

function estimateSentenceSpan(edit: ProposedEdit): Span {
  const sentenceCount = Math.max(
    countSentences(edit.originalText),
    countSentences(edit.proposedText),
  );

  const start = Math.max(0, edit.sentenceIndex);
  const end = start + Math.max(1, sentenceCount) - 1;

  return { start, end };
}

function spansOverlap(a: Span, b: Span): boolean {
  return a.start <= b.end && b.start <= a.end;
}

function editsOverlap(a: ProposedEdit, b: ProposedEdit): boolean {
  if (a.paragraphIndex !== b.paragraphIndex) {
    return false;
  }

  return spansOverlap(estimateSentenceSpan(a), estimateSentenceSpan(b));
}

function touchesSameSentence(a: ProposedEdit, b: ProposedEdit): boolean {
  if (a.paragraphIndex !== b.paragraphIndex) {
    return false;
  }

  return spansOverlap(estimateSentenceSpan(a), estimateSentenceSpan(b));
}

function sentenceSpanLength(edit: ProposedEdit): number {
  const span = estimateSentenceSpan(edit);
  return span.end - span.start + 1;
}

function getWavePriority(waveId: number): number {
  const wave: WaveEntry | undefined = getWave(waveId);
  return wave?.priority ?? 0;
}

function compareEdits(a: ProposedEdit, b: ProposedEdit): number {
  if (a.confidence !== b.confidence) {
    return b.confidence - a.confidence;
  }

  const aScope = scopeNarrowness(a.scope);
  const bScope = scopeNarrowness(b.scope);
  if (aScope !== bScope) {
    return aScope - bScope;
  }

  const aWavePriority = getWavePriority(a.waveId);
  const bWavePriority = getWavePriority(b.waveId);
  if (aWavePriority !== bWavePriority) {
    return bWavePriority - aWavePriority;
  }

  if (a.paragraphIndex !== b.paragraphIndex) {
    return a.paragraphIndex - b.paragraphIndex;
  }

  if (a.sentenceIndex !== b.sentenceIndex) {
    return a.sentenceIndex - b.sentenceIndex;
  }

  return a.editId.localeCompare(b.editId);
}

function getConflictWinner(a: ProposedEdit, b: ProposedEdit): ProposedEdit {
  const byRank = compareEdits(a, b);
  if (byRank <= 0) {
    return a;
  }
  return b;
}

function normalizeEdits(edits: ProposedEdit[]): ProposedEdit[] {
  const seen = new Set<string>();
  const normalized: ProposedEdit[] = [];

  for (const edit of edits) {
    const key = `${edit.editId}::${edit.waveId}::${edit.paragraphIndex}::${edit.sentenceIndex}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(edit);
  }

  return normalized;
}

export function rankEdits(edits: ProposedEdit[], mode: RevisionMode): ProposedEdit[] {
  void mode;
  return normalizeEdits(edits).sort(compareEdits);
}

export function suppressOverlapping(
  edits: ProposedEdit[],
  mode: RevisionMode,
): { kept: ProposedEdit[]; suppressed: ProposedEdit[] } {
  const ranked = rankEdits(edits, mode);
  const kept: ProposedEdit[] = [];
  const suppressed: ProposedEdit[] = [];

  for (const edit of ranked) {
    if (mode === "surgical" && sentenceSpanLength(edit) > 2) {
      suppressed.push(edit);
      continue;
    }

    const overlappingKept = kept.find((candidate) => editsOverlap(candidate, edit));
    if (!overlappingKept) {
      kept.push(edit);
      continue;
    }

    const winner = getConflictWinner(overlappingKept, edit);
    if (winner.editId === overlappingKept.editId) {
      suppressed.push(edit);
      continue;
    }

    const keptIndex = kept.findIndex((candidate) => candidate.editId === overlappingKept.editId);
    if (keptIndex >= 0) {
      kept.splice(keptIndex, 1, edit);
    } else {
      kept.push(edit);
    }
    suppressed.push(overlappingKept);
  }

  return {
    kept: kept.sort(compareEdits),
    suppressed: suppressed.sort(compareEdits),
  };
}

function estimateGroupRisk(groupEdits: ProposedEdit[]): "low" | "medium" | "high" {
  if (groupEdits.length <= 1) {
    return "low";
  }

  let overlapPairs = 0;
  const uniqueWaves = new Set<number>();
  let lowConfidenceCount = 0;

  for (const edit of groupEdits) {
    uniqueWaves.add(edit.waveId);
    if (edit.confidence < 0.6) {
      lowConfidenceCount += 1;
    }
  }

  for (let i = 0; i < groupEdits.length; i += 1) {
    for (let j = i + 1; j < groupEdits.length; j += 1) {
      if (editsOverlap(groupEdits[i], groupEdits[j])) {
        overlapPairs += 1;
      }
    }
  }

  const highComplexity = groupEdits.length >= 4 || uniqueWaves.size >= 3 || overlapPairs >= 3;
  if (highComplexity || lowConfidenceCount >= 2) {
    return "high";
  }

  return "medium";
}

export function groupEdits(edits: ProposedEdit[]): DiffGroup[] {
  const ranked = rankEdits(edits, "standard");
  const visited = new Set<string>();
  const groups: DiffGroup[] = [];

  for (const seed of ranked) {
    if (visited.has(seed.editId)) {
      continue;
    }

    const queue: ProposedEdit[] = [seed];
    const connected: ProposedEdit[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.editId)) {
        continue;
      }

      visited.add(current.editId);
      connected.push(current);

      for (const candidate of ranked) {
        if (visited.has(candidate.editId)) {
          continue;
        }
        if (editsOverlap(current, candidate)) {
          queue.push(candidate);
        }
      }
    }

    const orderedEdits = connected.sort(compareEdits);
    const waveIds = [...new Set(orderedEdits.map((edit) => edit.waveId))].sort((a, b) => a - b);

    let canMerge = false;
    for (let i = 0; i < orderedEdits.length; i += 1) {
      for (let j = i + 1; j < orderedEdits.length; j += 1) {
        if (touchesSameSentence(orderedEdits[i], orderedEdits[j])) {
          canMerge = true;
          break;
        }
      }
      if (canMerge) {
        break;
      }
    }

    groups.push({
      groupId: `grp-${groups.length + 1}`,
      waveIds,
      edits: orderedEdits,
      conflictRisk: estimateGroupRisk(orderedEdits),
      applyOrder: groups.length + 1,
      canMerge,
    });
  }

  groups.sort((a, b) => {
    const aTop = a.edits[0];
    const bTop = b.edits[0];
    if (!aTop || !bTop) {
      return a.groupId.localeCompare(b.groupId);
    }

    return compareEdits(aTop, bTop);
  });

  return groups.map((group, index) => ({
    ...group,
    groupId: `grp-${index + 1}`,
    applyOrder: index + 1,
  }));
}

function estimateReportRisk(
  groups: DiffGroup[],
  suppressed: ProposedEdit[],
  keptCount: number,
): "low" | "medium" | "high" {
  const hasHighGroup = groups.some((group) => group.conflictRisk === "high");
  if (hasHighGroup) {
    return "high";
  }

  const suppressionRatio = keptCount === 0 ? 0 : suppressed.length / keptCount;
  if (suppressionRatio > 0.4 || groups.some((group) => group.conflictRisk === "medium")) {
    return "medium";
  }

  return "low";
}

export function buildDiffReport(edits: ProposedEdit[], mode: RevisionMode): DiffReport {
  const normalized = normalizeEdits(edits);
  const rankedInput = rankEdits(normalized, mode);
  const { kept, suppressed } = suppressOverlapping(rankedInput, mode);
  const rankedEdits = rankEdits(kept, mode);
  const groups = groupEdits(rankedEdits);

  const estimatedRisk = estimateReportRisk(groups, suppressed, rankedEdits.length);
  const applySummary =
    `Prepared ${rankedEdits.length} ranked edits in ${groups.length} groups` +
    ` (${suppressed.length} suppressed), estimated risk: ${estimatedRisk}.`;

  return {
    rankedEdits,
    groups,
    suppressedEdits: suppressed,
    totalEditCount: rankedEdits.length,
    estimatedRisk,
    applySummary,
  };
}
