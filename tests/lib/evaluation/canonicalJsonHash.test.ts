import { canonicalJson, canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';

describe('canonicalJsonHash', () => {
  test('sorts object keys recursively before hashing', () => {
    const left = {
      z: 1,
      a: {
        y: ['keep-order', { b: 2, a: 1 }],
        x: 'value',
      },
    };
    const right = {
      a: {
        x: 'value',
        y: ['keep-order', { a: 1, b: 2 }],
      },
      z: 1,
    };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(canonicalJsonSha256(left)).toBe(canonicalJsonSha256(right));
  });

  test('preserves array order because arrays are semantic JSON order', () => {
    expect(canonicalJsonSha256(['a', 'b'])).not.toBe(canonicalJsonSha256(['b', 'a']));
  });
});
