import { createHash } from 'crypto';

function canonicalize(value: unknown): unknown {
  if (value === null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalize(item)));
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const item = record[key];
      if (item !== undefined) {
        acc[key] = canonicalize(item);
      }
      return acc;
    }, {});
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return '';
  return JSON.stringify(canonicalize(value)) ?? '';
}

export function canonicalJsonSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
