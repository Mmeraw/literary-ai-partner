export type RoutedManuscriptType =
  | "narrative_fiction"
  | "query_letter"
  | "synopsis"
  | "author_bio"
  | "business_letter"
  | "essay_or_nonfiction"
  | "undetermined";

export interface NarrativePreflightDecision {
  allowed: boolean;
  detectedType: RoutedManuscriptType;
  userMessage?: string;
  details?: string;
  wordCount: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
}

function matchCount(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

const QUERY_LETTER_PATTERNS: RegExp[] = [
  /dear\s+agent/i,
  /seeking\s+representation/i,
  /my\s+novel/i,
  /word\s+count/i,
  /thank you for your time and consideration/i,
];

const SYNOPSIS_PATTERNS: RegExp[] = [
  /synopsis/i,
  /the\s+novel\s+follows/i,
  /in\s+this\s+story/i,
  /the\s+protagonist/i,
  /by\s+the\s+end/i,
];

const AUTHOR_BIO_PATTERNS: RegExp[] = [
  /author\s+bio/i,
  /i\s+am\s+an?\s+(author|writer)/i,
  /my\s+work\s+has\s+appeared/i,
  /i\s+live\s+in/i,
  /holds\s+a\s+degree/i,
];

const BUSINESS_LETTER_PATTERNS: RegExp[] = [
  /^\s*dear\s+/im,
  /^(sincerely|best regards|kind regards|respectfully),?\s*$/im,
  /to\s+whom\s+it\s+may\s+concern/i,
  /i\s+am\s+writing\s+to/i,
  /thank you for your consideration/i,
];

const ESSAY_NONFICTION_PATTERNS: RegExp[] = [
  /thesis/i,
  /in\s+this\s+essay/i,
  /non[-\s]?fiction/i,
  /argument/i,
  /research/i,
  /analysis/i,
];

const NARRATIVE_SIGNALS: RegExp[] = [
  /\b(said|asked|whispered|shouted|replied)\b/i,
  /\b(he|she|they)\s+(walked|ran|turned|looked|stared|paused|felt|thought)\b/i,
  /\b(scene|chapter)\b/i,
  /[“"][^”"]+[”"]/,
];

function detectManuscriptType(text: string): RoutedManuscriptType {
  const queryScore = matchCount(text, QUERY_LETTER_PATTERNS);
  if (queryScore >= 2) return "query_letter";

  const businessLetterScore = matchCount(text, BUSINESS_LETTER_PATTERNS);
  if (businessLetterScore >= 2) return "business_letter";

  const synopsisScore = matchCount(text, SYNOPSIS_PATTERNS);
  if (synopsisScore >= 2) return "synopsis";

  const authorBioScore = matchCount(text, AUTHOR_BIO_PATTERNS);
  if (authorBioScore >= 2) return "author_bio";

  const essayScore = matchCount(text, ESSAY_NONFICTION_PATTERNS);
  if (essayScore >= 2) return "essay_or_nonfiction";

  const narrativeSignalScore = matchCount(text, NARRATIVE_SIGNALS);
  if (narrativeSignalScore >= 2) return "narrative_fiction";

  return "undetermined";
}

function typeLabel(type: RoutedManuscriptType): string {
  switch (type) {
    case "query_letter":
      return "Query letter";
    case "synopsis":
      return "Synopsis";
    case "author_bio":
      return "Author bio";
    case "business_letter":
      return "Letter / correspondence";
    case "essay_or_nonfiction":
      return "Essay / non-fiction";
    case "narrative_fiction":
      return "Narrative fiction";
    default:
      return "Undetermined";
  }
}

export function routeNarrativeEvaluationPreflight(text: string): NarrativePreflightDecision {
  const wordCount = countWords(text);
  const detectedType = detectManuscriptType(text);

  const blockedTypes: RoutedManuscriptType[] = [
    "query_letter",
    "synopsis",
    "author_bio",
    "business_letter",
    "essay_or_nonfiction",
  ];

  if (blockedTypes.includes(detectedType)) {
    return {
      allowed: false,
      detectedType,
      wordCount,
      userMessage:
        "This submission appears to be a letter, essay, synopsis, or non-fiction document rather than narrative fiction.",
      details: `Detected manuscript type: ${typeLabel(detectedType)}. Upload a chapter or story excerpt for narrative-fiction evaluation.`,
    };
  }

  return {
    allowed: true,
    detectedType,
    wordCount,
  };
}