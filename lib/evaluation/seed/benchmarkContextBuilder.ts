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

const BENCHMARK_EXEMPLAR_CARTEL_BABIES = `
COMPLETED BENCHMARK EXEMPLAR — STORY LEDGER (Cartel Babies, required-gold):
This is the canonical product example for seed and Phase 1A Story Ledger quality. Use this as your target shape for the nine-layer scaffold; shrink breadth for shorter submissions, but do not weaken evidence discipline.

- Required-gold source docs: docs/benchmarks/cartel-babies-dream.md, docs/benchmarks/cartel-babies-dream-v2-governed-ledger-addendum.md, docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_9_LAYER_BENCHMARK_CARTEL_BABIES.md
- Completion standard: must capture Michael and Benjamin as dual protagonists, Paolito/Paul identity transformation, Raúl/Navarro governance conflict, Cobra betrayal, Diego loyalty-tax pressure, El Tomatero/red bat, pigs/pig-pen disposal terror, cartel product/lab pressure, radio-channel punishment code, embassy/new-identity transition, and Vancouver aftercare
- Source integrity: distinguish true structural defects from motif, table-of-contents artifact, anchor issue, package note, or manual-verification concern
- POV / identity: preserve Michael captivity POV, Benjamin search/origin lane, Paolito→Paul rename chain, and cartel/institutional systems as distinct canonical entities
- Relationship network: map Michael/Benjamin, Michael/Raúl, Michael/Paolito-Paul, Raúl/Paolito, Raúl/Navarro, Raúl/Cobra, Raúl/Diego, Raúl/El Tomatero/Paolito, radio channels/camp population, and protected-family aftercare
- Object / symbol: track blue evil-eye charm, keys, embassy papers, red bat, pig pen, product/lab substances, radio channels, Beethoven's Fifth, table tennis, and local Sinaloa anchors as lifecycle-bearing systems
- Threat / pressure / ending: include individual, institutional, chemical, disposal-terror, encoded-punishment, family, legal-identity, and aftercare pressures; do not collapse the manuscript to a single villain or generic cartel setting
- Key learning: The seed MUST identify all story-bearing people, systems, objects, pressure codes, identity transitions, and ending obligations because downstream phases must verify or reject claims from manuscript evidence — they must not invent missing architecture
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
  const exemplar = BENCHMARK_EXEMPLAR_CARTEL_BABIES;

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
