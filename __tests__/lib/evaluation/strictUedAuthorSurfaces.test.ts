import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('strict certified UED consumption on author-facing surfaces', () => {
  test('report webpage has no legacy unified-document fallback builder path', () => {
    const source = readWorkspaceFile('app/reports/[jobId]/page.tsx');

    expect(source).toContain('loadCertifiedUnifiedEvaluationDocumentArtifact');
    expect(source).toContain('if (persistedDocument.ok === false)');
    expect(source).toContain('const canonicalDoc = sanitizeAuthorFacingDisplayValue(persistedDocument.document');
    expect(source).not.toContain('buildWebpageUnifiedDocument');
    expect(source).not.toContain('buildUnifiedEvaluationDocument({');
    expect(source).not.toContain('Missing persisted UED artifact; using legacy');
  });

  test('download route has no legacy canonical document fallback builder path', () => {
    const source = readWorkspaceFile('app/api/reports/[jobId]/download/route.ts');

    expect(source).toContain('loadCertifiedUnifiedEvaluationDocumentArtifact');
    expect(source).toContain('if (persistedDocument.ok === false)');
    expect(source).toContain('const canonicalDoc = persistedDocument.document;');
    expect(source).not.toContain('buildCanonicalTemplateDocument');
    expect(source).not.toContain('buildUnifiedEvaluationDocument({');
    expect(source).not.toContain('Missing persisted UED artifact; using legacy');
  });

  test('author exposure DB errors are surfaced as system failures, not not-found policy blocks', () => {
    const surfaces = [
      'app/api/report-shares/route.ts',
      'app/api/reports/[jobId]/download/route.ts',
      'app/api/jobs/[jobId]/artifacts/route.ts',
    ];

    for (const relativePath of surfaces) {
      const source = readWorkspaceFile(relativePath);
      expect(source).toContain("exposureDecision.reason === 'db_error'");
      expect(source).toContain('System error checking author exposure certification');
      expect(source).toContain('status: 500');
    }
  });
});
