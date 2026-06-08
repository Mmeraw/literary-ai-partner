import fs from 'node:fs';
import path from 'node:path';

describe('evaluate job page query contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/evaluate/[jobId]/page.tsx'),
    'utf8',
  );

  test('loads report status by job id without optional intake columns', () => {
    const jobSelectMatch = source.match(/\.from\("evaluation_jobs"\)\s*\.select\("([^"]+)"\)/);
    expect(jobSelectMatch).not.toBeNull();

    const selectedColumns = jobSelectMatch?.[1] ?? '';
    expect(selectedColumns).toContain('id');
    expect(selectedColumns).toContain('manuscript_id');
    expect(selectedColumns).toContain('status');
    expect(selectedColumns).toContain('last_error');
    expect(selectedColumns).toContain('failure_code');
    expect(selectedColumns).not.toContain('failure_envelope');
    expect(selectedColumns).not.toContain('author_name');
    expect(selectedColumns).not.toContain('manuscript_title');
  });

  test('uses manuscript ownership before stale job user ownership for dashboard-visible jobs', () => {
    expect(source).toContain('const manuscriptOwnerUserId');
    expect(source).toContain('const directJobUserId');
    expect(source).toContain('const ownerUserId = manuscriptOwnerUserId ?? directJobUserId');
  });

  test('uses manuscript text for a 200-word submission preview fallback', () => {
    expect(source).toContain('import { getManuscriptText } from "@/lib/manuscripts/chunks"');
    expect(source).toContain('firstWords(await getManuscriptText(manuscriptId as number), 200)');
    expect(source).toContain('Submission Preview');
  });

  test('renders optional author/project metadata without making it required for access', () => {
    expect(source).toContain('submitted_author_name');
    expect(source).toContain('submitted_project_title');
    expect(source).toContain('Author Name');
    expect(source).toContain('Project Title');
    expect(source).toContain('Not provided');
  });

  test('unavailable state uses an active no-cache reload control instead of a same-route link', () => {
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain('export const revalidate = 0');
    expect(source).toContain('EvaluationUnavailableReloadButton');
    expect(source).not.toContain('href={`/evaluate/${jobId}`}');
  });

  test('failed evaluations render customer-safe QA details instead of internal pipeline details', () => {
    expect(source).toContain('Evaluation Details');
    expect(source).toContain('Evaluation needs review');
    expect(source).toContain('internal quality assurance and completeness checks');
    expect(source).toContain('Quality and completeness review needed');
    expect(source).toContain('RevisionGrade is investigating');
    expect(source).not.toContain('<dt className="font-semibold text-stone-950">Phase</dt>');
    expect(source).not.toContain('<dt className="font-semibold text-stone-950">Failure Code</dt>');
    expect(source).not.toContain('Technical Error Detail');
    expect(source).not.toContain('Failure Envelope');
  });
});
