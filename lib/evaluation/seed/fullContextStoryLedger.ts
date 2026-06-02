/**
 * Phase 0.5a — Full-Context Story Ledger Seed Generator
 *
 * Unlike the existing semanticSeedGenerator (which produces claim-based
 * hypotheses), this module generates a COMPLETE 9-layer story ledger with
 * explicit failure conditions from a single full-context LLM call.
 *
 * Architecture:
 *   - Input: Full manuscript text (no chunking)
 *   - Output: 9-layer story ledger with canonical hard facts + failure conditions
 *   - Authority: seed_only (non-authoritative until verified by Phase 1A)
 *   - Purpose: Provides ground truth constraints that prevent downstream
 *     comprehension failures (e.g., "Billy is dead" prevents any recommendation
 *     suggesting Billy acts after the tent scene)
 *
 * The output format mirrors the ChatGPT Story Ledger benchmark structure
 * defined in docs/benchmarks/story-ledger/.
 */

import OpenAI from 'openai';
import { getEvalOpenAiTimeoutMs } from '@/lib/evaluation/config';
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPipelineModel,
  isReasoningStyleModel,
} from '@/lib/evaluation/policy';
import {
  buildSeedBenchmarkContext,
  inferSeedRoute,
  validateLedgerStructure,
} from '@/lib/evaluation/seed/benchmarkContextBuilder';

// ── Types ────────────────────────────────────────────────────────────────────

export type StoryLedgerLayer =
  | 'source_integrity'
  | 'pov_structure'
  | 'canonical_identity'
  | 'cast_role_tier'
  | 'pronoun_transitions'
  | 'relationship_network'
  | 'object_symbol'
  | 'timeline_location_worldstate'
  | 'threat_pressure_ending';

export type CharacterEndState = {
  entity: string;
  end_state: string;
  is_terminal: boolean;
};

export type ObjectEntry = {
  name: string;
  attached_characters: string[];
  mobility: 'stationary' | 'mobile' | 'leaching';
  lifecycle_note: string;
};

export type RelationshipEntry = {
  pair: string;
  function: string;
  arc_summary: string;
};

export type FailureCondition = {
  layer: StoryLedgerLayer;
  condition: string;
};

export type CanonicalHardFact = {
  fact: string;
  layer: StoryLedgerLayer;
};

export type FullContextStoryLedger = {
  artifact_type: 'full_context_story_ledger_v1';
  authority: 'seed_only';
  generated_at: string;
  model: string;
  prompt_version: string;

  manuscript_title: string;
  manuscript_word_count: number;

  // 9-layer content
  layers: {
    source_integrity: {
      route: string;
      work_type: string;
      evidence_distribution_required: string[];
    };
    pov_structure: {
      pov_characters: string[];
      camera_owners: string[];
      note: string;
    };
    canonical_identity: {
      primary_entities: string[];
      must_not_omit: string[];
    };
    cast_role_tier: {
      tiers: Array<{ tier_name: string; entities: string[]; obligation: string }>;
    };
    pronoun_transitions: {
      reviewable_transitions: string[];
      do_not_flag: string[];
    };
    relationship_network: {
      relationships: RelationshipEntry[];
    };
    object_symbol: {
      objects: ObjectEntry[];
      contamination_model: string;
    };
    timeline_location_worldstate: {
      timeline_sequence: Array<{ phase: string; location: string; function: string }>;
      world_rules: Array<{ rule: string; treatment: string }>;
    };
    threat_pressure_ending: {
      pressures: Array<{ type: string; content: string }>;
      character_end_states: CharacterEndState[];
    };
  };

  // Validation contract
  canonical_hard_facts: CanonicalHardFact[];
  failure_conditions: FailureCondition[];
  hard_do_not_import: string[];

  // Review gate acceptance checks (Q&A format)
  acceptance_checks: Array<{ question: string; correct_answer: string }>;
};

// ── Prompt ───────────────────────────────────────────────────────────────────

const PROMPT_VERSION = 'phase05a-full-context-story-ledger-v1';

function buildFullContextSystemPrompt(workType?: string): string {
  const route = inferSeedRoute(workType);
  return `You are Phase 0.5A, the full-manuscript Story Ledger seed writer for RevisionGrade.

Your job: Read the ENTIRE manuscript in one pass and produce a comprehensive 9-layer Story Ledger with explicit failure conditions.

This ledger becomes the GROUND TRUTH that all downstream evaluation phases must respect. Any downstream recommendation that contradicts this ledger is INVALID.

${buildSeedBenchmarkContext(route)}

Output ONLY valid JSON matching the schema below. No prose, no markdown.

SCHEMA:
{
  "layers": {
    "source_integrity": {
      "route": "LONG_FORM | SHORT_FORM",
      "work_type": "novel | novella | short_story | etc",
      "evidence_distribution_required": ["list of manuscript regions that MUST be cited in downstream evidence"]
    },
    "pov_structure": {
      "pov_characters": ["characters who hold narrative POV"],
      "camera_owners": ["characters/entities whose perspective controls scenes"],
      "note": "brief description of POV strategy"
    },
    "canonical_identity": {
      "primary_entities": ["ALL named characters/forces that are plot-critical"],
      "must_not_omit": ["entities that downstream MUST track — omission = failure"]
    },
    "cast_role_tier": {
      "tiers": [
        { "tier_name": "name of tier", "entities": ["entity names"], "obligation": "what must be tracked for this tier" }
      ]
    },
    "pronoun_transitions": {
      "reviewable_transitions": ["any genuine pronoun/identity transitions in the text"],
      "do_not_flag": ["things that look like transitions but are NOT (deity personification, object POV, species labels, etc.)"]
    },
    "relationship_network": {
      "relationships": [
        { "pair": "Entity A / Entity B", "function": "relationship function", "arc_summary": "beginning → middle → ending" }
      ]
    },
    "object_symbol": {
      "objects": [
        { "name": "object name", "attached_characters": ["chars"], "mobility": "stationary|mobile|leaching", "lifecycle_note": "how it functions in the story" }
      ],
      "contamination_model": "describe how contamination/influence ACTUALLY moves in this story (what is fixed, what is mobile, what leaches)"
    },
    "timeline_location_worldstate": {
      "timeline_sequence": [
        { "phase": "narrative phase name", "location": "where", "function": "what happens" }
      ],
      "world_rules": [
        { "rule": "rule statement", "treatment": "how the ledger should treat it" }
      ]
    },
    "threat_pressure_ending": {
      "pressures": [
        { "type": "pressure category", "content": "what it involves" }
      ],
      "character_end_states": [
        { "entity": "name", "end_state": "what happens to them by end", "is_terminal": true/false }
      ]
    }
  },
  "canonical_hard_facts": [
    { "fact": "declarative factual statement about the manuscript", "layer": "which layer it belongs to" }
  ],
  "failure_conditions": [
    { "layer": "layer name", "condition": "Fails if [specific incorrect claim that would indicate comprehension failure]" }
  ],
  "hard_do_not_import": ["content from other works or false assumptions that must NEVER appear"],
  "acceptance_checks": [
    { "question": "verification question", "correct_answer": "the correct answer based on manuscript" }
  ]
}

CRITICAL RULES:
1. Read the FULL manuscript. Do not sample or skim.
2. Character end-states must be ACCURATE. If a character DIES, mark is_terminal=true. Do not assume survival.
3. Object mobility must reflect ACTUAL text. If an object stays in one place, mark "stationary." If contamination moves via water/carrier, that is "leaching" or "mobile" respectively.
4. Failure conditions must be SPECIFIC and FALSIFIABLE. Each should catch a concrete comprehension error.
5. The contamination_model field must describe the ACTUAL mechanism of how influence/danger spreads, not a generic "objects move between locations."
6. canonical_hard_facts should include 10-20 key facts that downstream phases MUST respect.
7. acceptance_checks should include 8-12 questions that verify the ledger is correct.
8. Include ALL major characters in character_end_states, especially those who DIE.
9. Do not confuse cosmology/religion with physical geography (e.g., a deity is not a "lake owner").
10. Do not confuse mutation/transformation with death (e.g., mutated fish are alive, not dead fish).
11. NEVER list dialogue fragments, interjections, or common English words as character entities. Words like "No", "Yes", "Oh", "Hey" that appear at the start of dialogue lines followed by a comma are NOT character names. Only list proper names, titles, nicknames, or stable identity labels from the manuscript.`;
}

function buildUserPrompt(params: {
  title: string;
  workType: string;
  wordCount: number;
  manuscriptText: string;
}): string {
  return `Generate the full 9-layer Story Ledger for this manuscript.

Title: ${params.title}
Work type: ${params.workType}
Word count: ${params.wordCount}

MANUSCRIPT TEXT:
${params.manuscriptText}

Return ONLY the JSON object. No markdown fences. No commentary.`;
}

// ── Generator ────────────────────────────────────────────────────────────────

export type GenerateFullContextLedgerInput = {
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

export type GenerateFullContextLedgerResult = {
  ledger: FullContextStoryLedger;
  model: string;
  promptVersion: string;
  durationMs: number;
  structuralValidation?: import('@/lib/evaluation/seed/benchmarkContextBuilder').SeedStructuralValidation;
};

function parseStoryLedgerResponse(
  raw: string,
  params: { title: string; wordCount: number },
): Partial<FullContextStoryLedger> {
  if (!raw || !raw.trim()) {
    throw new Error('Empty response from LLM for full-context story ledger');
  }

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Story ledger response is not a valid JSON object');
  }

  return parsed as Partial<FullContextStoryLedger>;
}

function normalizeLayerName(key: string): StoryLedgerLayer | null {
  const map: Record<string, StoryLedgerLayer> = {
    source_integrity: 'source_integrity',
    pov_structure: 'pov_structure',
    canonical_identity: 'canonical_identity',
    cast_role_tier: 'cast_role_tier',
    pronoun_transitions: 'pronoun_transitions',
    relationship_network: 'relationship_network',
    object_symbol: 'object_symbol',
    timeline_location_worldstate: 'timeline_location_worldstate',
    threat_pressure_ending: 'threat_pressure_ending',
  };
  return map[key] ?? null;
}

function normalizeCanonicalHardFacts(raw: unknown): CanonicalHardFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      fact: typeof item.fact === 'string' ? item.fact : String(item.fact ?? ''),
      layer: normalizeLayerName(String(item.layer ?? '')) ?? 'source_integrity',
    }))
    .filter((f) => f.fact.length > 0);
}

function normalizeFailureConditions(raw: unknown): FailureCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      layer: normalizeLayerName(String(item.layer ?? '')) ?? 'source_integrity',
      condition: typeof item.condition === 'string' ? item.condition : String(item.condition ?? ''),
    }))
    .filter((f) => f.condition.length > 0);
}

function normalizeAcceptanceChecks(raw: unknown): Array<{ question: string; correct_answer: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      question: typeof item.question === 'string' ? item.question : '',
      correct_answer: typeof item.correct_answer === 'string' ? item.correct_answer : '',
    }))
    .filter((c) => c.question.length > 0 && c.correct_answer.length > 0);
}

function normalizeCharacterEndStates(raw: unknown): CharacterEndState[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      entity: typeof item.entity === 'string' ? item.entity : '',
      end_state: typeof item.end_state === 'string' ? item.end_state : '',
      is_terminal: item.is_terminal === true,
    }))
    .filter((e) => e.entity.length > 0);
}

function normalizeObjectEntries(raw: unknown): ObjectEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const mobilityRaw = item.mobility;
      const mobility: 'stationary' | 'mobile' | 'leaching' =
        (mobilityRaw === 'stationary' || mobilityRaw === 'mobile' || mobilityRaw === 'leaching')
          ? mobilityRaw
          : 'stationary';
      return {
        name: typeof item.name === 'string' ? item.name : '',
        attached_characters: Array.isArray(item.attached_characters)
          ? item.attached_characters.filter((c): c is string => typeof c === 'string')
          : [],
        mobility,
        lifecycle_note: typeof item.lifecycle_note === 'string' ? item.lifecycle_note : '',
      };
    })
    .filter((o) => o.name.length > 0);
}

function normalizeRelationships(raw: unknown): RelationshipEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      pair: typeof item.pair === 'string' ? item.pair : '',
      function: typeof item.function === 'string' ? item.function : '',
      arc_summary: typeof item.arc_summary === 'string' ? item.arc_summary : '',
    }))
    .filter((r) => r.pair.length > 0);
}

function buildFullLedger(
  parsed: Partial<FullContextStoryLedger>,
  meta: { title: string; wordCount: number; model: string; generatedAt: string },
): FullContextStoryLedger {
  const layers = parsed.layers && typeof parsed.layers === 'object' ? parsed.layers : {} as any;

  const sourceIntegrity = layers.source_integrity && typeof layers.source_integrity === 'object'
    ? layers.source_integrity
    : {} as any;
  const povStructure = layers.pov_structure && typeof layers.pov_structure === 'object'
    ? layers.pov_structure
    : {} as any;
  const canonicalIdentity = layers.canonical_identity && typeof layers.canonical_identity === 'object'
    ? layers.canonical_identity
    : {} as any;
  const castRoleTier = layers.cast_role_tier && typeof layers.cast_role_tier === 'object'
    ? layers.cast_role_tier
    : {} as any;
  const pronounTransitions = layers.pronoun_transitions && typeof layers.pronoun_transitions === 'object'
    ? layers.pronoun_transitions
    : {} as any;
  const relationshipNetwork = layers.relationship_network && typeof layers.relationship_network === 'object'
    ? layers.relationship_network
    : {} as any;
  const objectSymbol = layers.object_symbol && typeof layers.object_symbol === 'object'
    ? layers.object_symbol
    : {} as any;
  const timelineLocation = layers.timeline_location_worldstate && typeof layers.timeline_location_worldstate === 'object'
    ? layers.timeline_location_worldstate
    : {} as any;
  const threatPressure = layers.threat_pressure_ending && typeof layers.threat_pressure_ending === 'object'
    ? layers.threat_pressure_ending
    : {} as any;

  return {
    artifact_type: 'full_context_story_ledger_v1',
    authority: 'seed_only',
    generated_at: meta.generatedAt,
    model: meta.model,
    prompt_version: PROMPT_VERSION,
    manuscript_title: meta.title,
    manuscript_word_count: meta.wordCount,
    layers: {
      source_integrity: {
        route: typeof sourceIntegrity.route === 'string' ? sourceIntegrity.route : 'LONG_FORM',
        work_type: typeof sourceIntegrity.work_type === 'string' ? sourceIntegrity.work_type : 'novel',
        evidence_distribution_required: Array.isArray(sourceIntegrity.evidence_distribution_required)
          ? sourceIntegrity.evidence_distribution_required.filter((s: unknown): s is string => typeof s === 'string')
          : [],
      },
      pov_structure: {
        pov_characters: Array.isArray(povStructure.pov_characters)
          ? povStructure.pov_characters.filter((s: unknown): s is string => typeof s === 'string')
          : [],
        camera_owners: Array.isArray(povStructure.camera_owners)
          ? povStructure.camera_owners.filter((s: unknown): s is string => typeof s === 'string')
          : [],
        note: typeof povStructure.note === 'string' ? povStructure.note : '',
      },
      canonical_identity: {
        primary_entities: Array.isArray(canonicalIdentity.primary_entities)
          ? canonicalIdentity.primary_entities.filter((s: unknown): s is string => typeof s === 'string')
          : [],
        must_not_omit: Array.isArray(canonicalIdentity.must_not_omit)
          ? canonicalIdentity.must_not_omit.filter((s: unknown): s is string => typeof s === 'string')
          : [],
      },
      cast_role_tier: {
        tiers: Array.isArray(castRoleTier.tiers)
          ? castRoleTier.tiers
              .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === 'object')
              .map((t: Record<string, unknown>) => ({
                tier_name: typeof t.tier_name === 'string' ? t.tier_name : '',
                entities: Array.isArray(t.entities) ? t.entities.filter((s: unknown): s is string => typeof s === 'string') : [],
                obligation: typeof t.obligation === 'string' ? t.obligation : '',
              }))
          : [],
      },
      pronoun_transitions: {
        reviewable_transitions: Array.isArray(pronounTransitions.reviewable_transitions)
          ? pronounTransitions.reviewable_transitions.filter((s: unknown): s is string => typeof s === 'string')
          : [],
        do_not_flag: Array.isArray(pronounTransitions.do_not_flag)
          ? pronounTransitions.do_not_flag.filter((s: unknown): s is string => typeof s === 'string')
          : [],
      },
      relationship_network: {
        relationships: normalizeRelationships(relationshipNetwork.relationships),
      },
      object_symbol: {
        objects: normalizeObjectEntries(objectSymbol.objects),
        contamination_model: typeof objectSymbol.contamination_model === 'string'
          ? objectSymbol.contamination_model
          : '',
      },
      timeline_location_worldstate: {
        timeline_sequence: Array.isArray(timelineLocation.timeline_sequence)
          ? timelineLocation.timeline_sequence
              .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === 'object')
              .map((t: Record<string, unknown>) => ({
                phase: typeof t.phase === 'string' ? t.phase : '',
                location: typeof t.location === 'string' ? t.location : '',
                function: typeof t.function === 'string' ? t.function : '',
              }))
          : [],
        world_rules: Array.isArray(timelineLocation.world_rules)
          ? timelineLocation.world_rules
              .filter((r: unknown): r is Record<string, unknown> => !!r && typeof r === 'object')
              .map((r: Record<string, unknown>) => ({
                rule: typeof r.rule === 'string' ? r.rule : '',
                treatment: typeof r.treatment === 'string' ? r.treatment : '',
              }))
          : [],
      },
      threat_pressure_ending: {
        pressures: Array.isArray(threatPressure.pressures)
          ? threatPressure.pressures
              .filter((p: unknown): p is Record<string, unknown> => !!p && typeof p === 'object')
              .map((p: Record<string, unknown>) => ({
                type: typeof p.type === 'string' ? p.type : '',
                content: typeof p.content === 'string' ? p.content : '',
              }))
          : [],
        character_end_states: normalizeCharacterEndStates(threatPressure.character_end_states),
      },
    },
    canonical_hard_facts: normalizeCanonicalHardFacts(parsed.canonical_hard_facts),
    failure_conditions: normalizeFailureConditions(parsed.failure_conditions),
    hard_do_not_import: Array.isArray(parsed.hard_do_not_import)
      ? parsed.hard_do_not_import.filter((s: unknown): s is string => typeof s === 'string')
      : [],
    acceptance_checks: normalizeAcceptanceChecks(parsed.acceptance_checks),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateFullContextStoryLedger(
  input: GenerateFullContextLedgerInput,
): Promise<GenerateFullContextLedgerResult> {
  const model = getCanonicalPipelineModel(input.model);
  const timeoutMs = input.timeoutMs ?? Math.max(getEvalOpenAiTimeoutMs(), 120_000);
  const apiKey = input.openaiApiKey?.trim() ?? process.env.OPENAI_API_KEY ?? '';
  const generatedAt = new Date().toISOString();

  if (!apiKey) {
    throw new Error('Phase 0.5a: Missing OpenAI API key for full-context story ledger generation');
  }

  const openai = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 3,
  });

  const startMs = Date.now();

  const userPrompt = buildUserPrompt({
    title: input.title,
    workType: input.workType,
    wordCount: input.wordCount,
    manuscriptText: input.manuscriptText,
  });

  const completion = await openai.chat.completions.create({
    model,
    ...(isReasoningStyleModel(model) ? {} : buildOpenAITemperatureParam(model, 0.1)),
    ...buildOpenAIOutputTokenParam(model, 16_000),
    messages: [
      { role: 'system', content: buildFullContextSystemPrompt(input.workType) },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  const durationMs = Date.now() - startMs;

  const parsed = parseStoryLedgerResponse(raw, {
    title: input.title,
    wordCount: input.wordCount,
  });

  const ledger = buildFullLedger(parsed, {
    title: input.title,
    wordCount: input.wordCount,
    model,
    generatedAt,
  });

  // Structural validation against benchmark template
  const structuralValidation = validateLedgerStructure(ledger.layers as unknown as Record<string, unknown>);
  if (structuralValidation.warnings.length > 0) {
    console.warn(
      `[phase_0.5a] Structural validation warnings for "${input.title}":`,
      structuralValidation.warnings.join('; '),
    );
  }

  return {
    ledger,
    model,
    promptVersion: PROMPT_VERSION,
    durationMs,
    structuralValidation,
  };
}

// ── Ledger Quality Minimum Gate ──────────────────────────────────────────────

export type LedgerQualityDimension = {
  name: string;
  actual: number;
  minimum: number;
  passed: boolean;
};

export type LedgerQualityAssessment = {
  status: 'passed' | 'degraded';
  dimensions: LedgerQualityDimension[];
  degraded_dimensions: string[];
  overall_completeness: number;
};

const LEDGER_QUALITY_MINIMUMS = {
  canonical_hard_facts: 8,
  character_end_states: 3,
  failure_conditions: 3,
  acceptance_checks: 5,
  primary_entities: 2,
  relationships: 2,
} as const;

export function assessLedgerQuality(ledger: FullContextStoryLedger): LedgerQualityAssessment {
  const dimensions: LedgerQualityDimension[] = [
    {
      name: 'canonical_hard_facts',
      actual: ledger.canonical_hard_facts.length,
      minimum: LEDGER_QUALITY_MINIMUMS.canonical_hard_facts,
      passed: ledger.canonical_hard_facts.length >= LEDGER_QUALITY_MINIMUMS.canonical_hard_facts,
    },
    {
      name: 'character_end_states',
      actual: ledger.layers.threat_pressure_ending.character_end_states.length,
      minimum: LEDGER_QUALITY_MINIMUMS.character_end_states,
      passed: ledger.layers.threat_pressure_ending.character_end_states.length >= LEDGER_QUALITY_MINIMUMS.character_end_states,
    },
    {
      name: 'failure_conditions',
      actual: ledger.failure_conditions.length,
      minimum: LEDGER_QUALITY_MINIMUMS.failure_conditions,
      passed: ledger.failure_conditions.length >= LEDGER_QUALITY_MINIMUMS.failure_conditions,
    },
    {
      name: 'acceptance_checks',
      actual: ledger.acceptance_checks.length,
      minimum: LEDGER_QUALITY_MINIMUMS.acceptance_checks,
      passed: ledger.acceptance_checks.length >= LEDGER_QUALITY_MINIMUMS.acceptance_checks,
    },
    {
      name: 'primary_entities',
      actual: ledger.layers.canonical_identity.primary_entities.length,
      minimum: LEDGER_QUALITY_MINIMUMS.primary_entities,
      passed: ledger.layers.canonical_identity.primary_entities.length >= LEDGER_QUALITY_MINIMUMS.primary_entities,
    },
    {
      name: 'relationships',
      actual: ledger.layers.relationship_network.relationships.length,
      minimum: LEDGER_QUALITY_MINIMUMS.relationships,
      passed: ledger.layers.relationship_network.relationships.length >= LEDGER_QUALITY_MINIMUMS.relationships,
    },
  ];

  const degraded_dimensions = dimensions.filter(d => !d.passed).map(d => d.name);
  const passedCount = dimensions.filter(d => d.passed).length;
  const overall_completeness = dimensions.length > 0 ? passedCount / dimensions.length : 0;

  return {
    status: degraded_dimensions.length === 0 ? 'passed' : 'degraded',
    dimensions,
    degraded_dimensions,
    overall_completeness,
  };
}

/**
 * Builds the seed context block for Phase 1A chunks from a full-context story ledger.
 * This is the "coarse bridge" — hard facts that travel with every chunk.
 */
export function buildLedgerSeedContextBlock(ledger: FullContextStoryLedger): string {
  const lines: string[] = [];

  lines.push('═══ STORY LEDGER GROUND TRUTH (Phase 0.5a — MANDATORY CONSTRAINTS) ═══');
  lines.push('');
  lines.push('The following facts are CANONICAL. Any extraction or scoring that contradicts these is INVALID.');
  lines.push('');

  // Canonical hard facts
  lines.push('── CANONICAL HARD FACTS ──');
  for (const fact of ledger.canonical_hard_facts) {
    lines.push(`  • ${fact.fact}`);
  }
  lines.push('');

  // Character end states (critical for preventing "character alive" errors)
  lines.push('── CHARACTER END STATES ──');
  for (const endState of ledger.layers.threat_pressure_ending.character_end_states) {
    const terminal = endState.is_terminal ? ' [TERMINAL — no post-death arc]' : '';
    lines.push(`  • ${endState.entity}: ${endState.end_state}${terminal}`);
  }
  lines.push('');

  // Object mobility (critical for preventing "objects move" errors)
  lines.push('── OBJECT MOBILITY ──');
  for (const obj of ledger.layers.object_symbol.objects) {
    lines.push(`  • ${obj.name}: ${obj.mobility} — ${obj.lifecycle_note}`);
  }
  if (ledger.layers.object_symbol.contamination_model) {
    lines.push(`  CONTAMINATION MODEL: ${ledger.layers.object_symbol.contamination_model}`);
  }
  lines.push('');

  // Failure conditions (what must NOT be claimed)
  lines.push('── FAILURE CONDITIONS (claims that would be WRONG) ──');
  for (const fc of ledger.failure_conditions.slice(0, 15)) {
    lines.push(`  ✗ ${fc.condition}`);
  }
  lines.push('');

  // Must-not-omit entities
  lines.push('── MUST NOT OMIT ──');
  for (const entity of ledger.layers.canonical_identity.must_not_omit) {
    lines.push(`  ★ ${entity}`);
  }

  return lines.join('\n');
}
