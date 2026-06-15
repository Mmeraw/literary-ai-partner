import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const generateRoute = read('app/api/agent-readiness/generate/route.ts');
const generateAllRoute = read('app/api/agent-readiness/generate-all/route.ts');
const hookSource = read('app/agent-readiness/hooks/useAgentReadinessGenerate.ts');
const synopsisPage = read('app/agent-readiness/synopsis/page.tsx');
const bioPage = read('app/agent-readiness/bio/page.tsx');

describe('Agent Readiness generation contract', () => {
  test('supports synopsis lengths as request metadata without inventing new section keys', () => {
    expect(generateRoute).toContain("type SynopsisLength = 'query' | 'standard' | 'extended'");
    expect(generateRoute).toContain('const SYNOPSIS_LENGTH_LIMITS');
    expect(generateRoute).toContain("query: {");
    expect(generateRoute).toContain('min: 100');
    expect(generateRoute).toContain('max: 150');
    expect(generateRoute).toContain("standard: {");
    expect(generateRoute).toContain('min: 250');
    expect(generateRoute).toContain('max: 500');
    expect(generateRoute).toContain("extended: {");
    expect(generateRoute).toContain('min: 700');
    expect(generateRoute).toContain('max: 1000');
    expect(generateRoute).toContain("| 'synopsis'");
    expect(generateRoute).not.toContain('synopsis_short');
    expect(generateRoute).not.toContain('synopsis_medium');
    expect(generateRoute).not.toContain('synopsis_long');
  });

  test('passes the selected synopsis length from the page through the hook to the API', () => {
    expect(hookSource).toContain('synopsisLength?: SynopsisLength');
    expect(hookSource).toContain('synopsisLength: opts?.synopsisLength');
    expect(synopsisPage).toContain("type SynopsisLength = \"query\" | \"standard\" | \"extended\"");
    expect(synopsisPage).toContain('synopsisLength: selected');
  });

  test('generate-all explicitly generates a standard synopsis by default and validates bio input', () => {
    expect(generateAllRoute).toContain('const synopsisLength = normalizeSynopsisLength(body.synopsisLength)');
    expect(generateAllRoute).toContain("...(section === 'synopsis' ? { synopsisLength } : {})");
    expect(generateAllRoute).toContain('Author Bio input too brief');
    expect(generateAllRoute).toContain('trimmedAuthorBioInput.length >= 50');
  });

  test('query letters may use approved bio only and must omit invented bio claims otherwise', () => {
    expect(generateRoute).toContain('APPROVED AUTHOR BIO FACTS');
    expect(generateRoute).toContain('No approved author-supplied bio is available');
    expect(generateRoute).toContain('Omit author credentials and bio claims from the query letter');
    expect(generateRoute).toContain("getPersistedAgentSection(ctx, 'author_bio', 'approved')");
    expect(generateRoute).toContain('NEVER invent credentials, awards, education, locations, publications, or lived experience');
  });

  test('author bio page still requires author-supplied upload or pasted source material', () => {
    expect(bioPage).toContain('RevisionGrade does not invent author credentials');
    expect(bioPage).toContain('Upload Source');
    expect(bioPage).toContain('extractAuthorProfileSourceUploadText');
    expect(bioPage).toContain('authorBioInput: authorMaterials');
  });
});
