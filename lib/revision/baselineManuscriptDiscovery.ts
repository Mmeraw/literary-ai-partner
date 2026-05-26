import { getVersionById } from "@/lib/manuscripts/versions";
import type { CreateDiagnosticFindingInput } from "./types";

const DISCOVERY_PREFIX = "baseline_manuscript_discovery";
const MAX_DISCOVERY_FINDINGS = 400;

type LocatedText = {
  text: string;
  paragraphIndex: number;
  sentenceIndex?: number | null;
};

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
    .split(/(?<=[.!?])\s+/g)
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
  criterionKey: string,
  findingType: string,
  severity: "low" | "medium" | "high",
  diagnosis: string,
  recommendation: string,
): CreateDiagnosticFindingInput {
  return {
    evaluation_job_id: evaluationRunId,
    manuscript_version_id: manuscriptVersionId,
    artifact_id: null,
    criterion_key: criterionKey,
    finding_type: `${DISCOVERY_PREFIX}:${findingType}`,
    severity,
    confidence: null,
    location_ref: location(item),
    paragraph_index: item.paragraphIndex,
    sentence_index: item.sentenceIndex ?? null,
    original_text: item.text,
    evidence_excerpt: compact(item.text),
    diagnosis,
    recommendation,
    action_hint: "refine",
  };
}

function signature(input: CreateDiagnosticFindingInput): string {
  return [input.finding_type, input.location_ref, input.original_text]
    .join("|")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isBaselineDiscoveryFindingType(findingType?: string | null): boolean {
  return Boolean(findingType?.startsWith(DISCOVERY_PREFIX));
}

export async function buildBaselineManuscriptDiscoveryFindings(
  evaluationRunId: string,
  manuscriptVersionId: string,
): Promise<CreateDiagnosticFindingInput[]> {
  const version = await getVersionById(manuscriptVersionId);
  const text = typeof version?.raw_text === "string" ? version.raw_text : "";
  if (!text.trim()) return [];

  const paragraphs = splitParagraphs(text);
  const sentences = paragraphs.flatMap(splitSentences);
  const candidates: CreateDiagnosticFindingInput[] = [];

  for (const paragraph of paragraphs) {
    if (wordCount(paragraph.text) >= 190) {
      candidates.push(
        makeFinding(
          evaluationRunId,
          manuscriptVersionId,
          paragraph,
          "PACING",
          "long_paragraph_pressure",
          "medium",
          "Long paragraph may dilute pacing or visual clarity for the reader.",
          "Review this paragraph for possible split points, compression, or a stronger turn beat while preserving voice.",
        ),
      );
    }
  }

  for (const sentence of sentences) {
    if (wordCount(sentence.text) >= 45) {
      candidates.push(
        makeFinding(
          evaluationRunId,
          manuscriptVersionId,
          sentence,
          "PROSE_CONTROL",
          "long_sentence_load",
          "low",
          "Long sentence may be carrying too many beats at once.",
          "Review for possible compression, punctuation reshaping, or a cleaner beat break without flattening style.",
        ),
      );
    }
  }

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const key = signature(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_DISCOVERY_FINDINGS);
}
