import { buildCompleteStorySeedV1 } from '@/lib/evaluation/seed/seedScaffoldFactory';
import { extractSeedEntityNames } from '@/lib/evaluation/processor';

describe('extractSeedEntityNames', () => {
  test('accepts complete scaffold story seeds without legacy claims arrays', () => {
    const seed = buildCompleteStorySeedV1({ generatedAt: '2026-07-15T00:00:00.000Z' });

    expect(() => extractSeedEntityNames(seed)).not.toThrow();
    expect(extractSeedEntityNames(seed)).toEqual([]);
  });

  test('extracts names from legacy claim-based story seeds', () => {
    expect(extractSeedEntityNames({
      claims: [
        {
          claim_id: 'story_seed:1',
          hypothesis: 'Mara may carry recurring pressure.',
          temp_seed_entity_id: 'temp_seed_entity_mara_voss',
        },
        {
          claim_id: 'story_seed:2',
          hypothesis: 'Fallback should be ignored.',
          temp_seed_entity_id: 'temp_seed_entity_fallback_primary_work',
        },
      ],
    })).toEqual(['mara voss']);
  });
});
