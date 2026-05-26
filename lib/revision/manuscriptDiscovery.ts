import { getVersionById } from "@/lib/manuscripts/versions";
import {
  bulkCreateDiagnosticFindings,
  listFindingsForEvaluationRun,
} from "./normalizeFindings";
import type {
  CreateDiagnosticFindingInput,
  DiagnosticFinding,
  ProposalSeverity,
} from "./types";

type DiscoveryRule = {
  criterion_key: string;
  finding_type: string;
  severity: ProposalSeverity;
  diagnosis: string;
  recommendation: string;
};

type LocatedText = {
  text: string;
  paragraphIndex: number;
  sentenceIndex?: number | null;
};

const DISCOVERY_PREFIX = "baseline_manuscript_discovery";
const MAX_DISCOVERY_FINDINGS = 400;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function compact(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

function splitParagraphs(rawText: string): LocatedText[] {
  return rawText
    .split(/\n{2,}/g)
    .map((text, index) => ({ text: text.trim(), paragraphIndex: index + 1 }))
    .filter((item) => item.text.length > 0);
}

function splitSentences(paragraph: LocatedText): LocatedText[] {
  return paragraph.text
    .split(/(?<=[.!?])\s+(?=[A-Z“\"'])/g)
    .map((text, index) => ({
      text: text.trim(),
      paragraphIndex: paragraph.paragraphIndex,
      sentenceIndex: index + 1,
    }))
    .filter((item) => item.text.length > 0);
}

function location(item: LocatedText): string {
  return item.sentenceIndex
    ? `paragraph:${item.paragraphIndex}:sentence:${item.sentenceIndex}`
    : `paragraph:${item.paragraphIndex}`;
}

function makeFinding(
  evaluationRunId: string,
  manuscriptVersionId: string,
  item: LocatedText,
  rule: DiscoveryRule,
): CreateDiagnosticFindingInput {
  return {
    evaluation_job_id: evaluationRunId,
    manuscript_version_id: manuscriptVersionId,
    artifact_id: null,
    criterion_key: rule.criterion_key,
    finding_type: `${DISCOVERY_PREFIX}:${rule.finding_type}`,
    severity: rule.severity,
    confidence: null,
    location_ref: location(item),
    paragraph_index: item.paragraphIndex,
    sentence_index: item.sentenceIndex ?? null,
    original_text: item.text,
    evidence_excerpt: compact(item.text),
    diagnosis: rule.diagnosis,
    recommendation: rule.recommendation,
    action_hint: "refine",
  };
}

function signature(input: CreateDiagnosticFindingInput): string {
  return [input.finding_type, input.location_ref, input.original_text]
    .join("|")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hasBaselineDiscovery(findings: DiagnosticFinding[]): boolean {
  return findings.some((finding) => finding.finding_type?.startsWith(DISCOVERY_PREFIX));
}

function discoverParagraphFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
  paragraphs: LocatedText[],
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];

  for (const paragraph of paragraphs) {
    const words = wordCount(paragraph.text);

    if (words >= 190) {
      findings.push(
        makeFinding(evaluationRunId, manuscriptVersionId, paragraph, {
          criterion_key: "PACING",
          finding_type: "long_paragraph_pressure",
          severity: "medium",
          diagnosis: "Long paragraph may dilute pacing or visual clarity for the reader.",
          recommendation:
            "Review this paragraph for possible split points, compression, or a stronger turn beat while preserving voice.",
        }),
      );
    }

    if (/\b(I|he|she|they|we)\s+(saw|felt|heard|noticed|realized|wondered|thought|knew)\b/i.test(paragraph.text)) {
      findings.push(
        makeFinding(evaluationRunId, manuscriptVersionId, paragraph, {
          criterion_key: "VOICE",
          finding_type: "filtered_perception_cluster",
          severity: "low",
          diagnosis: "Perception or cognition filters may be adding distance between reader and scene.",
          recommendation:
            "Check whether the filtering is intentional. If not, render the perception or realization more directly.",
        }),
      );
    }
  }

  return findings;
}

function discoverSentenceFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
  sentences: LocatedText[],
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];

  for (const sentence of sentences) {
    const words = wordCount(sentence.text);

    if (words >= 45) {
      findings.push(
        makeFinding(evaluationRunId, manuscriptVersionId, sentence, {
          criterion_key: "PROSE_CONTROL",
          finding_type: "long_sentence_load",
          severity: "low",
          diagnosis: "Long sentence may be carrying too many beats at once.",
          recommendation:
            "Review for possible compression, punctuation reshaping, or a cleaner beat break without flattening style.",
        }),
      );
    }

    if (/\b\w+ly,\s+\w+ly\b/i.test(sentence.text) || /\b\w+ly\s+and\s+\w+ly\b/i.test(sentence.text)) {
      findings.push(
        makeFinding(evaluationRunId, manuscriptVersionId, sentence, {
          criterion_key: "PROSE_CONTROL",
          finding_type: "adverb_stack",
          severity: "low",
          diagnosis: "Stacked adverbs may dilute tonal precision.",
          recommendation:
            "Choose the strongest modifier, replace the stack with an action beat, or remove the adverbs if the line already carries the tone.",
        }),
      );
    }

    if (/"[^"]{20,}"\s*$/g.test(sentence.text)) {
      findings.push(
        makeFinding(evaluationRunId, manuscriptVersionId, sentence, {
          criterion_key: "DIALOGUE",
          finding_type: "dialogue_attribution_check",
          severity: "low",
          diagnosis: "Dialogue line may need attribution, rendering mechanism, or action-beat context.",
          recommendation:
            "Confirm speaker clarity and add an action beat only if the exchange becomes ambiguous or emotionally under-rendered.",
        }),
      );
    }
  }

  return findings;
}

export async function discoverBaselineManuscriptFindingsForEvaluationRun(
  evaluationRunId: string,
  manuscriptVersionId: string,
): Promise<DiagnosticFinding[]> {
  const existing = await listFindingsForEvaluationRun(evaluationRunId);
  if (hasBaselineDiscovery(existing)) {
    return existing;
  }

  const version = await getVersionById(manuscriptVersionId);
  const rawText = typeof version?.raw_text === "string" ? version.raw_text : "";
  if (!rawText.trim()) {
    return existing;
  }

  const paragraphs = splitParagraphs(rawText);
  const sentences = paragraphs.flatMap(splitSentences);
  const candidates = [
    ...discoverParagraphFindings(evaluationRunId, manuscriptVersionId, paragraphs),
    ...discoverSentenceFindings(evaluationRunId, manuscriptVersionId, sentences),
  ];

  const seen = new Set<string>();
  const deduped = candidates.filter((candidate) => {
    const key = signature(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_DISCOVERY_FINDINGS);

  if (deduped.length === 0) {
    return existing;
  }

  await bulkCreateDiagnosticFindings(deduped);
  return listFindingsForEvaluationRun(evaluationRunId);
}
