# RevisionGrade Admin · Site Experience Analytics

This document describes the private `/admin/experience` dashboard and the production setup required for analytics storage.

## Purpose

The Site Experience dashboard is for product and business visibility:

- visitor counts
- sessions
- page views
- bounce rate
- Revise example starts and completions
- evaluation starts
- report views
- top pages
- top clicks
- geography
- recent activity
- CSV export for Excel or Sheets

## Privacy boundary

The analytics system is intentionally product-behavior only.

Do not store:

- manuscript text
- pasted text
- editor contents
- query letter text
- synopsis text
- author bio text
- generated report prose
- private revision prose

Allowed data includes:

- path
- event name
- page title
- click target label
- duration
- anonymous visitor id
- authenticated user id where available
- referrer and UTM campaign parameters
- coarse geography from hosting headers where available

## Production setup

Apply this migration in production Supabase:

```txt
supabase/migrations/20260603020000_site_experience_analytics.sql
```

It creates:

- `public.site_analytics_sessions`
- `public.site_analytics_events`

Both tables have RLS enabled and direct anon/authenticated access revoked. Server routes use the service-role client.

## Admin routes

- `/admin` — Admin Control Center
- `/admin/experience` — Site Experience Analytics
- `/api/admin/analytics/overview` — dashboard JSON
- `/api/admin/analytics/export?kind=events&range=7d` — events CSV
- `/api/admin/analytics/export?kind=sessions&range=7d` — sessions CSV
- `/api/analytics/track` — fail-open tracking intake

## Admin access

Admin access is allowed when either condition is true:

1. Supabase app metadata role is `admin` or `superadmin`.
2. Authenticated email is `tsavobc@hotmail.com`.

## Fail-open behavior

The public site must not break if analytics storage is unavailable. The tracking route returns success/ignored responses when tables are absent or Supabase rejects the write.

The admin dashboard shows an “Analytics storage not ready yet” message when the migration has not been applied.

## Operating doctrine

Use this dashboard to understand whether people are moving from curiosity to product action:

1. landing page view
2. pricing or evaluation interest
3. Revise example engagement
4. evaluation upload or job creation
5. report view
6. Word/PDF download
7. Agent Readiness or Revise continuation

The goal is not vanity telemetry. The goal is to identify friction, abandoned steps, and pages that are not converting serious writers into paid product usage.
