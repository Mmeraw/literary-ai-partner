export {};

const fs = require('fs');
const path = require('path');

describe('watchdog idle rescue lease safety', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const routePath = path.join(repoRoot, 'app/api/workers/watchdog/route.ts');
  const routeSource = fs.readFileSync(routePath, 'utf8');

  test('candidate selection requires a stale pulse and an expired non-null lease', () => {
    expect(routeSource).toContain(".not('worker_pulse_at', 'is', null)");
    expect(routeSource).toContain(".not('lease_until', 'is', null)");
    expect(routeSource).toContain(".lt('worker_pulse_at', pulseCutoff)");
    expect(routeSource).toContain(".lt('lease_until', now)");
  });

  test('mutation repeats liveness predicates and the selected lease token', () => {
    expect(routeSource).toContain(".eq('lease_token', leaseToken)");
    expect(routeSource.match(/\.lt\('worker_pulse_at', pulseCutoff\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(routeSource.match(/\.lt\('lease_until', now\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(routeSource).toContain(".select('id')");
    expect(routeSource).toContain('.maybeSingle()');
  });

  test('rescue clears all claim, lease, heartbeat, and pulse ownership fields', () => {
    for (const field of [
      'claimed_by: null',
      'claimed_at: null',
      'lease_token: null',
      'lease_until: null',
      'last_heartbeat_at: null',
      'last_heartbeat: null',
      'worker_pulse_at: null',
    ]) {
      expect(routeSource).toContain(field);
    }
  });

  test('zero-row compare-and-rescue is treated as a live-worker renewal, not a rescue', () => {
    expect(routeSource).toContain('if (!rescuedRow)');
    expect(routeSource).toContain('lease or pulse was renewed before rescue');
    expect(routeSource).toContain('idleRescued++;');
  });
});
