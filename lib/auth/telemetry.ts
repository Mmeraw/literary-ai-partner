import { appendUserActivity } from '@/lib/activity/userActivity'

const METRICS_ENABLED =
  process.env.METRICS_ENABLED === 'true' || process.env.NEXT_PUBLIC_METRICS_ENABLED === 'true'

type Tags = Record<string, string>

function safeMetricEmit(event: string, tags?: Tags): void {
  if (!METRICS_ENABLED) return

  try {
    console.log('AuthMetric', {
      event,
      tags,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Passive observability only: never throw from telemetry.
  }
}

export function trackAuthCheck(result: 'authenticated' | 'anonymous' | 'error'): void {
  safeMetricEmit('auth.middleware.check', { result })
}

export function trackAuthRedirect(reason: 'login_required' | 'already_authenticated'): void {
  safeMetricEmit('auth.middleware.redirect', { reason })
}

export function trackAuthBypass(reason: 'ci_test_missing_env'): void {
  safeMetricEmit('auth.middleware.bypass', { reason })
}

export type ClientAuthFlow = 'login' | 'signup' | 'oauth'
export type ClientAuthOutcome =
  | 'attempt'
  | 'blocked_backoff'
  | 'validation_failed'
  | 'failed'
  | 'redirect_started'
  | 'succeeded'
  | 'unexpected_error'

export function trackClientAuthEvent(
  flow: ClientAuthFlow,
  outcome: ClientAuthOutcome,
  tags?: Tags,
): void {
  safeMetricEmit('auth.client.event', {
    flow,
    outcome,
    ...(tags ?? {}),
  })

  if (typeof window !== 'undefined') {
    let detail: string | undefined
    if (tags) {
      try {
        detail = JSON.stringify(tags)
      } catch {
        detail = 'event_tags_unserializable'
      }
    }

    appendUserActivity({
      event: `auth.${flow}.${outcome}`,
      detail,
      route: window.location.pathname,
      ...(window.location.pathname ? { href: window.location.pathname, linkLabel: 'Open page' } : {}),
    })
  }
}
