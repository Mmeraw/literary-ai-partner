import { reduceIdentityGroups } from '@/lib/evaluation/pipeline/identityReducerFallback';

describe('identityReducerFallback parity', () => {
  it('applies identity hygiene filters in fallback path', () => {
    const result = reduceIdentityGroups('{"identities":[}', [
      {
        character_name: 'madam',
        aliases: ['the stranger', 'he', 'Philip Pirrip'],
        alternate_names: ['sir', 'Pip'],
      },
    ]);

    expect(result.merge_status).toBe('DEGRADED_FALLBACK_TO_RAW');
    expect(result.canonical_identity_groups).toHaveLength(1);

    const [group] = result.canonical_identity_groups;
    expect(group.canonical_identity_group).toBe('Unidentified Figure');
    expect(group.aliases).toEqual(expect.arrayContaining(['Unidentified Figure', 'Philip Pirrip', 'Pip']));
    expect(group.aliases).not.toEqual(expect.arrayContaining(['madam', 'the stranger', 'he', 'sir']));
  });
});
