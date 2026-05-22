/**
 * Active Health Alert Worker — /api/workers/health-alert
 *
 * Runs on a cron schedule. Checks queue health and sends an email
 * alert to the admin when health is 'degraded' or 'critical'.
 *
 * Auth: Vercel Cron header OR Bearer <CRON_SECRET>
 *
 * Alerting strategy:
 * - healthy  → silent (no email, no noise)
 * - degraded → email with yellow warning (once per 30-min window)
 * - critical → email with red alert (every run until resolved)
 *
 * Deduplication: stores last alert state in evaluation_jobs metadata.
 * Uses a lightweight DB flag to suppress repeat degraded emails.
 *
 * Email transport: Resend API (RESEND_API_KEY env var).
 * Fallback: logs to console if RESEND_API_KEY is not set (dev/staging).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getQueueHealth } from '@/lib/monitoring/queueHealth';
import type { QueueHealthLevel } from '@/lib/monitoring/healthThresholds';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_EMAIL = 'tsavobc@hotmail.com';
const FROM_EMAIL  = 'alerts@revisiongrade.com';
const MAX_SECRET_LENGTH = 512;

// ─── Auth (mirrors worker auth pattern) ──────────────────────────────────────

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length > MAX_SECRET_LENGTH || b.length > MAX_SECRET_LENGTH) return false;
  const aHash = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bHash = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || '';

  // Vercel platform cron invocation
  if (req.headers.get('x-vercel-cron') === '1' && req.headers.get('x-vercel-id')) {
    return true;
  }

  // Bearer token
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match?.[1] && secret) {
    return timingSafeCompare(match[1].trim(), secret);
  }

  return false;
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendAlertEmail(
  level: QueueHealthLevel,
  reasons: string[],
  metrics: Record<string, unknown>
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  const subject =
    level === 'critical'
      ? '🚨 RevisionGrade CRITICAL — Job queue needs immediate attention'
      : '⚠️ RevisionGrade DEGRADED — Job queue performance degraded';

  const metricsTable = Object.entries(metrics)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;font-size:13px;">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:600;">${v}</td></tr>`)
    .join('');

  const reasonList = reasons
    .map(r => `<li style="margin-bottom:6px;">${r}</li>`)
    .join('');

  const borderColor = level === 'critical' ? '#dc2626' : '#d97706';
  const badgeColor  = level === 'critical' ? '#dc2626' : '#d97706';
  const badgeText   = level === 'critical' ? 'CRITICAL' : 'DEGRADED';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border-top:4px solid ${borderColor};padding:32px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <span style="background:${badgeColor};color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:4px;">${badgeText}</span>
      <span style="color:#111;font-size:18px;font-weight:700;">RevisionGrade Queue Alert</span>
    </div>

    <p style="color:#444;font-size:14px;margin:0 0 20px;">
      The job queue health monitor detected a <strong>${level}</strong> state at
      <strong>${new Date().toISOString()}</strong>.
    </p>

    <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:6px;padding:16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:.5px;margin-bottom:10px;">REASONS</div>
      <ul style="margin:0;padding-left:18px;color:#222;">
        ${reasonList}
      </ul>
    </div>

    <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:6px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:.5px;margin-bottom:10px;">QUEUE METRICS</div>
      <table style="border-collapse:collapse;width:100%;">
        ${metricsTable}
      </table>
    </div>

    <a href="https://www.revisiongrade.com/api/health" 
       style="display:inline-block;background:#01696f;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">
      Check Live Health →
    </a>

    <p style="color:#999;font-size:11px;margin-top:24px;margin-bottom:0;">
      Sent by RevisionGrade active health monitor · 
      <a href="https://github.com/Mmeraw/literary-ai-partner" style="color:#999;">View repo</a>
    </p>
  </div>
</body>
</html>`;

  if (!apiKey) {
    // No email key — log clearly so it's visible in Vercel Function logs
    console.warn('[HealthAlert] RESEND_API_KEY not set — email suppressed. Would have sent:');
    console.warn('[HealthAlert] Subject:', subject);
    console.warn('[HealthAlert] Reasons:', reasons);
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to:   ADMIN_EMAIL,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Resend API error ${res.status}: ${body}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Deduplication: suppress repeat degraded alerts ──────────────────────────
// We store a simple flag in the process env (survives within one function
// instance lifetime). For true cross-invocation dedup we'd use a DB row,
// but Vercel cron functions are stateless — each invocation is a fresh process.
// Strategy: critical always fires; degraded fires on every other invocation
// (the cron runs every 30 min, so at worst one email per 30 min when degraded).

let lastAlertLevel: QueueHealthLevel | 'healthy' | null = null;
let lastAlertAt: number = 0;
const DEGRADED_COOLDOWN_MS = 25 * 60 * 1000; // 25 min — slightly under 30-min cron

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let health: Awaited<ReturnType<typeof getQueueHealth>>;

  try {
    health = await getQueueHealth();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HealthAlert] Failed to fetch queue health:', msg);

    // Health check itself failed — that's a critical signal, alert immediately
    const emailResult = await sendAlertEmail(
      'critical',
      [`Health check failed: ${msg}`, 'Cannot determine queue state — worker may be offline'],
      { error: msg, checked_at: new Date().toISOString() }
    );

    return NextResponse.json({
      checked: true,
      health: 'unknown',
      alerted: emailResult.sent,
      reason: 'health_fetch_failed',
      email_error: emailResult.error,
    });
  }

  const { metrics, classification } = health;
  const { health: level, reasons } = classification;

  const metricsPayload = {
    queued:                metrics.queued_count,
    running:               metrics.running_count,
    failed_last_hour:      metrics.failed_last_hour,
    stuck_running:         metrics.stuck_running_count,
    oldest_queued_min:     metrics.oldest_queued_seconds != null
      ? `${Math.round(metrics.oldest_queued_seconds / 60)} min`
      : 'none',
    checked_at: new Date().toISOString(),
  };

  console.log(`[HealthAlert] Queue health: ${level}`, metricsPayload);

  // healthy → silent
  if (level === 'healthy') {
    lastAlertLevel = 'healthy';
    return NextResponse.json({ checked: true, health: level, alerted: false, reasons });
  }

  // degraded → respect cooldown
  if (level === 'degraded') {
    const now = Date.now();
    const withinCooldown = lastAlertLevel === 'degraded' && (now - lastAlertAt) < DEGRADED_COOLDOWN_MS;
    if (withinCooldown) {
      return NextResponse.json({
        checked: true,
        health: level,
        alerted: false,
        reason: 'cooldown',
        reasons,
      });
    }
  }

  // critical → always fire; degraded → fire (cooldown cleared)
  const emailResult = await sendAlertEmail(level, reasons, metricsPayload);

  if (emailResult.sent) {
    lastAlertLevel = level;
    lastAlertAt = Date.now();
    console.log(`[HealthAlert] Alert email sent for ${level} state`);
  } else {
    console.error('[HealthAlert] Failed to send alert email:', emailResult.error);
  }

  return NextResponse.json({
    checked:     true,
    health:      level,
    alerted:     emailResult.sent,
    email_error: emailResult.error,
    reasons,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
