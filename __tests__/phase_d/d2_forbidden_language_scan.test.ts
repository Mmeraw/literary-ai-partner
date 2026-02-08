import { scanObjectForForbiddenMarketClaims, containsForbiddenMarketClaims } from '@/lib/release/forbiddenMarketClaims';

describe('D2 forbidden market claims scanner (fail-closed)', () => {
  describe('containsForbiddenMarketClaims', () => {
    it('detects "guarantee" patterns (case-insensitive)', () => {
      expect(containsForbiddenMarketClaims('This is guaranteed')).toBe(true);
      expect(containsForbiddenMarketClaims('This is GUARANTEED')).toBe(true);
      expect(containsForbiddenMarketClaims('We guarantee this')).toBe(true);
      expect(containsForbiddenMarketClaims('This is guaranteed.')).toBe(true);
    });

    it('detects "will sell" pattern', () => {
      expect(containsForbiddenMarketClaims('This will sell')).toBe(true);
      expect(containsForbiddenMarketClaims('This WILL SELL')).toBe(true);
    });

    it('detects "bestseller" variants', () => {
      expect(containsForbiddenMarketClaims('bestseller')).toBe(true);
      expect(containsForbiddenMarketClaims('best-seller')).toBe(true);
      expect(containsForbiddenMarketClaims('best seller')).toBe(false); // space variant
    });

    it('detects "surefire" pattern', () => {
      expect(containsForbiddenMarketClaims('This is surefire')).toBe(true);
      expect(containsForbiddenMarketClaims('surefire success')).toBe(true);
    });

    it('detects "certain to sell"', () => {
      expect(containsForbiddenMarketClaims('certain to sell')).toBe(true);
      expect(containsForbiddenMarketClaims('Certain to sell')).toBe(true);
    });

    it('detects "agent will" in market context', () => {
      expect(containsForbiddenMarketClaims('agent will love this')).toBe(true);
      expect(containsForbiddenMarketClaims('Agent will')).toBe(true);
    });

    it('detects "publisher will" in market context', () => {
      expect(containsForbiddenMarketClaims('publisher will acquire')).toBe(true);
      expect(containsForbiddenMarketClaims('Publisher will')).toBe(true);
    });

    it('detects "will get picked up"', () => {
      expect(containsForbiddenMarketClaims('will get picked up')).toBe(true);
      expect(containsForbiddenMarketClaims('Will get picked up')).toBe(true);
    });

    it('detects "will be acquired"', () => {
      expect(containsForbiddenMarketClaims('will be acquired')).toBe(true);
      expect(containsForbiddenMarketClaims('Will be acquired')).toBe(true);
    });

    it('does not flag neutral language', () => {
      expect(containsForbiddenMarketClaims('This is a neutral statement.')).toBe(false);
      expect(containsForbiddenMarketClaims('This manuscript is well-written.')).toBe(false);
      expect(containsForbiddenMarketClaims('The plot is engaging.')).toBe(false);
      expect(containsForbiddenMarketClaims('Strong narrative voice.')).toBe(false);
    });

    it('does not flag partial word matches', () => {
      expect(containsForbiddenMarketClaims('guaranteed')).toBe(true); // should match as ends with -d
      expect(containsForbiddenMarketClaims('guarantees')).toBe(true); // should match as ends with -s
    });
  });

  describe('scanObjectForForbiddenMarketClaims', () => {
    it('detects forbidden claims anywhere in rendered string content', () => {
      const obj = {
        agentSummary: { highLevel: 'This will sell. Guaranteed.' }
      };
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(true);
    });

    it('detects forbidden claims in deeply nested structures', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              notes: ['neutral text', 'This will sell']
            }
          }
        }
      };
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(true);
    });

    it('detects forbidden claims in arrays of strings', () => {
      const obj = {
        notes: ['neutral note 1', 'guaranteed success', 'neutral note 2']
      };
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(true);
    });

    it('does not flag neutral language in complex objects', () => {
      const obj = {
        agentSummary: { highLevel: 'This is a neutral statement.' },
        notes: ['Note 1', 'Note 2'],
        metadata: {
          processed: true,
          notes: ['The manuscript is well-written.']
        }
      };
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(false);
    });

    it('handles circular references safely', () => {
      const obj: any = {
        name: 'test',
        notes: 'neutral'
      };
      obj.self = obj; // create circular reference
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(false);
    });

    it('handles circular references with forbidden language', () => {
      const obj: any = {
        name: 'test',
        notes: 'guaranteed'
      };
      obj.self = obj; // create circular reference
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(true);
    });

    it('scans nested arrays containing objects', () => {
      const obj = {
        items: [
          { title: 'Item 1', description: 'neutral' },
          { title: 'Item 2', description: 'This will sell' },
          { title: 'Item 3', description: 'another neutral' }
        ]
      };
      expect(scanObjectForForbiddenMarketClaims(obj)).toBe(true);
    });

    it('returns false for null, undefined, and primitives', () => {
      expect(scanObjectForForbiddenMarketClaims(null)).toBe(false);
      expect(scanObjectForForbiddenMarketClaims(undefined)).toBe(false);
      expect(scanObjectForForbiddenMarketClaims(42)).toBe(false);
      expect(scanObjectForForbiddenMarketClaims(true)).toBe(false);
    });
  });
});
