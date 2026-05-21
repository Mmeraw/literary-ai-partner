import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Resources — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resources — RevisionGrade™</title>
  <meta name="description" content="Methodology, FAQs, and editorial doctrine behind the RevisionGrade instrument. WAVE Revision System · 13 Story Evaluation Criteria." />
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
      <li><a href="pricing.html">Pricing</a></li>
      <li><a href="resources.html" class="active">Resources</a></li>
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
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2rem;">Resources</p>
    <h1 class="display-xl reveal" style="max-width:720px; margin-bottom:1.25rem; transition-delay:0.08s;">
      The instrument explained.
    </h1>
    <p class="body-lg reveal" style="max-width:600px; transition-delay:0.12s;">
      Methodology, doctrine, and answers to the questions authors ask before they trust a system with their manuscript. Framework-driven analysis does not replace human editorial judgment — final decisions remain with the author.
    </p>
  </div>
</section>

<!-- METHODOLOGY -->
<section id="methodology" class="section border-top bg-ink2">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2rem;">Methodology</p>
    <div class="grid-2 reveal" style="gap:4rem; transition-delay:0.06s; align-items:start;">
      <div>
        <h2 class="display-md reveal" style="margin-bottom:1.25rem;">How the instrument reads.</h2>
        <p class="body-lg" style="margin-bottom:1.5rem;">The evaluation engine reads manuscripts against two independently maintained frameworks. Neither framework is applied simultaneously — each pass has a defined scope, a defined evidence standard, and a defined confidence threshold before it may produce output.</p>
        <div style="display:flex; flex-direction:column; gap:1.25rem;">
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); flex-shrink:0;">01</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">Evidence-first ordering.</p>
              <p class="body-sm">No criterion is scored before evidence is located in the manuscript. The instrument cannot fabricate a finding it cannot anchor to a specific passage.</p>
            </div>
          </div>
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); flex-shrink:0;">02</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">Confidence disclosure.</p>
              <p class="body-sm">Every criterion score carries a confidence marker. Criteria where the evidence packet is insufficient are marked "not evaluated" — not silently zeroed.</p>
            </div>
          </div>
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); flex-shrink:0;">03</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">Deterministic ordering.</p>
              <p class="body-sm">The same manuscript evaluated twice produces the same diagnosis. There is no randomness in the evaluation or the revision queue. Reproducibility is a governance requirement, not a feature.</p>
            </div>
          </div>
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); flex-shrink:0;">04</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">Fail-closed gates.</p>
              <p class="body-sm">Render is not available until the completion contract is satisfied. The instrument does not produce a submission package for a manuscript whose revision queue contains unresolved MUST items without documented override.</p>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="card" style="margin-bottom:1.25rem;">
          <p class="mono-xs gold" style="margin-bottom:1rem;">The 13 Story Evaluation Criteria</p>
          <p class="body-sm" style="margin-bottom:1.25rem;">The reader-facing standard. Thirteen dimensions covering everything from logline strength and premise discipline to prose control, pacing economy, and market readiness.</p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem;">
            <div class="criterion-row">Logline strength</div>
            <div class="criterion-row">Market positioning</div>
            <div class="criterion-row">Voice authority</div>
            <div class="criterion-row">Premise discipline</div>
            <div class="criterion-row">Scene density</div>
            <div class="criterion-row">Prose control</div>
            <div class="criterion-row">Closing power</div>
            <div class="criterion-row">Character arcs</div>
            <div class="criterion-row">Comp alignment</div>
            <div class="criterion-row">Thematic coherence</div>
            <div class="criterion-row">Pacing economy</div>
            <div class="criterion-row">Dialogue craft</div>
            <div class="criterion-row" style="grid-column:1/-1;">Genre fluency</div>
          </div>
        </div>
        <div class="card card-gold">
          <p class="mono-xs gold" style="margin-bottom:1rem;">The WAVE Revision System</p>
          <p class="body-sm" style="margin-bottom:1.25rem;">The instrument-facing standard. Multi-pass, evidence-anchored, designed for manuscripts that already have a working spine.</p>
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div class="criterion-row">W: Adaptive narrative structure</div>
            <div class="criterion-row">A: Pressure &amp; pacing continuity</div>
            <div class="criterion-row">V: Voice &amp; tone enforcement</div>
            <div class="criterion-row">E: Evidence-anchored opportunities</div>
          </div>
          <p class="body-xs" style="margin-top:1rem; font-style:italic;">The scoring logic and thresholds remain proprietary. Authors see the decisions and the reasoning, not the underlying engine.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- REVISE FAQ -->
<section class="section border-top">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2.5rem;">Evaluate — Common questions</p>
    <div class="faq-grid reveal" style="transition-delay:0.06s;">
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What does RevisionGrade actually evaluate?</p>
        <p class="body-sm">Every manuscript is read against 13 Story Evaluation Criteria and the WAVE Revision System. Each criterion is scored with evidence anchored to specific passages in your manuscript — not inferred from a summary or word count.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">How is this different from AI writing tools?</p>
        <p class="body-sm">RevisionGrade does not generate prose. It diagnoses craft problems, sequences repairs, and governs the revision process. The author writes every fix. The instrument measures whether the manuscript meets professional submission standards.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">Will it change my voice?</p>
        <p class="body-sm">No. Voice fingerprints — colloquialisms, intentional fragments, dialogue register, rhythm — are protected at the renderer boundary. "For who?" in dialogue is a speech pattern, not a grammar error. The instrument reads it that way.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What if a criterion can't be evaluated?</p>
        <p class="body-sm">It is marked "not evaluated" — not silently zeroed. The instrument discloses when the evidence packet is insufficient. Pacing &amp; Structure, Prose / Line Craft, and Market Readiness are frequently partial or deferred on short submissions.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What file formats are supported?</p>
        <p class="body-sm">Docx, PDF, and plain text (.txt). Manuscripts are processed in full — no chunking, no summarization. The instrument reads every sentence before rendering any judgment.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">Is my manuscript stored?</p>
        <p class="body-sm">Manuscripts are stored only for the duration of your active session and revision history. You may delete all stored manuscript data from your dashboard at any time. We do not use your manuscript to train models.</p>
      </div>
    </div>
  </div>
</section>

<!-- REVISE FAQ -->
<section class="section border-top bg-ink2">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2.5rem;">Revise — Common questions</p>
    <div class="faq-grid reveal" style="transition-delay:0.06s;">
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What is a RevisionOpportunity?</p>
        <p class="body-sm">The canonical work order unit. Each opportunity carries six required fields: Evidence, Symptom, Cause, Fix direction, Reader effect, and Mistake-proofing. Nothing advances to the queue without all six certified.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What are MUST / SHOULD / COULD?</p>
        <p class="body-sm">Severity tiers governing queue order. MUST SPINE → MUST HIGH → SHOULD HIGH → SHOULD MEDIUM → COULD LOCAL → DEFERRED. MUST SPINE items cannot be rejected without a documented override. The queue is deterministic — identical input produces identical ordering.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What are the four decision states?</p>
        <p class="body-sm">ACCEPTED (one of three proposals selected), CUSTOM (author writes their own fix), REJECTED-with-reason (documented reason required), or DEFERRED-with-trigger (deferred to a specific future condition). Every decision is recorded and auditable.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What is the completion contract?</p>
        <p class="body-sm">A fail-closed gate that prevents Render until all MUST items have reached a terminal state. The contract also enforces the voice guardrail — quoted manuscript text is never altered unless the author explicitly accepts a proposal.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">What is long-form mode?</p>
        <p class="body-sm">At 25,000 words, WAVE intelligence and the Golden Spine become contract-enforced surfaces. Revise switches to operating-system mode: CONTINUITY, PRESSURE, PACING, PROMISES, and THEMATIC metrics are tracked across the full manuscript. If the wave surface is missing at this threshold, the contract fails closed.</p>
      </div>
      <div>
        <p class="mono-xs" style="color:var(--cream); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.625rem;">Can I reject an opportunity?</p>
        <p class="body-sm">Yes — for SHOULD and COULD items, rejection requires only a reason. For MUST SPINE items, rejection requires a documented override that is logged in the audit trail. Zero compression is a valid outcome for every tier.</p>
      </div>
    </div>
  </div>
</section>

<!-- DOCTRINE -->
<section class="section border-top">
  <div class="container">
    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2.5rem;">Editorial doctrine</p>
    <div class="grid-3 reveal" style="transition-delay:0.06s;">
      <div class="doctrine-item">
        <span class="mono-xs dim" style="display:block; margin-bottom:0.5rem;">I.</span>
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; color:var(--cream); margin-bottom:0.75rem; line-height:1.4;">Hard governance underneath. Rich editorial humanity on top.</h3>
        <p class="body-sm">The framework is deterministic. The report speaks like a senior editor. Both are true simultaneously and neither cancels the other.</p>
      </div>
      <div class="doctrine-item">
        <span class="mono-xs dim" style="display:block; margin-bottom:0.5rem;">II.</span>
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; color:var(--cream); margin-bottom:0.75rem; line-height:1.4;">Voice, behavior, and force are protected.</h3>
        <p class="body-sm">Deliberate style is not normalized away. The instrument distinguishes intentional craft from structural weakness — and leaves the former untouched.</p>
      </div>
      <div class="doctrine-item">
        <span class="mono-xs dim" style="display:block; margin-bottom:0.5rem;">III.</span>
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; color:var(--cream); margin-bottom:0.75rem; line-height:1.4;">Zero compression is a valid outcome.</h3>
        <p class="body-sm">If your manuscript is already strong in a criterion, the report says so. Revision for its own sake is not the goal. The goal is readiness.</p>
      </div>
    </div>
    <div class="reveal" style="margin-top:3rem; padding-top:2rem; border-top:1px solid var(--border); transition-delay:0.10s;">
      <p class="body-xs" style="font-family:var(--font-mono); max-width:720px; line-height:1.8;">
        RevisionGrade provides framework-driven analysis calibrated against professional editorial standards. It does not replace human editorial judgment, literary agents, or developmental editors. Final decisions remain with the author. The frameworks, thresholds, and scoring logic remain proprietary and are implemented in software.
      </p>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="section border-top bg-ink2">
  <div class="container" style="text-align:center; padding-block:4.5rem;">
    <h2 class="display-md reveal" style="margin-bottom:1rem;">Run it through the instrument.</h2>
    <p class="body-sm reveal" style="max-width:420px; margin-inline:auto; margin-bottom:2.5rem; transition-delay:0.06s;">New users receive 1–2 free evaluations (~5,000 words total). No credit card. Account required after the trial.</p>
    <div class="btn-group btn-group-center reveal" style="transition-delay:0.10s;">
      <a href="#" class="btn btn-gold">Start a free evaluation</a>
      <a href="pricing.html" class="btn btn-ghost">See pricing</a>
    </div>
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

<style>
.criterion-row { display:flex; align-items:center; padding:0.28rem 0; border-bottom:1px solid rgba(200,190,168,0.06); font-family:var(--font-mono); font-size:0.65rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--cream2); break-inside:avoid; }
</style>

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
