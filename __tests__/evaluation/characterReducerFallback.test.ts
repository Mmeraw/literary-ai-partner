import { reduceIdentityGroups } from '../../lib/evaluation/pipeline/identityReducerFallback';

describe('identity reducer fallback resilience', () => {
  it('returns OK when strict identity payload validates', () => {
    const result = reduceIdentityGroups(JSON.stringify({
      identities: [
        {
          canonical_identity_group: 'Michael James Salter',
          aliases: ['Michael', 'Mike', 'Mr. Salter'],
          role_tier: 'co_protagonist',
          primary_pov_anchor: true,
        },
      ],
    }), []);

    expect(result).toEqual({
      merge_status: 'OK',
      canonical_identity_groups: [
        {
          canonical_identity_group: 'Michael James Salter',
          aliases: ['Michael', 'Mike', 'Mr. Salter'],
          role_tier: 'co_protagonist',
          primary_pov_anchor: true,
        },
      ],
    });
  });

  it('routes malformed model output to degraded fallback while preserving role hints', () => {
    const result = reduceIdentityGroups('{ malformed json', [
      {
        character_name: 'Michael',
        alternate_names: ['Mike', 'Mr. Salter'],
        role_description: 'lead protagonist and primary POV anchor',
        is_pov_character: true,
      },
      {
        name: 'Raúl',
        aliases: ['Raul'],
        context: 'cartel antagonist and active threat',
      },
      {
        name: 'Shopkeeper',
        context: 'minor functional scene witness',
      },
    ]);

    expect(result.merge_status).toBe('DEGRADED_FALLBACK_TO_RAW');
    expect(result.diagnostic_logs).toBeTruthy();
    expect(result.canonical_identity_groups).toEqual([
      {
        canonical_identity_group: 'Michael',
        aliases: ['Michael', 'Mike', 'Mr. Salter'],
        role_tier: 'co_protagonist',
        primary_pov_anchor: true,
      },
      {
        canonical_identity_group: 'Raúl',
        aliases: ['Raúl', 'Raul'],
        role_tier: 'complex_antagonist',
        primary_pov_anchor: false,
      },
      {
        canonical_identity_group: 'Shopkeeper',
        aliases: ['Shopkeeper'],
        role_tier: 'functional_scene_character',
        primary_pov_anchor: false,
      },
    ]);
  });

  it('returns failed critical when output is empty or fully truncated', () => {
    const result = reduceIdentityGroups('', [
      { character_name: 'Michael', role_description: 'protagonist' },
    ]);

    expect(result).toEqual({
      merge_status: 'FAILED_CRITICAL',
      diagnostic_logs: 'CRITICAL_REDUCER_ERROR: LLM output stream truncated or generated zero tokens. Fallback impossible.',
      canonical_identity_groups: [],
    });
  });

  it('accepts fenced JSON from model output', () => {
    const result = reduceIdentityGroups(`\`\`\`json
{
  "identities": [
    {
      "canonical_identity_group": "Benjamin",
      "aliases": ["Ben"],
      "role_tier": "co_protagonist",
      "primary_pov_anchor": false
    }
  ]
}
\`\`\``, []);

    expect(result.merge_status).toBe('OK');
    expect(result.canonical_identity_groups[0]).toMatchObject({
      canonical_identity_group: 'Benjamin',
      aliases: ['Ben'],
      role_tier: 'co_protagonist',
    });
  });
});
