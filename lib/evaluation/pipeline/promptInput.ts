const DEFAULT_PASS_INPUT_CHAR_BUDGET = (() => {
  const parsed = Number.parseInt(process.env.EVAL_PIPELINE_INPUT_CHAR_BUDGET || "50000", 10);
  return Number.isFinite(parsed) && parsed >= 12000 && parsed <= 100000 ? parsed : 50000;
})();

const DEFAULT_SYNTHESIS_REFERENCE_CHAR_BUDGET = (() => {
  const parsed = Number.parseInt(process.env.EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET || "18000", 10);
  return Number.isFinite(parsed) && parsed >= 4000 && parsed <= 50000 ? parsed : 18000;
})();

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
  return DEFAULT_PASS_INPUT_CHAR_BUDGET;
}

export function getDefaultSynthesisReferenceCharBudget(): number {
  return DEFAULT_SYNTHESIS_REFERENCE_CHAR_BUDGET;
}

export function buildPromptInputWindow(text: string, maxChars = DEFAULT_PASS_INPUT_CHAR_BUDGET): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const separatorBudget = OMITTED_SEPARATOR.length * 2;
  const segmentLen = Math.max(1500, Math.floor((maxChars - separatorBudget) / 3));

  const start = trimmed.slice(0, segmentLen).trim();
  const middleStart = Math.max(0, Math.floor(trimmed.length / 2) - Math.floor(segmentLen / 2));
  const middle = trimmed.slice(middleStart, middleStart + segmentLen).trim();
  const end = trimmed.slice(Math.max(0, trimmed.length - segmentLen)).trim();

  return `${start}${OMITTED_SEPARATOR}${middle}${OMITTED_SEPARATOR}${end}`;
}

export function summarizePromptCoverage(text: string, maxChars = DEFAULT_PASS_INPUT_CHAR_BUDGET): PromptCoverage {
  const window = buildPromptInputWindow(text, maxChars);
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
