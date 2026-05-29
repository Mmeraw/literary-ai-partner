import {
  isInvalidIdentityNameToken,
  sanitizeIdentityNameList,
  sanitizeIdentityNameToken,
} from '@/lib/evaluation/pipeline/identityNameHygiene';

describe('identityNameHygiene', () => {
  it('rejects invalid canonical identity name tokens', () => {
    expect(isInvalidIdentityNameToken('he')).toBe(true);
    expect(isInvalidIdentityNameToken('the boy')).toBe(true);
    expect(isInvalidIdentityNameToken('sir')).toBe(true);
    expect(isInvalidIdentityNameToken('madam')).toBe(true);
    expect(isInvalidIdentityNameToken('the stranger')).toBe(true);
    expect(isInvalidIdentityNameToken("Joe and Biddy's son")).toBe(true);
  });

  it('accepts valid identity name tokens', () => {
    expect(sanitizeIdentityNameToken('Philip Pirrip')).toBe('Philip Pirrip');
    expect(sanitizeIdentityNameToken('Pip')).toBe('Pip');
  });

  it('sanitizes and deduplicates lists while preserving valid entries', () => {
    expect(sanitizeIdentityNameList(['he', 'Pip', 'pip', 'sir', 'Philip Pirrip'])).toEqual([
      'Pip',
      'Philip Pirrip',
    ]);
  });
});
