export type EvaluationMode = "STANDARD" | "TRANSGRESSIVE" | "TESTIMONY";
export type VoicePreservationMode = "MAXIMUM" | "BALANCED" | "POLISHED";
export type DetectionConfidence = "LOW" | "MODERATE" | "HIGH";

export type SectionModeOverride = {
  chapterRange: [number, number];
  mode: EvaluationMode;
  reason: string;
};

export type DetectedMode = {
  proposedEvaluationMode: EvaluationMode;
  proposedVoicePreservationMode: VoicePreservationMode;
  confidence: DetectionConfidence;
  evidence: Array<{ signal: string; where: string }>;
  alternates?: Array<{ mode: EvaluationMode; reason: string }>;
  sectionOverrides?: SectionModeOverride[];
};

function confidenceFromScore(score: number): DetectionConfidence {
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MODERATE";
  return "LOW";
}

function firstMatchLocation(text: string, phrase: string): string {
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx < 0) return "manuscript";
  return `char~${idx}`;
}

export function detectModeFromManuscript(manuscriptText: string): DetectedMode {
  const text = manuscriptText || "";
  const lower = text.toLowerCase();

  const testimonySignals = [
    "i remember",
    "i survived",
    "survivor",
    "trauma",
    "assault",
    "abuse",
    "panic",
    "ptsd",
    "witness",
    "testimony",
  ];

  const transgressiveSignals = [
    "fuck",
    "blood",
    "gore",
    "grotesque",
    "rot",
    "slur",
    "damn",
    "fractured",
  ];

  const standardSignals = [
    "chapter",
    "scene",
    "agent",
    "manuscript",
    "character",
  ];

  const testimonyHits = testimonySignals.filter((signal) => lower.includes(signal));
  const transgressiveHits = transgressiveSignals.filter((signal) => lower.includes(signal));
  const standardHits = standardSignals.filter((signal) => lower.includes(signal));

  const likelyFragmentation = (text.match(/[—–-]{2,}|\.\.\.|\n\n\s*[a-z]/g) || []).length;

  const testimonyScore = testimonyHits.length + (lower.includes("i ") ? 1 : 0);
  const transgressiveScore = transgressiveHits.length + (likelyFragmentation >= 2 ? 1 : 0);
  const standardScore = standardHits.length;

  if (testimonyScore >= Math.max(transgressiveScore + 1, 2)) {
    const evidence = testimonyHits.slice(0, 5).map((signal) => ({
      signal: `survivor-disclosure marker: ${signal}`,
      where: firstMatchLocation(text, signal),
    }));

    if (evidence.length === 0) {
      evidence.push({
        signal: "first-person disclosure cadence",
        where: "manuscript",
      });
    }

    return {
      proposedEvaluationMode: "TESTIMONY",
      proposedVoicePreservationMode: "MAXIMUM",
      confidence: confidenceFromScore(testimonyScore),
      evidence,
      alternates: [
        {
          mode: "TRANSGRESSIVE",
          reason: "register volatility may indicate transgressive craft in sections",
        },
      ],
    };
  }

  if (transgressiveScore >= Math.max(testimonyScore + 1, 2)) {
    const evidence = transgressiveHits.slice(0, 5).map((signal) => ({
      signal: `register-break marker: ${signal}`,
      where: firstMatchLocation(text, signal),
    }));

    if (likelyFragmentation >= 2) {
      evidence.push({
        signal: "intentional fragmentation patterns",
        where: "multi-section",
      });
    }

    if (evidence.length === 0) {
      evidence.push({
        signal: "non-standard register variance",
        where: "manuscript",
      });
    }

    return {
      proposedEvaluationMode: "TRANSGRESSIVE",
      proposedVoicePreservationMode: "MAXIMUM",
      confidence: confidenceFromScore(transgressiveScore),
      evidence,
      alternates: [
        {
          mode: "TESTIMONY",
          reason: "first-person disclosure motifs may warrant testimony guardrails",
        },
      ],
    };
  }

  return {
    proposedEvaluationMode: "STANDARD",
    proposedVoicePreservationMode: "BALANCED",
    confidence: confidenceFromScore(Math.max(standardScore, 1)),
    evidence: [
      {
        signal: "conventional narrative structure and low volatility register",
        where: "manuscript",
      },
    ],
    alternates: [
      {
        mode: "TRANSGRESSIVE",
        reason: "localized sections may still require stronger preservation",
      },
    ],
  };
}
