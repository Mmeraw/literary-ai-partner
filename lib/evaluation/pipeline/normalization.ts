/**
 * Semantic normalization layer for Pass 3 output.
 * Applies immediately after raw model JSON response, before any downstream logic.
 * 
 * Principle: nothing downstream ever sees an unnormalized semantic value.
 */

import type {
  IssueFamily,
  StrategicLever,
  RevisionGranularity,
} from './types';

/**
 * Normalize free-form issue_family input to canonical enum value.
 * Maps common variants to canonical terms.
 */
export function normalizeIssueFamily(input: unknown): IssueFamily {
  if (typeof input !== 'string') {
    return 'prose_control'; // safe fallback
  }

  const normalized = input.toLowerCase().trim();

  // Direct match
  const canonical: Record<string, IssueFamily> = {
    'pacing': 'pacing',
    'dialogue': 'dialogue',
    'closure': 'closure',
    'characterization': 'characterization',
    'exposition': 'exposition',
    'tension': 'tension',
    'prose_control': 'prose_control',
    'prose_and_style': 'prose_control',
    'prose': 'prose_control',
    'style': 'prose_control',
    'grammar': 'prose_control',
    'scene_structure': 'scene_structure',
    'structure': 'scene_structure',
    'pacing_and_structure': 'scene_structure',
    'voice': 'voice',
    'tone': 'voice',
    'character_voice': 'voice',
    'market_positioning': 'market_positioning',
    'market': 'market_positioning',
    'marketability': 'market_positioning',
    'commercial': 'market_positioning',
  };

  return canonical[normalized] ?? 'prose_control';
}

/**
 * Normalize free-form strategic_lever input to canonical enum value.
 * Maps common phrasings to canonical levers.
 */
export function normalizeStrategicLever(input: unknown): StrategicLever {
  if (typeof input !== 'string') {
    return 'momentum_visibility'; // safe fallback
  }

  const normalized = input.toLowerCase().trim().replace(/\s+/g, '_');

  // Map variants to single canonical form
  const canonical: Record<string, StrategicLever> = {
    // Momentum / pacing
    'momentum_visibility': 'momentum_visibility',
    'momentum': 'momentum_visibility',
    'forward_momentum': 'momentum_visibility',
    'scene_momentum': 'momentum_visibility',
    'pacing': 'momentum_visibility',
    'rhythm': 'momentum_visibility',
    'narrative_momentum': 'momentum_visibility',
    'increase_momentum': 'momentum_visibility',
    'vary_rhythm': 'momentum_visibility',
    'interleave_action': 'momentum_visibility',
    'add_goal_oriented_beats': 'momentum_visibility',

    // Dialogue density
    'dialogue_exposition_density': 'dialogue_exposition_density',
    'dialogue_exposition': 'dialogue_exposition_density',
    'on_the_nose_dialogue': 'dialogue_exposition_density',
    'reduce_exposition_in_dialogue': 'dialogue_exposition_density',
    'dialogue_density': 'dialogue_exposition_density',

    // Scene goals
    'scene_goal_clarity': 'scene_goal_clarity',
    'scene_clarity': 'scene_goal_clarity',
    'goal_clarity': 'scene_goal_clarity',
    'scene_objectives': 'scene_goal_clarity',

    // Closure
    'closure_state_lock': 'closure_state_lock',
    'closure': 'closure_state_lock',
    'ending': 'closure_state_lock',
    'close_state_lock': 'closure_state_lock',
    'resolution': 'closure_state_lock',

    // Character voice
    'character_voice_differentiation': 'character_voice_differentiation',
    'character_voice': 'character_voice_differentiation',
    'voice_differentiation': 'character_voice_differentiation',
    'character_distinction': 'character_voice_differentiation',

    // Tension
    'tension_escalation': 'tension_escalation',
    'tension': 'tension_escalation',
    'escalation': 'tension_escalation',
    'stakes': 'tension_escalation',
    'raise_tension': 'tension_escalation',

    // Exposition
    'exposition_load_reduction': 'exposition_load_reduction',
    'exposition_load': 'exposition_load_reduction',
    'exposition': 'exposition_load_reduction',
    'reduce_exposition': 'exposition_load_reduction',
    'info_dump': 'exposition_load_reduction',

    // Prose
    'prose_compression': 'prose_compression',
    'prose': 'prose_compression',
    'compression': 'prose_compression',
    'tighten': 'prose_compression',
    'cut_wordiness': 'prose_compression',

    // Market
    'market_signal_clarity': 'market_signal_clarity',
    'market': 'market_signal_clarity',
    'marketability': 'market_signal_clarity',
    'market_signal': 'market_signal_clarity',
  };

  return canonical[normalized] ?? 'momentum_visibility';
}

/**
 * Normalize revision_granularity to canonical form.
 * Maps variants like "word", "line", "paragraph" to canonical levels.
 */
export function normalizeRevisionGranularity(input: unknown): RevisionGranularity {
  if (typeof input !== 'string') {
    return 'scene'; // safe fallback
  }

  const normalized = input.toLowerCase().trim();

  const canonical: Record<string, RevisionGranularity> = {
    'line': 'line',
    'word': 'line',
    'sentence': 'line',
    'paragraph': 'beat',
    'beat': 'beat',
    'passage': 'beat',
    'block': 'beat',
    'scene': 'scene',
    'chapter': 'chapter',
    'section': 'chapter',
    'part': 'chapter',
    'manuscript': 'manuscript',
    'book': 'manuscript',
    'full': 'manuscript',
    'global': 'manuscript',
  };

  return canonical[normalized] ?? 'scene';
}

/**
 * Build deterministic redundancy key from semantic fields.
 * Used for duplicate detection in QualityGate.
 * Format: issue_family:strategic_lever:revision_granularity
 */
export function buildRedundancyKey(
  issue_family: IssueFamily | undefined,
  strategic_lever: StrategicLever | undefined,
  revision_granularity: RevisionGranularity | undefined,
): string {
  const family = issue_family ?? 'unknown';
  const lever = strategic_lever ?? 'unknown';
  const granularity = revision_granularity ?? 'unknown';
  return `${family}:${lever}:${granularity}`;
}
