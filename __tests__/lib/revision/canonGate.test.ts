import { runCanonGate } from '../../../lib/revision/canonGate';

describe('canonGate', () => {
  it('blocks unsupported proper-noun entities when canon is supplied', () => {
    const result = runCanonGate({ candidateText: 'Robert opened the drawer beside Maria.', knownEntities: ['Robert'] });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('UNSUPPORTED_FACT');
  });

  it('passes known entities', () => {
    const result = runCanonGate({ candidateText: 'Robert opened the drawer.', knownEntities: ['Robert'] });
    expect(result.passed).toBe(true);
  });
});
