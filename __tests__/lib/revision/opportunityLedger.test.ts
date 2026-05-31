import {
  buildRevisionOpportunitiesFromEvaluationPayload,
  ensureRevisionOpportunityLedgerArtifact,
} from '@/lib/revision/opportunityLedger';

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

describe('ensureRevisionOpportunityLedgerArtifact', () => {
  it('rebuilds stale empty ledger when evaluation payload now has opportunities', async () => {
    const upsertSpy = jest.fn();

    const supabase = {
      from: (table: string) => {
        const state: {
          selectClause: string | null;
          filters: Record<string, unknown>;
        } = {
          selectClause: null,
          filters: {},
        };

        const chain = {
          select: (value: string) => {
            state.selectClause = value;
            return chain;
          },
          eq: (column: string, value: unknown) => {
            state.filters[column] = value;
            return chain;
          },
          in: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === 'evaluation_artifacts' && state.selectClause === 'id, content') {
              return {
                data: {
                  id: 'ledger-old',
                  content: {
                    opportunities: [],
                  },
                },
                error: null,
              };
            }

            if (table === 'evaluation_jobs') {
              return {
                data: {
                  id: state.filters.id,
                  manuscript_id: 6074,
                  evaluation_project_id: null,
                  evaluation_result: null,
                },
                error: null,
              };
            }

            if (table === 'evaluation_artifacts' && state.selectClause === 'content, source_hash') {
              return {
                data: {
                  source_hash: 'src-hash-1',
                  content: {
                    criteria: [
                      {
                        key: 'pacing',
                        recommendations: [
                          {
                            diagnosis: 'Abrupt scene transition weakens momentum.',
                            recommendation: 'Insert a bridging beat before cut.',
                            anchor_snippet: 'She slammed the door. Next scene starts abruptly.',
                            location_ref: 'chapter:3',
                            confidence: 0.84,
                          },
                        ],
                      },
                    ],
                  },
                },
                error: null,
              };
            }

            return { data: null, error: null };
          },
          upsert: (payload: unknown) => {
            upsertSpy(payload);
            return {
              select: () => ({
                limit: async () => ({
                  data: [{ id: 'ledger-new' }],
                  error: null,
                }),
              }),
            };
          },
        };

        return chain;
      },
    };

    const result = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-123');

    expect(result.artifactId).toBe('ledger-new');
    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
