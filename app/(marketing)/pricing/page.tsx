import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pricing — RevisionGrade™</title>
  <meta name="description" content="Plans metered by total words analyzed. Unlimited evaluations within your word budget. Free sample — no credit card required." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <link href="https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap" rel="stylesheet" />
    <style>/* ============================================================
   RevisionGrade™ — Design Tokens
   Single source of truth for all CSS custom properties.
   Import this file first in every stylesheet.
   ============================================================ */

/* ── RESET ───────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }

/* ── ROOT TOKENS ─────────────────────────────────────────── */
:root {

  /* ── Brand palette ────────────────────────────────────── */
  --ink:    #0D0A05;   /* obsidian black — page background          */
  --ink2:   #1A1208;   /* surface raised — cards, nav bg            */
  --ink3:   #261A0A;   /* surface featured — highlighted cards      */
  --cream:  #F5EFE0;   /* bone cream — primary text                 */
  --cream2: #C8BEA8;   /* body text, secondary labels               */
  --gold:   #C8A96E;   /* tarnished gold — accents, CTAs            */
  --red:    #7A2B1A;   /* oxblood — MUST tier, danger accents        */
  --dim:    #6B6560;   /* muted / disabled / placeholder            */

  /* ── Workbench surface variant ────────────────────────── */
  /* Used in dashboard, repair queue, report reader.         */
  /* Slightly lighter than marketing pages for readability.  */
  --surface:          #12100B;   /* workbench page bg                  */
  --surface-raised:   #1C160E;   /* panel / card on workbench          */
  --surface-elevated: #241C10;   /* dropdown, modal, popover           */
  --surface-readable: #F8F1E4;   /* light reading surface (report text)*/
  --surface-readable-dim: #EAE3D4; /* secondary on readable surface    */

  /* ── Semantic status colors ───────────────────────────── */
  --success: #7FA36B;   /* passed gate, complete, accepted           */
  --warning: #C8A96E;   /* needs review, SHOULD tier (same as gold)  */
  --danger:  #A7472A;   /* failed gate, rejected, blocked            */
  --info:    #7DD3D8;   /* informational, code types, context        */
  --muted:   #6B6560;   /* disabled state, placeholder (= --dim)     */

  /* Token aliases for semantic use in app UI */
  --status-complete:  var(--success);
  --status-warning:   var(--warning);
  --status-blocked:   var(--danger);
  --status-info:      var(--info);
  --status-must:      #C0473A;   /* brighter than --red for small text */
  --status-should:    var(--gold);
  --status-could:     var(--dim);

  /* ── Typography ───────────────────────────────────────── */
  --font-serif: 'Instrument Serif', Georgia, Cambria, serif;
  --font-body:  'Switzer', 'Inter', system-ui, sans-serif;
  --font-mono:  'Switzer', 'Courier New', monospace;

  /* ── Layout ───────────────────────────────────────────── */
  --max-w:      1040px;
  --max-w-wide: 1240px;
  --px:         clamp(1.25rem, 4vw, 2.5rem);

  /* ── Borders ──────────────────────────────────────────── */
  --border:          rgba(200, 190, 168, 0.10);
  --border-subtle:   rgba(200, 190, 168, 0.06);
  --border-strong:   rgba(200, 190, 168, 0.20);
  --border-gold:     rgba(200, 169, 110, 0.25);
  --border-gold-strong: rgba(200, 169, 110, 0.55);
  --border-red:      rgba(122, 43, 26, 0.40);
  --border-success:  rgba(127, 163, 107, 0.30);
  --border-danger:   rgba(167, 71, 42, 0.35);
  --border-info:     rgba(125, 211, 216, 0.25);

  /* ── Radius ───────────────────────────────────────────── */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-pill: 9999px;
  /* Note: default RevisionGrade aesthetic is sharp (0px). Use radius
     sparingly — chips, badges, avatars, status pills only. */

  /* ── Shadows ──────────────────────────────────────────── */
  --shadow-soft:   0 20px 60px rgba(0, 0, 0, 0.28);
  --shadow-hard:   0 8px 24px  rgba(0, 0, 0, 0.40);
  --shadow-subtle: 0 2px 8px   rgba(0, 0, 0, 0.18);
  --shadow-gold:   0 0 0 1px rgba(200, 169, 110, 0.35), 0 8px 32px rgba(200, 169, 110, 0.08);
  --shadow-danger: 0 0 0 1px rgba(167, 71, 42, 0.35);

  /* ── Z-index layers ───────────────────────────────────── */
  --z-base:    0;
  --z-raised:  1;
  --z-dropdown: 50;
  --z-nav:     100;
  --z-modal:   200;
  --z-toast:   300;

  /* ── Transitions ──────────────────────────────────────── */
  --transition-fast: 0.12s ease;
  --transition-base: 0.18s ease;
  --transition-slow: 0.35s ease;
}

/* ── BASE ────────────────────────────────────────────────── */
a { color: inherit; text-decoration: none; }
em { font-style: italic; }

/* ── TYPOGRAPHY UTILITIES ────────────────────────────────── */
.serif { font-family: var(--font-serif); }
.mono  { font-family: var(--font-mono); letter-spacing: 0.01em; }

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: -0.02em;
  color: var(--cream);
}

.display-hero {
  font-size: clamp(3.5rem, 9vw, 8rem);
  line-height: 0.97;
  letter-spacing: -0.03em;
}
.display-xl {
  font-size: clamp(2.75rem, 6vw, 5.5rem);
  line-height: 1.0;
  letter-spacing: -0.025em;
}
.display-lg {
  font-size: clamp(2rem, 4.5vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.display-md {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  line-height: 1.1;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--cream2);
}
.eyebrow-gold { color: var(--gold); }

.body-lg  { font-size: 1.1rem; line-height: 1.65; color: var(--cream2); }
.body-sm  { font-size: 0.875rem; line-height: 1.65; color: var(--cream2); }
.body-xs  { font-size: 0.8rem; line-height: 1.6; color: var(--dim); }
.mono-xs  { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; }

/* Color utilities */
.gold    { color: var(--gold); }
.red     { color: var(--red); }
.cream   { color: var(--cream); }
.dim     { color: var(--dim); }
.success { color: var(--success); }
.warning { color: var(--warning); }
.danger  { color: var(--danger); }
.info    { color: var(--info); }

/* ── LAYOUT UTILITIES ────────────────────────────────────── */
.container      { max-width: var(--max-w);      margin-inline: auto; padding-inline: var(--px); }
.container-wide { max-width: var(--max-w-wide); margin-inline: auto; padding-inline: var(--px); }
.section        { padding-block: clamp(4rem, 8vw, 7rem); }
.section-sm     { padding-block: clamp(2.5rem, 5vw, 4rem); }
.border-top     { border-top: 1px solid var(--border); }
.divider        { border: none; border-top: 1px solid var(--border); margin: 0; }

.grid-2    { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
.grid-3    { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.grid-stat { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; }

@media (max-width: 768px) {
  .grid-2, .grid-3, .grid-stat { grid-template-columns: 1fr; }
  .hide-mobile { display: none; }
}

/* ── SCROLL ANIMATION ────────────────────────────────────── */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible { opacity: 1; transform: none; }
</style>
    <style>/* ============================================================
   RevisionGrade™ — Marketing CSS
   Font loading handled here (fallback for non-HTML entry points) */
@import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600,700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

/* ============================================================
   RevisionGrade™ — Marketing CSS (continued)
   Landing, pricing, resources, and public-facing brand pages.
   Imports: design-tokens.css (always first)
   ============================================================ */

/* ── PAGE BASE ───────────────────────────────────────────── */
body {
  background: var(--ink);
  color: var(--cream);
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.6;
}

/* ── NAV ─────────────────────────────────────────────────── */
.nav {
  position: sticky; top: 0; z-index: var(--z-nav);
  background: rgba(13, 10, 5, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  transition: box-shadow var(--transition-base);
}
.nav-inner {
  max-width: var(--max-w);
  margin-inline: auto;
  padding-inline: var(--px);
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}
.nav-logo {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  white-space: nowrap;
}
.nav-links {
  display: flex; align-items: center; gap: 2rem; list-style: none;
}
.nav-links a {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  transition: color var(--transition-fast);
}
.nav-links a:hover { color: var(--cream2); }
.nav-links a.active { color: var(--cream); }
.nav-signin {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--cream2);
  border: 1px solid var(--border);
  padding: 0.45rem 1.1rem;
  transition: border-color var(--transition-fast), color var(--transition-fast);
  white-space: nowrap;
}
.nav-signin:hover { border-color: var(--cream2); color: var(--cream); }
.nav-mobile-toggle {
  display: none;
  background: none; border: none; color: var(--cream2);
  cursor: pointer; padding: 0.25rem;
}
@media (max-width: 768px) {
  .nav-links { display: none; }
  .nav-links.open {
    display: flex; flex-direction: column;
    position: absolute; top: 60px; left: 0; right: 0;
    background: rgba(13,10,5,0.98);
    padding: 1.5rem var(--px);
    border-bottom: 1px solid var(--border);
    gap: 1.25rem; align-items: flex-start;
  }
  .nav-mobile-toggle { display: block; }
}

/* ── BUTTONS ─────────────────────────────────────────────── */
.btn {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 1rem 2.25rem;
  border: 1px solid;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
}
.btn-gold  { border-color: var(--gold); color: var(--gold); background: transparent; }
.btn-gold:hover { background: var(--gold); color: var(--ink); }
.btn-cream { border-color: var(--cream); color: var(--cream); background: transparent; }
.btn-cream:hover { border-color: var(--cream); color: var(--cream); opacity: 0.75; }
.btn-cream-fill { border-color: var(--cream); color: var(--ink); background: var(--cream); }
.btn-cream-fill:hover { background: transparent; color: var(--cream); }
.btn-ghost { border-color: rgba(200,190,168,0.25); color: var(--cream2); }
.btn-ghost:hover { border-color: var(--cream2); color: var(--cream); }
.btn-group { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.btn-group-center { justify-content: center; }

/* ── CARDS ───────────────────────────────────────────────── */
.card          { border: 1px solid var(--border); background: var(--ink); padding: 2rem; }
.card-gold     { border-color: var(--border-gold); }
.card-surface  { background: var(--ink2); }

/* ── STAT BOX ROW ────────────────────────────────────────── */
.stat-boxes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  border: 1px solid var(--border);
  overflow: hidden;
}
.stat-box { background: var(--ink2); padding: 1.5rem 1.75rem; }
.stat-box + .stat-box { border-left: 1px solid var(--border); }
@media (max-width: 768px) {
  .stat-boxes { grid-template-columns: 1fr; }
  .stat-box + .stat-box { border-left: none; border-top: 1px solid var(--border); }
}

/* ── BG VARIANTS ─────────────────────────────────────────── */
.bg-ink2 { background: var(--ink2); }
.bg-ink3 { background: var(--ink3); }

/* ── PIPELINE STEPS ──────────────────────────────────────── */
.pipeline-step {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  gap: 1.5rem;
  padding: 2rem 0;
  border-top: 1px solid var(--border);
  align-items: start;
}
@media (max-width: 768px) {
  .pipeline-step { grid-template-columns: 1fr; gap: 0.75rem; }
}

/* ── DOCTRINE TRIO ───────────────────────────────────────── */
.doctrine-item { border-left: 2px solid var(--border-red); padding-left: 1.5rem; }

/* ── PRICING CARDS ───────────────────────────────────────── */
.price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
@media (max-width: 900px) { .price-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 580px) { .price-grid { grid-template-columns: 1fr; } }

.price-card {
  position: relative;
  border: 1px solid var(--border);
  background: var(--ink);
  padding: 1.75rem;
  display: flex; flex-direction: column;
  transition: box-shadow var(--transition-base);
}
.price-card:hover { box-shadow: var(--shadow-soft); }
.price-card.featured {
  border-color: var(--border-gold-strong);
  background: var(--ink3);
  box-shadow: var(--shadow-gold);
}
.price-card .recommended-badge {
  position: absolute;
  top: -0.75rem; left: 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  background: var(--gold);
  color: var(--ink);
  padding: 0.2rem 0.6rem;
}
.price-amount  { font-size: 2.5rem; font-family: var(--font-serif); color: var(--cream); line-height: 1; }
.price-note    { font-family: var(--font-mono); font-size: 0.68rem; color: var(--dim); margin-left: 0.4rem; }
.price-cap     { font-family: var(--font-mono); font-size: 0.68rem; color: var(--gold); margin-top: 0.3rem; }
.price-tagline { font-size: 0.875rem; font-style: italic; color: var(--cream2); margin-top: 0.6rem; }
.price-features { list-style: none; flex: 1; margin: 1.25rem 0; }
.price-features li {
  display: flex; gap: 0.6rem;
  font-size: 0.8rem; color: var(--cream2); line-height: 1.5;
  padding: 0.35rem 0; border-bottom: 1px solid var(--border-subtle);
}
.price-features li span { color: var(--gold); flex-shrink: 0; }

/* ── WORD BUDGET TABLE ───────────────────────────────────── */
.budget-row {
  display: flex; justify-content: space-between;
  padding: 0.75rem 0; border-bottom: 1px solid var(--border);
  font-size: 0.875rem; color: var(--cream2);
}
.budget-row .val { font-family: var(--font-mono); color: var(--cream); }
.budget-row.total { font-family: var(--font-mono); color: var(--cream); border-bottom: none; padding-top: 1rem; }
.budget-row.total .val { color: var(--gold); }

/* ── FAQ ─────────────────────────────────────────────────── */
.faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem 4rem; }
@media (max-width: 768px) { .faq-grid { grid-template-columns: 1fr; } }

/* ── LAYER CARDS (architecture diagram) ─────────────────── */
.layer-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 0; border: 1px solid var(--border); overflow: hidden;
}
.layer-card {
  padding: 2rem 1.75rem;
  border-right: 1px solid var(--border);
  position: relative;
}
.layer-card:last-child { border-right: none; }
.layer-card.active { background: var(--ink2); }
.you-are-here {
  display: inline-block;
  font-family: var(--font-mono); font-size: 0.6rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  background: var(--red); color: var(--cream);
  padding: 0.15rem 0.5rem; margin-bottom: 0.75rem;
}
@media (max-width: 768px) {
  .layer-grid { grid-template-columns: 1fr; }
  .layer-card { border-right: none; border-bottom: 1px solid var(--border); }
  .layer-card:last-child { border-bottom: none; }
}

/* ── FOOTER ──────────────────────────────────────────────── */
.footer { border-top: 1px solid var(--border); background: var(--ink); }
.footer-inner {
  max-width: var(--max-w); margin-inline: auto;
  padding-inline: var(--px); padding-block: 3rem;
}
.footer-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 2rem; margin-bottom: 3rem;
}
@media (max-width: 768px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
.footer-col-title {
  font-family: var(--font-mono); font-size: 0.68rem;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--cream2); margin-bottom: 1rem;
}
.footer-links { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.footer-links a { font-family: var(--font-mono); font-size: 0.72rem; color: var(--dim); transition: color var(--transition-fast); }
.footer-links a:hover { color: var(--cream2); }
.footer-bottom {
  border-top: 1px solid var(--border); padding-top: 1.5rem;
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.75rem;
}
.footer-bottom p { font-family: var(--font-mono); font-size: 0.68rem; color: var(--dim); }
</style>
    <style>/* ============================================================
   RevisionGrade™ — Shared Components CSS
   Product UI primitives shared across marketing + app surfaces.
   Imports: design-tokens.css (always first)
   ============================================================ */

/* ── CHIP / TAG ──────────────────────────────────────────── */
.chip {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border: 1px solid var(--border);
  padding: 0.25rem 0.625rem;
  color: var(--cream2);
  border-radius: var(--radius-sm);
}
.chip-gold   { border-color: var(--border-gold);    color: var(--gold);    }
.chip-danger { border-color: var(--border-danger);  color: var(--danger);  }
.chip-success{ border-color: var(--border-success); color: var(--success); }
.chip-info   { border-color: var(--border-info);    color: var(--info);    }

/* ── STATUS PILLS ────────────────────────────────────────── */
/* Filled pill for job states, queue health, gate outcomes */
.status-pill {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-family: var(--font-mono); font-size: 0.62rem;
  letter-spacing: 0.12em; text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
.status-pill::before {
  content: ''; display: inline-block; width: 5px; height: 5px;
  border-radius: 50%; background: currentColor; flex-shrink: 0;
}
.pill-complete { background: rgba(127,163,107,0.12); color: var(--success); }
.pill-warning  { background: rgba(200,169,110,0.12); color: var(--warning); }
.pill-blocked  { background: rgba(167, 71, 42,0.14); color: var(--danger);  }
.pill-info     { background: rgba(125,211,216,0.12); color: var(--info);    }
.pill-muted    { background: rgba(107,101, 96,0.12); color: var(--muted);   }

/* ── TIER LABELS ─────────────────────────────────────────── */
/* MUST / SHOULD / COULD — used in queue and report          */
.tier-must   { color: var(--status-must);   font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap; }
.tier-should { color: var(--status-should); font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap; }
.tier-could  { color: var(--status-could);  font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap; }

/* ── CODE BLOCK ──────────────────────────────────────────── */
.code-block {
  font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.65;
  background: var(--ink); border: 1px solid var(--border);
  padding: 1.5rem; overflow-x: auto; color: var(--cream2);
  white-space: pre;
}
.code-keyword { color: var(--gold); }
.code-type    { color: var(--info); }
.code-string  { color: var(--success); }
.code-comment { color: var(--dim); font-style: italic; }

.highlight-code {
  background: var(--ink2); color: var(--cream);
  padding: 0.1rem 0.4rem;
  font-family: var(--font-mono); font-size: 0.9em;
}

/* ── METRIC BARS ─────────────────────────────────────────── */
.metric-row { margin-bottom: 1.25rem; }
.metric-header { display: flex; justify-content: space-between; margin-bottom: 0.4rem; }
.metric-track { height: 2px; background: rgba(200,190,168,0.10); width: 100%; border-radius: 1px; }
.metric-fill  { height: 2px; background: var(--gold); transition: width 0.6s ease; border-radius: 1px; }
.metric-fill.success { background: var(--success); }
.metric-fill.danger  { background: var(--danger); }

/* ── FILTER TABS ─────────────────────────────────────────── */
.filter-tabs { display: flex; gap: 0; margin-bottom: 1rem; }
.filter-tab {
  font-family: var(--font-mono); font-size: 0.62rem;
  letter-spacing: 0.14em; text-transform: uppercase;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border); border-right: none;
  color: var(--dim); background: transparent;
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.filter-tab:last-child { border-right: 1px solid var(--border); }
.filter-tab.active { color: var(--cream); background: var(--surface-raised); }
.filter-tab:hover:not(.active) { color: var(--cream2); }

/* ── GOVERNANCE GUARANTEE CARDS ──────────────────────────── */
.gov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-top: 2.5rem; }
@media (max-width: 768px) { .gov-grid { grid-template-columns: 1fr; } }
.gov-card { border: 1px solid var(--border); background: var(--surface-raised); padding: 1.5rem; }
.gov-card-code {
  font-family: var(--font-mono); font-size: 0.68rem;
  letter-spacing: 0.1em; color: var(--gold); margin-bottom: 0.5rem;
}

/* ── VOICE GUARDRAIL PANEL ───────────────────────────────── */
.voice-panel { border: 1px solid var(--border-gold); background: var(--surface-raised); padding: 2rem; }
.voice-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 600px) { .voice-cols { grid-template-columns: 1fr; } }
.voice-gate {
  font-family: var(--font-mono); font-size: 0.7rem; color: var(--gold);
  border: 1px solid rgba(200,169,110,0.15);
  background: var(--surface-raised); padding: 0.7rem 1rem;
}

/* ── DREAM REPORT ────────────────────────────────────────── */
.dream-report {
  border: 1px solid var(--border); background: var(--surface);
  padding: 2rem; font-family: var(--font-mono); font-size: 0.78rem;
}
.dream-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 1.5rem; margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}
.dream-score { text-align: right; }
.dream-criteria { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 2rem; margin-bottom: 1.5rem; }
.dream-criterion {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.4rem 0; border-bottom: 1px solid var(--border-subtle);
}
@media (max-width: 600px) { .dream-criteria { grid-template-columns: 1fr; } }

/* Criterion outcome coloring */
.dream-criterion .pass { color: var(--success); }
.dream-criterion .fail { color: var(--danger);  }
.dream-criterion .warn { color: var(--warning); }
</style>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230D0A05'/><text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-size='18' fill='%23C8A96E'>R</text></svg>" />
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo">RevisionGrade™</a>
    <ul class="nav-links" id="nav-links">
      <li><a href="index.html">Landing</a></li>
      <li><a href="revise.html">Revise</a></li>
      <li><a href="pricing.html" class="active">Pricing</a></li>
      <li><a href="resources.html">Resources</a></li>
      <li><a href="dashboard.html">Dashboard</a></li>
      <li><a href="workbench.html">Workbench</a></li>
    </ul>
    <a href="#" class="nav-signin">Sign In</a>
    <button class="nav-mobile-toggle" onclick="document.getElementById('nav-links').classList.toggle('open')" aria-label="Menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect y="4" width="20" height="1.5" fill="currentColor"/><rect y="9.25" width="20" height="1.5" fill="currentColor"/><rect y="14.5" width="20" height="1.5" fill="currentColor"/></svg>
    </button>
  </div>
</nav>

<!-- HERO -->
<section style="padding-top:5.5rem; padding-bottom:3rem;">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2rem;">Pricing</p>
    <h1 class="display-xl reveal" style="margin-bottom:1.5rem; max-width:680px; transition-delay:0.08s;">
      The same rigor. <em style="color:var(--gold); font-style:italic;">A fraction</em> of the cost.
    </h1>

    <!-- Mary Cole block -->
    <div class="card card-surface reveal" style="max-width:600px; padding:2rem; margin-bottom:2rem; transition-delay:0.12s;">
      <p class="mono-xs gold" style="margin-bottom:1.25rem;">The real cost of editorial review</p>
      <div style="display:flex; flex-direction:column; gap:0.875rem;">
        <p class="body-sm">A senior line editor charges <strong style="color:var(--cream);">$6,615</strong> to read your 147,000-word novel once.</p>
        <p class="body-sm">A former literary agent quoted <strong style="color:var(--cream);">$10,000</strong> for one developmental read.</p>
        <div style="border-top:1px solid var(--border); padding-top:1rem; margin-top:0.25rem;">
          <p style="color:var(--cream); font-size:1rem; line-height:1.5;">RevisionGrade evaluates the same novel, through every revision, for <strong style="color:var(--gold); font-size:1.25rem;">$249.</strong></p>
          <p class="body-xs" style="margin-top:0.5rem;">Same craft framework. Same readiness threshold. Run it again after every rewrite.</p>
        </div>
      </div>
    </div>

    <p class="body-sm reveal" style="max-width:600px; border-left:2px solid rgba(200,169,110,0.4); padding-left:1.25rem; color:var(--cream2); transition-delay:0.16s;">
      Plans are metered by total words analyzed. Within that allowance, evaluations, revisions, and work-tied outputs remain available without pass limits. When your allowance is reached, new analyses pause until reset or upgrade — past results remain fully accessible.
    </p>
  </div>
</section>

<!-- PLANS -->
<section class="section border-top bg-ink2">
  <div class="container-wide">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2.5rem;">Plans</p>
    <div class="price-grid reveal" style="transition-delay:0.08s;">

      <!-- Free Sample -->
      <div class="price-card">
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.75rem;">Free Sample</p>
        <div style="display:flex; align-items:baseline; gap:0.5rem; margin-bottom:0.25rem;">
          <span class="price-amount">$0</span>
          <span class="price-note">no credit card</span>
        </div>
        <p class="price-cap">3,000 words</p>
        <p class="price-tagline">One chapter. Immediate insight.</p>
        <ul class="price-features">
          <li><span>→</span>Single-chapter evaluation</li>
          <li><span>→</span>Core craft signals</li>
          <li><span>→</span>Automated insight summary</li>
          <li><span>→</span>Readiness score preview</li>
        </ul>
        <a href="#" class="btn btn-ghost" style="width:100%; text-align:center; display:block; padding:0.875rem;">Begin Sample</a>
      </div>

      <!-- Pilot -->
      <div class="price-card">
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.75rem;">Pilot</p>
        <div style="display:flex; align-items:baseline; gap:0.5rem; margin-bottom:0.25rem;">
          <span class="price-amount">$19</span>
          <span class="price-note">one-time</span>
        </div>
        <p class="price-cap">Up to 20,000 words</p>
        <p class="price-tagline">A first act, a novella, a proof of concept.</p>
        <ul class="price-features">
          <li><span>→</span>Full short-form manuscript evaluation</li>
          <li><span>→</span>13-criterion WAVE scoring</li>
          <li><span>→</span>Revision opportunity queue</li>
          <li><span>→</span>Downloadable DREAM report</li>
        </ul>
        <a href="#" class="btn btn-ghost" style="width:100%; text-align:center; display:block; padding:0.875rem;">Begin Evaluation</a>
      </div>

      <!-- Creamium — RECOMMENDED -->
      <div class="price-card featured">
        <span class="recommended-badge">Recommended</span>
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.75rem;">Creamium</p>
        <div style="display:flex; align-items:baseline; gap:0.5rem; margin-bottom:0.25rem;">
          <span class="price-amount">$249</span>
          <span class="price-note">one-time · 1 manuscript</span>
        </div>
        <p class="price-cap">Up to 400,000 words</p>
        <p class="price-tagline">One full novel lifecycle. Every pass you need.</p>
        <ul class="price-features">
          <li><span>→</span>Full manuscript evaluation (any length)</li>
          <li><span>→</span>Unlimited re-evaluations within word budget</li>
          <li><span>→</span>Complete WAVE report &amp; revision queue</li>
          <li><span>→</span>DREAM Long-Form evaluation</li>
          <li><span>→</span>Dashboard access for 12 months</li>
          <li><span>→</span>Exportable agent-facing summary</li>
          <li><span>→</span>Query letter &amp; synopsis outputs</li>
        </ul>
        <a href="#" class="btn btn-gold" style="width:100%; text-align:center; display:block; padding:0.875rem;">Select Creamium</a>
      </div>

      <!-- Premium Annual -->
      <div class="price-card">
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.75rem;">Premium Annual</p>
        <div style="display:flex; align-items:baseline; gap:0.5rem; margin-bottom:0.25rem;">
          <span class="price-amount">$599</span>
          <span class="price-note">per year · up to 3 manuscripts</span>
        </div>
        <p class="price-cap">1,500,000 words / year</p>
        <p class="price-tagline">Working novelists. Active revision. Multiple books.</p>
        <ul class="price-features">
          <li><span>→</span>Everything in Creamium</li>
          <li><span>→</span>Up to 3 manuscripts simultaneously</li>
          <li><span>→</span>Longitudinal tracking across revision cycles</li>
          <li><span>→</span>Pitch decks &amp; market comparables</li>
          <li><span>→</span>Agent package &amp; film adaptation outputs</li>
          <li><span>→</span>Priority processing</li>
        </ul>
        <a href="#" class="btn btn-ghost" style="width:100%; text-align:center; display:block; padding:0.875rem;">Select Premium</a>
      </div>

      <!-- Studio Pro -->
      <div class="price-card">
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.75rem;">Studio Pro</p>
        <div style="display:flex; align-items:baseline; gap:0.5rem; margin-bottom:0.25rem;">
          <span class="price-amount">$1,499</span>
          <span class="price-note">per year · unlimited</span>
        </div>
        <p class="price-cap">4,000,000 words / year</p>
        <p class="price-tagline">Career authors, ghostwriters, and hybrid pros.</p>
        <ul class="price-features">
          <li><span>→</span>Everything in Premium</li>
          <li><span>→</span>Unlimited manuscripts</li>
          <li><span>→</span>Comparative analysis reports</li>
          <li><span>→</span>Genre-context diagnostics</li>
          <li><span>→</span>Advanced benchmarking</li>
          <li><span>→</span>Storygate Studio eligibility review</li>
        </ul>
        <a href="#" class="btn btn-ghost" style="width:100%; text-align:center; display:block; padding:0.875rem;">Select Studio</a>
      </div>

      <!-- Agency -->
      <div class="price-card">
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.75rem;">Agency / Studio</p>
        <div style="display:flex; align-items:baseline; gap:0.5rem; margin-bottom:0.25rem;">
          <span class="price-amount" style="font-size:1.75rem;">Custom</span>
        </div>
        <p class="price-cap">Negotiated capacity</p>
        <p class="price-tagline">Editors, agencies, and MFA programs.</p>
        <ul class="price-features">
          <li><span>→</span>Multi-user seats &amp; team dashboards</li>
          <li><span>→</span>Custom criteria weighting</li>
          <li><span>→</span>Bulk manuscript processing</li>
          <li><span>→</span>White-label options</li>
          <li><span>→</span>API access</li>
          <li><span>→</span>24/7 dedicated support</li>
        </ul>
        <a href="mailto:hello@revisiongrade.com" class="btn btn-ghost" style="width:100%; text-align:center; display:block; padding:0.875rem;">Request Access</a>
      </div>

    </div>
  </div>
</section>

<!-- WORD BUDGET -->
<section class="section border-top">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:1.5rem;">How the word budget works</p>
    <h2 class="display-md reveal" style="margin-bottom:2.5rem; max-width:520px; transition-delay:0.06s;">A realistic lifecycle for a 147,000-word novel.</h2>
    <div class="grid-2 reveal" style="transition-delay:0.1s; align-items:start;">
      <div>
        <div class="budget-row"><span>Evaluation pass 1 (full read)</span><span class="val">147,000 words</span></div>
        <div class="budget-row"><span>Revision pass (targeted chapter re-evals)</span><span class="val">~60,000 words</span></div>
        <div class="budget-row"><span>Evaluation pass 2 (full re-read)</span><span class="val">147,000 words</span></div>
        <div class="budget-row"><span>Final polish re-evaluation (optional)</span><span class="val">~40,000 words</span></div>
        <div class="budget-row total"><span>Total realistic lifecycle</span><span class="val">~394,000 words</span></div>
        <p class="body-xs" style="margin-top:0.75rem; font-family:var(--font-mono);">Creamium's 400,000-word budget is designed to cover one full novel lifecycle with headroom. Overages billed at $0.0008/word (~$80 per 100k additional words).</p>
      </div>
      <div class="card card-surface" style="padding:1.75rem;">
        <p class="mono-xs gold" style="margin-bottom:1rem;">What you get for $249</p>
        <ul class="price-features" style="margin:0;">
          <li><span>→</span>Full manuscript evaluation</li>
          <li><span>→</span>RevisionGrade scorecard across all 13 criteria</li>
          <li><span>→</span>DREAM Long-Form evaluation report</li>
          <li><span>→</span>Unlimited re-evaluations within 400k-word budget</li>
          <li><span>→</span>Dashboard access for 12 months</li>
          <li><span>→</span>Governed revision queue (REVISE)</li>
          <li><span>→</span>Exportable agent-facing summary</li>
          <li><span>→</span>Query letter and synopsis outputs</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- STORYGATE -->
<section class="section border-top bg-ink2">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:1rem;">Storygate Studio™</p>
    <h2 class="display-md reveal" style="margin-bottom:1rem; max-width:560px; transition-delay:0.06s;">Curation review for manuscripts that cross the threshold.</h2>
    <p class="body-lg reveal" style="max-width:680px; transition-delay:0.10s;">Manuscripts that reach a RevisionGrade score of 8.0 or higher may be reviewed for Storygate Studio curation. Access is governed and selective — not a marketplace or pay-to-list system. Eligible creators submit query letters, pitch decks, and synopses at no additional cost. This is not a guarantee of representation or publication.</p>
  </div>
</section>

<!-- FAQ -->
<section class="section border-top">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2.5rem;">Common questions</p>
    <div class="faq-grid reveal" style="transition-delay:0.06s;">
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What counts against my word budget?</p>
        <p class="body-sm">Only words actually analyzed in an evaluation pass. Uploads, navigation, report viewing, and revision-session work do not consume your budget.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What happens when I reach my word limit?</p>
        <p class="body-sm">New analyses pause until the next billing cycle or until you upgrade. All previous results — reports, revision queues, dashboard history — remain fully accessible. We pause, we don't punish.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">Can I run multiple passes on the same manuscript?</p>
        <p class="body-sm">Yes. The Creamium lifecycle is designed for roughly 2–3 full passes on a 147,000-word novel, with additional chapter-level re-evaluations in between.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">Is this a replacement for a developmental editor?</p>
        <p class="body-sm">No. RevisionGrade is framework-driven analysis — a governed instrument for measuring and sequencing manuscript repair. It does not replace human editorial judgment, literary agents, or developmental editors.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What is the refund policy?</p>
        <p class="body-sm">If your first full-manuscript evaluation does not surface at least 10 actionable craft issues, we will issue a full refund. No questions asked.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What is Storygate Studio eligibility?</p>
        <p class="body-sm">Manuscripts that reach 8.0+ on the RevisionGrade readiness scale may be reviewed for Storygate Studio curation — a governed pathway toward agent and industry exposure. Eligibility does not guarantee representation or publication.</p>
      </div>
    </div>
  </div>
</section>

<!-- BOTTOM CTA -->
<section class="section border-top bg-ink2">
  <div class="container" style="text-align:center; padding-block:4.5rem;">
    <h2 class="display-md reveal" style="margin-bottom:1rem;">Begin with a free sample evaluation.</h2>
    <p class="body-sm reveal" style="max-width:400px; margin-inline:auto; margin-bottom:2.5rem; transition-delay:0.06s;">Upload one chapter. No credit card required. See exactly what RevisionGrade surfaces before you commit to a plan.</p>
    <a href="#" class="btn btn-gold reveal" style="transition-delay:0.10s;">Start Free Sample</a>
    <p class="body-xs reveal" style="font-family:var(--font-mono); margin-top:1.25rem; transition-delay:0.14s;">Framework-driven analysis · Does not replace human editorial judgment</p>
  </div>
</section>

<footer class="footer">
  <div class="footer-inner">
    <div class="footer-grid">
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; letter-spacing:0.18em; text-transform:uppercase; color:var(--gold); margin-bottom:0.75rem;">RevisionGrade™</p>
        <p class="body-xs">A governed revision operating system for serious manuscripts.</p>
      </div>
      <div>
        <p class="footer-col-title">Product</p>
        <ul class="footer-links">
          <li><a href="#">Evaluate</a></li>
          <li><a href="revise.html">Revise</a></li>
          <li><a href="dashboard.html">Dashboard</a></li>
      <li><a href="workbench.html">Workbench</a></li>
        </ul>
      </div>
      <div>
        <p class="footer-col-title">Company</p>
        <ul class="footer-links">
          <li><a href="resources.html">Resources</a></li>
          <li><a href="pricing.html">Pricing</a></li>
        </ul>
      </div>
      <div>
        <p class="footer-col-title">Account</p>
        <ul class="footer-links">
          <li><a href="#">Sign In</a></li>
          <li><a href="#">Create Account</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 RevisionGrade™ · Framework-driven analysis · Not a replacement for human editorial judgment</p>
      <p>WAVE Revision System · 13 Story Evaluation Criteria</p>
    </div>
  </div>
</footer>

<script>
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.06 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
</script>
</body>
</html>
`
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ all: 'initial', display: 'block' }}
    />
  )
}
