import { STORY_LAYER_COUNT, STORY_LAYER_KEYS } from '@/lib/evaluation/artifacts/artifactTypes';
import { buildCompleteStorySeedV1 } from '@/lib/evaluation/seed/seedScaffoldFactory';
import {
  buildUnnamedNarratorLayer,
  isForbiddenNarratorIdentityCandidate,
  narratorReferenceForReport,
} from '@/lib/evaluation/storyLedger/narratorAttributionLayer';

describe('narrator attribution layer', () => {
  it('registers narrator attribution as the tenth story layer', () => {
    expect(STORY_LAYER_COUNT).toBe(10);
    expect(STORY_LAYER_KEYS).toContain('narrator_attribution_layer');

    const seed = buildCompleteStorySeedV1({ generatedAt: '2026-06-13T00:00:00.000Z' });
    expect(seed.layer_scaffolds.narrator_attribution_layer.required_sections).toContain('narrator_registry');
    expect(seed.global_candidate_inputs.candidate_narrator_registry).toEqual([]);
  });

  it('blocks themes, costs, expenses, and conversational tokens as narrator names', () => {
    for (const candidate of ['Cost', 'Costs', 'Expense', 'Expenses', 'Price', 'Vanity', 'Beauty', 'Money', 'Status', 'No', 'Yes', 'Hey']) {
      expect(isForbiddenNarratorIdentityCandidate(candidate)).toBe(true);
    }
  });

  it('falls back to narrator when a forbidden term is supplied as a name', () => {
    expect(narratorReferenceForReport({
      display_label: 'Cost',
      canonical_name: 'Cost',
      name_state: 'named',
      confidence: 'verified',
      evidence: ['The story repeatedly discusses the cost of vanity.'],
      allowed_report_reference: 'Cost',
      forbidden_report_references: [],
    })).toBe('the narrator');
  });

  it('uses unnamed narrator when no explicit narrator name is supported', () => {
    const layer = buildUnnamedNarratorLayer();
    expect(layer.narrators[0].canonical_name).toBeNull();
    expect(narratorReferenceForReport(layer.narrators[0])).toBe('the unnamed narrator');
  });
});
