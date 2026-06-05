import {
  buildRevisionOpportunitiesFromEvaluationPayload,
  ensureRevisionOpportunityLedgerArtifact,
} from '@/lib/revision/opportunityLedger';
import { candidateTextIsCopyPasteReady } from '@/lib/revision/reviseCardContract';

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

  it('fails closed when A/B/C candidates are missing', () => {
    const payload = {
      criteria: [
        {
          key: 'proseControl',
          recommendations: [
            {
              diagnosis: 'The beat lands abstractly and diffuses urgency.',
              recommendation: 'Ground the turn in a concrete immediate consequence.',
              anchor_snippet: 'Newton held the vial too long before answering.',
              location_ref: 'chapter:1',
              confidence: 0.83,
            },
          ],
        },
      ],
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opportunities).toHaveLength(1);

    const [row] = opportunities;
    expect(typeof row.candidate_text_a).toBe('string');
    expect(typeof row.candidate_text_b).toBe('string');
    expect(typeof row.candidate_text_c).toBe('string');

    expect(row.candidate_text_a).toBe('');
    expect(row.candidate_text_b).toBe('');
    expect(row.candidate_text_c).toBe('');
    expect(candidateTextIsCopyPasteReady(row.candidate_text_a)).toBe(false);
    expect(candidateTextIsCopyPasteReady(row.candidate_text_b)).toBe(false);
    expect(candidateTextIsCopyPasteReady(row.candidate_text_c)).toBe(false);
    expect(row.grounding_status).toBe('unsupported_blocked');
  });

  it('regression: blocks contamination terms for The Silence Begins when explicit candidates are absent', () => {
    const payload = {
      criteria: [
        {
          key: 'sceneConstruction',
          recommendations: [
            {
              diagnosis: 'The scene shift lands abruptly.',
              recommendation: 'Bridge the turn with grounded consequences.',
              anchor_snippet: 'The Silence Begins opened on a cold stairwell and held on breath.',
              location_ref: 'chapter:2',
              confidence: 0.82,
            },
          ],
        },
      ],
    };

    const longformPayload = {
      longform_document: {
        criterion_analyses: [
          {
            key: 'sceneConstruction',
            score: 6,
            revision_queue: [
              '[LOCATION: Chapter 2] [OPERATION: replace_selected_passage] Paolito studies the Cartel Babies file while the Unnamed Boy watches the hallway.',
            ],
          },
        ],
      },
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, longformPayload);

    expect(opportunities.length).toBeGreaterThan(0);
    for (const row of opportunities) {
      const merged = `${row.candidate_text_a ?? ''} ${row.candidate_text_b ?? ''} ${row.candidate_text_c ?? ''}`;
      expect(merged).not.toMatch(/Paolito|Unnamed Boy|Cartel Babies/i);
      expect(row.grounding_status).toBe('unsupported_blocked');
    }
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
