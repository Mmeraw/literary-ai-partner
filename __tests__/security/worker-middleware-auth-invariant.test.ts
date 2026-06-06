import fs from 'fs';
import path from 'path';

describe('worker middleware auth invariants', () => {
  const middlewareSource = () =>
    fs.readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8');

  test('middleware allows worker cron and bearer requests to reach route-local auth', () => {
    const src = middlewareSource();

    expect(src).toContain("matchesPath(request.nextUrl.pathname, '/api/workers')");
    expect(src).toContain('allowRouteLocalWorkerAuth');
    expect(src).toContain('isVercelCronInvocation(request)');
    expect(src).toContain('hasBearerAuthorization(request)');

    const workerGateIndex = src.indexOf("matchesPath(request.nextUrl.pathname, '/api/workers')");
    const routeLocalBypassIndex = src.indexOf('allowRouteLocalWorkerAuth', workerGateIndex);
    const workerSecretRequiredIndex = src.indexOf('WORKER_SECRET_REQUIRED', workerGateIndex);

    expect(workerGateIndex).toBeGreaterThanOrEqual(0);
    expect(routeLocalBypassIndex).toBeGreaterThan(workerGateIndex);
    expect(workerSecretRequiredIndex).toBeGreaterThan(routeLocalBypassIndex);
  });

  test('middleware documents why x-worker-secret cannot be mandatory for cron', () => {
    const src = middlewareSource();

    expect(src).toContain('Vercel Cron cannot send custom x-worker-secret headers');
    expect(src).toContain('Authorization: Bearer $CRON_SECRET');
    expect(src).toContain('jobs can remain queued with no claim, lease, or heartbeat');
  });
});