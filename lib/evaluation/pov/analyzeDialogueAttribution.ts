import type { DialogueDiagnosticSummary, DialogueFinding } from "./types";
import type { DialogueAttributionDiagnostics } from "@/lib/evaluation/pipeline/types";

export interface AnalyzeDialogueAttributionInput {
  manuscriptText: string;
}

const TAG_REGEX =
  /\b(said|asked|replied|answered|shouted|whispered|murmured|muttered|breathed|intoned)\b/gi;
const SOFT_TAG_REGEX = /\b(whispered|murmured|muttered|breathed|intoned)\b/gi;
const QUOTED_LINE_REGEX = /"([^"\n]+)"/g;
const ACTION_BEAT_REGEX = /^[A-Z][^.!?\n]*\b(nodded|smiled|frowned|laughed|cried|whispered|shouted|gasped|sighed|leaned|stood|sat|turned|glanced|watched|stared|stepped|walked|moved|gestured|reached|grabbed|released)\b[^"]*[.!?]/gm;
const INDIRECT_SPEECH_REGEX = /\b(said that|told.*that|explained that|noted that|mentioned that|stated that|reported that|indicated that)\b/gi;
const REPORTED_SPEECH_REGEX = /\b(according to|as.*said|.*said|.*told.*that)\b/gi;

/**
 * Expanded dialogue attribution analysis that detects rich craft mechanisms.
 * Returns canonical DialogueAttributionDiagnostics for quality gate enforcement.
 * This is the primary return type for new code.
 */
export function analyzeDialogueAttributionForGate(
  input: AnalyzeDialogueAttributionInput,
): DialogueAttributionDiagnostics {
  const text = input.manuscriptText;

  const wordCount = countWords(text);
  const allTags = [...text.matchAll(TAG_REGEX)];
  const softTags = [...text.matchAll(SOFT_TAG_REGEX)];
  const quotedLines = [...text.matchAll(QUOTED_LINE_REGEX)];
  const actionBeats = [...text.matchAll(ACTION_BEAT_REGEX)];
  const indirectSpeech = [...text.matchAll(INDIRECT_SPEECH_REGEX)];
  const reportedSpeech = [...text.matchAll(REPORTED_SPEECH_REGEX)];

  const totalAttributionTags = allTags.length;
  const softTagCount = softTags.length;
  const quotedSpeechCount = quotedLines.length;
  const actionBeatCount = actionBeats.length;

  const tagDensity =
    wordCount === 0 ? 0 : Number(((totalAttributionTags / wordCount) * 1000).toFixed(2));
  const actionBeatDensity =
    wordCount === 0 ? 0 : Number(((actionBeatCount / wordCount) * 1000).toFixed(2));

  // Estimate dialogue turn count (quoted lines are a proxy for turns)
  const dialogueTurnCount = Math.max(quotedSpeechCount, totalAttributionTags);

  // Detect speaker clarity
  const turnTakingClarity = determineTurnTakingClarity(
    totalAttributionTags,
    actionBeatCount,
    quotedSpeechCount,
    tagDensity,
  );

  // Risk assessment
  const speakerAmbiguityRisk = determineSpeakerAmbiguityRisk(
    quotedSpeechCount,
    totalAttributionTags,
    actionBeatCount,
    tagDensity,
  );

  // Determine rendering modes found
  const renderingModesDetected = detectRenderingModes(text, {
    quotedSpeechCount,
    totalAttributionTags,
    actionBeatCount,
    indirectSpeechCount: indirectSpeech.length,
    reportedSpeechCount: reportedSpeech.length,
  });

  // Determine attribution strategies
  const speakerAttributionStrategy = detectAttributionStrategies(text, {
    totalAttributionTags,
    actionBeatCount,
    quotedSpeechCount,
    voiceDifferentiationIndicators: detectVoiceDifferentiation(text),
    alternatingTurnIndicators: dialogueTurnCount > 0,
  });

  // Build diagnostic summary
  const diagnosticSummary = buildDiagnosticSummary({
    tagDensity,
    actionBeatDensity,
    turnTakingClarity,
    speakerAmbiguityRisk,
    renderingModes: renderingModesDetected,
    strategies: speakerAttributionStrategy,
    quotedSpeechCount,
    totalAttributionTags,
  });

  return {
    quotedSpeechCount,
    dialogueTurnCount,
    explicitTagCount: totalAttributionTags,
    actionBeatCount,
    tagDensity,
    actionBeatDensity,
    turnTakingClarity,
    speakerAmbiguityRisk,
    renderingModesDetected,
    speakerAttributionStrategy,
    diagnosticSummary,
  };
}

/**
 * Legacy dialogue diagnostics for backward compatibility with POV evidence validation.
 * Returns DialogueDiagnosticSummary with findings array (old format).
 */
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

function determineTurnTakingClarity(
  tagCount: number,
  beatCount: number,
  quotedLines: number,
  tagDensity: number,
): "clear" | "mixed" | "unclear" {
  // Clear when: adequate clear attribution mechanisms
  if ((tagCount >= 3 || beatCount >= 2) && quotedLines > 0) {
    return "clear";
  }
  // Mixed when: some mechanisms but limited
  if ((tagCount > 0 || beatCount > 0) && quotedLines > 0) {
    return "mixed";
  }
  // Unclear when: minimal mechanisms
  return "unclear";
}

function determineSpeakerAmbiguityRisk(
  quotedSpeechCount: number,
  tagCount: number,
  beatCount: number,
  tagDensity: number,
): "low" | "medium" | "high" {
  // Low risk: adequate attribution for quoted speech
  if (quotedSpeechCount > 0 && (tagCount + beatCount) >= quotedSpeechCount * 0.5) {
    return "low";
  }
  // Medium risk: some dialogue but not fully attributed
  if (quotedSpeechCount > 0 && (tagCount + beatCount) >= quotedSpeechCount * 0.25) {
    return "medium";
  }
  // High risk: lots of dialogue with minimal attribution
  return "high";
}

function detectRenderingModes(
  text: string,
  metrics: {
    quotedSpeechCount: number;
    totalAttributionTags: number;
    actionBeatCount: number;
    indirectSpeechCount: number;
    reportedSpeechCount: number;
  },
): DialogueAttributionDiagnostics["renderingModesDetected"] {
  const modes: DialogueAttributionDiagnostics["renderingModesDetected"] = [];

  if (metrics.quotedSpeechCount > 0) modes.push("direct_speech");
  if (metrics.indirectSpeechCount > 0) modes.push("indirect_speech");
  if (metrics.reportedSpeechCount > 0) modes.push("reported_speech");
  if (metrics.totalAttributionTags > 0) modes.push("tagged_speech");
  if (metrics.actionBeatCount > 0) modes.push("action_beat_attribution");

  // Detect untagged exchanges (dialogue context without explicit tags)
  if (metrics.quotedSpeechCount > metrics.totalAttributionTags) {
    modes.push("tagless_exchange");
  }

  // Detect interiority during dialogue (thought breaks in dialogue)
  if (/["'](?:[^"']*)(thought|wondered|realized|considered)[^"']*["']/i.test(text)) {
    modes.push("interiority_during_dialogue");
  }

  return [...new Set(modes)]; // Remove duplicates
}

function detectAttributionStrategies(
  text: string,
  metrics: {
    totalAttributionTags: number;
    actionBeatCount: number;
    quotedSpeechCount: number;
    voiceDifferentiationIndicators: boolean;
    alternatingTurnIndicators: boolean;
  },
): DialogueAttributionDiagnostics["speakerAttributionStrategy"] {
  const strategies: DialogueAttributionDiagnostics["speakerAttributionStrategy"] = [];

  if (metrics.totalAttributionTags > 0) strategies.push("explicit_tags");
  if (metrics.actionBeatCount > 0) strategies.push("action_beats");
  if (metrics.voiceDifferentiationIndicators) strategies.push("voice_differentiation");
  if (metrics.alternatingTurnIndicators && metrics.quotedSpeechCount > 1) {
    strategies.push("alternating_turns");
  }

  // Contextual anchoring: dialogue tied to scene location/time
  if (/\b(here|there|now|then|this place|that time)\b/i.test(text)) {
    strategies.push("contextual_anchoring");
  }

  return [...new Set(strategies)]; // Remove duplicates
}

function detectVoiceDifferentiation(text: string): boolean {
  // Check for multiple distinct voices/registers (contractions, vocabulary, sentence length)
  const hasContractions = /\b(don't|can't|won't|isn't|doesn't)\b/i.test(text);
  const hasFormalLanguage = /\b(nevertheless|furthermore|regarding|shall|ought)\b/i.test(text);
  const hasDialect = /\b(y'all|ain't|gonna|wanna)\b/i.test(text);

  return (hasContractions && hasFormalLanguage) || hasDialect;
}

function buildDiagnosticSummary(metrics: {
  tagDensity: number;
  actionBeatDensity: number;
  turnTakingClarity: string;
  speakerAmbiguityRisk: string;
  renderingModes: string[];
  strategies: string[];
  quotedSpeechCount: number;
  totalAttributionTags: number;
}): string {
  const parts: string[] = [];

  if (metrics.quotedSpeechCount > 0) {
    parts.push(
      `${metrics.quotedSpeechCount} quoted speech segment(s) detected with turn-taking clarity: ${metrics.turnTakingClarity}`,
    );
  }

  if (metrics.totalAttributionTags > 0) {
    parts.push(
      `${metrics.totalAttributionTags} explicit attribution tag(s), density: ${metrics.tagDensity}/1000 words`,
    );
  }

  if (metrics.actionBeatDensity > 0) {
    parts.push(`Action beat density: ${metrics.actionBeatDensity}/1000 words`);
  }

  if (metrics.renderingModes.length > 0) {
    parts.push(`Rendering modes detected: ${metrics.renderingModes.join(", ")}`);
  }

  if (metrics.strategies.length > 0) {
    parts.push(`Attribution strategies: ${metrics.strategies.join(", ")}`);
  }

  parts.push(`Speaker ambiguity risk: ${metrics.speakerAmbiguityRisk}`);

  return parts.join("; ");
}

function countWords(text: string): number {
  const words = text.trim().match(/\b[\w'-]+\b/g);
  return words ? words.length : 0;
}

function excerpt(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
