import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('cross-user access guard contracts', () => {
  test('jobs status route enforces owner match and returns not found for non-owners', () => {
    const source = read('app/api/jobs/[jobId]/route.ts');
    expect(source).toContain('if (job.user_id !== ownerId)');
    expect(source).toContain('{ ok: false, error: "Job not found" }');
  });

  test('report download route enforces user ownership', () => {
    const source = read('app/api/reports/[jobId]/download/route.ts');
    expect(source).toContain('if (job.user_id !== user.id)');
    expect(source).toContain("return NextResponse.json({ error: 'Not found' }, { status: 404 });");
  });

  test('manuscript list/delete routes are user-scoped', () => {
    const source = read('app/api/manuscripts/route.ts');
    expect(source).toContain('.eq("user_id", user.id)');
  });

  test('report shares are owner-scoped before share creation', () => {
    const source = read('app/api/report-shares/route.ts');
    expect(source).toContain('.eq("user_id", actorId)');
    expect(source).toContain('Job not found');
  });

  test('admin costs endpoint requires admin guard', () => {
    const source = read('app/api/admin/costs/route.ts');
    expect(source).toContain('requireAdmin');
  });
});
