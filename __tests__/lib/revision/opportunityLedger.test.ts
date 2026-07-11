import {
  buildRevisionOpportunitiesFromEvaluationPayload,
  ensureRevisionOpportunityLedgerArtifact,
  findHydrationChunkForAnchor,
  reconstructRevisionLedgerWithCurrentCode,
} from '@/lib/revision/opportunityLedger';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import { candidateTextIsCopyPasteReady } from '@/lib/revision/reviseCardContract';
import { logRevisionEvent } from '@/lib/revision/logRevisionEvent';

jest.mock('@/lib/revision/logRevisionEvent', () => ({
  logRevisionEvent: jest.fn(async () => undefined),
}));

const mockLogRevisionEvent = logRevisionEvent as jest.MockedFunction<typeof logRevisionEvent>;

describe('findHydrationChunkForAnchor', () => {
  it('resolves wrapper-quoted anchors by stripping evidence wrappers before normalization', () => {
    const result = findHydrationChunkForAnchor(
      '“And still, I couldn’t shake the suspicion: What if Calder weren’t missing?”',
      [{ content: 'And still, I couldn’t shake the suspicion: What if Calder weren’t missing?' }],
    );

    expect(result.content).toContain('Calder');
    expect(result.diagnostic).toEqual(expect.objectContaining({
      wrapper_stripped: true,
      strategy: 'exact_match',
    }));
  });

  it('normalizes em/en-dashes consistently and can resolve a traced short fragment through guarded fuzzy matching', () => {
    const result = findHydrationChunkForAnchor(
      '“s trying to do both—sacred stewardship and national necessity.” Cliff let out a low whistle.',
      [
        {
          content:
            'The council is trying to do both – sacred stewardship and national necessity. Cliff let out a low whistle before answering.',
        },
      ],
    );

    expect(result.content).toContain('sacred stewardship');
    expect(result.diagnostic).toEqual(expect.objectContaining({
      dash_normalized: true,
      strategy: 'fuzzy_match',
      matched_tokens: expect.any(Number),
    }));
  });

  it('does not resolve fabricated anchors after normalization', () => {
    const result = findHydrationChunkForAnchor(
      '“This fabricated bridge anchor never appears in the manuscript context.”',
      [{ content: 'The river moved under a gray sky while the camp packed in silence.' }],
    );

    expect(result.content).toBeUndefined();
    expect(result.diagnostic.strategy).toBe('no_match');
  });
});

describe('reconstructRevisionLedgerWithCurrentCode', () => {
  it('replays canonical projection, preflight, and hydration lookup without using rendered-only supply', () => {
    const unifiedDocument = {
      canonicalOpportunityLedger: {
        opportunities: [
          {
            id: 'OPP-001',
            primary_criterion: 'pacing',
            severity: 'high',
            evidence: 'Mara stopped at the riverbank before answering the question.',
            location: 'chapter:1',
            symptom: 'The scene rushes past the decision beat before the reader can feel it.',
            cause: 'The prose jumps from question to answer without letting consequence register.',
            fix_direction: 'Replace the rushed transition with one concrete hesitation beat before the answer.',
            reader_effect: 'The reader tracks the consequence and trusts the scene momentum.',
            action: 'Replace the rushed transition with one hesitation beat.',
          },
          {
            id: 'OPP-002',
            primary_criterion: 'dialogue',
            severity: 'medium',
            evidence: '“I heard the water change,” Mara said, and Eli looked toward the trees.',
            location: 'chapter:2',
            symptom: 'The dialogue lands without enough response texture.',
            cause: 'The reply names information but underplays the visible reaction.',
            fix_direction: 'Insert one reaction beat after the line so the exchange carries pressure.',
            reader_effect: 'The reader feels the social pressure instead of receiving only information.',
            action: 'Insert one reaction beat after the line.',
          },
        ],
        rendered_opportunities: [
          {
            id: 'OPP-001',
            primary_criterion: 'pacing',
            severity: 'high',
            evidence: 'Mara stopped at the riverbank before answering the question.',
            location: 'chapter:1',
            fix_direction: 'Replace the rushed transition with one concrete hesitation beat before the answer.',
          },
        ],
      },
    };

    const result = reconstructRevisionLedgerWithCurrentCode({
      unifiedDocument,
      sourceUedHash: canonicalJsonSha256(unifiedDocument),
      wordCount: 12_000,
      contextQuality: 'clean',
      manuscriptChunksByContent: [
        { content: 'Mara stopped at the riverbank before answering the question.' },
        { content: '“I heard the water change,” Mara said, and Eli looked toward the trees.' },
      ],
    });

    expect(result.sourceMode).toBe('canonical_full');
    expect(result.canonicalCount).toBe(2);
    expect(result.renderedCount).toBe(1);
    expect(result.opportunities).toHaveLength(2);
    expect(result.hydrationAnchorLookupSummary).toMatchObject({
      total: 2,
      matched: 2,
      no_match: 0,
    });
  });
});

describe('buildRevisionOpportunitiesFromEvaluationPayload', () => {
  function makeRecommendation(index: number, priority: 'high' | 'medium' | 'low' = 'medium') {
    return {
      diagnosis: `Revision issue ${index} weakens the local reader signal.`,
      recommendation: `Repair issue ${index} with manuscript-specific evidence and targeted prose.`,
      anchor_snippet: `A concrete manuscript sentence for issue ${index} gives the queue an evidence anchor.`,
      location_ref: `passage:${index}`,
      priority,
      confidence: 0.82,
      candidate_text_a: `Mara held the door open for issue ${index}, letting the silence settle before she answered.`,
      candidate_text_b: `For issue ${index}, Mara paused at the threshold until the room understood her choice.`,
      candidate_text_c: `The answer for issue ${index} stayed in Mara's hand before it reached her voice.`,
      symptom: `The reader loses trust at passage ${index} because the cause-effect logic is suppressed beneath surface action.`,
      cause: `The prose advances without grounding the consequence, so narrative logic dissolves before reaching the reader.`,
      fix_direction: `Restore causal clarity by surfacing the implication before the next narrative beat.`,
      reader_effect: `The reader re-anchors in scene logic and trusts the forward momentum of the narrative.`,
      revision_operation: 'replace_selected_passage',
    };
  }

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

  it('caps short-form revision opportunities at 50', () => {
    const payload = {
      criteria: [
        {
          key: 'pacing',
          recommendations: Array.from({ length: 60 }, (_, index) => makeRecommendation(index + 1)),
        },
      ],
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, undefined, {
      wordCount: 4_899,
    });

    expect(opportunities).toHaveLength(50);
  });

  it('caps long-form revision opportunities at 100', () => {
    const payload = {
      criteria: [
        {
          key: 'sceneConstruction',
          recommendations: Array.from({ length: 120 }, (_, index) => makeRecommendation(index + 1)),
        },
      ],
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload, undefined, undefined, {
      wordCount: 25_000,
    });

    expect(opportunities).toHaveLength(100);
  });

  it('does not backfill opportunities from evidence anchors alone, even for long-form manuscripts', () => {
    const criteria = Array.from({ length: 13 }, (_, criterionIndex) => ({
      key: `criterion_${criterionIndex + 1}`,
      score_0_10: criterionIndex % 3 === 0 ? 4 : 6,
      rationale: `Criterion ${criterionIndex + 1} has repeated evidence-backed revision pressure across the manuscript.`,
      evidence: Array.from({ length: 8 }, (_, evidenceIndex) => ({
        snippet: `Chapter ${criterionIndex + 1}, evidence ${evidenceIndex + 1}: The river sound changes the family decision before the scene resolves.`,
        location_ref: `chapter:${criterionIndex + 1}:evidence:${evidenceIndex + 1}`,
      })),
      recommendations: criterionIndex === 0
        ? [makeRecommendation(1, 'high')]
        : [],
    }));

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(
      { criteria },
      undefined,
      undefined,
      { wordCount: 86_000 },
    );

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].provenance).toBe('evaluation_result.criteria.recommendations');
    expect(JSON.stringify(opportunities)).not.toContain('evidence_density_backfill');
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

  it('rebuilds queue opportunities without banned generic fallback filler phrases', () => {
    const payload = {
      criteria: [
        {
          key: 'narrativeDrive',
          recommendations: [
            {
              diagnosis: 'Insert one concrete stakes beat that lands the deferred decision at the current scene turn.',
              recommendation: 'Insert one concrete stakes beat that lands the deferred decision at the current scene turn.',
              anchor_snippet: 'Studies are mixed on the success of safe injection sites.',
              location_ref: 'passage:rebuild-no-garbage',
              confidence: 0.82,
            },
          ],
        },
      ],
    };

    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    expect(opportunities).toHaveLength(1);

    const serialized = JSON.stringify(opportunities);
    expect(serialized).not.toMatch(/looked away first|moment to claim its price|moment tightened|keep the air still|pressure of the moment/i);
  });
});

describe('ensureRevisionOpportunityLedgerArtifact', () => {
  it('projects Revise opportunities from certified UED canonical opportunity IDs when available', async () => {
    const upsertSpy = jest.fn();
    const canonicalOpportunity = {
      id: 'OPP-001',
      primary_criterion: 'themeAndSubtext',
      related_criteria: ['themeAndSubtext', 'narrativeClosure'],
      severity: 'high',
      evidence: 'Total value: Priceless.',
      location: 'ending:final-beat',
      symptom: 'The final paragraph explains the theme after the priceless payoff lands.',
      cause: 'Explicit summary reduces the force of the subtext.',
      fix_direction: 'Let the “Total value: Priceless” beat carry the theme with less explanation.',
      reader_effect: 'The ending lands with more restraint and confidence.',
      action: 'Lighten the final thematic explanation.',
      expected_impact: 'The reader supplies the conclusion instead of being told the moral.',
      is_action_item_candidate: true,
      issue_type: 'thematic_closure',
      deduped_from: ['themeAndSubtext:1', 'narrativeClosure:1'],
    };
    const unifiedDocument = {
      title: 'The Price of Vanity',
      canonicalOpportunityLedger: {
        // Authoritative full canonical supply that Revise must consume.
        opportunities: [canonicalOpportunity],
        // Curated report/PDF display subset (capped 7/10) — NOT the Revise source.
        rendered_opportunities: [canonicalOpportunity],
      },
    };
    const uedHash = canonicalJsonSha256(unifiedDocument);

    const supabase = {
      from: (table: string) => {
        const state: {
          selectClause: string | null;
          filters: Record<string, unknown>;
          inFilter: { column: string; values: unknown[] } | null;
        } = { selectClause: null, filters: {}, inFilter: null };

        const chain = {
          select: (value: string) => {
            state.selectClause = value;
            return chain;
          },
          eq: (column: string, value: unknown) => {
            state.filters[column] = value;
            return chain;
          },
          in: (column: string, values: unknown[]) => {
            state.inFilter = { column, values };
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === 'evaluation_artifacts' && state.selectClause === 'id, content') {
              return { data: null, error: null };
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
                  source_hash: 'evaluation-result-hash',
                  content: {
                    overview: { word_count: 1800 },
                    criteria: [],
                  },
                },
                error: null,
              };
            }

            if (table === 'evaluation_artifacts' && state.selectClause === 'content') {
              if (state.filters.artifact_type === 'unified_evaluation_document_v1') {
                return { data: { content: unifiedDocument }, error: null };
              }
              if (state.filters.artifact_type === 'author_exposure_certification_v1') {
                return {
                  data: {
                    content: {
                      schema_version: 'author_exposure_certification_v1',
                      decision: 'certified',
                      unified_document_hash: uedHash,
                    },
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            }

            return { data: null, error: null };
          },
          upsert: (payload: unknown) => {
            upsertSpy(payload);
            return {
              select: () => ({
                limit: async () => ({ data: [{ id: 'ledger-new' }], error: null }),
              }),
            };
          },
        };

        return chain;
      },
    };

    const result = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-ued');

    expect(result.artifactId).toBe('ledger-new');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({
      opportunity_id: 'OPP-001',
      source_opportunity_id: 'OPP-001',
      source_criterion: 'themeAndSubtext',
      source_ued_hash: uedHash,
      provenance: 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',
    });

    const persisted = upsertSpy.mock.calls[0][0] as { content: Record<string, unknown> };
    expect(persisted.content).toMatchObject({
      opportunity_source_authority: 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',
      source_ued_hash: uedHash,
      ued_rendered_opportunity_count: 1,
      ued_canonical_opportunity_count: 1,
      revise_source_mode: 'canonical_full',
    });
    expect(persisted.content.opportunities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        opportunity_id: 'OPP-001',
        source_opportunity_id: 'OPP-001',
        source_ued_hash: uedHash,
      }),
    ]));
  });

  it('rebuilds stale empty ledger from legacy evaluation payload only when explicit backfill is enabled', async () => {
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

    const result = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-123', { allowLegacyEvaluationProjection: true });

    expect(result.artifactId).toBe('ledger-new');
    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const persisted = upsertSpy.mock.calls[0][0] as { content: Record<string, unknown> };
    expect(persisted.content).toMatchObject({
      job_id: 'job-123',
      evaluation_project_id: null,
      manuscript_id: 6074,
      artifact_type: 'revision_opportunity_ledger_v1',
      artifact_version: 'v1',
      mode_contract: {
        evaluation_mode: 'STANDARD',
        voice_preservation: 'BALANCED',
        source: 'evaluation_jobs',
      },
    });
    expect(typeof persisted.content.artifact_id).toBe('string');
    expect(typeof persisted.content.source_hash).toBe('string');
    expect(typeof persisted.content.manuscript_version_hash).toBe('string');
    expect(typeof persisted.content.generated_at).toBe('string');
    expect(persisted.content.quality_manifest).toMatchObject({
      artifact_type: 'revision_opportunity_ledger_v1',
      producer_stage_id: 'ADJACENT_REVISION_LEDGER',
      contract_status: 'degraded',
      completeness_metric: expect.stringContaining('finding_id'),
      accuracy_metric: expect.stringContaining('evaluation evidence'),
      dirty_data_rule: expect.stringContaining('Needs Targeting'),
      metrics: expect.objectContaining({
        total_opportunities: expect.any(Number),
        finding_id_coverage: 1,
        evidence_anchor_coverage: 1,
        manuscript_location_coverage: 1,
        revision_operation_coverage: 1,
      }),
    });

    const [opportunity] = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opportunity).toMatchObject({
      criterion: 'PACING',
      severity: 'should',
      decision_state: 'open',
      provenance: 'evaluation_result.criteria.recommendations',
    });
    expect(typeof opportunity.opportunity_id).toBe('string');
    expect(typeof opportunity.finding_id).toBe('string');
    expect(typeof opportunity.rationale).toBe('string');
    expect(typeof opportunity.evidence_anchor).toBe('string');
    expect(typeof opportunity.manuscript_coordinates).toBe('string');
    expect(['low', 'medium', 'high']).toContain(opportunity.confidence);
  });

  it('fails closed instead of projecting raw evaluation recommendations when certified UED opportunities are unavailable', async () => {
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
              return { data: null, error: null };
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
                  source_hash: 'src-hash-raw-only',
                  content: {
                    criteria: [
                      {
                        key: 'pacing',
                        recommendations: [
                          {
                            diagnosis: 'Raw recommendation must not become Revise truth.',
                            recommendation: 'This should not be projected without certified UED.',
                            anchor_snippet: 'A raw evaluation sentence exists but is not certified canonical truth.',
                            location_ref: 'chapter:1',
                          },
                        ],
                      },
                    ],
                  },
                },
                error: null,
              };
            }
            if (table === 'evaluation_artifacts' && state.selectClause === 'content') {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          },
          upsert: jest.fn(),
        };

        return chain;
      },
    };

    await expect(ensureRevisionOpportunityLedgerArtifact(supabase, 'job-raw-only')).rejects.toThrow(
      'Certified UED canonicalOpportunityLedger.opportunities is required',
    );
  });

  it('returns rebuilt opportunities when ledger persistence fails so Workbench render is not blocked', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

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
                  id: 'ledger-existing',
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
          upsert: () => ({
            select: () => ({
              limit: async () => ({
                data: null,
                error: { message: 'transient write failure' },
              }),
            }),
          }),
        };

        return chain;
      },
    };

    const result = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-123', { allowLegacyEvaluationProjection: true });

    expect(result.artifactId).toBe('ledger-existing');
    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to persist revision_opportunity_ledger_v1',
      { message: 'transient write failure' },
    );

    errorSpy.mockRestore();
  });
});

// ── Hydration status / one-ledger rebuild integration tests ───────────────────
// These tests mock candidateHydration to isolate the status-suffix and
// rebuild/upsert logic inside ensureRevisionOpportunityLedgerArtifact.

jest.mock('@/lib/revision/candidateHydration', () => ({
  hydrateLedgerCandidates: jest.fn(),
  HYDRATION_MAX_BATCH_SIZE: 15,
  HYDRATION_MODEL: 'gpt-4o-mini',
  HYDRATION_PROMPT_VERSION: 'candidate_hydration_v1',
}));

jest.mock('@/lib/revision/candidateRegeneration', () => ({
  regenerateCandidatesForQualityFailed: jest.fn(),
}));

import { hydrateLedgerCandidates } from '@/lib/revision/candidateHydration';
import { regenerateCandidatesForQualityFailed } from '@/lib/revision/candidateRegeneration';
const mockHydrate = hydrateLedgerCandidates as jest.MockedFunction<typeof hydrateLedgerCandidates>;
const mockRegen = regenerateCandidatesForQualityFailed as jest.MockedFunction<typeof regenerateCandidatesForQualityFailed>;

/** Build N distinct recommendations whose anchor_snippet and rationale are long enough
 *  to form valid opportunities but have NO candidate_text_a/b/c (i.e. they will be SLAE-blocked). */
function makeBlockedRecommendations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    diagnosis: `Issue ${i}: prose weakness undermines narrative coherence in this passage.`,
    recommendation: `Restructure sentence ${i} to restore causal clarity and reader orientation.`,
    anchor_snippet: `Passage ${i}: The character moved through the space without acknowledging the implication of what had just occurred.`,
    location_ref: `passage:${i}`,
    priority: 'medium',
    confidence: 0.75,
    symptom: `The reader loses narrative momentum at passage ${i} because causal logic is suppressed beneath surface action.`,
    cause: `The prose moves forward without grounding the consequence, so cause-effect dissolves before reaching the reader.`,
    fix_direction: `Restore causal clarity by making the implication explicit before the character moves to the next beat.`,
    reader_effect: `The reader re-anchors in the scene logic and trusts the forward momentum of the narrative.`,
    revision_operation: 'replace_selected_passage',
    // intentionally no candidate_text_a/b/c — SLAE will block these
  }));
}

/** Minimal supabase double used by hydration-status tests. */
function makeMinimalSupabase(overrides: {
  existingLedger?: { id: string; content: Record<string, unknown> } | null;
  criteriaRecommendations?: unknown[];
  evaluationPayloadExtras?: Record<string, unknown>;
  ledgerQualityReportContent?: Record<string, unknown> | null;
  jobFields?: Record<string, unknown>;
  manuscriptChunks?: Array<{ content: string }>;
  upsertSpy?: jest.Mock;
}) {
  const upsertSpy = overrides.upsertSpy ?? jest.fn();

  return {
    from: (table: string) => {
      const state: { selectClause: string | null; filters: Record<string, unknown> } = {
        selectClause: null,
        filters: {},
      };
      const chain: any = {
        data: null,
        error: null,
        select: (v: string) => { state.selectClause = v; return chain; },
        eq: (col: string, val: unknown) => { state.filters[col] = val; return chain; },
        in: () => chain,
        order: () => {
          if (table === 'manuscript_chunks' && state.selectClause === 'content') {
            chain.data = overrides.manuscriptChunks ?? [];
            chain.error = null;
          }
          return chain;
        },
        limit: () => chain,
        maybeSingle: async () => {
          // Existing ledger row
          if (table === 'evaluation_artifacts' && state.selectClause === 'id, content') {
            return { data: overrides.existingLedger ?? null, error: null };
          }
          // Job row
          if (table === 'evaluation_jobs') {
            return {
              data: {
                id: state.filters['id'],
                manuscript_id: 9999,
                evaluation_project_id: null,
                evaluation_result: null,
                ...overrides.jobFields,
              },
              error: null,
            };
          }
          // Evaluation result artifact (provides criteria with blocked recommendations)
          if (table === 'evaluation_artifacts' && state.selectClause === 'content, source_hash') {
            return {
              data: {
                source_hash: 'hash-abc',
                content: {
                  ...overrides.evaluationPayloadExtras,
                  criteria: [
                    {
                      key: 'character',
                      score_0_10: 3,
                      recommendations: overrides.criteriaRecommendations ?? [],
                    },
                  ],
                },
              },
              error: null,
            };
          }
          if (
            table === 'evaluation_artifacts' &&
            state.selectClause === 'content' &&
            state.filters['artifact_type'] === 'ledger_quality_report_v1'
          ) {
            return {
              data: overrides.ledgerQualityReportContent === undefined
                ? null
                : { content: overrides.ledgerQualityReportContent },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        upsert: (payload: unknown) => {
          upsertSpy(payload);
          return { select: () => ({ limit: async () => ({ data: [{ id: 'new-ledger' }], error: null }) }) };
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
      return chain;
    },
  };
}

describe('ensureRevisionOpportunityLedgerArtifact — hydration status suffix and one-ledger rebuild', () => {
  const OPENAI_KEY = 'sk-test-key';

  beforeEach(() => {
    process.env.OPENAI_API_KEY = OPENAI_KEY;
    mockHydrate.mockReset();
    mockRegen.mockReset();
    mockLogRevisionEvent.mockReset();
    // Default: regen returns no healed candidates (fail-closed)
    mockRegen.mockResolvedValue({
      healed: new Map(),
      stillFailed: new Map(),
    });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('writes _ai_hydrated_complete when all blocked opportunities are hydrated', async () => {
    const recs = makeBlockedRecommendations(3);
    const upsertSpy = jest.fn();
    const manuscriptChunks = recs.map((r) => ({ content: r.anchor_snippet }));

    // Use mockImplementation so we can read the actual blockedOpps argument
    // and return candidates keyed by the real opportunity_ids generated inside
    // ensureRevisionOpportunityLedgerArtifact. This is the only way to prove
    // that stillBlocked === 0 and _ai_hydrated_complete is written.
    mockHydrate.mockImplementation(async (blockedOpps) => {
      const candidatesMap = new Map(
        blockedOpps.map((o: { opportunity_id: string }) => [
          o.opportunity_id,
          {
            candidate_text_a: 'The character moved through the space, then paused when the implication finally caught up with the moment.',
            candidate_text_b: 'As the character crossed the room, the implication of what had happened settled into the silence around them.',
            candidate_text_c: 'The character kept moving, but the space changed once the implication became impossible to ignore.',
          },
        ]),
      );
      return { hydratedCount: blockedOpps.length, skippedCount: 0, candidates: candidatesMap };
    });

    const supabase = makeMinimalSupabase({ criteriaRecommendations: recs, manuscriptChunks, upsertSpy });
    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-complete', { allowLegacyEvaluationProjection: true });

    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const status = persisted.content.candidate_generation_status as string;

    // All 3 opportunities were hydrated with matching IDs → stillBlocked === 0
    // → suffix must be _ai_hydrated_complete (not just "string exists")
    expect(status).toContain('ai_hydrated_complete');
    expect(status).not.toContain('ai_hydrated_partial');

    // Verify the persisted opportunities were actually updated
    const opps = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opps.every((o) => o.grounding_status === 'supported')).toBe(true);
    expect(opps.every((o) => typeof o.candidate_text_a === 'string' && (o.candidate_text_a as string).length > 0)).toBe(true);

    const preflight = persisted.content.revise_queue_preflight as Record<string, unknown>;
    const lookupDiagnostics = preflight.hydration_anchor_lookup_diagnostics as Record<string, Record<string, unknown>>;
    expect(Object.keys(lookupDiagnostics)).toHaveLength(3);
    expect(Object.values(lookupDiagnostics).every((d) => d.strategy === 'exact_match')).toBe(true);
  });

  it('writes _ai_hydrated_partial when some opportunities remain blocked', async () => {
    // 20 blocked recommendations; hydration only fills 15 (the first batch)
    const recs = makeBlockedRecommendations(20);
    const upsertSpy = jest.fn();
    const manuscriptChunks = recs.map((r) => ({ content: r.anchor_snippet }));

    // Hydration reports 15 hydrated but the Map has 0 matching entries
    // (IDs don't match) — so stillBlocked will equal 20. The important
    // thing is the suffix is _partial or empty (not _complete).
    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 15,
      skippedCount: 0,
      candidates: new Map(), // No matching IDs → opportunities stay blocked
    });

    const supabase = makeMinimalSupabase({ criteriaRecommendations: recs, manuscriptChunks, upsertSpy });
    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-partial', { allowLegacyEvaluationProjection: true });

    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const status = persisted.content.candidate_generation_status as string;

    // Must NOT contain 'ai_hydrated_complete' — that would falsely certify the ledger.
    expect(status).not.toContain('ai_hydrated_complete');
  });

  it('rebuilds and upserts even when an existing ledger claims ai_hydrated_complete', async () => {
    const recs = makeBlockedRecommendations(3);
    const manuscriptChunks = recs.map((r) => ({ content: r.anchor_snippet }));

    mockHydrate.mockImplementation(async (blockedOpps) => {
      const candidatesMap = new Map(
        blockedOpps.map((o: { opportunity_id: string }) => [
          o.opportunity_id,
          {
            candidate_text_a: 'The character crossed the room and let the implication register before taking another step.',
            candidate_text_b: 'The character stopped in the room long enough for the implication of what had happened to settle.',
            candidate_text_c: 'The character moved on only after the space around them made the consequence impossible to ignore.',
          },
        ]),
      );
      return { hydratedCount: blockedOpps.length, skippedCount: 0, candidates: candidatesMap };
    });

    const upsertSpy = jest.fn();
    const supabase = makeMinimalSupabase({
      existingLedger: {
        id: 'ledger-complete',
        content: {
          candidate_generation_status: 'backend_filled_abc_v1_ai_hydrated_complete',
          revise_queue_preflight: {
            version: 'revise_queue_preflight_gate_v1',
            context_quality: 'clean',
          },
          opportunities: recs.map((r, i) => ({
            opportunity_id: `rol:${i}`,
            criterion: 'CHARACTER',
            severity: 'should',
            rationale: r.recommendation,
            evidence_anchor: r.anchor_snippet,
            manuscript_coordinates: `passage:${i}`,
            provenance: 'evaluation_result.criteria.recommendations',
            confidence: 'medium',
            decision_state: 'open',
            candidate_text_a: 'The character crossed the room and let the implication register before taking another step.',
            candidate_text_b: 'The character stopped in the room long enough for the implication of what had happened to settle.',
            candidate_text_c: 'The character moved on only after the space around them made the consequence impossible to ignore.',
            grounding_status: 'supported',
            preflight_status: 'passed',
            context_quality: 'clean',
          })),
        },
      },
      criteriaRecommendations: recs,
      manuscriptChunks,
      upsertSpy,
    });
    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-stable-complete', { allowLegacyEvaluationProjection: true });

    // Existing rows are never cache authority. The job has one ledger row, but
    // its content is rebuilt from canonical evaluation artifacts and upserted.
    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const rebuiltStatus = (upsertSpy.mock.calls[0][0] as { content: Record<string, unknown> }).content.candidate_generation_status as string;
    expect(rebuiltStatus).toContain('ai_hydrated_complete');
  });

  it('rebuilds and upserts existing ai_hydrated_partial ledgers', async () => {
    const recs = makeBlockedRecommendations(3);
    const manuscriptChunks = recs.map((r) => ({ content: r.anchor_snippet }));

    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 0,
      skippedCount: 0,
      candidates: new Map(),
    });

    const upsertSpyPartial = jest.fn();
    const partialSupabase = makeMinimalSupabase({
      existingLedger: {
        id: 'ledger-partial',
        content: {
          candidate_generation_status: 'backend_filled_abc_v1_ai_hydrated_partial',
          opportunities: recs.map((r, i) => ({
            opportunity_id: `rol:partial:${i}`,
            criterion: 'CHARACTER',
            severity: 'should',
            rationale: r.recommendation,
            evidence_anchor: r.anchor_snippet,
            manuscript_coordinates: `passage:${i}`,
            provenance: 'evaluation_result.criteria.recommendations',
            confidence: 'medium',
            decision_state: 'open',
            candidate_text_a: '',
            candidate_text_b: '',
            candidate_text_c: '',
            grounding_status: 'unsupported_blocked',
          })),
        },
      },
      criteriaRecommendations: recs,
      manuscriptChunks,
      upsertSpy: upsertSpyPartial,
    });
    await ensureRevisionOpportunityLedgerArtifact(partialSupabase, 'job-stable-partial', { allowLegacyEvaluationProjection: true });

    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(upsertSpyPartial).toHaveBeenCalledTimes(1);
    const rebuiltStatus = (upsertSpyPartial.mock.calls[0][0] as { content: Record<string, unknown> }).content.candidate_generation_status as string;
    expect(rebuiltStatus).not.toContain('ai_hydrated_complete');
  });

  it('marks opportunities limited-context and caps confidence when ledger quality is retryable-degraded', async () => {
    delete process.env.OPENAI_API_KEY;
    const upsertSpy = jest.fn();

    const supabase = makeMinimalSupabase({
      upsertSpy,
      ledgerQualityReportContent: {
        quality_report: {
          gate_ready_status: 'blocked_retryable_technical',
          blocking_reasons: ['TECHNICAL_BLOCK: Pass 3A reducer failed.'],
          layer_truth_status: {
            canonical_identity_layer: 'degraded',
            relationship_network_layer: 'degraded',
          },
        },
      },
      criteriaRecommendations: [
        {
          diagnosis: 'Christine and Nicolas need a clearer bridge beat at this turn.',
          recommendation: 'Bridge Christine and Nicolas with one concrete consequence beat before the scene moves on.',
          anchor_snippet: 'Christine looked toward Nicolas’s closed bedroom door and let the house go quiet.',
          location_ref: 'passage:limited-context',
          confidence: 0.95,
          candidate_text_a: 'Christine looked toward Nicolas’s closed bedroom door, and the quiet in the hall made her choice feel smaller than her fear.',
          candidate_text_b: 'When Christine glanced at Nicolas’s closed door, the whole house seemed to hold its breath around what she would not say.',
          candidate_text_c: 'The hallway stayed quiet after Christine looked toward Nicolas’s room, leaving her worry to do the speaking for her.',
        },
      ],
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-limited-context', { allowLegacyEvaluationProjection: true });

    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    expect(persisted.content.revise_queue_preflight).toMatchObject({
      version: 'revise_queue_preflight_gate_v1',
      context_quality: 'limited',
      gate_ready_status: 'blocked_retryable_technical',
    });
    expect(persisted.content.candidate_generation_status).toContain('res_preflight_complete');

    const [opp] = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opp.context_quality).toBe('limited');
    expect(opp.preflight_status).toBe('limited_context');
    expect(opp.preflight_reasons).toContain('limited_context_due_to_degraded_canon');
    expect(opp.confidence).toBe('medium');
  });

  it('quarantines TESTIMONY dialogue recommendations without source dialogue before hydration', async () => {
    const upsertSpy = jest.fn();

    const supabase = makeMinimalSupabase({
      upsertSpy,
      evaluationPayloadExtras: {
        confirmed_mode: {
          evaluationMode: 'TESTIMONY',
          voicePreservationMode: 'POLISHED',
        },
      },
      criteriaRecommendations: [
        {
          diagnosis: 'The Christine exchange is summarized instead of rendered as dialogue.',
          recommendation: 'Convert one summarized exchange between Christine and the narrator into a short dialogue beat.',
          anchor_snippet: 'Brad, myself and others have suggested to Christine that she should just kick Nicolas out so he learns to be become self-sufficient.',
          location_ref: 'passage:testimony-dialogue-risk',
          confidence: 0.84,
        },
      ],
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-testimony-dialogue-risk', { allowLegacyEvaluationProjection: true });

    expect(mockHydrate).not.toHaveBeenCalled();
    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const [opp] = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opp.preflight_status).toBe('blocked');
    expect(opp.preflight_reasons).toContain('testimony_fabrication_risk');
    expect(opp.grounding_status).toBe('unsupported_blocked');
    expect(opp.candidate_text_a).toBe('');
    expect(persisted.content.candidate_generation_status).toContain('res_preflight_complete');
  });

  it('blocks hydration for passed opportunities with missing context/coordinates and exposes admin actions', async () => {
    const upsertSpy = jest.fn();

    const supabase = makeMinimalSupabase({
      upsertSpy,
      criteriaRecommendations: [
        {
          diagnosis: 'Insert one concrete stakes beat that lands the deferred decision at the current scene turn; At the scene level, studies are mixed on the success of safe injection sites.',
          recommendation: 'Insert one concrete stakes beat that lands the deferred decision at the current scene turn; At the scene level, studies are mixed on the success of safe injection sites.',
          anchor_snippet: 'Studies are mixed on the success of safe injection sites.',
          location_ref: 'NARRATIVEDRIVE:recommendation',
          confidence: 0.75,
          revision_operation: 'insert_after_selected_passage',
        },
      ],
      manuscriptChunks: [],
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-hydration-input-incomplete', { allowLegacyEvaluationProjection: true });

    expect(mockHydrate).not.toHaveBeenCalled();
    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const [opp] = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opp.preflight_status).toBe('blocked');
    expect(opp.preflight_reasons).toContain('hydration_context_not_found');
    expect(opp.preflight_reasons).toContain('hydration_placeholder_coordinates');
    expect(opp.grounding_status).toBe('unsupported_blocked');
    expect(opp.grounding_note).toContain('Hydration input incomplete');
    expect(opp.admin_actions).toContain('Regenerate recommendation');
    expect(opp.admin_actions).toContain('Rewrite anchor');
    expect(opp.admin_actions).toContain('Discard unsafe card');
    expect(opp.admin_actions).toContain('Regenerate from source manuscript context');
  });

  it('flags contaminated rationale for recommendation whose rationale echoes the anchor verbatim', async () => {
    const upsertSpy = jest.fn();

    const supabase = makeMinimalSupabase({
      upsertSpy,
      criteriaRecommendations: [
        {
          recommendation: 'Strengthen the transition with one concrete beat; INSITE has drawn criticism from the Bush Administration White House Office of National Drug Control Policy.',
          rationale: 'Strengthen the transition with one concrete beat; INSITE has drawn criticism from the Bush Administration White House Office of National Drug Control Policy.',
          anchor_snippet: 'INSITE has drawn criticism from the Bush Administration White House Office of National Drug Control Policy.',
          location_ref: 'MARKETABILITY:recommendation',
          confidence: 0.81,
          revision_operation: 'replace_selected_passage',
        },
      ],
      manuscriptChunks: [
        {
          content: 'INSITE has drawn criticism from the Bush Administration White House Office of National Drug Control Policy, which argued the policy framework normalizes harm reduction.',
        },
      ],
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-hydration-input-contaminated', { allowLegacyEvaluationProjection: true });

    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const [opp] = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opp.preflight_status).toBe('blocked');
    // Rationale contamination is caught at preflight (rationale_contaminated) or at
    // hydration eligibility (hydration_input_contaminated) — both are valid blocking reasons.
    const reasons = opp.preflight_reasons as string[];
    expect(
      reasons.includes('rationale_contaminated') || reasons.includes('hydration_input_contaminated'),
    ).toBe(true);
    expect(opp.admin_actions).toContain('Regenerate from source manuscript context');
  });

  it('blocks user-visible admission when fewer than two candidates pass quality gate', async () => {
    delete process.env.OPENAI_API_KEY;
    const upsertSpy = jest.fn();

    const supabase = makeMinimalSupabase({
      upsertSpy,
      criteriaRecommendations: [
        {
          diagnosis: 'The transition beat is abrupt.',
          recommendation: 'Insert one concrete bridge beat before the scene turn.',
          anchor_snippet: 'Christine paused at the kitchen doorway and listened to the quiet in the hall.',
          location_ref: 'passage:candidate-quality',
          confidence: 0.88,
          revision_operation: 'insert_after_selected_passage',
          candidate_text_a: 'This passage should be revised to improve clarity for the reader and strengthen narrative cohesion.',
          candidate_text_b: 'Overall, this scene demonstrates unresolved stakes and indicates the narrative needs stronger connective tissue.',
          candidate_text_c: 'Revise the paragraph for better pacing.',
        },
      ],
      manuscriptChunks: [
        { content: 'Christine paused at the kitchen doorway and listened to the quiet in the hall.' },
      ],
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-candidate-quality-fail', { allowLegacyEvaluationProjection: true });

    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const [opp] = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opp.preflight_status).toBe('blocked');
    expect(opp.preflight_reasons).toContain('candidate_quality_failed');
    expect(opp.grounding_status).toBe('unsupported_blocked');
    expect(opp.admin_actions).toContain('Regenerate candidate prose');
  });

  it('emits REVISION_CANDIDATE_REJECTED for blocked opportunities with privacy-safe metadata only', async () => {
    const upsertSpy = jest.fn();

    const supabase = makeMinimalSupabase({
      upsertSpy,
      ledgerQualityReportContent: {
        quality_report: {
          gate_ready_status: 'blocked',
          blocking_reasons: ['CANON_BLOCK'],
          layer_truth_status: {
            canonical_identity_layer: 'blocked',
          },
        },
      },
      criteriaRecommendations: [
        {
          diagnosis: 'Narrative momentum stalls at the hinge beat.',
          recommendation: 'Bridge the hinge beat with one causal consequence sentence.',
          anchor_snippet: 'He set the letter down and waited until the room went quiet.',
          location_ref: 'chapter:4',
          confidence: 0.73,
        },
      ],
      manuscriptChunks: [{ content: 'He set the letter down and waited until the room went quiet.' }],
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-telemetry-canon-blocked', { allowLegacyEvaluationProjection: true });

    const rejectionEvents = mockLogRevisionEvent.mock.calls
      .map(([call]) => call as Record<string, unknown>)
      .filter((event) => event.event_code === 'REVISION_CANDIDATE_REJECTED');

    expect(rejectionEvents.length).toBeGreaterThan(0);
    const event = rejectionEvents[0];
    const metadata = event.metadata as Record<string, unknown>;

    expect(metadata.rejection_reasons).toEqual(expect.arrayContaining(['canon_authority_blocked']));
    expect(metadata).toMatchObject({
      anchor_found: true,
      context_found: true,
      hydration_attempted: false,
      prompt_version: 'candidate_hydration_v1',
      candidate_generation_status: expect.any(String),
    });

    const bannedKeys = [
      'manuscript_text',
      'manuscript_context',
      'evidence_anchor',
      'anchor_text',
      'rationale',
      'candidate_text_a',
      'candidate_text_b',
      'candidate_text_c',
      'dialogue_snippet',
      'location_snippet',
      'source_excerpt',
    ];

    for (const key of bannedKeys) {
      expect(metadata).not.toHaveProperty(key);
    }
  });

  it('emits overlap rejection telemetry with numeric diagnostics and no text-bearing payload', async () => {
    const upsertSpy = jest.fn();
    const manuscriptChunks = [
      {
        content: 'Nora folded the map, then looked at the doorway until the room understood she had already decided.',
      },
    ];

    mockHydrate.mockImplementation(async (blockedOpps) => {
      const rejectionReasons = new Map<string, string>();
      for (const opp of blockedOpps) {
        rejectionReasons.set(opp.opportunity_id, 'hydration_candidate_rejected_overlap');
      }
      return {
        hydratedCount: 0,
        skippedCount: 0,
        candidates: new Map(),
        rejectionReasons,
      };
    });

    const supabase = makeMinimalSupabase({
      upsertSpy,
      criteriaRecommendations: [
        {
          diagnosis: 'The transition does not show the causal hinge clearly.',
          recommendation: 'Clarify the hinge with one consequence-forward sentence before the next beat.',
          anchor_snippet: manuscriptChunks[0].content,
          location_ref: 'chapter:2 paragraph:3',
          confidence: 0.79,
          revision_operation: 'replace_selected_passage',
        },
      ],
      manuscriptChunks,
    });

    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-telemetry-overlap', { allowLegacyEvaluationProjection: true });

    const rejectionEvents = mockLogRevisionEvent.mock.calls
      .map(([call]) => call as Record<string, unknown>)
      .filter((event) => event.event_code === 'REVISION_CANDIDATE_REJECTED');

    expect(rejectionEvents.length).toBeGreaterThan(0);
    const metadata = rejectionEvents[0].metadata as Record<string, unknown>;

    expect(metadata.rejection_reasons).toEqual(expect.arrayContaining(['hydration_candidate_rejected_overlap']));
    expect(metadata).toMatchObject({
      hydration_attempted: true,
      hydration_result: 'rejected_overlap',
      model: expect.any(String),
      anchor_length_words: expect.any(Number),
      candidate_word_counts: { a: expect.any(Number), b: expect.any(Number), c: expect.any(Number) },
      candidate_anchor_overlap_scores: { a: expect.any(Number), b: expect.any(Number), c: expect.any(Number) },
      coordinates_placeholder: false,
      rationale_contaminated: false,
      prompt_version: 'candidate_hydration_v1',
    });

    const candidateCounts = metadata.candidate_word_counts as Record<string, number>;
    expect(candidateCounts.a).toBeGreaterThanOrEqual(0);
    expect(candidateCounts.b).toBeGreaterThanOrEqual(0);
    expect(candidateCounts.c).toBeGreaterThanOrEqual(0);

    const overlap = metadata.candidate_anchor_overlap_scores as Record<string, number>;
    expect(overlap.a).toBeGreaterThanOrEqual(0);
    expect(overlap.b).toBeGreaterThanOrEqual(0);
    expect(overlap.c).toBeGreaterThanOrEqual(0);

    const bannedKeys = [
      'manuscript_text',
      'manuscript_context',
      'evidence_anchor',
      'anchor_text',
      'rationale',
      'candidate_text_a',
      'candidate_text_b',
      'candidate_text_c',
      'dialogue_snippet',
      'location_snippet',
      'source_excerpt',
    ];
    for (const key of bannedKeys) {
      expect(metadata).not.toHaveProperty(key);
    }
  });

  it('calls regeneration for quality-failed hydrated opportunities and heals them', async () => {
    const rec = {
      diagnosis: 'The transition beat is absent.',
      recommendation: 'Insert a concrete bridge beat that shows Nora registering the implication before she moves.',
      anchor_snippet: 'Nora folded the map, then looked at the doorway until the room understood she had already decided.',
      location_ref: 'chapter:3 passage:regen-heal',
      confidence: 0.82,
      revision_operation: 'insert_after_selected_passage',
    };
    const manuscriptChunks = [{ content: rec.anchor_snippet }];
    const upsertSpy = jest.fn();

    // Hydration returns quality-failing prose (generic advice triggers quality gate)
    mockHydrate.mockImplementation(async (blockedOpps) => {
      const candidatesMap = new Map(
        blockedOpps.map((o: { opportunity_id: string }) => [
          o.opportunity_id,
          {
            candidate_text_a: 'This passage should be revised to clarify the narrative for the reader.',
            candidate_text_b: 'The scene needs to strengthen its thematic stakes for better manuscript impact.',
            candidate_text_c: 'Consider rewriting the section to improve transition and narrative flow.',
          },
        ]),
      );
      return { hydratedCount: blockedOpps.length, skippedCount: 0, candidates: candidatesMap };
    });

    // Regeneration returns healed, copy-ready prose
    mockRegen.mockImplementation(async (opps) => {
      const healed = new Map(
        opps.map((o: { opportunity_id: string }) => [
          o.opportunity_id,
          {
            candidate_text_a: 'Nora pressed her fingertips against the doorframe before she let herself follow the decision she had already made.',
            candidate_text_b: 'The map sat folded in her hands while the room caught up to what the doorway had already told her.',
            candidate_text_c: 'Nora stood at the threshold a moment longer, letting the quiet behind her settle before she moved into what came next.',
          },
        ]),
      );
      return { healed, stillFailed: new Map() };
    });

    const supabase = makeMinimalSupabase({ criteriaRecommendations: [rec], manuscriptChunks, upsertSpy });
    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-regen-heals', { allowLegacyEvaluationProjection: true });

    // Regen must have been invoked (quality gate triggered it)
    expect(mockRegen).toHaveBeenCalledTimes(1);

    // Final persisted opportunity must be supported (healed by regen)
    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const opps = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opps.length).toBe(1);
    expect(opps[0].grounding_status).toBe('supported');
    expect(opps[0].preflight_status).toBe('passed');
    expect(typeof opps[0].candidate_text_a).toBe('string');
    expect((opps[0].candidate_text_a as string).length).toBeGreaterThan(20);
  });

  it('fails closed when regen also fails quality — card stays blocked with regen reason code', async () => {
    const rec = {
      diagnosis: 'The transition beat is absent.',
      recommendation: 'Insert a concrete bridge beat.',
      anchor_snippet: 'Nora folded the map, then looked at the doorway until the room understood she had already decided.',
      location_ref: 'chapter:3 passage:regen-fail',
      confidence: 0.82,
      revision_operation: 'insert_after_selected_passage',
    };
    const manuscriptChunks = [{ content: rec.anchor_snippet }];
    const upsertSpy = jest.fn();

    // Hydration returns quality-failing prose
    mockHydrate.mockImplementation(async (blockedOpps) => {
      const candidatesMap = new Map(
        blockedOpps.map((o: { opportunity_id: string }) => [
          o.opportunity_id,
          {
            candidate_text_a: 'This passage should be revised to clarify the narrative for the reader.',
            candidate_text_b: 'The scene needs to strengthen its thematic stakes for better manuscript impact.',
            candidate_text_c: 'Consider rewriting the section to improve transition and narrative flow.',
          },
        ]),
      );
      return { hydratedCount: blockedOpps.length, skippedCount: 0, candidates: candidatesMap };
    });

    // Regen also fails — all opportunities still-failed
    mockRegen.mockImplementation(async (opps) => {
      const stillFailed = new Map(
        opps.map((o: { opportunity_id: string }) => [
          o.opportunity_id,
          ['candidate_quality_failed_after_regen'],
        ]),
      );
      return { healed: new Map(), stillFailed };
    });

    const supabase = makeMinimalSupabase({ criteriaRecommendations: [rec], manuscriptChunks, upsertSpy });
    await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-regen-still-fails', { allowLegacyEvaluationProjection: true });

    expect(mockRegen).toHaveBeenCalledTimes(1);

    // Card must remain blocked — fail closed
    const persisted = upsertSpy.mock.calls[0]?.[0] as { content: Record<string, unknown> };
    const opps = persisted.content.opportunities as Array<Record<string, unknown>>;
    expect(opps.length).toBe(1);
    expect(opps[0].grounding_status).toBe('unsupported_blocked');
    expect(opps[0].preflight_status).toBe('blocked');
    expect(opps[0].preflight_reasons).toContain('candidate_quality_failed_after_regen');
  });
});
