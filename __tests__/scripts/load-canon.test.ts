import path from 'node:path';
import { isIngestable, CANON_ROOT } from '../../scripts/load-canon';

describe('canon loader: _md-only ingest gate (PR-0)', () => {
  it('CANON_ROOT resolves to docs/canon/_md', () => {
    expect(CANON_ROOT.endsWith(path.join('docs', 'canon', '_md'))).toBe(true);
  });

  it('accepts .md files under docs/canon/_md', () => {
    const f = path.join(CANON_ROOT, 'sample.md');
    expect(isIngestable(f)).toEqual({ ok: true });
  });

  it('accepts .md files in nested subdirs of docs/canon/_md', () => {
    const f = path.join(CANON_ROOT, 'subdir', 'nested.md');
    expect(isIngestable(f)).toEqual({ ok: true });
  });

  it('rejects .txt files even under docs/canon/_md', () => {
    const f = path.join(CANON_ROOT, 'legacy.txt');
    const v = isIngestable(f);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/^disallowed_extension:/);
  });

  it('rejects .docx files even under docs/canon/_md', () => {
    const f = path.join(CANON_ROOT, 'legacy.docx');
    expect(isIngestable(f).ok).toBe(false);
  });

  it('rejects extension-less files', () => {
    const f = path.join(CANON_ROOT, 'README');
    const v = isIngestable(f);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('disallowed_extension:none');
  });

  it('rejects .md files outside docs/canon/_md (sibling dir)', () => {
    const f = path.resolve(process.cwd(), 'docs/canon/raw/legacy.md');
    const v = isIngestable(f);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('outside_canon_md_root');
  });

  it('rejects .md files outside docs/canon entirely', () => {
    const f = path.resolve(process.cwd(), 'README.md');
    expect(isIngestable(f)).toEqual({
      ok: false,
      reason: 'outside_canon_md_root',
    });
  });

  it('rejects absolute paths outside the repo', () => {
    const f = '/tmp/elsewhere/anything.md';
    expect(isIngestable(f)).toEqual({
      ok: false,
      reason: 'outside_canon_md_root',
    });
  });
});
