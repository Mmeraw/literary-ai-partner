import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Landing — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RevisionGrade™ — A Governed Revision Operating System</title>
  <meta name="description" content="A governed revision operating system for serious manuscripts. Framework-driven analysis. Not a replacement for human editorial judgment." />
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

<!-- ── NAV ───────────────────────────────────────────────── -->
<nav class="nav">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo">RevisionGrade™</a>
    <ul class="nav-links" id="nav-links">
      <li><a href="index.html" class="active">Landing</a></li>
      <li><a href="revise.html">Revise</a></li>
      <li><a href="pricing.html">Pricing</a></li>
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

<!-- ── HERO ──────────────────────────────────────────────── -->
<section style="padding-top:5.5rem; padding-bottom:3rem;">
  <div class="container">

    <p class="eyebrow reveal" style="margin-bottom:2.5rem;">
      <span style="color:var(--red);margin-right:0.5rem;">●</span>
      RevisionGrade · Layer-Zero Canon
    </p>

    <h1 class="display-hero reveal" style="max-width:880px; margin-bottom:2rem; transition-delay:0.08s;">
      A <em style="color:var(--gold); font-style:italic;">governed revision</em> operating system for serious manuscripts.
    </h1>

    <p class="body-lg reveal" style="max-width:620px; margin-bottom:0.75rem; transition-delay:0.14s;">
      Not an AI editor. Not a rewriter. RevisionGrade enforces narrative quality through <em style="font-style:italic; color:var(--cream);">auditable, reproducible literary governance</em> — diagnosing what a trained editor would catch, and refusing to alter what makes the work yours.
    </p>
    <p class="body-sm reveal" style="max-width:560px; margin-bottom:0.75rem; color:var(--cream2); transition-delay:0.17s;">
      We call the engine <em style="font-style:italic; color:var(--cream);">the instrument</em>. It reads structurally, narratively, and at manuscript scale — the way serious editorial institutions read. What it surfaces, you decide.
    </p>
    <p class="mono-xs dim reveal" style="margin-bottom:3rem; transition-delay:0.20s;">
      Framework-driven analysis. Not a replacement for human editorial judgment.
    </p>

    <div class="btn-group reveal" style="margin-bottom:4rem; transition-delay:0.24s;">
      <a href="workbench.html" class="btn btn-gold">Start a free evaluation</a>
      <a href="revise.html" class="btn btn-ghost">See how it works</a>
    </div>

    <!-- Stats bar -->
    <div class="stat-boxes reveal" style="transition-delay:0.30s;">
      <div class="stat-box" style="text-align:center;">
        <p style="font-size:1.9rem; font-family:var(--font-serif); color:var(--cream); margin-bottom:0.35rem; font-weight:400;">13</p>
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.2rem;">Story evaluation criteria</p>
        <p class="body-xs">The reader-facing standard</p>
      </div>
      <div class="stat-box" style="text-align:center;">
        <p style="font-size:1.9rem; font-family:var(--font-serif); color:var(--gold); margin-bottom:0.35rem; letter-spacing:0.08em;">W·A·V·E</p>
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.2rem;">Revision engine</p>
        <p class="body-xs">Adaptive · Pressure · Voice · Evidence</p>
      </div>
      <div class="stat-box" style="text-align:center;">
        <p style="font-size:1.9rem; font-family:var(--font-serif); color:var(--cream); margin-bottom:0.35rem;">∅</p>
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.2rem;">Voice altered without consent</p>
        <p class="body-xs">Zero. By design.</p>
      </div>
    </div>

    <p class="body-xs reveal" style="font-family:var(--font-mono); margin-top:1.5rem; transition-delay:0.34s;">
      <span style="color:var(--red); margin-right:0.5rem;">→</span>Currently accepting manuscripts by invitation
    </p>

  </div>
</section>

<!-- ── I. THE STANDARD ────────────────────────────────────── -->
<section class="section border-top bg-ink2">
  <div class="container">

    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:0.5rem;">I. The Standard</p>
    <h2 class="display-xl reveal" style="margin-bottom:1.25rem; transition-delay:0.06s;">Two canons. One coherent grade.</h2>
    <p class="body-lg reveal" style="max-width:680px; margin-bottom:3.5rem; transition-delay:0.1s;">
      Every manuscript is read against the <em style="font-style:italic; color:var(--gold);">13 Story Evaluation Criteria</em> and the <em style="font-style:italic; color:var(--gold);">WAVE Revision System</em>. Together they cover what agents and editors actually grade for — and they are the intellectual property the engine enforces, not generates.
    </p>

    <div class="grid-2 reveal" style="transition-delay:0.14s;">
      <!-- 13 criteria -->
      <div class="card">
        <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem;">
          <span style="font-family:var(--font-serif); font-size:1.5rem; color:var(--gold);">13</span>
          <div>
            <p class="mono-xs" style="color:var(--cream2);">Story Evaluation Criteria</p>
            <p class="body-xs">The reader-facing standard</p>
          </div>
        </div>
        <p class="body-sm" style="margin-bottom:1.5rem;">The thirteen dimensions a trained eye scans for in the first seconds of a query. Surfaces where a manuscript is decided.</p>
        <div style="columns:2; gap:0.5rem;">
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
          <div class="criterion-row">Genre fluency</div>
        </div>
      </div>

      <!-- WAVE -->
      <div class="card card-gold">
        <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem;">
          <span style="font-family:var(--font-serif); font-size:1.25rem; color:var(--gold); letter-spacing:0.06em;">W·A·V·E</span>
          <div>
            <p class="mono-xs" style="color:var(--cream2);">Revision System</p>
            <p class="body-xs">The instrument-facing standard</p>
          </div>
        </div>
        <p class="body-sm" style="margin-bottom:1.5rem;">A late-stage revision system for manuscripts that already have a working spine. Diagnostic, multi-pass, evidence-anchored — each finding isolates one failure pattern and shows how to repair it without touching voice.</p>
        <div style="display:flex; flex-direction:column; gap:0.625rem;">
          <div class="criterion-row">W: Adaptive narrative structure</div>
          <div class="criterion-row">A: Pressure &amp; pacing continuity</div>
          <div class="criterion-row">V: Voice &amp; tone enforcement</div>
          <div class="criterion-row">E: Evidence-anchored opportunities</div>
          <div class="criterion-row">+: Producer viability · canon compliance · structural risk</div>
        </div>
        <p class="body-xs" style="margin-top:1.25rem; font-style:italic;">The frameworks, thresholds, and scoring logic remain proprietary. Authors see the decisions and the reasoning, not the underlying engine.</p>
      </div>
    </div>

  </div>
</section>

<!-- ── II. THE INSTRUMENT ─────────────────────────────────── -->
<section class="section border-top">
  <div class="container">

    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:0.5rem;">II. The Instrument</p>
    <h2 class="display-xl reveal" style="margin-bottom:1.25rem; transition-delay:0.06s;">Two registers. One reading.</h2>
    <p class="body-lg reveal" style="max-width:680px; margin-bottom:3.5rem; transition-delay:0.1s;">
      An evaluation that meets the standard of an editor reading on a Tuesday afternoon — with the audit trail of an instrument that cannot lie about what it found.
    </p>

    <div class="grid-2 reveal" style="transition-delay:0.14s;">
      <div class="card">
        <p class="mono-xs dim" style="margin-bottom:0.375rem;">Underneath</p>
        <h3 style="font-family:var(--font-serif); font-size:1.5rem; font-style:italic; color:var(--cream); margin-bottom:1rem; line-height:1.2;">Invisible rigor.</h3>
        <p class="body-sm" style="margin-bottom:1.25rem;">Every recommendation is anchored in your manuscript. Every decision is logged, reproducible, and revocable. Nothing is guessed. Nothing is fabricated.</p>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <div class="criterion-row">Evidence-anchored at the line</div>
          <div class="criterion-row">Deterministic ordering across runs</div>
          <div class="criterion-row">Fail-closed when proof is incomplete</div>
        </div>
      </div>
      <div class="card card-gold">
        <p class="mono-xs" style="color:var(--gold); margin-bottom:0.375rem;">On top</p>
        <h3 style="font-family:var(--font-serif); font-size:1.5rem; font-style:italic; color:var(--cream); margin-bottom:1rem; line-height:1.2;">Visible humanity.</h3>
        <p class="body-sm" style="margin-bottom:1.25rem;">What you read is editorial intelligence — chapter by chapter, scene by scene, in the language an editor would actually use. Diagnoses that name the mechanism, the reader effect, and the revision.</p>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <div class="criterion-row">Chapter-level recovery pathways</div>
          <div class="criterion-row">Mechanism · Effect · Revision · Target</div>
          <div class="criterion-row">Author voice protected at the renderer boundary</div>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- ── VOICE PROTECTION ───────────────────────────────────── -->
<section class="section border-top bg-ink2">
  <div class="container">

    <p class="eyebrow reveal" style="margin-bottom:1.5rem; font-size:0.62rem; letter-spacing:0.16em; color:var(--dim);">A reading the engine refuses to flatten</p>

    <div style="text-align:center; margin-bottom:4rem;" class="reveal" style="transition-delay:0.06s;">
      <h2 class="display-xl" style="max-width:800px; margin-inline:auto;">
        <em style="font-style:italic; color:var(--cream2);">Other tools</em> would correct these.<br>
        <span style="color:var(--cream);">The instrument protects them.</span>
      </h2>
    </div>

    <div class="grid-2 reveal" style="align-items:start; gap:3.5rem; transition-delay:0.10s;">
      <!-- Manuscript sample -->
      <div>
        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem;">
          <!-- "For who?" -->
          <div class="card" style="padding:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
              <p class="body-xs" style="font-family:var(--font-mono);">Manuscript · Chapter 3</p>
              <span style="font-family:var(--font-mono); font-size:0.62rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--gold); background:rgba(200,169,110,0.10); padding:0.2rem 0.5rem;">PROTECTED</span>
            </div>
            <p style="font-family:var(--font-serif); font-size:1.05rem; color:var(--cream); margin-bottom:0.5rem;">"For who?"</p>
            <p class="body-xs" style="font-family:var(--font-mono);">Nonstandard grammar, voice-consistent. A character who speaks in slang is allowed to. The line carries register and identity.</p>
          </div>
          <!-- Cliff sentence -->
          <div class="card" style="padding:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
              <p class="body-xs" style="font-family:var(--font-mono);">Manuscript · Chapter 3</p>
              <span style="font-family:var(--font-mono); font-size:0.62rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--gold); background:rgba(200,169,110,0.10); padding:0.2rem 0.5rem;">PROTECTED</span>
            </div>
            <p style="font-family:var(--font-serif); font-size:0.95rem; color:var(--cream2); line-height:1.7; font-style:italic;">Cliff glanced at the gas prices, did the math, and decided against buying the washer fluid.</p>
            <p class="body-xs" style="font-family:var(--font-mono); margin-top:0.625rem;">An apparent inventory sentence encoding character psychology and economic pressure. Does narrative work.</p>
          </div>
        </div>
        <p class="body-xs" style="font-style:italic; color:var(--dim);">What looks like noise on the surface can carry voice, behavior, contradiction, consequence, or force. The engine reads for those functions before it reaches for the red pen.</p>
      </div>

      <!-- What the instrument understands -->
      <div>
        <p class="mono-xs gold" style="margin-bottom:1.25rem;">What the instrument understands</p>
        <div style="display:flex; flex-direction:column; gap:1.25rem;">
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); font-size:0.75rem; flex-shrink:0;">→</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">Voice, behavior, and force are protected.</p>
              <p class="body-xs">Colloquialisms in dialogue, intentional grammar departures, and hybrid registers are authorial behavior — not errors.</p>
            </div>
          </div>
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); font-size:0.75rem; flex-shrink:0;">→</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">Zero compression is a valid outcome.</p>
              <p class="body-xs">If the manuscript is already doing something well, the instrument says so and leaves it untouched.</p>
            </div>
          </div>
          <div style="display:flex; gap:1rem;">
            <span style="color:var(--gold); font-family:var(--font-mono); font-size:0.75rem; flex-shrink:0;">→</span>
            <div>
              <p class="body-sm" style="color:var(--cream); margin-bottom:0.25rem;">The mistake-proofing field governs repair.</p>
              <p class="body-xs">Every RevisionOpportunity carries an explicit list of what must not be changed while making the repair.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- ── SUBMISSION PATHWAY ─────────────────────────────────── -->
<section class="section border-top">
  <div class="container">

    <p class="eyebrow reveal" style="color:var(--dim); margin-bottom:0.5rem; font-size:0.62rem; letter-spacing:0.16em;">A submission pathway</p>
    <h2 class="display-xl reveal" style="margin-bottom:0.25rem; transition-delay:0.06s;">Manuscript to <em style="color:var(--gold); font-style:italic;">submission-ready</em>,</h2>
    <h2 class="display-xl reveal" style="margin-bottom:1.25rem; transition-delay:0.09s;">in five readings.</h2>
    <p class="body-lg reveal" style="max-width:640px; margin-bottom:3.5rem; transition-delay:0.12s;">An unbroken provenance chain. Each reading is reasoned, evidence-anchored, and reproducible. The author signs every transition. Nothing advances without consent.</p>

    <div class="reveal" style="transition-delay:0.15s;">
      <div class="pipeline-step">
        <div>
          <span class="mono-xs dim">i.</span>
          <p style="font-family:var(--font-serif); font-size:1.5rem; color:var(--cream); margin-top:0.25rem;">Read.</p>
          <p class="mono-xs dim" style="margin-top:0.25rem;">Intake</p>
        </div>
        <p class="body-sm">Manuscript received in full. Read end to end before any judgment is rendered. The instrument does not skim, sample, or summarize. Context is preserved.</p>
        <p class="body-xs" style="font-family:var(--font-mono);">Full text · in order · unparsed</p>
      </div>
      <div class="pipeline-step">
        <div>
          <span class="mono-xs dim">ii.</span>
          <p style="font-family:var(--font-serif); font-size:1.5rem; color:var(--cream); margin-top:0.25rem;">Diagnose.</p>
          <p class="mono-xs dim" style="margin-top:0.25rem;">Diagnostic</p>
        </div>
        <p class="body-sm">Read against the 13 Story Evaluation Criteria and the WAVE Revision System. Each finding isolates one mechanism, and cites the line in your manuscript that produced it.</p>
        <p class="body-xs" style="font-family:var(--font-mono);">13 Criteria · WAVE pass · Confidence disclosed</p>
      </div>
      <div class="pipeline-step">
        <div>
          <span class="mono-xs dim">iii.</span>
          <p style="font-family:var(--font-serif); font-size:1.5rem; color:var(--cream); margin-top:0.25rem;">Translate.</p>
          <p class="mono-xs dim" style="margin-top:0.25rem;">Editorial register</p>
        </div>
        <p class="body-sm">Findings rendered in the language an editor would actually use — mechanism, reader effect, suggested revision, and target. Prose, not telemetry. No schema cards, no jargon.</p>
        <p class="body-xs" style="font-family:var(--font-mono);">Mechanism · Effect · Revision · Target</p>
      </div>
      <div class="pipeline-step">
        <div>
          <span class="mono-xs dim">iv.</span>
          <p style="font-family:var(--font-serif); font-size:1.5rem; color:var(--cream); margin-top:0.25rem;">Revise.</p>
          <p class="mono-xs dim" style="margin-top:0.25rem;">Author boundary</p>
        </div>
        <p class="body-sm">One opportunity at a time. The author accepts, declines, or rewrites. The instrument records the decision and moves on. Zero compression is a valid outcome at every step.</p>
        <p class="body-xs" style="font-family:var(--font-mono);">Accept · Decline · Rewrite · Three proposals per opportunity</p>
      </div>
      <div class="pipeline-step">
        <div>
          <span class="mono-xs dim">v.</span>
          <p style="font-family:var(--font-serif); font-size:1.5rem; color:var(--cream); margin-top:0.25rem;">Render.</p>
          <p class="mono-xs dim" style="margin-top:0.25rem;">Submission package</p>
        </div>
        <p class="body-sm">Query, synopsis, agent and film packages — generated from the cleared draft, with the audit trail intact. What the manuscript carries forward is the manuscript you approved.</p>
        <p class="body-xs" style="font-family:var(--font-mono);">Cleared draft · Provenance preserved · Readiness certified</p>
      </div>
    </div>

    <p class="body-xs reveal" style="font-style:italic; color:var(--dim); margin-top:1.5rem; font-family:var(--font-mono); transition-delay:0.18s;">The author is the signatory of every transition. The instrument does not advance the manuscript on its own.</p>

  </div>
</section>

<!-- ── AGENT REALITY CHECK ────────────────────────────────── -->
<section class="section border-top bg-ink2">
  <div class="container">

    <p class="eyebrow reveal" style="color:var(--dim); margin-bottom:1.5rem; font-size:0.62rem; letter-spacing:0.16em;">The agent reality check</p>

    <h2 class="display-xl reveal" style="margin-bottom:1.5rem; max-width:760px; transition-delay:0.06s;">
      <em style="font-style:italic;">A brilliant story</em> is not the same as a <em style="font-style:italic; color:var(--gold);">submission-ready</em> one.
    </h2>

    <p class="body-lg reveal" style="max-width:640px; margin-bottom:3.5rem; color:var(--cream2); font-style:italic; transition-delay:0.10s;">
      We don't write your story. We translate it into the language gatekeepers already speak.
    </p>

    <!-- Recovery Blueprint example -->
    <div class="reveal" style="transition-delay:0.14s;">
      <p class="mono-xs gold" style="margin-bottom:1.25rem;">A page from a recovery blueprint</p>
      <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:var(--cream); margin-bottom:0.5rem; line-height:1.3;">What an evaluation <em style="font-style:italic; color:var(--gold);">actually reads like.</em></h3>
      <p class="mono-xs dim" style="margin-bottom:1.5rem;">Chapters 8 · 11 · 14 · Dialogue · Pressure continuity</p>

      <div class="card" style="padding:2rem; max-width:780px; border-left:2px solid rgba(200,169,110,0.3);">
        <p style="font-family:var(--font-serif); font-size:0.975rem; color:var(--cream2); line-height:1.85; font-style:italic; margin-bottom:1.25rem;">
          The conversations in eight, eleven, and fourteen are doing real work — Marisol's first refusal, the kitchen scene, the moment in the truck. Each one ends, however, on the line that delivers the information. The reader receives the fact and the scene closes. What is missing is the residue: the disagreement that follows a factual revelation, the anecdotal detour that lets a character avoid an admission, the silence held a beat too long. Two to four further exchanges in each scene would let the disclosures settle into the room. Estimated four to seven hundred words, organically. The effect would be sharper character differentiation and the kind of emotional realism a producer recognizes on a first read.
        </p>
        <p class="body-xs" style="font-family:var(--font-mono); color:var(--dim);">— What the manuscript still owes its reader. The residue — the disagreement, the silence, the detour, the line that cannot do the work alone — surfaced before gatekeepers find it for you.</p>
      </div>

      <p class="body-xs reveal" style="font-family:var(--font-mono); margin-top:1.25rem; transition-delay:0.18s;">No prose changed without your approval. Every decision on file. Every revision revocable.</p>
    </div>

  </div>
</section>

<!-- ── DREAM REPORT ───────────────────────────────────────── -->
<section class="section border-top">
  <div class="container">

    <h2 class="display-lg reveal" style="margin-bottom:1rem;">What an evaluation <em style="color:var(--gold); font-style:italic;">actually reads like.</em></h2>
    <p class="body-lg reveal" style="max-width:560px; margin-bottom:3.5rem; transition-delay:0.06s;">
      Not a checklist. Not automated grammar notes. A clinical readiness assessment — evidence-anchored, criterion-scored, and honest about what it could not certify.
    </p>

    <div class="dream-report reveal" style="transition-delay:0.1s;">
      <div class="dream-header">
        <div>
          <p style="color:var(--gold); letter-spacing:0.18em; text-transform:uppercase; margin-bottom:0.25rem; font-family:var(--font-mono); font-size:0.75rem;">DREAM Report</p>
          <p class="body-xs">Ancient Bloodlines — Love Between Species · 18,268 words</p>
        </div>
        <div class="dream-score">
          <p class="mono-xs" style="color:var(--cream2); margin-bottom:0.2rem;">Overall</p>
          <p style="font-size:1.35rem; color:var(--cream); font-family:var(--font-serif);">7.4 / 10</p>
        </div>
      </div>
      <div style="margin-bottom:1.5rem;">
        <p class="mono-xs dim" style="margin-bottom:0.75rem;">Overall verdict</p>
        <p class="body-sm" style="max-width:680px;">Opens with a compelling eco-fable confrontation that clearly frames communal stakes, distinct character roles, and a coherent thematic spine. Momentum flags when lore interrupts the live threat, dialogue leans didactic, and a hybrid register wobbles tone at peak pressure. Focus the standoff's escalation, embed motive actions, and compress the lore injections before revising line-level prose.</p>
      </div>
      <div class="dream-criteria" style="margin-bottom:1.5rem;">
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Concept &amp; Core Premise</span><div style="display:flex;gap:0.75rem;align-items:center;"><span style="color:var(--gold);">7/10</span><span class="body-xs">High</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Narrative Drive</span><div style="display:flex;gap:0.75rem;align-items:center;"><span style="color:var(--gold);">6/10</span><span class="body-xs">Moderate</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Character Depth</span><div style="display:flex;gap:0.75rem;align-items:center;"><span style="color:var(--gold);">6/10</span><span class="body-xs">Moderate</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Theme / Intelligence</span><div style="display:flex;gap:0.75rem;align-items:center;"><span style="color:var(--gold);">7/10</span><span class="body-xs">High</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">World-Building</span><div style="display:flex;gap:0.75rem;align-items:center;"><span style="color:var(--gold);">8/10</span><span class="body-xs">High</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Pacing &amp; Structure</span><div style="display:flex;gap:0.75rem;align-items:center;"><span class="dim">—</span><span class="body-xs">Not evaluated</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Prose / Line Craft</span><div style="display:flex;gap:0.75rem;align-items:center;"><span class="dim">—</span><span class="body-xs">Not evaluated</span></div></div>
        <div class="dream-criterion"><span style="color:var(--cream2); text-transform:uppercase; letter-spacing:0.08em; font-size:0.7rem;">Market Readiness</span><div style="display:flex;gap:0.75rem;align-items:center;"><span class="dim">—</span><span class="body-xs">Insufficient packet</span></div></div>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:1.25rem; margin-bottom:1rem;">
        <p style="font-family:var(--font-mono); font-size:0.7rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.16em; margin-bottom:0.75rem;">MUST · SPINE-CRITICAL</p>
        <p class="mono-xs dim" style="margin-bottom:0.35rem;">Evidence</p>
        <p class="body-sm" style="margin-bottom:0.75rem;">"The story's moral is that Gorf rewards those who are considerate of others and the environment."</p>
        <p class="mono-xs dim" style="margin-bottom:0.35rem;">Symptom</p>
        <p class="body-sm" style="margin-bottom:0.75rem;">Theme stated in narrator voice rather than emerging from story consequence.</p>
        <p class="mono-xs dim" style="margin-bottom:0.35rem;">Mistake-proofing</p>
        <p class="body-sm">Do not remove the moral — embed it. The fable register is intentional. The lecturing register is not.</p>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:0.875rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <span class="mono-xs dim">REVISE queue ready</span>
        <a href="workbench.html" style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold);">7 opportunities · Open in Workbench →</a>
      </div>
    </div>
    <p class="body-xs reveal" style="font-family:var(--font-mono); margin-top:1rem; transition-delay:0.14s;">Pacing, prose control, and market readiness are marked "not evaluated" — not silently zeroed. The instrument refuses to grade criteria without certified evidence. That is the right behavior.</p>

  </div>
</section>

<!-- ── III. DOCTRINE ──────────────────────────────────────── -->
<section class="section border-top bg-ink2">
  <div class="container">

    <p class="eyebrow eyebrow-gold reveal" style="margin-bottom:2.5rem;">III. The Doctrine</p>

    <div class="grid-3 reveal" style="margin-bottom:3.5rem; transition-delay:0.06s;">
      <div class="doctrine-item">
        <span class="mono-xs dim" style="display:block; margin-bottom:0.5rem;">i.</span>
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; color:var(--cream); margin-bottom:0.75rem; line-height:1.4;">Hard governance underneath. <em style="font-style:italic;">Rich editorial humanity on top.</em></h3>
        <p class="body-sm">The framework is deterministic. The report speaks like a senior editor. Both are true simultaneously and neither cancels the other.</p>
      </div>
      <div class="doctrine-item">
        <span class="mono-xs dim" style="display:block; margin-bottom:0.5rem;">ii.</span>
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; color:var(--cream); margin-bottom:0.75rem; line-height:1.4;">Voice, behavior, and force are <em style="font-style:italic;">protected.</em></h3>
        <p class="body-sm">Deliberate style is not normalized away. The instrument distinguishes intentional craft from structural weakness — and leaves the former untouched.</p>
      </div>
      <div class="doctrine-item">
        <span class="mono-xs dim" style="display:block; margin-bottom:0.5rem;">iii.</span>
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; color:var(--cream); margin-bottom:0.75rem; line-height:1.4;">Zero compression is a <em style="font-style:italic;">valid outcome.</em></h3>
        <p class="body-sm">If your manuscript is already strong in a criterion, the report says so. Revision for its own sake is not the goal. The goal is readiness.</p>
      </div>
    </div>

    <p class="body-xs reveal" style="font-family:var(--font-mono); transition-delay:0.10s;">
      Framework-driven analysis does not replace human editorial judgment, literary agents, or developmental editors. · Powered by the WAVE Revision System · 13 Story Evaluation Criteria
    </p>

  </div>
</section>

<!-- ── CTA ────────────────────────────────────────────────── -->
<section class="section border-top">
  <div class="container" style="text-align:center; padding-block:5.5rem;">

    <h2 class="display-xl reveal" style="margin-bottom:1.5rem; max-width:680px; margin-inline:auto; transition-delay:0.06s;">
      Run it through the instrument.
    </h2>
    <p class="body-lg reveal" style="max-width:480px; margin-inline:auto; margin-bottom:1rem; transition-delay:0.10s;">
      New users receive 1–2 free evaluations (~5,000 words total). No credit card. Account required after the trial.
    </p>
    <div class="btn-group btn-group-center reveal" style="margin-bottom:1.5rem; transition-delay:0.14s;">
      <a href="workbench.html" class="btn btn-gold">Start a free evaluation</a>
      <a href="pricing.html" class="btn btn-ghost">See pricing</a>
    </div>
    <p class="body-xs reveal" style="font-family:var(--font-mono); color:var(--dim); max-width:560px; margin-inline:auto; line-height:1.6; transition-delay:0.18s;">
      Powered by the proprietary WAVE Revision System · 13 Story Evaluation Criteria · Professional editorial standards
    </p>

  </div>
</section>

<!-- ── FOOTER ─────────────────────────────────────────────── -->
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
          <li><a href="resources.html#methodology">Methodology</a></li>
        </ul>
      </div>
      <div>
        <p class="footer-col-title">Trust</p>
        <ul class="footer-links">
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms of Service</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>RevisionGrade provides framework-driven analysis calibrated against professional editorial standards. It does not replace human editorial judgment — final decisions remain with the author.</p>
      <p>© 2026 RevisionGrade™. All rights reserved.</p>
    </div>
  </div>
</footer>

<style>
.criterion-row {
  display: flex; align-items: center; padding: 0.3rem 0;
  border-bottom: 1px solid rgba(200,190,168,0.06);
  font-family: var(--font-mono); font-size: 0.68rem;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--cream2);
  break-inside: avoid;
}
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
