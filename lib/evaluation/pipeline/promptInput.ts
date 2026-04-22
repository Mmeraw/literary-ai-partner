import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";

function getDefaultPassInputCharBudgetLazy(): number {
  return getEvaluationRuntimeConfig().pass.inputCharBudget;
}

function getDefaultSynthesisReferenceCharBudgetLazy(): number {
  return getEvaluationRuntimeConfig().pass.synthesisRefCharBudget;
}

const OMITTED_SEPARATOR = "\n\n[... middle of manuscript omitted for prompt window ...]\n\n";

export type PromptCoverage = {
  sourceChars: number;
  sourceWords: number;
  analyzedChars: number;
  analyzedWords: number;
  truncated: boolean;
  strategy: "full_text" | "sampled_beginning_middle_end";
  budgetChars: number;
};

export function estimateWordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function getDefaultPassInputCharBudget(): number {
  return getDefaultPassInputCharBudgetLazy();
}

export function getDefaultSynthesisReferenceCharBudget(): number {
  return getDefaultSynthesisReferenceCharBudgetLazy();
}

export function buildPromptInputWindow(text: string, maxChars?: number): string {
  const effectiveMaxChars = maxChars ?? getDefaultPassInputCharBudgetLazy();
  const trimmed = text.trim();
  if (trimmed.length <= effectiveMaxChars) {
    return trimmed;
  }

  const separatorBudget = OMITTED_SEPARATOR.length * 2;
  const segmentLen = Math.max(1500, Math.floor((effectiveMaxChars - separatorBudget) / 3));

  const start = trimmed.slice(0, segmentLen).trim();
  const middleStart = Math.max(0, Math.floor(trimmed.length / 2) - Math.floor(segmentLen / 2));
  const middle = trimmed.slice(middleStart, middleStart + segmentLen).trim();
  const end = trimmed.slice(Math.max(0, trimmed.length - segmentLen)).trim();

  return `${start}${OMITTED_SEPARATOR}${middle}${OMITTED_SEPARATOR}${end}`;
}

export function summarizePromptCoverage(text: string, maxChars?: number): PromptCoverage {
  const effectiveMaxChars = maxChars ?? getDefaultPassInputCharBudgetLazy();
  const window = buildPromptInputWindow(text, effectiveMaxChars);
  const source = text.trim();
  const normalizedWindow = window.replaceAll(OMITTED_SEPARATOR, " ");

  return {
    sourceChars: source.length,
    sourceWords: estimateWordCount(source),
    analyzedChars: window.length,
    analyzedWords: estimateWordCount(normalizedWindow),
    truncated: source.length > maxChars,
    strategy: source.length > maxChars ? "sampled_beginning_middle_end" : "full_text",
    budgetChars: maxChars,
  };
}

export function buildCoverageDisclosure(coverage: PromptCoverage, label = "Evaluator input coverage"): string {
  if (!coverage.truncated) {
    return `${label}: full submission included (${coverage.sourceWords} words / ${coverage.sourceChars} chars).`;
  }

  return `${label}: sampled beginning/middle/end window (${coverage.analyzedWords} of ${coverage.sourceWords} words, capped at ${coverage.budgetChars} chars).`;
}
