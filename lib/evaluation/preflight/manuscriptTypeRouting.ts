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
  scores: ManuscriptTypeScores;
  matchedSignals: ManuscriptTypeMatchedSignals;
  routingReason: string;
  routingConfidence: "high" | "medium" | "low";
}

export function buildNarrativePreflightAudit(
  decision: NarrativePreflightDecision,
): Record<string, unknown> {
  return {
    narrative_preflight_detected_type: decision.detectedType,
    narrative_preflight_word_count: decision.wordCount,
    narrative_preflight_routing_reason: decision.routingReason,
    narrative_preflight_routing_confidence: decision.routingConfidence,
    narrative_preflight_scores: decision.scores,
    narrative_preflight_matched_signals: decision.matchedSignals,
    ...(decision.allowed ? {} : { narrative_preflight_classifier_flagged: true }),
  };
}

export interface ManuscriptTypeScores {
  queryScore: number;
  businessLetterScore: number;
  synopsisScore: number;
  authorBioScore: number;
  narrativeScore: number;
  strongNarrativeScore: number;
  chapterScore: number;
  dialogueScore: number;
  hardNonfictionScore: number;
  weakNonfictionScore: number;
}

export interface ManuscriptTypeMatchedSignals {
  narrative: string[];
  nonfiction: string[];
  administrative: string[];
}

interface SignalPattern {
  label: string;
  pattern: RegExp;
}

interface ManuscriptTypeAnalysis {
  detectedType: RoutedManuscriptType;
  scores: ManuscriptTypeScores;
  matchedSignals: ManuscriptTypeMatchedSignals;
  routingReason: string;
  routingConfidence: "high" | "medium" | "low";
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
}

function matchedLabels(text: string, patterns: SignalPattern[]): string[] {
  return patterns.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

function occurrenceCount(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

const QUERY_LETTER_PATTERNS: SignalPattern[] = [
  { label: "dear_agent", pattern: /dear\s+agent/i },
  { label: "seeking_representation", pattern: /seeking\s+representation/i },
  { label: "my_novel", pattern: /my\s+novel/i },
  { label: "word_count", pattern: /word\s+count/i },
  {
    label: "query_thank_you",
    pattern: /thank you for your time and consideration/i,
  },
];

const SYNOPSIS_PATTERNS: SignalPattern[] = [
  { label: "synopsis_label", pattern: /synopsis/i },
  { label: "novel_follows", pattern: /the\s+novel\s+follows/i },
  { label: "story_summary", pattern: /in\s+this\s+story/i },
  { label: "protagonist_summary", pattern: /the\s+protagonist/i },
  { label: "ending_summary", pattern: /by\s+the\s+end/i },
  { label: "chapter_by_chapter", pattern: /chapter[-\s]+by[-\s]+chapter/i },
];

const AUTHOR_BIO_PATTERNS: SignalPattern[] = [
  { label: "author_bio_label", pattern: /author\s+bio/i },
  { label: "author_self_intro", pattern: /i\s+am\s+an?\s+(author|writer)/i },
  { label: "publication_credit", pattern: /my\s+work\s+has\s+appeared/i },
  { label: "author_location", pattern: /i\s+live\s+in/i },
  { label: "degree_credit", pattern: /holds\s+a\s+degree/i },
];

const BUSINESS_LETTER_PATTERNS: SignalPattern[] = [
  { label: "letter_salutation", pattern: /^\s*dear\s+/im },
  { label: "letter_signoff", pattern: /^(sincerely|best regards|kind regards|respectfully),?\s*$/im },
  { label: "to_whom_it_may_concern", pattern: /to\s+whom\s+it\s+may\s+concern/i },
  { label: "writing_to", pattern: /i\s+am\s+writing\s+to/i },
  { label: "consideration_thanks", pattern: /thank you for your consideration/i },
];

const HARD_NONFICTION_PATTERNS: SignalPattern[] = [
  { label: "in_this_essay", pattern: /in\s+this\s+essay/i },
  { label: "this_paper_argues", pattern: /this\s+paper\s+argues/i },
  { label: "thesis_statement", pattern: /thesis\s+statement/i },
  { label: "research_question", pattern: /research\s+question/i },
  { label: "literature_review", pattern: /literature\s+review/i },
  { label: "methodology", pattern: /methodology/i },
  { label: "abstract_section", pattern: /^\s*abstract\s*$/im },
  { label: "references_section", pattern: /^\s*(references|bibliography|works\s+cited)\s*$/im },
];

const WEAK_NONFICTION_PATTERNS: SignalPattern[] = [
  { label: "thesis", pattern: /\bthesis\b/i },
  { label: "argument", pattern: /\bargument\b/i },
  { label: "research", pattern: /\bresearch\b/i },
  { label: "analysis", pattern: /\banalysis\b/i },
  { label: "nonfiction", pattern: /\bnon[-\s]?fiction\b/i },
];

const NARRATIVE_SIGNALS: SignalPattern[] = [
  { label: "dialogue_tag", pattern: /\b(said|asked|whispered|shouted|replied)\b/i },
  {
    label: "character_action",
    pattern: /\b(he|she|they|it|we)\s+(walked|ran|turned|looked|stared|paused|felt|thought|crept|scrambled|leapt|crouched|waited)\b/i,
  },
  { label: "chapter_or_scene", pattern: /\b(scene|chapter|prologue|epilogue)\b/i },
  { label: "quoted_dialogue", pattern: /[“"][^”"\n]{2,}[”"]/ },
];

const STRONG_NARRATIVE_SIGNALS: SignalPattern[] = [
  { label: "chapter_heading", pattern: /^\s*(chapter\s+\d+|chapter\s+[ivxlcdm]+|prologue|epilogue)\b/im },
  { label: "dialogue_with_tag", pattern: /[“"][^”"\n]{2,}[”"]\s*,?\s*(said|asked|whispered|shouted|replied)\b/i },
  {
    label: "scene_movement",
    pattern: /\b(walked|ran|turned|looked|stared|paused|felt|thought|crept|scrambled|leapt|crouched|waited)\b/i,
  },
  {
    label: "sensory_or_emotional_interiority",
    pattern: /\b(heart|breath|blood|fear|hope|cold|warm|dark|light|forest|river|moon|sun)\b/i,
  },
];

function analyzeManuscriptType(text: string, wordCount: number): ManuscriptTypeAnalysis {
  const queryMatches = matchedLabels(text, QUERY_LETTER_PATTERNS);
  const businessLetterMatches = matchedLabels(text, BUSINESS_LETTER_PATTERNS);
  const synopsisMatches = matchedLabels(text, SYNOPSIS_PATTERNS);
  const authorBioMatches = matchedLabels(text, AUTHOR_BIO_PATTERNS);
  const narrativeMatches = matchedLabels(text, NARRATIVE_SIGNALS);
  const strongNarrativeMatches = matchedLabels(text, STRONG_NARRATIVE_SIGNALS);
  const hardNonfictionMatches = matchedLabels(text, HARD_NONFICTION_PATTERNS);
  const weakNonfictionMatches = matchedLabels(text, WEAK_NONFICTION_PATTERNS);
  const chapterScore = occurrenceCount(
    text,
    /^\s*(chapter\s+\d+|chapter\s+[ivxlcdm]+|prologue|epilogue)\b/gim,
  );
  const dialogueScore = occurrenceCount(text, /[“"][^”"\n]{2,}[”"]/g);

  const scores: ManuscriptTypeScores = {
    queryScore: queryMatches.length,
    businessLetterScore: businessLetterMatches.length,
    synopsisScore: synopsisMatches.length,
    authorBioScore: authorBioMatches.length,
    narrativeScore: narrativeMatches.length,
    strongNarrativeScore: strongNarrativeMatches.length,
    chapterScore,
    dialogueScore,
    hardNonfictionScore: hardNonfictionMatches.length,
    weakNonfictionScore: weakNonfictionMatches.length,
  };

  const matchedSignals: ManuscriptTypeMatchedSignals = {
    narrative: [...narrativeMatches, ...strongNarrativeMatches],
    nonfiction: [...hardNonfictionMatches, ...weakNonfictionMatches],
    administrative: [...queryMatches, ...businessLetterMatches, ...synopsisMatches, ...authorBioMatches],
  };

  const strongNarrativeEvidence =
    scores.strongNarrativeScore >= 2 ||
    (scores.chapterScore >= 1 && scores.dialogueScore >= 1 && scores.narrativeScore >= 2);
  const longFormNarrativeRescue =
    wordCount >= 10000 &&
    scores.chapterScore >= 1 &&
    scores.dialogueScore >= 2 &&
    (scores.strongNarrativeScore >= 1 || scores.narrativeScore >= 2);

  if (scores.queryScore >= 2) {
    return {
      detectedType: "query_letter",
      scores,
      matchedSignals,
      routingReason: "query_letter_administrative_signals",
      routingConfidence: "high",
    };
  }

  if (scores.businessLetterScore >= 2) {
    return {
      detectedType: "business_letter",
      scores,
      matchedSignals,
      routingReason: "business_letter_administrative_signals",
      routingConfidence: "high",
    };
  }

  if (scores.synopsisScore >= 2 && !longFormNarrativeRescue) {
    return {
      detectedType: "synopsis",
      scores,
      matchedSignals,
      routingReason: "synopsis_summary_signals_without_long_form_scene_evidence",
      routingConfidence: scores.synopsisScore >= 3 ? "high" : "medium",
    };
  }

  if (scores.authorBioScore >= 2) {
    return {
      detectedType: "author_bio",
      scores,
      matchedSignals,
      routingReason: "author_bio_administrative_signals",
      routingConfidence: "high",
    };
  }

  if (longFormNarrativeRescue) {
    return {
      detectedType: "narrative_fiction",
      scores,
      matchedSignals,
      routingReason: "long_form_chapter_dialogue_scene_evidence_overrides_weak_nonfiction_terms",
      routingConfidence: "high",
    };
  }

  if (strongNarrativeEvidence && scores.hardNonfictionScore === 0) {
    return {
      detectedType: "narrative_fiction",
      scores,
      matchedSignals,
      routingReason: "strong_narrative_evidence_overrides_weak_nonfiction_terms",
      routingConfidence: "high",
    };
  }

  if (scores.hardNonfictionScore >= 2) {
    return {
      detectedType: "essay_or_nonfiction",
      scores,
      matchedSignals,
      routingReason: "multiple_hard_nonfiction_signals",
      routingConfidence: "high",
    };
  }

  if (scores.hardNonfictionScore >= 1 && scores.weakNonfictionScore >= 2 && scores.narrativeScore < 2) {
    return {
      detectedType: "essay_or_nonfiction",
      scores,
      matchedSignals,
      routingReason: "hard_nonfiction_with_weak_nonfiction_support_and_low_narrative_evidence",
      routingConfidence: "medium",
    };
  }

  if (scores.weakNonfictionScore >= 3 && !strongNarrativeEvidence && scores.narrativeScore < 2) {
    return {
      detectedType: "essay_or_nonfiction",
      scores,
      matchedSignals,
      routingReason: "weak_nonfiction_terms_without_narrative_evidence",
      routingConfidence: "low",
    };
  }

  if (scores.narrativeScore >= 2) {
    return {
      detectedType: "narrative_fiction",
      scores,
      matchedSignals,
      routingReason: "narrative_scene_signals",
      routingConfidence: strongNarrativeEvidence ? "high" : "medium",
    };
  }

  return {
    detectedType: "undetermined",
    scores,
    matchedSignals,
    routingReason: "insufficient_classification_evidence",
    routingConfidence: "low",
  };
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
  const analysis = analyzeManuscriptType(text, wordCount);
  const detectedType = analysis.detectedType;

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
      scores: analysis.scores,
      matchedSignals: analysis.matchedSignals,
      routingReason: analysis.routingReason,
      routingConfidence: analysis.routingConfidence,
      userMessage:
        "This submission appears to be a letter, essay, synopsis, or non-fiction document rather than narrative fiction.",
      details: `Detected manuscript type: ${typeLabel(detectedType)}. Upload a chapter or story excerpt for narrative-fiction evaluation.`,
    };
  }

  return {
    allowed: true,
    detectedType,
    wordCount,
    scores: analysis.scores,
    matchedSignals: analysis.matchedSignals,
    routingReason: analysis.routingReason,
    routingConfidence: analysis.routingConfidence,
  };
}