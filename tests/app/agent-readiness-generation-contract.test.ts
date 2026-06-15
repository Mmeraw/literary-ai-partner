import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const generateRoute = read('app/api/agent-readiness/generate/route.ts');
const generateAllRoute = read('app/api/agent-readiness/generate-all/route.ts');
const hookSource = read('app/agent-readiness/hooks/useAgentReadinessGenerate.ts');
const workbenchSource = read('app/agent-readiness/AgentReadinessWorkbenchClient.tsx');
const synopsisPage = read('app/agent-readiness/synopsis/page.tsx');
const bioPage = read('app/agent-readiness/bio/page.tsx');

describe('Agent Readiness generation contract', () => {
  test('supports synopsis lengths as request metadata without inventing new section keys', () => {
    expect(generateRoute).toContain("type SynopsisLength = 'query' | 'standard' | 'extended'");
    expect(generateRoute).toContain("type SynopsisVariant = 'short' | 'medium' | 'long'");
    expect(generateRoute).toContain('const SYNOPSIS_LIMITS');
    expect(generateRoute).toContain('function synopsisVariantFromRequest');
    expect(generateRoute).toContain("if (length === 'query') return 'short'");
    expect(generateRoute).toContain("if (length === 'extended') return 'long'");
    expect(generateRoute).toContain("return 'medium'");
    expect(generateRoute).toContain("short: {");
    expect(generateRoute).toContain('min: 100');
    expect(generateRoute).toContain('max: 150');
    expect(generateRoute).toContain("medium: {");
    expect(generateRoute).toContain('min: 250');
    expect(generateRoute).toContain('max: 500');
    expect(generateRoute).toContain("long: {");
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

  test('main workbench exposes all synopsis variants and author-bio materials input', () => {
    expect(workbenchSource).toContain('type SynopsisVariant = "short" | "medium" | "long"');
    expect(workbenchSource).toContain('synopsis_short');
    expect(workbenchSource).toContain('synopsis_medium');
    expect(workbenchSource).toContain('synopsis_long');
    expect(workbenchSource).toContain('100–150 words');
    expect(workbenchSource).toContain('250–500 words');
    expect(workbenchSource).toContain('700–1,000 words');
    expect(workbenchSource).toContain('Author Bio Materials');
    expect(workbenchSource).toContain('authorBioInput.trim().length < 50');
    expect(workbenchSource).toContain('author-supplied bio/resume/CV only');
  });

  test('generate-all explicitly generates a standard synopsis by default and validates bio input', () => {
    expect(generateAllRoute).toContain('const synopsisLength = normalizeSynopsisLength(body.synopsisLength)');
    expect(generateAllRoute).toContain("...(section === 'synopsis' ? { synopsisLength } : {})");
    expect(generateAllRoute).toContain('Author Bio input too brief');
    expect(generateAllRoute).toContain('trimmedAuthorBioInput.length >= 50');
  });

  test('query letters may use approved bio only and must omit invented bio claims otherwise', () => {
    expect(generateRoute).toContain('APPROVED/AUTHOR-SUPPLIED BIO MATERIALS FOR OPTIONAL USE');
    expect(generateRoute).toContain('No author-supplied biography is available');
    expect(generateRoute).toContain('Omit biographical claims');
    expect(generateRoute).toContain('function approvedAuthorBio');
    expect(generateRoute).toContain('NEVER invent plot facts, credentials, awards, education, publication history, personal facts, comps, or market claims');
  });

  test('generation context consumes certified canonical opportunity ledger summaries', () => {
    expect(generateRoute).toContain("'unified_evaluation_document_v1', 'evaluation_result_v2', 'evaluation_result_v1'");
    expect(generateRoute).toContain("artifact_type', 'author_exposure_certification_v1'");
    expect(generateRoute).toContain('canonicalJsonSha256(unifiedDocument)');
    expect(generateRoute).toContain('canonicalOpportunityLedger');
    expect(generateRoute).toContain('rendered_opportunities');
    expect(generateRoute).toContain('CANONICAL OPPORTUNITY LEDGER — SINGLE RECOMMENDATION SOURCE');
    expect(generateRoute).toContain('canonicalOpportunities:');
    expect(generateRoute).toContain('extractCertifiedCanonicalOpportunityContext(artifact.content, certificationRow?.content)');
  });

  test('author bio page still requires author-supplied upload or pasted source material', () => {
    expect(bioPage).toContain('RevisionGrade does not invent author credentials');
    expect(bioPage).toContain('Upload Source');
    expect(bioPage).toContain('extractAuthorProfileSourceUploadText');
    expect(bioPage).toContain('authorBioInput: authorMaterials');
  });
});
