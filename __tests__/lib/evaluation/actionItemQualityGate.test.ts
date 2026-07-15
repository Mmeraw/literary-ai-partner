import { buildEnrichedActionItems, toPublicActionItem } from '@/lib/evaluation/actionItemQualityGate';

describe('actionItemQualityGate', () => {
  it('preserves _source provenance internally and strips it for public artifacts', () => {
    const criteria = [
      {
        key: 'dialogue' as const,
        recommendations: [
          {
            priority: 'medium' as const,
            action: 'Clarify the speaker attribution.',
            expected_impact: 'The attribution gap causes speaker intent to blur, reducing tension in the exchange.',
            reader_effect: 'Readers will hear distinct voices.',
            anchor_snippet: 'The river moved slowly.',
          },
        ],
      },
    ];

    const [item] = buildEnrichedActionItems(criteria, 'medium', 5);
    expect(item._source).toEqual({
      criterion_index: 0,
      recommendation_index: 0,
      why_field: 'expected_impact',
    });

    const publicItem = toPublicActionItem(item);
    expect(publicItem).not.toHaveProperty('_source');
    expect(publicItem).not.toHaveProperty('_sortScore');
  });
});
