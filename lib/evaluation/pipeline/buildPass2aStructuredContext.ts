import type {
  ManuscriptChunkEvidence,
  Pass2aCharacterLedgerEntry,
  Pass2aSceneIndexEntry,
  Pass2aStructuredContext,
  Pass2aTimelineAnchor,
} from "./types";

const ENTITY_PATTERN = /\b(?:[A-Z][a-z]+(?:['-][A-Za-z]+)?|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+(?:['-][A-Za-z]+)?|[A-Z]{2,})){0,2}\b/g;
const AGE_PATTERN = /\b\d{1,3}-year-old\b/gi;
const DURATION_PATTERN = /\b(?:\d+|multiple|several)\s+(?:years?|months?|weeks?|days?|trips?)\s+(?:later|after)\b/gi;
const SEQUENCE_PATTERN = /\b(?:first|second|third|next|last)\s+(?:day|night|week|month|year|trip|chapter|scene)\b/gi;

const ENTITY_STOPWORDS = new Set([
  "The",
  "A",
  "An",
  "He",
  "She",
  "They",
  "We",
  "I",
  "It",
  "His",
  "Her",
  "Their",
  "This",
  "That",
  "These",
  "Those",
  "Chapter",
  "Scene",
  "Pass",
  "God",
]);

function getSourceChunks(args: {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
}): ManuscriptChunkEvidence[] {
  if (Array.isArray(args.manuscriptChunks) && args.manuscriptChunks.length > 0) {
    return [...args.manuscriptChunks].sort((left, right) => left.chunk_index - right.chunk_index);
  }

  return [{ chunk_index: 0, content: args.manuscriptText }];
}

function normalizeEntityName(raw: string): string | null {
  const cleaned = raw.replace(/[“”"'.,;:!?()\[\]]+/g, "").trim();
  if (!cleaned || ENTITY_STOPWORDS.has(cleaned)) {
    return null;
  }

  if (cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

function buildSampleSnippet(content: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - 48);
  const end = Math.min(content.length, index + matchLength + 72);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

function firstSentence(content: string, fallbackLength = 180): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  const sentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  return sentence.slice(0, fallbackLength).trim();
}

function extractCharacterLedger(chunks: ManuscriptChunkEvidence[]): Pass2aCharacterLedgerEntry[] {
  const ledger = new Map<string, Pass2aCharacterLedgerEntry>();

  for (const chunk of chunks) {
    const matches = chunk.content.matchAll(ENTITY_PATTERN);
    for (const match of matches) {
      const rawName = match[0];
      const name = normalizeEntityName(rawName);
      if (!name) {
        continue;
      }

      const existing = ledger.get(name);
      if (existing) {
        existing.mention_count += 1;
        continue;
      }

      ledger.set(name, {
        name,
        first_chunk_index: chunk.chunk_index,
        mention_count: 1,
        sample_snippet: buildSampleSnippet(chunk.content, match.index ?? 0, rawName.length),
      });
    }
  }

  return [...ledger.values()]
    .sort((left, right) => {
      if (right.mention_count !== left.mention_count) {
        return right.mention_count - left.mention_count;
      }
      if (left.first_chunk_index !== right.first_chunk_index) {
        return left.first_chunk_index - right.first_chunk_index;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 24);
}

function extractSceneIndex(
  chunks: ManuscriptChunkEvidence[],
  characterLedger: Pass2aCharacterLedgerEntry[],
): Pass2aSceneIndexEntry[] {
  const names = new Set(characterLedger.map((entry) => entry.name));

  return chunks.map((chunk) => {
    const namedEntities = [...names]
      .filter((name) => chunk.content.includes(name))
      .slice(0, 6);

    return {
      chunk_index: chunk.chunk_index,
      scene_preview: firstSentence(chunk.content),
      named_entities: namedEntities,
    };
  });
}

function extractAnchorsForPattern(args: {
  chunks: ManuscriptChunkEvidence[];
  pattern: RegExp;
  anchorType: Pass2aTimelineAnchor["anchor_type"];
}): Pass2aTimelineAnchor[] {
  const anchors: Pass2aTimelineAnchor[] = [];

  for (const chunk of args.chunks) {
    const matches = chunk.content.matchAll(args.pattern);
    for (const match of matches) {
      anchors.push({
        chunk_index: chunk.chunk_index,
        anchor_type: args.anchorType,
        anchor_text: match[0],
      });
      if (anchors.length >= 20) {
        return anchors;
      }
    }
  }

  return anchors;
}

function extractTimelineAnchors(chunks: ManuscriptChunkEvidence[]): Pass2aTimelineAnchor[] {
  return [
    ...extractAnchorsForPattern({ chunks, pattern: AGE_PATTERN, anchorType: "age" }),
    ...extractAnchorsForPattern({ chunks, pattern: DURATION_PATTERN, anchorType: "duration" }),
    ...extractAnchorsForPattern({ chunks, pattern: SEQUENCE_PATTERN, anchorType: "sequence" }),
  ].slice(0, 24);
}

export function buildPass2aStructuredContext(args: {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
}): Pass2aStructuredContext {
  const chunks = getSourceChunks(args);
  const characterLedger = extractCharacterLedger(chunks);
  const sceneIndex = extractSceneIndex(chunks, characterLedger);
  const timelineAnchors = extractTimelineAnchors(chunks);

  return {
    character_ledger: characterLedger,
    scene_index: sceneIndex,
    timeline_anchors: timelineAnchors,
  };
}