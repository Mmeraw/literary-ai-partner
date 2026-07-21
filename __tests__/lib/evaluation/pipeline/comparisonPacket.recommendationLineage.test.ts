import { buildComparisonPacket } from '@/lib/evaluation/pipeline/comparisonPacket';
import type { SinglePassOutput } from '@/lib/evaluation/pipeline/types';

function pass(passNumber: 1 | 2, recommendations: unknown[] = []): SinglePassOutput {
  return {
    pass: passNumber,
    axis: passNumber === 1 ? 'craft_execution' : 'editorial_literary',
    model: 'test',
    prompt_version: 'test',
    temperature: 0,
    generated_at: '2026-07-20T00:00:00.000Z',
    criteria: [{
      key: 'pacing',
      score_0_10: 5,
      rationale: 'The scene carries momentum, but its consequence remains delayed.',
      evidence: [],
      recommendations,
    }] as SinglePassOutput['criteria'],
  };
}

describe('comparison packet recommendation lineage', () => {
  it('carries every meaningful Pass 2 discovery with a stable source identity into the safe Pass 3 packet', () => {
    const recommendations = [
      {
        action: 'Name the deadline before the character leaves.',
        symptom: 'The scene has pressure but no visible time limit.',
        anchor_snippet: 'The clock continued its slow circuit above the empty bar.',
        specific_fix: 'Name the deadline before the character leaves the bar.',
        reader_effect: 'Readers can feel the immediate cost of delay.',
      },
      {
        action: 'Land the consequence in the following beat.',
        symptom: 'The scene releases pressure without consequence.',
        anchor_snippet: 'He watched the door swing shut and returned to his drink.',
        specific_fix: 'Show the first consequence in the beat after the decision.',
        reader_effect: 'Readers can connect the choice to its cost.',
      },
    ];

    const packet = buildComparisonPacket(pass(1), pass(2, recommendations));
    const pacing = packet.criteria.find((criterion) => criterion.key === 'pacing')!;

    expect(pacing.pass2_recommendation_candidates).toHaveLength(2);
    expect(pacing.pass2_recommendation_candidates.map((candidate) => candidate.source_id))
      .toEqual(expect.arrayContaining([
        expect.stringMatching(/^pacing:[a-f0-9]{20}:1$/),
        expect.stringMatching(/^pacing:[a-f0-9]{20}:1$/),
      ]));
    expect(pacing.pass2_recommendation_candidates.map((candidate) => candidate.action))
      .toEqual(recommendations.map((recommendation) => recommendation.action));
  });

  it('does not promote malformed Pass 2 observations into lineage candidates', () => {
    const packet = buildComparisonPacket(pass(1), pass(2, [
      { action: 'Improve the writing.' },
      {
        action: 'Move the deadline into the scene.',
        symptom: 'The deadline is absent from the scene.',
        anchor_snippet: 'The clock continued its slow circuit above the empty bar.',
      },
    ]));

    expect(packet.criteria.find((criterion) => criterion.key === 'pacing')!
      .pass2_recommendation_candidates).toHaveLength(1);
  });
});
