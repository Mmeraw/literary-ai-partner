const createCompletionMock = jest.fn();
const OpenAIMock = jest.fn(() => ({
  chat: {
    completions: {
      create: createCompletionMock,
    },
  },
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: OpenAIMock,
}));

describe('generateSemanticSeedArtifacts', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('uses whole-manuscript LLM output to build story and evaluation seeds', async () => {
    createCompletionMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              story_claims: [
                {
                  claim_id: 'story_seed:1',
                  claim_status: 'proposed_unverified',
                  hypothesis: 'Mara appears to anchor the novel’s recurring family conflict.',
                  temp_seed_entity_id: 'temp_seed_entity_mara',
                  evidence_coordinates: ['“Mara”', 'chapter 1'],
                },
              ],
              evaluation_claims: [
                {
                  claim_id: 'evaluation_seed:1',
                  criterion_key: 'narrativeDrive',
                  claim_status: 'proposed_unverified',
                  hypothesis: 'The opening establishes forward motion but should be verified against later escalation.',
                  evidence_coordinates: ['“kept moving”'],
                },
                {
                  claim_id: 'evaluation_seed:2',
                  criterion_key: 'not_a_real_criterion',
                  claim_status: 'unknown_status',
                  hypothesis: 'This criterion key should normalize to a canonical value.',
                  evidence_coordinates: [],
                },
              ],
              uncertainty_flags: ['Cross-chapter pressure still needs Phase 1A verification.'],
              semantic_status: 'valid',
            }),
          },
        },
      ],
    });

    const { generateSemanticSeedArtifacts } = await import('../../../../lib/evaluation/seed/semanticSeedGenerator');

    const result = await generateSemanticSeedArtifacts({
      jobId: 'job-1',
      manuscriptId: 42,
      title: 'Semantic Seed Test',
      workType: 'novel',
      manuscriptText: 'Mara kept moving through the hallway while the family argued in the next room.',
      openaiApiKey: 'sk-test',
      model: 'gpt-4o-mini',
      timeoutMs: 1000,
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(OpenAIMock).toHaveBeenCalledTimes(1);
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    const request = createCompletionMock.mock.calls[0][0];
    expect(String(request.messages[1].content)).toContain('Mara kept moving through the hallway');
    expect(result.storySeed.artifact_type).toBe('story_map_seed_v1');
    expect(result.storySeed.model).toBe('gpt-4o-mini');
    expect(result.storySeed.prompt_version).toBe(result.promptVersion);
    expect(result.storySeed.claims).toHaveLength(1);
    expect(result.storySeed.claims[0].temp_seed_entity_id).toBe('temp_seed_entity_mara');
    expect(result.evaluationSeed.artifact_type).toBe('evaluation_seed_v1');
    expect(result.evaluationSeed.model).toBe('gpt-4o-mini');
    expect(result.evaluationSeed.prompt_version).toBe(result.promptVersion);
    expect(result.evaluationSeed.claims).toHaveLength(2);
    expect(result.evaluationSeed.claims[1].criterion_key).toBeDefined();
    expect(result.evaluationSeed.claims[1].claim_status).toBe('proposed_unverified');
  });

  test('uses deterministic fallback when the OpenAI key is missing', async () => {
    const { generateSemanticSeedArtifacts } = await import('../../../../lib/evaluation/seed/semanticSeedGenerator');

    const result = await generateSemanticSeedArtifacts({
      jobId: 'job-1',
      manuscriptId: 42,
      manuscriptText: 'short text',
      model: 'gpt-4o-mini',
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(createCompletionMock).not.toHaveBeenCalled();
    expect(result.storySeed.artifact_type).toBe('story_map_seed_v1');
    expect(result.storySeed.model).toBe('gpt-4o-mini');
    expect(result.storySeed.prompt_version).toBe(result.promptVersion);
    expect(result.storySeed.claims[0]?.claim_id).toBe('story_seed:fallback:1');
    expect(result.storySeed.claims[0]?.hypothesis).toContain('missing_openai_key');
    expect(result.evaluationSeed.artifact_type).toBe('evaluation_seed_v1');
    expect(result.evaluationSeed.model).toBe('gpt-4o-mini');
    expect(result.evaluationSeed.prompt_version).toBe(result.promptVersion);
  });

  test('uses deterministic fallback when OpenAI provider call fails', async () => {
    createCompletionMock.mockRejectedValue(new Error('provider exploded'));
    const { generateSemanticSeedArtifacts } = await import('../../../../lib/evaluation/seed/semanticSeedGenerator');

    const result = await generateSemanticSeedArtifacts({
      jobId: 'job-2',
      manuscriptId: 77,
      manuscriptText: 'text',
      openaiApiKey: 'sk-test',
      model: 'gpt-4o-mini',
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.storySeed.model).toBe('gpt-4o-mini');
    expect(result.evaluationSeed.model).toBe('gpt-4o-mini');
    expect(result.storySeed.claims[0]?.claim_id).toBe('story_seed:fallback:1');
    expect(result.storySeed.claims[0]?.hypothesis).toContain('provider_error');
  });
});
