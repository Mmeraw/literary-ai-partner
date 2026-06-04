/**
 * Benchmark Context Builder for Seed Generation
 *
 * Builds a compact context block from the dream/gold-standard benchmarks
 * and failure modes docs. This context is injected into seed generation
 * prompts so the LLM has:
 *   1. The exact 9-layer structure it must populate
 *   2. Per-layer failure conditions (what NOT to do)
 *   3. Gold-standard example shapes (what good output looks like)
 *   4. Structural validation criteria
 *   5. The DREAM evaluation template for the manuscript's route (long-form or short-form)
 *   6. A completed benchmark exemplar showing what gold-standard output looks like
 *
 * The context is kept compact to fit within model budgets
 * while providing enough grounding to prevent common extraction failures.
 */

import { buildCompactTemplateBlock, buildCompactStoryLedgerBlock, type DreamTemplateKey } from "@/lib/evaluation/dreamTemplateLoader";

export type SeedRoute = 'LONG_FORM' | 'SHORT_FORM';

/**
 * Infers the evaluation route from a work type string.
 * Short stories and excerpts use SHORT_FORM; everything else uses LONG_FORM.
 */
export function inferSeedRoute(workType?: string | null): SeedRoute {
  if (!workType) return 'LONG_FORM';
  const normalized = workType.toLowerCase().trim();
  const shortFormTypes = ['short_story', 'short story', 'excerpt', 'flash', 'flash_fiction', 'sample', 'chapter'];
  return shortFormTypes.some((t) => normalized.includes(t)) ? 'SHORT_FORM' : 'LONG_FORM';
}

// ── 9-Layer Template Structure ──────────────────────────────────────────────
// Now loaded at runtime from docs/benchmarks/story-ledger/STORY_LEDGER_9_LAYER_TEMPLATE.md
// via buildCompactStoryLedgerBlock(). The canonical .md file contains all 9 layers,
// required fields, failure conditions, validation contract, and completion standard.
// Hardcoded inline strings removed — single source of truth.

// ── DREAM Evaluation Templates (route-specific) ─────────────────────────────
// Templates are now loaded from docs/templates/evaluation/*.md via dreamTemplateLoader.
// The loader reads the canonical .md files, caches them, and produces compact
// prompt-ready blocks. Hardcoded summaries replaced with runtime file reads.

// ── Completed Benchmark Exemplar (compact) ──────────────────────────────────

const BENCHMARK_EXEMPLAR_LONGFORM = `
COMPLETED BENCHMARK EXEMPLAR — LONG-FORM (Froggin Noggin, 127K words, novel):
This is what a gold-standard evaluation looks like when completed. Use this as your target shape.

- Executive verdict: Named governing ambition (eco-satirical myth), primary emotional anchor (amphibian world), greatest asset (originality/world-system), principal drag (overabundance without hierarchy), readiness (not yet submission-ready, one major pass away)
- Overall quality: 66/100, Readiness: 58/100
- Structural stack: 4 layers identified (Human damage, Amphibian polity, Mythic/doctrinal, Environmental/ecological) with dependencies mapped
- 13 criteria scored: Concept 7, Drive 6, Character 6, POV/Voice 6, Scene 6, Dialogue 5, Theme 7, World 7, Prose 5, Pacing 5, Closure NE, Market 4
- Per-criterion: fit/gap with anchored evidence, why-it-matters, how-to-revise
- DREAM ledgers: character arcs for 8+ entities, relationship spine for 6+ pairs, symbol payoff for shard/toadstone/Gorf, sensory register across layers
- Revision priorities: architecture before stylistic, preserve weirdness, reorganize collision spine, tighten transitions
- Key learning: The seed MUST identify ALL major characters, their end states, ALL story-bearing objects, and the contamination model — because downstream phases CANNOT invent these
`.trim();

const BENCHMARK_EXEMPLAR_SHORTFORM = `
COMPLETED BENCHMARK EXEMPLAR — SHORT-FORM (Ancient Bloodlines, 18K words, novella):
This is what a gold-standard short-form evaluation looks like. Use this as your target shape.

- Verdict: Ambitious eco-fable with distinctive cross-species love story and moral battleground; pacing uneven where lore outruns conflict; character interiority lags behind world-building
- 13 criteria scored: Concept 7, Drive 6, Character 6, POV 6, Scene 6, Dialogue 5, Theme 7, World 7, Prose 5, Pacing 5, Closure NE, Market 4
- Top 3 actions: (1) Tighten central conflict in opening, (2) Fold world-building into live conflict, (3) Deepen interiority at choice-points
- Per-criterion: strengths, drags, and specific recommendations with evidence
- Confidence: Mixed — full text evaluated but some areas limited by scope
- Key learning: The seed MUST identify the central conflict, major characters with their roles, and the core thematic architecture — because short-form downstream cannot fill gaps from surrounding chapters
`.trim();

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds the complete benchmark context block for injection into seed
 * generation prompts. Accepts an optional route to include the correct
 * DREAM evaluation template (long-form or short-form) and matching
 * benchmark exemplar.
 */
export function buildSeedBenchmarkContext(route?: SeedRoute): string {
  const templateKey: DreamTemplateKey = route === 'SHORT_FORM' ? 'short_form' : 'long_form';
  const dreamTemplate = buildCompactTemplateBlock(templateKey);
  const exemplar = route === 'SHORT_FORM' ? BENCHMARK_EXEMPLAR_SHORTFORM : BENCHMARK_EXEMPLAR_LONGFORM;

  return [
    '═══ BENCHMARK GROUNDING CONTEXT (Phase 0 Warmup) ═══',
    '',
    'You MUST use this benchmark context to structure your output.',
    'Your output will be validated against these standards.',
    'The DREAM evaluation template below is what your seed prepares the manuscript to be evaluated against.',
    'The completed benchmark exemplar shows what gold-standard output looks like.',
    'Your seed output becomes GOLDEN GROUND TRUTH — downstream phases need hard evidence to override anything you establish here.',
    '',
    buildCompactStoryLedgerBlock(),
    '',
    dreamTemplate,
    '',
    exemplar,
  ].join('\n');
}

/**
 * Returns the 9-layer names in canonical order for structural validation.
 */
export const CANONICAL_LAYER_NAMES = [
  'source_integrity',
  'pov_structure',
  'canonical_identity',
  'cast_role_tier',
  'pronoun_transitions',
  'relationship_network',
  'object_symbol',
  'timeline_location_worldstate',
  'threat_pressure_ending',
] as const;

export type CanonicalLayerName = (typeof CANONICAL_LAYER_NAMES)[number];

/**
 * Structural validation result for a generated story ledger seed.
 */
export type SeedStructuralValidation = {
  status: 'passed' | 'degraded' | 'failed';
  present_layers: string[];
  missing_layers: string[];
  empty_layers: string[];
  warnings: string[];
};

/**
 * Validates that a generated ledger has the required 9-layer structure populated.
 * Does NOT validate content quality (that's assessLedgerQuality's job) — this
 * validates structural completeness against the template.
 */
export function validateLedgerStructure(
  layers: Record<string, unknown>,
): SeedStructuralValidation {
  const present_layers: string[] = [];
  const missing_layers: string[] = [];
  const empty_layers: string[] = [];
  const warnings: string[] = [];

  for (const layerName of CANONICAL_LAYER_NAMES) {
    const layer = layers[layerName];
    if (!layer || typeof layer !== 'object') {
      missing_layers.push(layerName);
      continue;
    }

    present_layers.push(layerName);

    // Check for effectively empty layers
    const layerObj = layer as Record<string, unknown>;
    const hasContent = Object.values(layerObj).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
      return v !== null && v !== undefined;
    });

    if (!hasContent) {
      empty_layers.push(layerName);
      warnings.push(`Layer '${layerName}' is present but empty — no usable content`);
    }
  }

  // Specific structural checks
  const threatLayer = layers.threat_pressure_ending as Record<string, unknown> | undefined;
  if (threatLayer) {
    const endStates = threatLayer.character_end_states;
    if (!Array.isArray(endStates) || endStates.length === 0) {
      warnings.push('threat_pressure_ending: no character_end_states — downstream cannot track who lives/dies');
    }
  }

  const identityLayer = layers.canonical_identity as Record<string, unknown> | undefined;
  if (identityLayer) {
    const entities = identityLayer.primary_entities;
    if (!Array.isArray(entities) || entities.length < 2) {
      warnings.push('canonical_identity: fewer than 2 primary entities — likely incomplete');
    }
    const mustNotOmit = identityLayer.must_not_omit;
    if (!Array.isArray(mustNotOmit) || mustNotOmit.length === 0) {
      warnings.push('canonical_identity: no must_not_omit list — downstream cannot enforce entity coverage');
    }
  }

  const relationshipLayer = layers.relationship_network as Record<string, unknown> | undefined;
  if (relationshipLayer) {
    const rels = relationshipLayer.relationships;
    if (!Array.isArray(rels) || rels.length < 2) {
      warnings.push('relationship_network: fewer than 2 relationships — likely incomplete');
    }
  }

  const objectLayer = layers.object_symbol as Record<string, unknown> | undefined;
  if (objectLayer) {
    const objects = objectLayer.objects;
    if (!Array.isArray(objects) || objects.length === 0) {
      warnings.push('object_symbol: no objects tracked — likely incomplete');
    }
    const contam = objectLayer.contamination_model;
    if (typeof contam !== 'string' || contam.trim().length === 0) {
      warnings.push('object_symbol: no contamination_model — downstream cannot assess influence mechanics');
    }
  }

  // Determine overall status
  let status: 'passed' | 'degraded' | 'failed';
  if (missing_layers.length >= 3) {
    status = 'failed';
  } else if (missing_layers.length > 0 || empty_layers.length > 0 || warnings.length > 2) {
    status = 'degraded';
  } else {
    status = 'passed';
  }

  return { status, present_layers, missing_layers, empty_layers, warnings };
}
