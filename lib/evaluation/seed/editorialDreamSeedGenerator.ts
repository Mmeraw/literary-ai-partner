/**
 * Phase 0.5b: Full-Context DREAM Seed Generator
 *
 * Generates a comprehensive editorial diagnostic from the full manuscript
 * in a single LLM call. This functions as a calibration reference for
 * downstream phases — providing target scoring, evidence distribution,
 * and recommendation specificity that Phase 3/3B should aim to match.
 *
 * The DREAM seed is NOT injected into chunk prompts (unlike the story ledger).
 * Instead, it calibrates Phase 3B longform output quality by providing a
 * reference document that the synthesis should approximate in depth and
 * specificity.
 *
 * Gated behind EVAL_FULL_CONTEXT_LEDGER=true feature flag (same gate as Phase 0.5a).
 */

import OpenAI from 'openai';
import { trackCompletionCost } from '@/lib/jobs/cost';
import { getCanonicalSeedModel } from '@/lib/evaluation/policy';
import { buildCompactTemplateBlock, resolveTemplateKey } from '@/lib/evaluation/dreamTemplateLoader';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DreamSeedCriterionDiagnostic {
  criterion: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  diagnosis: string;
  key_evidence: string[];
  revision_note: string;
}

export interface DreamSeedRevisionItem {
  priority: number;
  category: 'MUST' | 'SHOULD' | 'COULD';
  symptom: string;
  cause: string;
  fix: string;
  reader_effect: string;
}

export interface EditorialDreamSeed {
  artifact_type: 'editorial_dream_seed_v1';
  authority: 'seed_only';
  generated_at: string;
  model: string;
  prompt_version: string;
  manuscript_title: string;
  manuscript_word_count: number;

  executive_verdict: string;
  overall_score: number;
  overall_grade: 'PUBLISH' | 'REVISE' | 'DEVELOP' | 'REJECT';
  primary_diagnosis: string;
  secondary_diagnosis: string;

  criterion_diagnostics: DreamSeedCriterionDiagnostic[];

  structural_stack: {
    act_structure: string;
    convergence_assessment: string;
    closure_assessment: string;
    pacing_notes: string;
  };

  revision_queue: DreamSeedRevisionItem[];

  what_this_should_not_become: string;
  releasability_note: string;

  evidence_distribution: {
    opening_third: string[];
    middle_third: string[];
    final_third: string[];
  };

  acceptance_checks: Array<{
    question: string;
    correct_answer: string;
  }>;
}

export type GenerateEditorialDreamSeedInput = {
  jobId: string;
  manuscriptId: number;
  manuscriptText: string;
  title: string;
  workType: string;
  wordCount: number;
  openaiApiKey?: string | null;
  model?: string;
  timeoutMs?: number;
};

export type GenerateEditorialDreamSeedResult = {
  dreamSeed: EditorialDreamSeed;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

// ─── Prompt ──────────────────────────────────────────────────────────────────

const DREAM_SEED_PROMPT_VERSION = 'editorial_dream_seed_v1.0';

const DREAM_SEED_SYSTEM_PROMPT = `You are a senior developmental editor producing a comprehensive editorial diagnostic for a manuscript. You read the FULL text and produce an honest, specific, evidence-rich evaluation.

Your output is a calibration reference — it sets the quality ceiling for downstream automated evaluation. Be specific. Name scenes. Quote key images. Identify exactly where the manuscript succeeds and where it needs revision.

OUTPUT FORMAT: Return a single JSON object with these fields:

{
  "executive_verdict": "2-3 paragraph editorial summary of the manuscript's core identity, strengths, and primary revision needs",
  "overall_score": <integer 0-100>,
  "overall_grade": "PUBLISH" | "REVISE" | "DEVELOP" | "REJECT",
  "primary_diagnosis": "1 sentence: the single most important thing about this manuscript",
  "secondary_diagnosis": "1 sentence: the second most important editorial observation",
  "criterion_diagnostics": [
    {
      "criterion": "<one of: Concept, NarrativeDrive, CharacterWork, ProseControl, DialogueAuthenticity, ThematicResonance, WorldCoherence, EmotionalArc, SceneConstruction, VoiceAuthority, NarrativeClosure, ToneConsistency>",
      "score": <integer 0-10>,
      "confidence": "high" | "medium" | "low",
      "diagnosis": "2-3 sentences: what's working and what's not in this dimension",
      "key_evidence": ["scene/chapter reference 1", "scene/chapter reference 2"],
      "revision_note": "1 sentence: specific actionable revision guidance"
    }
    // One entry per criterion (12 total)
  ],
  "structural_stack": {
    "act_structure": "Description of how the manuscript is structurally organized",
    "convergence_assessment": "How well do the narrative threads converge?",
    "closure_assessment": "Does the ending deliver enough resolution for this volume?",
    "pacing_notes": "Where does pacing sag or rush?"
  },
  "revision_queue": [
    {
      "priority": <1-based integer>,
      "category": "MUST" | "SHOULD" | "COULD",
      "symptom": "What the reader experiences as wrong",
      "cause": "Why it's happening at the craft level",
      "fix": "Specific, actionable revision instruction (name scenes, characters)",
      "reader_effect": "What the reader gains when this is fixed"
    }
    // 5-10 items, ordered by priority
  ],
  "what_this_should_not_become": "1-2 sentences: what editorial direction would damage this manuscript's identity",
  "releasability_note": "1 sentence: overall readiness assessment",
  "evidence_distribution": {
    "opening_third": ["key evidence item 1 from opening third", "..."],
    "middle_third": ["key evidence item 1 from middle third", "..."],
    "final_third": ["key evidence item 1 from final third", "..."]
  },
  "acceptance_checks": [
    {"question": "factual comprehension question about the text", "correct_answer": "answer"}
    // 5-8 checks that verify the evaluator actually read the full manuscript
  ]
}

CRITICAL RULES:
- Evidence MUST be distributed across the full text — not clustered in opening chapters
- Recommendations MUST respect plot facts (dead characters stay dead, stationary objects stay put)
- Scores should be honest — do not inflate. A strong manuscript with real weaknesses gets 75-85.
- Revision items must be SPECIFIC — name characters, scenes, chapters. "Add more closure" is not acceptable; "Add a 500-word Billy aftermath beat after the tent confrontation to ground the emotional stakes" is.
- The "what this should not become" field prevents the author from misreading criticism as a mandate to flatten their work
- acceptance_checks verify you actually read the ending, middle, and key turning points`;

// ─── Generator ───────────────────────────────────────────────────────────────

export async function generateEditorialDreamSeed(
  input: GenerateEditorialDreamSeedInput,
): Promise<GenerateEditorialDreamSeedResult> {
  const model = input.model || getCanonicalSeedModel();
  const apiKey = input.openaiApiKey || process.env.OPENAI_API_KEY || '';
  const timeoutMs = input.timeoutMs || 180_000;

  const openai = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 2,
  });

  const templateKey = resolveTemplateKey(input.wordCount);
  const dreamTemplateBlock = buildCompactTemplateBlock(templateKey);

  const userPrompt = `MANUSCRIPT TITLE: ${input.title}
WORK TYPE: ${input.workType}
WORD COUNT: ${input.wordCount}
${dreamTemplateBlock ? `
## DREAM EVALUATION TEMPLATE (Canonical Report Shape)
Your diagnostic must prepare the manuscript for an evaluation that conforms to this template. Ensure your scoring, evidence distribution, and revision guidance align with the sections below.
${dreamTemplateBlock}
` : ""}
Read the following manuscript IN FULL and produce the editorial diagnostic JSON.

<manuscript>
${input.manuscriptText}
</manuscript>

Produce your editorial diagnostic now. Remember: evidence must be distributed across the FULL manuscript, not clustered in the opening. Name specific scenes, characters, and turning points from ALL sections.`;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: DREAM_SEED_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_completion_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  trackCompletionCost({
    jobId: input.jobId,
    phase: 'phase05b_editorial_dream_seed',
    model,
    usage: response.usage,
  });

  const content = response.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content) as Record<string, unknown>;

  const dreamSeed: EditorialDreamSeed = {
    artifact_type: 'editorial_dream_seed_v1',
    authority: 'seed_only',
    generated_at: new Date().toISOString(),
    model,
    prompt_version: DREAM_SEED_PROMPT_VERSION,
    manuscript_title: input.title,
    manuscript_word_count: input.wordCount,

    executive_verdict: typeof parsed.executive_verdict === 'string' ? parsed.executive_verdict : '',
    overall_score: typeof parsed.overall_score === 'number' ? parsed.overall_score : 0,
    overall_grade: normalizeGrade(parsed.overall_grade),
    primary_diagnosis: typeof parsed.primary_diagnosis === 'string' ? parsed.primary_diagnosis : '',
    secondary_diagnosis: typeof parsed.secondary_diagnosis === 'string' ? parsed.secondary_diagnosis : '',

    criterion_diagnostics: normalizeCriterionDiagnostics(parsed.criterion_diagnostics),

    structural_stack: normalizeStructuralStack(parsed.structural_stack),

    revision_queue: normalizeRevisionQueue(parsed.revision_queue),

    what_this_should_not_become: typeof parsed.what_this_should_not_become === 'string'
      ? parsed.what_this_should_not_become : '',
    releasability_note: typeof parsed.releasability_note === 'string'
      ? parsed.releasability_note : '',

    evidence_distribution: normalizeEvidenceDistribution(parsed.evidence_distribution),

    acceptance_checks: normalizeAcceptanceChecks(parsed.acceptance_checks),
  };

  return {
    dreamSeed,
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
  };
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeGrade(raw: unknown): 'PUBLISH' | 'REVISE' | 'DEVELOP' | 'REJECT' {
  if (raw === 'PUBLISH' || raw === 'REVISE' || raw === 'DEVELOP' || raw === 'REJECT') return raw;
  return 'REVISE';
}

function normalizeCriterionDiagnostics(raw: unknown): DreamSeedCriterionDiagnostic[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const confidence: 'high' | 'medium' | 'low' =
        (item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low')
          ? item.confidence : 'medium';
      return {
        criterion: typeof item.criterion === 'string' ? item.criterion : '',
        score: typeof item.score === 'number' ? Math.floor(item.score) : 5,
        confidence,
        diagnosis: typeof item.diagnosis === 'string' ? item.diagnosis : '',
        key_evidence: Array.isArray(item.key_evidence)
          ? item.key_evidence.filter((e): e is string => typeof e === 'string')
          : [],
        revision_note: typeof item.revision_note === 'string' ? item.revision_note : '',
      };
    })
    .filter((d) => d.criterion.length > 0);
}

function normalizeStructuralStack(raw: unknown): EditorialDreamSeed['structural_stack'] {
  if (!raw || typeof raw !== 'object') {
    return { act_structure: '', convergence_assessment: '', closure_assessment: '', pacing_notes: '' };
  }
  const obj = raw as Record<string, unknown>;
  return {
    act_structure: typeof obj.act_structure === 'string' ? obj.act_structure : '',
    convergence_assessment: typeof obj.convergence_assessment === 'string' ? obj.convergence_assessment : '',
    closure_assessment: typeof obj.closure_assessment === 'string' ? obj.closure_assessment : '',
    pacing_notes: typeof obj.pacing_notes === 'string' ? obj.pacing_notes : '',
  };
}

function normalizeRevisionQueue(raw: unknown): DreamSeedRevisionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const category: 'MUST' | 'SHOULD' | 'COULD' =
        (item.category === 'MUST' || item.category === 'SHOULD' || item.category === 'COULD')
          ? item.category : 'SHOULD';
      return {
        priority: typeof item.priority === 'number' ? item.priority : 99,
        category,
        symptom: typeof item.symptom === 'string' ? item.symptom : '',
        cause: typeof item.cause === 'string' ? item.cause : '',
        fix: typeof item.fix === 'string' ? item.fix : '',
        reader_effect: typeof item.reader_effect === 'string' ? item.reader_effect : '',
      };
    })
    .filter((r) => r.symptom.length > 0 || r.fix.length > 0);
}

function normalizeEvidenceDistribution(raw: unknown): EditorialDreamSeed['evidence_distribution'] {
  if (!raw || typeof raw !== 'object') {
    return { opening_third: [], middle_third: [], final_third: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    opening_third: Array.isArray(obj.opening_third)
      ? obj.opening_third.filter((e): e is string => typeof e === 'string')
      : [],
    middle_third: Array.isArray(obj.middle_third)
      ? obj.middle_third.filter((e): e is string => typeof e === 'string')
      : [],
    final_third: Array.isArray(obj.final_third)
      ? obj.final_third.filter((e): e is string => typeof e === 'string')
      : [],
  };
}

function normalizeAcceptanceChecks(raw: unknown): Array<{ question: string; correct_answer: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      question: typeof item.question === 'string' ? item.question : '',
      correct_answer: typeof item.correct_answer === 'string' ? item.correct_answer : '',
    }))
    .filter((c) => c.question.length > 0);
}

/**
 * Build a compact calibration block from the DREAM seed for use in Phase 3B.
 * This provides the scoring target and evidence distribution reference.
 */
export function buildDreamCalibrationBlock(seed: EditorialDreamSeed): string {
  const lines: string[] = [
    '=== DREAM SEED CALIBRATION REFERENCE (Phase 0.5b) ===',
    `Overall: ${seed.overall_score}/100 (${seed.overall_grade})`,
    `Diagnosis: ${seed.primary_diagnosis}`,
    '',
    'Criterion targets:',
  ];

  for (const crit of seed.criterion_diagnostics) {
    lines.push(`  ${crit.criterion}: ${crit.score}/10 (${crit.confidence})`);
  }

  lines.push('');
  lines.push('Evidence distribution requirement:');
  lines.push(`  Opening third: ${seed.evidence_distribution.opening_third.length} items`);
  lines.push(`  Middle third: ${seed.evidence_distribution.middle_third.length} items`);
  lines.push(`  Final third: ${seed.evidence_distribution.final_third.length} items`);

  lines.push('');
  lines.push(`What this should NOT become: ${seed.what_this_should_not_become}`);
  lines.push('=== END DREAM SEED CALIBRATION ===');

  return lines.join('\n');
}
