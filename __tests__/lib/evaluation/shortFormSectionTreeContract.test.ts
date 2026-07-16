import fs from 'fs';
import path from 'path';

import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { buildUnifiedEvaluationDocument } from '../../../lib/evaluation/unifiedEvaluationDocument';
import { ABSENCE_STATUS_TEXT } from '../../../lib/evaluation/presentation/reportDesignSystem';

type ContractShape = {
  sectionsInOrder: string[];
  requiredTitleBlockFields: string[];
  option: string;
  authoritativeModel: string;
  hybridPathAllowed: boolean;
};

describe('short-form section tree contract', () => {
  const contractPath = path.join(process.cwd(), 'docs/canon/SHORT_FORM_SECTION_TREE_CONTRACT_v1.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as ContractShape;

  test('locks Option A and forbids hybrid path', () => {
    expect(contract.option).toBe('A');
    expect(contract.authoritativeModel).toBe('canonicalDoc');
    expect(contract.hybridPathAllowed).toBe(false);
  });

  test('document sectionOrder matches canonical section contract', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Sister',
      result: {
        generated_at: '2026-06-08T00:00:00.000Z',
        overview: {
          overall_score_0_100: 64,
          verdict: 'revise',
          one_paragraph_summary: 'A complete summary for parity checks.',
          top_3_strengths: ['Strength one'],
          top_3_risks: ['Risk one'],
        },
        metrics: {
          manuscript: {
            title: 'Sister',
            word_count: 4903,
            genre: 'memoir',
            target_audience: 'Adult readers',
          },
        },
        enrichment: {
          premise: 'Premise paragraph',
          trigger_warnings: ['substance abuse'],
          reading_grade_level: 8.4,
          dialogue_percentage: 5.1,
          narrative_percentage: 94.9,
        },
        criteria: [
          {
            key: 'conceptAndCorePremise',
            score_0_10: 7,
            confidence_level: 'high',
            rationale: 'Concept rationale.',
            recommendations: [{ action: 'Clarify bridge.', priority: 'high' }],
          },
        ],
      },
    });

    expect([...doc.sectionOrder]).toEqual(contract.sectionsInOrder);
    for (const field of contract.requiredTitleBlockFields) {
      expect(Object.prototype.hasOwnProperty.call(doc.titleBlock, field)).toBe(true);
    }
  });

  test('required section surfaces receive an explicit absence status when source content is absent', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'Sparse Manuscript',
      result: {
        overview: {
          overall_score_0_100: undefined,
          verdict: undefined,
          one_paragraph_summary: '',
          top_3_strengths: [],
          top_3_risks: [],
        },
        metrics: {
          manuscript: {
            word_count: 1200,
          },
        },
        enrichment: {},
        criteria: [],
        recommendations: {
          quick_wins: [],
          strategic_revisions: [],
        },
      },
    });

    expect(doc.executiveSummary.trim()).toBe(ABSENCE_STATUS_TEXT);
    expect(doc.topStrengths).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.topRisks).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.topRecommendations).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.criteriaScoreGrid.length).toBe(13);
    expect(doc.criterionDetails.length).toBe(13);
    expect(doc.titleBlock.genre.trim().length).toBeGreaterThan(0);
    expect(doc.titleBlock.targetAudience.trim().length).toBeGreaterThan(0);
  });

  test.each([
    'short_form_evaluation' as const,
    'long_form_evaluation' as const,
    'long_form_multi_layer_evaluation' as const,
  ])('mode %s surfaces an explicit absence status when modeSpecific source content is absent', (mode) => {
    const doc = buildUnifiedEvaluationDocument({
      mode,
      displayTitle: 'Sparse Unified Manuscript',
      result: {
        overview: {
          one_paragraph_summary: '',
          top_3_strengths: [],
          top_3_risks: [],
        },
        metrics: { manuscript: { word_count: 1500 } },
        enrichment: {},
        criteria: [],
        recommendations: { quick_wins: [], strategic_revisions: [] },
      } as any,
      dream: null,
    });

    expect(doc.modeSpecific.manuscriptScaleContinuityFindings).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.storyLedgerArchitectureMap).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.reviewGateReadinessSurface).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.governedLedgerAddenda).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.crossLayerSynthesis).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.layerAwareRevisionSequencing).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.continuityCoverageProof).toEqual([ABSENCE_STATUS_TEXT]);
    expect(doc.modeSpecific.readinessReleasabilityPosture.trim()).toBe(ABSENCE_STATUS_TEXT);
  });

  test('Price of Vanity recommendations dedupe through one canonical opportunity ledger', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'The Price of Vanity',
      result: {
        generated_at: '2026-06-15T00:00:00.000Z',
        overview: {
          overall_score_0_100: 80,
          verdict: 'revise',
          one_paragraph_summary: 'A comic personal narrative uses an accounting motif to move from vanity toward a richer idea of value.',
          top_3_strengths: ['The escalating disaster chain is clean and causal.'],
          top_3_risks: ['Some revision opportunities repeat the same underlying issue.'],
        },
        metrics: {
          manuscript: {
            title: 'The Price of Vanity',
            word_count: 1800,
            genre: 'literary humor',
            target_audience: 'Adult readers',
          },
        },
        enrichment: {
          premise: 'A man trying to save money on hair color discovers the real price of vanity.',
          trigger_warnings: [],
        },
        criteria: [
          {
            key: 'conceptAndCorePremise',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'The premise is concrete and comic.',
            recommendations: [
              {
                priority: 'high',
                action: 'Trim the philosophical opening so the character and hair-coloring problem arrive sooner.',
                expected_impact: 'The reader enters the comic premise before abstract reflection slows the start.',
                anchor_snippet: 'Money was clearly one way he could differentiate himself, except he couldn’t exactly go around telling people, “Heh, I am in the top X% of Canadians financially.”',
                symptom: 'The worldview arrives before the character is in motion.',
                mechanism: 'Front-loaded exposition delays the first concrete vanity action.',
                specific_fix: 'Cut 30–50% of the opening reflection and move quickly to the hair-coloring setup.',
                reader_effect: 'The opening becomes more immediate and comic.',
              },
            ],
          },
          {
            key: 'themeAndSubtext',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'The cost motif pays off strongly.',
            recommendations: [
              {
                priority: 'high',
                action: 'Lighten the final thematic explanation after the priceless payoff.',
                expected_impact: 'The ending trusts readers to infer the value contrast.',
                anchor_snippet: 'His calamity was not completely without positivity though. During the process, he had met an amazing person, Kim, who differentiated herself through hard work, empathy, kindness, strong family ties, generosity, and more, thus reminding him of some of the more important values in life.',
                symptom: 'The final paragraph explains the lesson after the story has already demonstrated it.',
                mechanism: 'Explicit thematic summary reduces the force of the “Total value: Priceless” turn.',
                specific_fix: 'Let Kim’s action and the priceless line carry the theme with less explanation.',
                reader_effect: 'The close lands with more restraint and confidence.',
              },
            ],
          },
          {
            key: 'narrativeClosure',
            score_0_10: 7,
            confidence_level: 'high',
            rationale: 'The ending is effective but slightly over-articulated.',
            recommendations: [
              {
                priority: 'high',
                action: 'Reduce the final explanatory sentence so the priceless contrast remains the emotional endpoint.',
                expected_impact: 'The reader supplies the conclusion instead of being told the moral.',
                anchor_snippet: 'His calamity was not completely without positivity though. During the process, he had met an amazing person, Kim, who differentiated herself through hard work, empathy, kindness, strong family ties, generosity, and more, thus reminding him of some of the more important values in life.',
                symptom: 'The closure states the theme directly.',
                mechanism: 'Theme is converted from subtext into summary.',
                specific_fix: 'End closer to “Total value: Priceless” and remove redundant explanation.',
                reader_effect: 'The final beat feels more earned and less instructional.',
              },
            ],
          },
          {
            key: 'characterization',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'Kim changes the meaning of the story.',
            recommendations: [
              {
                priority: 'high',
                action: 'Reveal Kim’s backstory through a few dialogue beats rather than a compact biography.',
                expected_impact: 'Kim feels experienced in-scene rather than summarized.',
                anchor_snippet: 'Kim was originally from Vietnam. At the age of 11, she had fled with other boat people to Hong Kong, where she was forced to live in a refugee camp for four years.',
                symptom: 'Kim’s history arrives as biography.',
                mechanism: 'Exposition pauses the salon scene just as Kim becomes emotionally important.',
                specific_fix: 'Let one or two details surface through conversation while she works.',
                reader_effect: 'The reader discovers Kim through presence and voice.',
              },
            ],
          },
          {
            key: 'dialogue',
            score_0_10: 7,
            confidence_level: 'moderate',
            rationale: 'Dialogue is functional but sometimes too expository.',
            recommendations: [
              {
                priority: 'medium',
                action: 'Make Kim’s blunt salon line sound a little less like exposition.',
                expected_impact: 'The exchange will feel sharper and more natural.',
                anchor_snippet: 'You aren’t the first Customer who has come from that salon and needed their hair fixed.',
                symptom: 'The line delivers context efficiently but slightly announces its function.',
                mechanism: 'Dialogue carries background information more than immediate character pressure.',
                specific_fix: 'Shorten the line and let Kim’s confidence imply her experience.',
                reader_effect: 'The scene keeps its comic pressure while sounding more spontaneous.',
              },
            ],
          },
          {
            key: 'proseControl',
            score_0_10: 7,
            confidence_level: 'high',
            rationale: 'A small mechanical typo interrupts polish.',
            recommendations: [
              {
                priority: 'high',
                action: 'Correct the typo “In was 2:00 p.m.” to “It was 2:00 p.m.”',
                expected_impact: 'This removes a visible copyediting distraction.',
                anchor_snippet: 'In was 2:00 p.m.',
                symptom: 'A typo briefly breaks reader confidence.',
                mechanism: 'Mechanical error rather than craft structure.',
                specific_fix: 'Change “In” to “It.”',
                reader_effect: 'The page reads cleanly.',
              },
            ],
          },
        ],
        recommendations: { quick_wins: [], strategic_revisions: [] },
      },
    });

    const ledger = doc.canonicalOpportunityLedger!;
    expect(ledger.metrics.raw_opportunity_count).toBe(6);
    expect(ledger.metrics.canonical_opportunity_count).toBe(5);
    expect(ledger.metrics.duplicate_clusters).toBeGreaterThanOrEqual(1);
    expect(ledger.rendered_opportunities.map((item) => item.issue_type)).toEqual(expect.arrayContaining([
      'opening_setup',
      'thematic_closure',
      'character_exposition',
      'scene_dialogue',
      'mechanics_typo',
    ]));

    const closureOpportunities = ledger.rendered_opportunities.filter((item) => item.issue_type === 'thematic_closure');
    expect(closureOpportunities).toHaveLength(1);
    expect(closureOpportunities[0].related_criteria).toEqual(expect.arrayContaining(['themeAndSubtext', 'narrativeClosure']));

    expect(doc.topRecommendations.length).toBeGreaterThan(0);
    expect(doc.topRecommendations.join('\n')).not.toContain('OPP-');
    expect(doc.topRecommendations.join('\n')).not.toContain('In was 2:00 p.m.');

    const actionOpportunityIds = [
      ...doc.actionItems.quickWins,
      ...doc.actionItems.strategicRevisions,
    ].map((item) => item.opportunity_id);
    expect(new Set(actionOpportunityIds).size).toBe(actionOpportunityIds.length);
    expect(actionOpportunityIds).toEqual(expect.arrayContaining(
      ledger.rendered_opportunities
        .filter((item) => item.is_action_item_candidate)
        .slice(0, actionOpportunityIds.length)
        .map((item) => item.id),
    ));

    const printedCriterionOpportunityIds = doc.criterionDetails
      .flatMap((detail) => detail.recommendations)
      .map((recommendation) => recommendation.opportunity_id)
      .filter(Boolean);
    expect(printedCriterionOpportunityIds).toContain(closureOpportunities[0].id);
  });

  /**
   * REGRESSION TEST: Price of Vanity — genre was rendered as "novel" (a
   * format word) because the Title Block used metrics.manuscript.genre
   * without filtering. The builder must prefer enrichment.diagnosed_genre
   * and reject bare FORMAT_WORDS.
   */
  test('genre: rejects bare format word "novel" in title block', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'The Price of Vanity',
      result: {
        generated_at: '2026-06-11T00:00:00.000Z',
        overview: {
          overall_score_0_100: 72,
          verdict: 'revise',
          one_paragraph_summary: 'A humorous account of vanity and hair disasters.',
          top_3_strengths: ['Voice', 'Humor', 'Pacing'],
          top_3_risks: ['Risk one'],
        },
        metrics: {
          manuscript: {
            title: 'The Price of Vanity',
            word_count: 1498,
            genre: 'novel',
            target_audience: 'Adult Readers',
          },
        },
        enrichment: {
          premise: 'A man learns about vanity through a bad hair day.',
          trigger_warnings: [],
        },
        criteria: [],
      },
    });

    expect(doc.titleBlock.genre).toBe('Not specified');
    expect(doc.titleBlock.genreConfidenceLabel).toBeNull();
  });

  test('genre: prefers enrichment.diagnosed_genre over metrics.manuscript.genre', () => {
    const doc = buildShortFormEvaluationDocument({
      displayTitle: 'The Price of Vanity',
      result: {
        generated_at: '2026-06-11T00:00:00.000Z',
        overview: {
          overall_score_0_100: 72,
          verdict: 'revise',
          one_paragraph_summary: 'A humorous account of vanity and hair disasters.',
          top_3_strengths: ['Voice', 'Humor', 'Pacing'],
          top_3_risks: ['Risk one'],
        },
        metrics: {
          manuscript: {
            title: 'The Price of Vanity',
            word_count: 1498,
            genre: 'novel',
            target_audience: 'Adult Readers',
          },
        },
        enrichment: {
          premise: 'A man learns about vanity through a bad hair day.',
          trigger_warnings: [],
          diagnosed_genre: 'Comedy / comic fiction + Literary / upmarket fiction',
        },
        criteria: [],
      },
    });

    expect(doc.titleBlock.genre).toBe('Comedy / Comic Fiction + Literary / Upmarket Fiction');
  });
});
