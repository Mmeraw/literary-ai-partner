# Decommissioning Registry

## DECOMMISSIONING CERTIFICATE: Silo Prototype Retirement — Phase 1 Archive Gate

- **Date:** 2026-05-23
- **Status:** Archive-only; purge is not authorized.
- **Trigger:** PR #654 migrated public routing ownership from static `public/marketing-export` rewrites to the canonical Next.js `app/` router shell.
- **Canonical Runtime Ownership:**
  - `app/page.tsx`
  - `app/revise/page.tsx`
  - `app/resources/page.tsx`
  - `app/reliability/page.tsx`
  - `app/methodology/page.tsx`
  - `app/dashboard/page.tsx`
  - `app/workbench/page.tsx`

### Runtime disposition

The legacy static marketing-export assets are no longer canonical production route owners after PR #654. They remain reference material only until parity risk is closed.

### Evidence snapshot

- Repository search found no `ChartEngine` symbol on `main` during the parity check.
- Repository search found no `useInlineEdit` symbol on `main` during the parity check.
- `app/dashboard/page.tsx` is production-routed and componentized through `DashboardHeader`, `KpiCard`, `EvaluationHistoryTable`, `EmptyState`, `getDashboardEvaluations`, and `computeDashboardKpis`.
- `app/workbench/page.tsx` is a client route with local `useState`, typed `Opportunity`, typed `Decision`, typed `SessionEntry`, static `OPPORTUNITIES`, and local decision stamping.
- The legacy revise script still contains substantive queue/demo behavior and must remain available as parity reference until Workbench migration is complete.

### Legacy assets currently treated as reference-only

- `public/marketing-export/main/index.html`
- `public/marketing-export/main/landing.js`
- `public/marketing-export/revise/index.html`
- `public/marketing-export/revise/script.js`
- Associated CSS/assets under `public/marketing-export/`

### Referenced artifacts not proven present on current `main`

The following prototype-era filenames were referenced in planning material but were not proven present as root-level files during the parity check:

- `dashboard.html`
- `workbench.html`
- `revise-workbench.html`
- `update_css.py`
- root-level `style.css`, `marketing.css`, `dashboard.css`, `report.css`

If copies exist in another branch, local workspace, uploaded bundle, or archive directory, they remain subject to the same parity gate before purge.

### Open parity risk

Purge is blocked until the following Workbench behaviors are either verified in `app/` / `components/` / `lib/` or explicitly waived in a follow-up certificate:

- Inline edit behavior
- `onBlur` persistence
- `Escape` / ESC rejection behavior
- Keyboard event handling
- `localStorage` or `sessionStorage` persistence
- Accept / reject / keep / custom decision state-machine behavior
- Revision diff or custom revision wrapping behavior
- Any Chart.js or dashboard visualization behavior not represented by current dashboard components

### Required audit command before purge

```bash
grep -RniE "Chart|new Chart|chart.js|addEventListener|onclick|localStorage|sessionStorage|contenteditable|onblur|blur|Escape|keydown|custom-wrap|accept|reject|defer|diff|revision" public/marketing-export docs archive . 2>/dev/null
```

Meaningful hits must be compared against:

```bash
app/dashboard
components/dashboard
lib/dashboard
app/workbench
components
lib/hooks
```

### Purge authorization

**Blocked.**

A later PR may permanently delete the legacy silo only after the parity report demonstrates that no mission-critical dashboard/workbench interaction logic remains trapped in static HTML/JS/CSS assets.

### Authorized next action

Archive or retain legacy assets as reference-only material. Do not delete them as part of this certificate.
