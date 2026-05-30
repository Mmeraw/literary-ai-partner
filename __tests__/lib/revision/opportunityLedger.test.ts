import { buildRevisionOpportunitiesFromEvaluationPayload } from '@/lib/revision/opportunityLedger';

describe('buildRevisionOpportunitiesFromEvaluationPayload', () => {
  it('builds opportunities from criteria recommendations with evidence anchors', () => {
    const payload = {
      criteria: [
        {
          key: 'pacing',
          score_0_10: 4,
          recommendations: [
            {
              diagnosis: 'Mid-scene transitions are abrupt.',
              recommendation: 'Add one bridge beat before each hard cut.',
              anchor_snippet: 'She opened the door and suddenly the chapter ended.',
              location_ref: 'chapter:3',
              confidence: 0.91,
            },
          ],
        },
      ],
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].criterion).toBe('PACING');
    expect(opportunities[0].severity).toBe('must');
    expect(opportunities[0].confidence).toBe('high');
    expect(opportunities[0].decision_state).toBe('open');
    expect(opportunities[0].evidence_anchor).toMatch(/door/);
  });

  it('enforces no-anchor-no-opportunity', () => {
    const payload = {
      criteria: [
        {
          key: 'voice',
          recommendations: [
            {
              diagnosis: 'Voice drifts generic in this section.',
              recommendation: 'Re-introduce concrete diction.',
              location_ref: 'chapter:2',
            },
          ],
        },
      ],
      recommendations: [
        {
          criterion: 'voice',
          recommendation: 'Strengthen sentence rhythm.',
        },
      ],
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opportunities).toHaveLength(0);
  });

  it('supports top-level recommendation buckets', () => {
    const payload = {
      recommendations: {
        quick_wins: [
          {
            criterion: 'dialogue',
            recommendation: 'Trim redundant tag clusters.',
            evidence_snippet: '"Yes," she said, she said again, she said quietly.',
            location_ref: 'chapter:7',
            priority: 'medium',
            confidence: 'medium',
          },
        ],
      },
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].criterion).toBe('DIALOGUE');
    expect(opportunities[0].severity).toBe('should');
  });
});
