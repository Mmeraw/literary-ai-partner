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
    expect(selectedColumns).not.toContain('author_name');
    expect(selectedColumns).not.toContain('manuscript_title');
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
});
