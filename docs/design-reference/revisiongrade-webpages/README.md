# RevisionGrade webpage design reference bundle

Purpose: static design/reference files for improving revisiongrade.com inside the Next.js app.

Do not deploy these HTML files directly over the production app. Use them as source-of-truth visual/design references and port the structure into the real app routes/components.

## Included pages

- `index.html` — landing page reference
- `revise.html` — Revise page reference
- `pricing.html` — pricing page reference
- `dashboard.html` — dashboard reference
- `resources.html` — resources page reference
- `workbench.html` — workbench reference
- `css/design-tokens.css` — design tokens
- `css/marketing.css` — marketing page CSS
- `css/components.css` — shared component CSS
- `css/dashboard.css` — dashboard CSS
- `css/report.css` — report CSS
- `style.css` — bundled/base CSS

## Suggested implementation task for GitHub/Copilot/Codex

Use the files in `docs/design-reference/revisiongrade-webpages/` as the reference design package. Improve the live Next.js RevisionGrade UI by porting the strongest parts into the actual app routes/components.

Scope boundaries:

1. Do not change evaluation pipeline logic, scoring, gates, worker code, Supabase migrations, or runtime configuration.
2. Do not paste static HTML directly into production routes without adapting it to the existing Next.js/React/component architecture.
3. Preserve existing auth/deployment protection behavior.
4. Keep changes focused on public webpage/dashboard UI only.
5. Open a PR with before/after screenshots, route list, and build/test evidence.

Acceptance criteria:

- Landing, pricing, revise/workbench, dashboard, and resources routes use a coherent RevisionGrade visual language.
- Shared tokens/components are centralized rather than duplicated page-by-page.
- `npm run build` passes.
- PR body includes screenshots or preview links for changed routes.
