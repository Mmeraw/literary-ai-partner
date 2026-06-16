import {
  __testingFullContextStoryLedger,
  buildLedgerSeedContextBlock,
  type FullContextStoryLedger,
} from '@/lib/evaluation/seed/fullContextStoryLedger';

describe('full-context story ledger narrator attribution layer', () => {
  it('blocks Price of Vanity cost/expense labels from becoming narrator canon', () => {
    const normalized = __testingFullContextStoryLedger.normalizeNarratorAttribution({
      narrator_label: 'Cost',
      narrator_confidence: 'confirmed',
      allowed_references: ['Cost', 'the narrator'],
      blocked_false_names: ['Total cost'],
      attribution_note: 'The manuscript contains cost labels.',
    });

    expect(normalized.narrator_label).toBe('the unnamed narrator');
    expect(normalized.narrator_confidence).toBe('unknown');
    expect(normalized.allowed_references).toEqual(expect.arrayContaining(['the narrator', 'the unnamed narrator']));
    expect(normalized.allowed_references).not.toContain('Cost');
    expect(normalized.blocked_false_names).toEqual(expect.arrayContaining(['Cost', 'Total cost', 'Yes', 'No']));
  });

  it('removes false narrator names from canonical entity lists', () => {
    expect(__testingFullContextStoryLedger.normalizeCanonicalEntityList([
      'Cost',
      'Kim',
      'Price',
      'Vanity',
      'Marcus',
    ])).toEqual(['Kim', 'Marcus']);
  });

  it('carries narrator authority into every downstream seed context block', () => {
    const ledger: FullContextStoryLedger = {
      artifact_type: 'full_context_story_ledger_v1',
      authority: 'seed_only',
      generated_at: '2026-06-15T00:00:00.000Z',
      model: 'test-model',
      prompt_version: 'phase05a-full-context-story-ledger-v1',
      manuscript_title: 'The Price of Vanity',
      manuscript_word_count: 1800,
      layers: {
        source_integrity: { route: 'SHORT_FORM', work_type: 'short_story', evidence_distribution_required: [] },
        pov_structure: { pov_characters: ['the unnamed narrator'], camera_owners: ['the unnamed narrator'], note: 'First-person retrospective narration.' },
        narrator_attribution: {
          narrator_label: 'the unnamed narrator',
          narrator_confidence: 'unknown',
          allowed_references: ['the unnamed narrator', 'the narrator'],
          blocked_false_names: ['Cost', 'Price', 'Vanity'],
          attribution_note: 'No explicit narrator name is confirmed by the manuscript.',
        },
        canonical_identity: { primary_entities: ['Kim', 'Marcus'], must_not_omit: ['Kim'] },
        cast_role_tier: { tiers: [] },
        pronoun_transitions: { reviewable_transitions: [], do_not_flag: [] },
        relationship_network: { relationships: [] },
        object_symbol: { objects: [], contamination_model: '' },
        timeline_location_worldstate: { timeline_sequence: [], world_rules: [] },
        threat_pressure_ending: { pressures: [], character_end_states: [] },
      },
      canonical_hard_facts: [],
      failure_conditions: [],
      hard_do_not_import: [],
      acceptance_checks: [],
    };

    const context = buildLedgerSeedContextBlock(ledger);
    expect(context).toContain('NARRATOR ATTRIBUTION AUTHORITY');
    expect(context).toContain('Narrator label: the unnamed narrator');
    expect(context).toContain('Blocked false narrator names: Cost, Price, Vanity');
    expect(context).toContain('Never infer a narrator name from theme words, expenses, prices, greetings, yes/no tokens, or cost labels.');
  });
});