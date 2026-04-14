import type { DialogueDiagnosticSummary, DialogueFinding } from "./types";

export interface AnalyzeDialogueAttributionInput {
  manuscriptText: string;
}

const TAG_REGEX =
  /\b(said|asked|replied|answered|shouted|whispered|murmured|muttered|breathed|intoned)\b/gi;
const SOFT_TAG_REGEX = /\b(whispered|murmured|muttered|breathed|intoned)\b/gi;
const QUOTED_LINE_REGEX = /"([^"\n]+)"/g;

export function analyzeDialogueAttribution(
  input: AnalyzeDialogueAttributionInput,
): DialogueDiagnosticSummary {
  const text = input.manuscriptText;
  const findings: DialogueFinding[] = [];

  const wordCount = countWords(text);
  const allTags = [...text.matchAll(TAG_REGEX)];
  const softTags = [...text.matchAll(SOFT_TAG_REGEX)];
  const quotedLines = [...text.matchAll(QUOTED_LINE_REGEX)];

  const totalAttributionTags = allTags.length;
  const softTagCount = softTags.length;
  const totalDialogueLines = quotedLines.length;

  const tagsPerThousandWords =
    wordCount === 0 ? 0 : Number(((totalAttributionTags / wordCount) * 1000).toFixed(2));

  if (tagsPerThousandWords > 4) {
    findings.push({
      code: "TAG_DENSITY_EXCEEDED",
      severity: "warning",
      rationale: `Attribution density is ${tagsPerThousandWords}/1000 words, above Gate 15.1 threshold (4/1000).`,
      anchor: { excerpt: "Chapter-level attribution density measurement." },
      ruleSource: "GATE_15_1_ATTRIBUTION_DENSITY",
    });
  } else {
    findings.push({
      code: "ATTRIBUTION_MINIMAL_AND_CLEAR",
      severity: "info",
      rationale: `Attribution density is ${tagsPerThousandWords}/1000 words, within Gate 15.1 threshold.`,
      anchor: { excerpt: "Chapter-level attribution density measurement." },
      ruleSource: "GATE_15_1_ATTRIBUTION_DENSITY",
    });
  }

  if (softTagCount > 2) {
    findings.push({
      code: "SOFT_TAG_OVERUSE",
      severity: "warning",
      rationale: `Soft-tag count is ${softTagCount}, above preferred chapter cap (2) unless acoustically justified.`,
      anchor: { excerpt: "Chapter-level soft-tag count." },
      ruleSource: "GATE_15_1_SOFT_TAG_CAP",
    });
  }

  const removableTagMatches = [
    ...text.matchAll(/"[^"\n]+"[,]?\s+(I|he|she|they|[A-Z][a-z]+)\s+(said|asked|replied)\b/g),
  ];

  let removableTagCount = 0;
  for (const match of removableTagMatches) {
    removableTagCount += 1;
    findings.push({
      code: "REDUNDANT_ATTRIBUTION",
      severity: "warning",
      rationale:
        "Attribution tag may be removable if speaker identity is already clear from exchange structure or action anchoring.",
      anchor: { excerpt: excerpt(match[0]) },
      tag: match[2],
      removable: true,
      ruleSource: "ATTRIBUTION_INDEPENDENCE_CHECK",
    });
  }

  const dependencyScore =
    totalAttributionTags === 0 ? 0 : Number((removableTagCount / totalAttributionTags).toFixed(2));

  if (dependencyScore < 0.35) {
    findings.push({
      code: "DIALOGUE_SELF_SUPPORTING",
      severity: "info",
      rationale: "Dialogue appears to rely relatively little on removable mechanical attribution.",
      anchor: { excerpt: "Chapter-level attribution dependency score." },
      ruleSource: "ATTRIBUTION_INDEPENDENCE_CHECK",
    });
  } else {
    findings.push({
      code: "ATTRIBUTION_DEPENDENCY_HIGH",
      severity: "warning",
      rationale:
        "A high share of attribution appears mechanically removable, suggesting unnecessary tag dependence.",
      anchor: { excerpt: "Chapter-level attribution dependency score." },
      ruleSource: "ATTRIBUTION_INDEPENDENCE_CHECK",
    });
  }

  return {
    totalDialogueLines,
    totalAttributionTags,
    tagsPerThousandWords,
    softTagCount,
    removableTagCount,
    dependencyScore,
    findings,
  };
}

function countWords(text: string): number {
  const words = text.trim().match(/\b[\w'-]+\b/g);
  return words ? words.length : 0;
}

function excerpt(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
