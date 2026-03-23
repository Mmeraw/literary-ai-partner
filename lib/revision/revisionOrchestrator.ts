import {
  planWaves,
  deriveWaveTargetsFromFindings,
  validatePlan,
  type WavePlan,
  type RevisionMode,
} from "./wavePlanner";
import {
  buildDiffReport,
  type DiffReport,
  type ProposedEdit,
} from "./diffIntelligence";
import { resolveConflicts, buildExecutionPlan } from "./waveConflicts";
import { getWave, WAVE_REGISTRY } from "./waveRegistry";

export type OrchestratorInput = {
  chapterText: string;
  chapterId: string;
  revisionMode: RevisionMode;
  pass1Findings?: Record<string, unknown>;
  pass2Findings?: Record<string, unknown>;
  pass3Findings?: Record<string, unknown>;
  targetWaveIds?: number[];
};

export type OrchestratorResult = {
  chapterId: string;
  plan: WavePlan;
  diffReport: DiffReport;
  appliedEdits: ProposedEdit[];
  skippedEdits: ProposedEdit[];
  executionLog: string[];
  finalText: string;
  success: boolean;
  errors: string[];
};

type ChapterStructure = {
  paragraphs: string[];
  sentenceMatrix: string[][];
};

function splitParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [];
  }

  return trimmed
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function splitSentences(paragraph: string): string[] {
  const parts = paragraph.match(/[^.!?]+[.!?]*|[^.!?]+$/g);
  if (!parts) {
    const fallback = paragraph.trim();
    return fallback.length > 0 ? [fallback] : [];
  }

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseChapter(text: string): ChapterStructure {
  const paragraphs = splitParagraphs(text);
  const sentenceMatrix = paragraphs.map((paragraph) => splitSentences(paragraph));
  return { paragraphs, sentenceMatrix };
}

function rebuildChapter(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function replaceFirstOccurrence(haystack: string, needle: string, replacement: string): string {
  const index = haystack.indexOf(needle);
  if (index === -1) {
    return haystack;
  }

  return `${haystack.slice(0, index)}${replacement}${haystack.slice(index + needle.length)}`;
}

function safeConfidence(value: number): number {
  return Math.max(0.05, Math.min(0.99, Number(value.toFixed(3))));
}

function computeConfidence(
  priority: number,
  originalText: string,
  proposedText: string,
  mode: RevisionMode,
): number {
  const base = 0.45 + priority / 180;
  const modeBoost = mode === "surgical" ? 0.08 : mode === "deep" ? -0.02 : 0;
  const delta = Math.abs(proposedText.length - originalText.length);
  const deltaPenalty = Math.min(0.12, delta / Math.max(200, originalText.length + 1));
  return safeConfidence(base + modeBoost - deltaPenalty);
}

function scoreParagraphForWave(paragraph: string, category: string): number {
  const text = paragraph.toLowerCase();
  const sentenceCount = splitSentences(paragraph).length;

  const dialogueSignals = (text.match(/["“”']/g) ?? []).length;
  const actionSignals = (text.match(/\b(run|ran|move|moved|fight|turn|rush|grab|leave|arrive)\b/g) ?? []).length;
  const claritySignals = (text.match(/\b(very|really|just|somehow|perhaps|maybe|due to the fact|in order to)\b/g) ?? []).length;
  const continuitySignals = (text.match(/\b(yesterday|today|tomorrow|suddenly|later|before|after)\b/g) ?? []).length;

  switch (category) {
    case "dialogue":
      return dialogueSignals * 3 + sentenceCount;
    case "pacing":
      return sentenceCount * 2 + actionSignals;
    case "clarity":
    case "polish":
      return claritySignals * 2 + sentenceCount;
    case "continuity":
    case "scene":
      return continuitySignals * 2 + sentenceCount;
    case "character":
      return (text.match(/\b(he|she|they|i)\b/g) ?? []).length + sentenceCount;
    default:
      return sentenceCount;
  }
}

function pickParagraphIndexes(chapter: ChapterStructure, category: string, mode: RevisionMode): number[] {
  const ranked = chapter.paragraphs
    .map((paragraph, index) => ({
      index,
      score: scoreParagraphForWave(paragraph, category),
    }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));

  const maxCount = mode === "surgical" ? 1 : mode === "standard" ? 2 : 3;
  return ranked.slice(0, maxCount).map((item) => item.index).sort((a, b) => a - b);
}

function applyCategoryLogic(input: string, category: string): string {
  let output = input;

  switch (category) {
    case "structure":
      output = output
        .replace(/\bwanted to\b/gi, "needed to")
        .replace(/\bmaybe\b/gi, "must")
        .replace(/\bin the end\b/gi, "by the end");
      break;
    case "narrative":
      output = output
        .replace(/\bthen\b/gi, "next")
        .replace(/\bsuddenly\b/gi, "in that moment")
        .replace(/\bwas going to\b/gi, "would");
      break;
    case "voice":
      output = output
        .replace(/\breally\b/gi, "")
        .replace(/\bvery\b/gi, "")
        .replace(/\bI think\b/gi, "I know");
      break;
    case "dialogue":
      output = output
        .replace(/\bsaid\s+(angrily|softly|loudly|quietly)\b/gi, "said")
        .replace(/--/g, "—")
        .replace(/\bwell,\s+/gi, "");
      break;
    case "pacing":
      output = output
        .replace(/\bbegan to\b/gi, "")
        .replace(/\bstarted to\b/gi, "")
        .replace(/\bin order to\b/gi, "to");
      break;
    case "clarity":
      output = output
        .replace(/\bdue to the fact that\b/gi, "because")
        .replace(/\bat this point in time\b/gi, "now")
        .replace(/\bin order to\b/gi, "to");
      break;
    case "continuity":
      output = output
        .replace(/\bsuddenly\b/gi, "a moment later")
        .replace(/\bmeanwhile\b/gi, "at the same time");
      break;
    case "scene":
      output = output
        .replace(/\bthere was\b/gi, "")
        .replace(/\bit was\b/gi, "");
      break;
    case "character":
      output = output
        .replace(/\bwas\b/gi, "chose to be")
        .replace(/\bdecided to\b/gi, "committed to");
      break;
    case "polish":
      output = output
        .replace(/\s+,/g, ",")
        .replace(/\s+\./g, ".")
        .replace(/\bthat that\b/gi, "that");
      break;
    default:
      break;
  }

  output = output.replace(/\s{2,}/g, " ").trim();
  return output.length > 0 ? output : input;
}

function makeEdit(
  waveId: number,
  scope: string,
  paragraphIndex: number,
  sentenceIndex: number,
  originalText: string,
  proposedText: string,
  mode: RevisionMode,
  rationale: string,
  tags: string[],
  serial: number,
): ProposedEdit {
  const wave = getWave(waveId);

  return {
    waveId,
    editId: `${waveId}-${paragraphIndex}-${sentenceIndex}-${serial}`,
    originalText,
    proposedText,
    scope,
    sentenceIndex,
    paragraphIndex,
    confidence: computeConfidence(wave?.priority ?? 50, originalText, proposedText, mode),
    rationale,
    tags,
  };
}

export function generateEditsForWave(
  waveId: number,
  text: string,
  mode: RevisionMode,
): ProposedEdit[] {
  const wave = getWave(waveId);
  if (!wave) {
    return [];
  }

  const chapter = parseChapter(text);
  if (chapter.paragraphs.length === 0) {
    return [];
  }

  const paragraphIndexes = pickParagraphIndexes(chapter, wave.category, mode);
  const edits: ProposedEdit[] = [];
  let serial = 1;

  for (const paragraphIndex of paragraphIndexes) {
    const paragraph = chapter.paragraphs[paragraphIndex] ?? "";
    const sentences = chapter.sentenceMatrix[paragraphIndex] ?? [];

    if (wave.scope === "sentence") {
      const maxSentences = mode === "surgical" ? 1 : mode === "standard" ? 2 : 3;
      for (let sentenceIndex = 0; sentenceIndex < Math.min(sentences.length, maxSentences); sentenceIndex += 1) {
        const originalSentence = sentences[sentenceIndex];
        const proposedSentence = applyCategoryLogic(originalSentence, wave.category);
        if (normalizeWhitespace(originalSentence) === normalizeWhitespace(proposedSentence)) {
          continue;
        }

        edits.push(
          makeEdit(
            waveId,
            "sentence",
            paragraphIndex,
            sentenceIndex,
            originalSentence,
            proposedSentence,
            mode,
            `${wave.name}: refined sentence-level ${wave.category} signal.`,
            [wave.category, wave.scope, `mode:${mode}`, "sentence-transform"],
            serial,
          ),
        );
        serial += 1;
      }
      continue;
    }

    if (wave.scope === "paragraph") {
      const transformedSentences = sentences.map((sentence) => applyCategoryLogic(sentence, wave.category));
      const proposedParagraph = transformedSentences.join(" ").replace(/\s{2,}/g, " ").trim();

      if (normalizeWhitespace(paragraph) !== normalizeWhitespace(proposedParagraph)) {
        edits.push(
          makeEdit(
            waveId,
            "paragraph",
            paragraphIndex,
            0,
            paragraph,
            proposedParagraph,
            mode,
            `${wave.name}: improved paragraph-level ${wave.category} cohesion.`,
            [wave.category, wave.scope, `mode:${mode}`, "paragraph-transform"],
            serial,
          ),
        );
        serial += 1;
      }
      continue;
    }

    // scene/chapter waves operate on key paragraphs as macro edits.
    const anchorSentence = sentences[0] ?? paragraph;
    const transformedAnchor = applyCategoryLogic(anchorSentence, wave.category);
    let proposedParagraph = paragraph;
    if (normalizeWhitespace(anchorSentence) !== normalizeWhitespace(transformedAnchor)) {
      proposedParagraph = replaceFirstOccurrence(paragraph, anchorSentence, transformedAnchor);
    } else {
      proposedParagraph = applyCategoryLogic(paragraph, wave.category);
    }

    if (normalizeWhitespace(paragraph) === normalizeWhitespace(proposedParagraph)) {
      continue;
    }

    edits.push(
      makeEdit(
        waveId,
        wave.scope,
        paragraphIndex,
        0,
        paragraph,
        proposedParagraph,
        mode,
        `${wave.name}: applied ${wave.scope}-level ${wave.category} adjustment.`,
        [wave.category, wave.scope, `mode:${mode}`, "macro-transform"],
        serial,
      ),
    );
    serial += 1;
  }

  return edits;
}

export function applyEditToText(text: string, edit: ProposedEdit): string {
  const chapter = parseChapter(text);
  if (chapter.paragraphs.length === 0) {
    return text;
  }

  if (edit.paragraphIndex < 0 || edit.paragraphIndex >= chapter.paragraphs.length) {
    return replaceFirstOccurrence(text, edit.originalText, edit.proposedText);
  }

  const paragraphs = [...chapter.paragraphs];
  const currentParagraph = paragraphs[edit.paragraphIndex];

  if (edit.scope === "sentence") {
    const sentences = splitSentences(currentParagraph);
    if (edit.sentenceIndex >= 0 && edit.sentenceIndex < sentences.length) {
      const candidate = sentences[edit.sentenceIndex];
      if (normalizeWhitespace(candidate) === normalizeWhitespace(edit.originalText)) {
        sentences[edit.sentenceIndex] = edit.proposedText.trim();
        paragraphs[edit.paragraphIndex] = sentences.join(" ").replace(/\s{2,}/g, " ").trim();
        return rebuildChapter(paragraphs);
      }
    }

    const replacedParagraph = replaceFirstOccurrence(currentParagraph, edit.originalText, edit.proposedText);
    if (replacedParagraph !== currentParagraph) {
      paragraphs[edit.paragraphIndex] = replacedParagraph;
      return rebuildChapter(paragraphs);
    }

    return replaceFirstOccurrence(text, edit.originalText, edit.proposedText);
  }

  if (normalizeWhitespace(currentParagraph) === normalizeWhitespace(edit.originalText)) {
    paragraphs[edit.paragraphIndex] = edit.proposedText.trim();
    return rebuildChapter(paragraphs);
  }

  const replacedParagraph = replaceFirstOccurrence(currentParagraph, edit.originalText, edit.proposedText);
  if (replacedParagraph !== currentParagraph) {
    paragraphs[edit.paragraphIndex] = replacedParagraph;
    return rebuildChapter(paragraphs);
  }

  return replaceFirstOccurrence(text, edit.originalText, edit.proposedText);
}

function uniqueWaveIds(waveIds: number[]): number[] {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const waveId of waveIds) {
    if (!Number.isInteger(waveId) || seen.has(waveId) || !getWave(waveId)) {
      continue;
    }
    seen.add(waveId);
    normalized.push(waveId);
  }

  return normalized;
}

function deriveFallbackTargets(mode: RevisionMode): number[] {
  const ranked = [...WAVE_REGISTRY].sort((a, b) => b.priority - a.priority || a.id - b.id);

  if (mode === "surgical") {
    return ranked
      .filter((wave) => wave.surgicalAllowed && (wave.scope === "sentence" || wave.scope === "paragraph"))
      .slice(0, 8)
      .map((wave) => wave.id);
  }

  if (mode === "deep") {
    return ranked.slice(0, 15).map((wave) => wave.id);
  }

  return ranked.slice(0, 10).map((wave) => wave.id);
}

function dedupeEdits(edits: ProposedEdit[]): ProposedEdit[] {
  const seen = new Set<string>();
  const deduped: ProposedEdit[] = [];

  for (const edit of edits) {
    const key = `${edit.editId}::${edit.waveId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(edit);
  }

  return deduped;
}

export function orchestrateRevision(input: OrchestratorInput): OrchestratorResult {
  const executionLog: string[] = [];
  const errors: string[] = [];

  executionLog.push(`[orchestrator] Starting revision for chapter ${input.chapterId} in ${input.revisionMode} mode.`);

  const explicitTargets = uniqueWaveIds(input.targetWaveIds ?? []);
  const derivedTargets = uniqueWaveIds([
    ...deriveWaveTargetsFromFindings(input.pass1Findings ?? {}),
    ...deriveWaveTargetsFromFindings(input.pass2Findings ?? {}),
    ...deriveWaveTargetsFromFindings(input.pass3Findings ?? {}),
  ]);

  let targetWaveIds = explicitTargets.length > 0 ? explicitTargets : derivedTargets;
  if (targetWaveIds.length === 0) {
    targetWaveIds = deriveFallbackTargets(input.revisionMode);
    executionLog.push(
      `[orchestrator] No explicit or findings-derived targets. Applied fallback target set (${targetWaveIds.length} waves).`,
    );
  } else {
    executionLog.push(`[orchestrator] Targeted ${targetWaveIds.length} waves for planning.`);
  }

  const plan = planWaves(targetWaveIds, input.revisionMode, {
    pass1: input.pass1Findings,
    pass2: input.pass2Findings,
    pass3: input.pass3Findings,
  });
  executionLog.push(`[orchestrator] Planner produced ${plan.orderedWaveIds.length} executable waves.`);

  const validation = validatePlan(plan);
  if (!validation.valid) {
    executionLog.push(`[orchestrator] Plan validation found ${validation.violations.length} violation(s).`);
    for (const violation of validation.violations) {
      executionLog.push(`[orchestrator] validation: ${violation}`);
    }

    if (input.revisionMode === "surgical") {
      errors.push(...validation.violations);
      executionLog.push("[orchestrator] Surgical mode abort: invalid plan cannot proceed.");

      return {
        chapterId: input.chapterId,
        plan,
        diffReport: buildDiffReport([], input.revisionMode),
        appliedEdits: [],
        skippedEdits: [],
        executionLog,
        finalText: input.chapterText,
        success: false,
        errors,
      };
    }
  } else {
    executionLog.push("[orchestrator] Plan validation passed.");
  }

  const conflictSnapshot = resolveConflicts(plan.orderedWaveIds, input.revisionMode);
  executionLog.push(
    `[orchestrator] Conflict snapshot: ${conflictSnapshot.suppressedWaves.length} suppressed, ${conflictSnapshot.deferredWaves.length} deferred.`,
  );

  const waveExecutionOrder = buildExecutionPlan(plan.orderedWaveIds, input.revisionMode);
  executionLog.push(`[orchestrator] Final execution order contains ${waveExecutionOrder.length} waves.`);

  const generatedEdits: ProposedEdit[] = [];
  for (const waveId of waveExecutionOrder) {
    const wave = getWave(waveId);
    if (!wave) {
      continue;
    }

    const edits = generateEditsForWave(waveId, input.chapterText, input.revisionMode);
    executionLog.push(`[orchestrator] Wave ${waveId} (${wave.name}) generated ${edits.length} edit(s).`);
    generatedEdits.push(...edits);
  }

  const dedupedEdits = dedupeEdits(generatedEdits);
  const diffReport = buildDiffReport(dedupedEdits, input.revisionMode);
  executionLog.push(
    `[orchestrator] Diff intelligence kept ${diffReport.rankedEdits.length} edits and suppressed ${diffReport.suppressedEdits.length}.`,
  );

  let currentText = input.chapterText;
  const appliedEdits: ProposedEdit[] = [];
  const failedApplyEdits: ProposedEdit[] = [];

  for (const edit of diffReport.rankedEdits) {
    const updated = applyEditToText(currentText, edit);
    if (updated !== currentText) {
      currentText = updated;
      appliedEdits.push(edit);
      executionLog.push(
        `[orchestrator] Applied edit ${edit.editId} (wave ${edit.waveId}) at p${edit.paragraphIndex}/s${edit.sentenceIndex}.`,
      );
    } else {
      failedApplyEdits.push(edit);
      executionLog.push(
        `[orchestrator] Skipped edit ${edit.editId} (wave ${edit.waveId}) because anchor text was not found.`,
      );
    }
  }

  const skippedEdits = dedupeEdits([...diffReport.suppressedEdits, ...failedApplyEdits]);

  if (appliedEdits.length === 0 && diffReport.rankedEdits.length > 0) {
    errors.push("No ranked edits could be applied to chapter text.");
  }

  const success = errors.length === 0;
  executionLog.push(
    `[orchestrator] Revision completed: success=${success}, applied=${appliedEdits.length}, skipped=${skippedEdits.length}.`,
  );

  return {
    chapterId: input.chapterId,
    plan,
    diffReport,
    appliedEdits,
    skippedEdits,
    executionLog,
    finalText: currentText,
    success,
    errors,
  };
}
