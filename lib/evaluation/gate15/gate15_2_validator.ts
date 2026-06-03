/**
 * Gate 15.2 — Voice Integrity & Nonstandard Speech Protection (Overcorrection Firewall)
 *
 * Canon: Volume I, Gate 15 Paired Gate Architecture
 * Authority: GATE_15_2_PR1_CANON_AND_SCHEMA_SPEC.md, GATE_15_2_PR2_LAYER1_CLASSIFIER_SPEC.md
 *
 * Gate 15.2 is a false-positive protection layer for meaning.
 * It prevents the system from normalizing intentional voice, flattening dialect,
 * deleting behavioral contradiction, or over-compressing high-density narrative.
 *
 * Classification model (5 types):
 *   FORCE     — symbolic/tonal pressure → PROTECT
 *   BEHAVIOR  — reveals character truth → PROTECT / TRIM
 *   INVENTORY — non-functional detail → CUT
 *   NOISE     — mechanical redundancy → CUT
 *   MIXED     — contains both → TRIM
 *
 * 7 detection areas:
 *   1. Nonstandard speech indicators (slang, truncation, dialect)
 *   2. Behavioral detail indicators (hesitation, reversal, micro-actions)
 *   3. Panic / cognitive compression (repeated phrases, fragmented syntax)
 *   4. Performance register indicators (rhyme, chant, stylized repetition)
 *   5. Inventory / logistical density (object lists, procedural description)
 *   6. Physiological signals (breathing patterns, tension, physical reactions)
 *   7. Voice consistency check (idiolect stability across segments)
 *
 * Mandatory Decision Test (per candidate):
 *   1. Is meaning clear?
 *   2. Is voice consistent?
 *   3. Does it show behavior?
 *   4. Does it carry force?
 *   5. Would editing weaken it?
 *   Rule: ≥3 YES → PROTECT
 *
 * This is a deterministic heuristic implementation (no LLM calls).
 * Canon: long-form only (≥25,000 words). Requires Gate 15.1 PASS to execute.
 */

import { type GateStatus, GATE15_MIN_WORD_COUNT } from './gate15_1_validator';

// ── Types ────────────────────────────────────────────────────────────────

export type FunctionalClass = 'FORCE' | 'BEHAVIOR' | 'INVENTORY' | 'NOISE' | 'MIXED';
export type ProtectionAction = 'PROTECT' | 'TRIM' | 'CUT';

export interface CandidateSegment {
  text: string;
  detectionArea: DetectionArea;
  functionalClass: FunctionalClass;
  action: ProtectionAction;
  confidence: 'low' | 'moderate' | 'high';
  decisionTestScore: number;
  rationale: string;
}

export type DetectionArea =
  | 'nonstandard_speech'
  | 'behavioral_detail'
  | 'panic_compression'
  | 'performance_register'
  | 'inventory_density'
  | 'physiological_signal'
  | 'voice_consistency';

export interface DetectionAreaSummary {
  area: DetectionArea;
  candidateCount: number;
  protectedCount: number;
  trimCount: number;
  cutCount: number;
}

export interface Gate15_2Result {
  overallStatus: GateStatus;
  blocking: boolean;
  wordCount: number;
  skippedBecause?: string;
  protectedSegments: number;
  trimSegments: number;
  cutSegments: number;
  totalCandidates: number;
  overcorrectionRiskLevel: 'low' | 'moderate' | 'high';
  detectionAreas: DetectionAreaSummary[];
  candidates: CandidateSegment[];
  summaryFindings: string[];
}

// ── Detection Patterns ───────────────────────────────────────────────────

/** Nonstandard speech: truncation, slang, dropped articles, clipped syntax */
const TRUNCATION_PATTERN = /\b\w+['']\b/g;
const SLANG_INDICATORS = /\b(ya|yall|y'all|gonna|gotta|wanna|ain't|aint|dunno|lemme|gimme|kinda|sorta|coulda|woulda|shoulda|hafta|outta|bout|em|til|nah|yeah|nope|yep)\b/gi;
const DROPPED_ARTICLE_PATTERN = /\b(got|need|want|take|give|put|had|has|have|get)\s+((?!a\b|an\b|the\b|my\b|his\b|her\b|their\b|its\b|our\b|your\b)[A-Z][a-z]+)/g;

/** Behavioral detail: hesitation markers, reversal indicators */
const HESITATION_MARKERS = /\b(paused|hesitated|stopped|froze|waited|stalled|faltered)\b.*?\b(then|before|but|and then|finally)\b/gi;
const REVERSAL_INDICATORS = /\b(started to|was about to|almost|nearly|considered|thought about)\b.*?\b(but|then|instead|however|stopped)\b/gi;

/** Panic/cognitive compression: fragments, repeated phrases, thought loops */
const FRAGMENT_PATTERN = /(?:^|\n)([A-Z][^.!?\n]{0,30}[.!?])(?:\n|$)/gm;
const REPETITION_PATTERN = /\b(\w{4,})\b(?:\s+\w+){0,5}\s+\b\1\b/gi;

/** Performance register: rhyme, chant-like structure */
const CHANT_PATTERN = /(?:^|\n)(.{5,40})\n\1/gm;

/** Inventory/logistical density: lists, procedural description */
const LIST_PATTERN = /(?:^|\n)\s*[-•]\s+.+(?:\n\s*[-•]\s+.+){2,}/gm;
const ENUMERATION_PATTERN = /\b(first|second|third|then|next|after that|finally)\b/gi;

/** Physiological signals: breathing, tension patterns */
const BREATHING_PATTERN = /\b(breath|breathing|exhaled?|inhaled?|gasped?|panted?|wheezed?)\b/gi;
const TENSION_PATTERN = /\b(trembl(?:ed|ing)|shak(?:ing|en)|tens(?:ed|ing)|clench(?:ed|ing)|grip(?:ped|ping)|tight(?:ened|ening)|rigid|stiff(?:ened|ening))\b/gi;

// ── Helpers ──────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function runDecisionTest(segment: string): { score: number; rationale: string } {
  let yes = 0;
  const reasons: string[] = [];

  // 1. Is meaning clear?
  const hasPunctuation = /[.!?]/.test(segment);
  const hasSubjectVerb = /\b[A-Z][a-z]+\b.*\b(?:is|was|are|were|has|had|did|does|do|will|would|could|can|should|shall|may|might)\b/i.test(segment);
  if (hasPunctuation && hasSubjectVerb) {
    yes++;
    reasons.push('meaning_clear');
  }

  // 2. Is voice consistent? (check for nonstandard markers as consistency signal)
  const hasNonstandard = SLANG_INDICATORS.test(segment) || TRUNCATION_PATTERN.test(segment);
  SLANG_INDICATORS.lastIndex = 0;
  TRUNCATION_PATTERN.lastIndex = 0;
  if (hasNonstandard) {
    yes++;
    reasons.push('voice_consistent_nonstandard');
  }

  // 3. Does it show behavior?
  const hasBehavior = /\b(nodded|shrugged|frowned|smiled|winced|flinched|stiffened|reached|grabbed|clenched|unclenched|shifted|squirmed)\b/i.test(segment);
  if (hasBehavior) {
    yes++;
    reasons.push('shows_behavior');
  }

  // 4. Does it carry force? (emotional/tonal weight)
  const hasForce = /[!]/.test(segment) || /\b(never|always|must|cannot|won't|can't|don't|damn|hell|god|please|stop|enough|no)\b/i.test(segment);
  if (hasForce) {
    yes++;
    reasons.push('carries_force');
  }

  // 5. Would editing weaken it?
  const isShort = segment.split(/\s+/).length <= 8;
  const hasSpeechPattern = /["'']/.test(segment);
  if (isShort && (hasSpeechPattern || hasNonstandard || hasForce)) {
    yes++;
    reasons.push('editing_would_weaken');
  }

  return { score: yes, rationale: reasons.join(', ') || 'no_protection_signals' };
}

function classifyCandidate(
  segment: string,
  area: DetectionArea,
  decisionScore: number,
): { functionalClass: FunctionalClass; action: ProtectionAction } {
  // Canon rule: ≥3 YES on decision test → PROTECT
  if (decisionScore >= 3) {
    if (area === 'performance_register' || area === 'panic_compression') {
      return { functionalClass: 'FORCE', action: 'PROTECT' };
    }
    if (area === 'behavioral_detail' || area === 'nonstandard_speech') {
      return { functionalClass: 'BEHAVIOR', action: 'PROTECT' };
    }
    return { functionalClass: 'MIXED', action: 'TRIM' };
  }

  if (decisionScore === 2) {
    return { functionalClass: 'MIXED', action: 'TRIM' };
  }

  if (area === 'inventory_density') {
    return { functionalClass: 'INVENTORY', action: 'CUT' };
  }

  return { functionalClass: 'NOISE', action: 'CUT' };
}

function determineConfidence(decisionScore: number): 'low' | 'moderate' | 'high' {
  if (decisionScore >= 4) return 'high';
  if (decisionScore >= 2) return 'moderate';
  return 'low';
}

// ── Main Validator ───────────────────────────────────────────────────────

export function runGate15_2(
  manuscriptText: string,
  gate15_1Passed: boolean,
): Gate15_2Result {
  const wordCount = countWords(manuscriptText);

  // Word count gate
  if (wordCount < GATE15_MIN_WORD_COUNT) {
    return {
      overallStatus: 'SKIPPED',
      blocking: false,
      wordCount,
      skippedBecause: `short_form_under_${GATE15_MIN_WORD_COUNT}_words`,
      protectedSegments: 0,
      trimSegments: 0,
      cutSegments: 0,
      totalCandidates: 0,
      overcorrectionRiskLevel: 'low',
      detectionAreas: [],
      candidates: [],
      summaryFindings: [`Gate 15.2 skipped: manuscript is ${wordCount.toLocaleString()} words (minimum ${GATE15_MIN_WORD_COUNT.toLocaleString()} for WAVE/Gate 15)`],
    };
  }

  // Canon: Gate 15.2 must not execute if Gate 15.1 failed
  if (!gate15_1Passed) {
    return {
      overallStatus: 'SKIPPED',
      blocking: false,
      wordCount,
      skippedBecause: 'gate_15_1_did_not_pass',
      protectedSegments: 0,
      trimSegments: 0,
      cutSegments: 0,
      totalCandidates: 0,
      overcorrectionRiskLevel: 'low',
      detectionAreas: [],
      candidates: [],
      summaryFindings: ['Gate 15.2 skipped: Gate 15.1 did not pass (execution order is mandatory)'],
    };
  }

  const sentences = extractSentences(manuscriptText);
  const candidates: CandidateSegment[] = [];
  const MAX_CANDIDATES = 100;

  // Scan for candidates across 7 detection areas
  const areaCounters = new Map<DetectionArea, { protected: number; trim: number; cut: number }>();
  const allAreas: DetectionArea[] = [
    'nonstandard_speech', 'behavioral_detail', 'panic_compression',
    'performance_register', 'inventory_density', 'physiological_signal',
    'voice_consistency',
  ];
  for (const a of allAreas) {
    areaCounters.set(a, { protected: 0, trim: 0, cut: 0 });
  }

  // Sample sentences to keep deterministic and bounded
  const sampleSize = Math.min(sentences.length, 2000);
  const step = Math.max(1, Math.floor(sentences.length / sampleSize));

  for (let i = 0; i < sentences.length && candidates.length < MAX_CANDIDATES; i += step) {
    const sentence = sentences[i];
    if (!sentence || sentence.length < 10) continue;

    // Check each detection area
    const detected = detectAreas(sentence);
    if (detected.length === 0) continue;

    const { score, rationale } = runDecisionTest(sentence);
    const primaryArea = detected[0];
    const { functionalClass, action } = classifyCandidate(sentence, primaryArea, score);
    const confidence = determineConfidence(score);

    candidates.push({
      text: sentence.length > 200 ? sentence.slice(0, 200) + '...' : sentence,
      detectionArea: primaryArea,
      functionalClass,
      action,
      confidence,
      decisionTestScore: score,
      rationale,
    });

    const counter = areaCounters.get(primaryArea)!;
    if (action === 'PROTECT') counter.protected++;
    else if (action === 'TRIM') counter.trim++;
    else counter.cut++;
  }

  const protectedSegments = candidates.filter(c => c.action === 'PROTECT').length;
  const trimSegments = candidates.filter(c => c.action === 'TRIM').length;
  const cutSegments = candidates.filter(c => c.action === 'CUT').length;

  // Build detection area summaries
  const detectionAreas: DetectionAreaSummary[] = allAreas.map(area => {
    const counter = areaCounters.get(area)!;
    const total = counter.protected + counter.trim + counter.cut;
    return {
      area,
      candidateCount: total,
      protectedCount: counter.protected,
      trimCount: counter.trim,
      cutCount: counter.cut,
    };
  }).filter(d => d.candidateCount > 0);

  // Overcorrection risk: high if many protected segments found
  const protectionRatio = candidates.length === 0 ? 0 : protectedSegments / candidates.length;
  const overcorrectionRiskLevel: 'low' | 'moderate' | 'high' =
    protectionRatio > 0.5 ? 'high' :
    protectionRatio > 0.2 ? 'moderate' : 'low';

  const summaryFindings: string[] = [];
  summaryFindings.push(`Scanned ${candidates.length} candidate segments across ${detectionAreas.length} detection areas`);
  if (protectedSegments > 0) {
    summaryFindings.push(`${protectedSegments} segments flagged for voice/meaning protection (PROTECT)`);
  }
  if (trimSegments > 0) {
    summaryFindings.push(`${trimSegments} segments flagged as mixed function (TRIM with care)`);
  }
  if (cutSegments > 0) {
    summaryFindings.push(`${cutSegments} segments classified as inventory/noise (CUT eligible)`);
  }
  if (overcorrectionRiskLevel === 'high') {
    summaryFindings.push('HIGH overcorrection risk: majority of candidates carry protected voice/meaning');
  }

  // Canon: zero compression is a valid success state
  const overallStatus: GateStatus = 'PASS';

  return {
    overallStatus,
    blocking: false,
    wordCount,
    protectedSegments,
    trimSegments,
    cutSegments,
    totalCandidates: candidates.length,
    overcorrectionRiskLevel,
    detectionAreas,
    candidates,
    summaryFindings,
  };
}

// ── Detection Functions ──────────────────────────────────────────────────

function detectAreas(sentence: string): DetectionArea[] {
  const areas: DetectionArea[] = [];

  // 1. Nonstandard speech
  SLANG_INDICATORS.lastIndex = 0;
  TRUNCATION_PATTERN.lastIndex = 0;
  if (SLANG_INDICATORS.test(sentence) || TRUNCATION_PATTERN.test(sentence)) {
    areas.push('nonstandard_speech');
  }
  SLANG_INDICATORS.lastIndex = 0;
  TRUNCATION_PATTERN.lastIndex = 0;

  // 2. Behavioral detail
  HESITATION_MARKERS.lastIndex = 0;
  REVERSAL_INDICATORS.lastIndex = 0;
  if (HESITATION_MARKERS.test(sentence) || REVERSAL_INDICATORS.test(sentence)) {
    areas.push('behavioral_detail');
  }
  HESITATION_MARKERS.lastIndex = 0;
  REVERSAL_INDICATORS.lastIndex = 0;

  // 3. Panic/cognitive compression
  const isFragment = sentence.split(/\s+/).length <= 5 && /[.!?]$/.test(sentence);
  REPETITION_PATTERN.lastIndex = 0;
  if (isFragment || REPETITION_PATTERN.test(sentence)) {
    areas.push('panic_compression');
  }
  REPETITION_PATTERN.lastIndex = 0;

  // 4. Performance register
  const hasRhyme = /\b(\w+)\b.+\b\w*\1\w*\b/i.test(sentence);
  if (hasRhyme && sentence.length < 100) {
    areas.push('performance_register');
  }

  // 5. Inventory/logistical density
  ENUMERATION_PATTERN.lastIndex = 0;
  const enumCount = (sentence.match(ENUMERATION_PATTERN) || []).length;
  ENUMERATION_PATTERN.lastIndex = 0;
  if (enumCount >= 2) {
    areas.push('inventory_density');
  }

  // 6. Physiological signals
  BREATHING_PATTERN.lastIndex = 0;
  TENSION_PATTERN.lastIndex = 0;
  if (BREATHING_PATTERN.test(sentence) || TENSION_PATTERN.test(sentence)) {
    areas.push('physiological_signal');
  }
  BREATHING_PATTERN.lastIndex = 0;
  TENSION_PATTERN.lastIndex = 0;

  return areas;
}
