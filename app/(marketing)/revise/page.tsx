import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Revise — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>REVISE — RevisionGrade™ | Governed Repair Happens Here</title>
  <meta name="description" content="Revise is where governed repair happens — one opportunity at a time. Evidence-anchored. Voice-preserving. Built against governed contracts, not feature aspirations." />
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
<style>
/* ── DETAIL PANEL — right pane of repair queue ──────────── */

/* Two-pane: left queue list + right detail, side by side */
.queue-two-pane {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: 560px;
}
.queue-right.detail-panel {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--ink2) 0%, var(--ink) 100%);
  overflow-y: auto;
  max-height: 740px;
  border-left: 1px solid var(--border);
}

/* Header */
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1.375rem 1.625rem;
  border-bottom: 1px solid var(--border);
}
.detail-crumb {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 0.375rem;
}
.detail-title {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: clamp(1rem, 2vw, 1.25rem);
  letter-spacing: -0.01em;
  color: var(--cream);
  line-height: 1.2;
  max-width: 36ch;
}
.detail-tags {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  align-items: flex-start;
  padding-top: 0.15rem;
}
.dtag {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 0.2rem 0.45rem;
  border: 1px solid transparent;
  white-space: nowrap;
}
.dtag-must  { background: rgba(138,39,51,0.16); color: #e0a3ad; border-color: rgba(138,39,51,0.40); }
.dtag-spine { background: rgba(138,39,51,0.22); color: #e0a3ad; border-color: rgba(138,39,51,0.50); }
.dtag-conf  { color: var(--cream2); border-color: var(--border-strong); }
.dtag-should{ background: rgba(200,169,110,0.12); color: var(--gold); border-color: var(--border-gold); }
.dtag-could { color: var(--dim); border-color: var(--border); }

/* Shared section wrapper */
.dp-section {
  padding: 1.25rem 1.625rem;
  border-bottom: 1px solid var(--border);
}
.dp-section-label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 500;
  margin-bottom: 0.75rem;
}

/* Evidence block */
.dp-quote {
  font-family: var(--font-serif);
  font-size: clamp(1.05rem, 1.8vw, 1.375rem);
  font-style: italic;
  line-height: 1.45;
  color: var(--cream);
  padding-left: 1rem;
  border-left: 2px solid var(--border-red);
  margin: 0;
}
.dp-quote-mark {
  font-family: var(--font-serif);
  font-size: 1.3em;
  color: var(--gold);
  margin-right: 0.2rem;
  vertical-align: -0.1em;
  line-height: 0;
}
.dp-quoted {
  background: rgba(200, 169, 110, 0.10);
  padding: 0.05em 0.3em;
}
.dp-anchor {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--dim);
  margin-top: 0.75rem;
  letter-spacing: 0.04em;
}

/* Diagnosis: 2-column definition list */
.dp-diagnosis {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem 1.75rem;
}
.dp-diagnosis > div { display: flex; flex-direction: column; gap: 0.25rem; }
.dp-diagnosis dt {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
}
.dp-diagnosis dd {
  font-size: 0.82rem;
  color: var(--cream2);
  line-height: 1.55;
  margin: 0;
}
@media (max-width: 720px) { .dp-diagnosis { grid-template-columns: 1fr; } }

/* Options: stacked proposal cards */
.dp-options { padding-bottom: 1rem; }
.dp-option {
  background: var(--ink3);
  border: 1px solid var(--border);
  padding: 0.875rem 1rem;
  margin-bottom: 0.625rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.dp-option:last-of-type { margin-bottom: 0; }
.dp-option:hover { border-color: var(--border-gold); }
.dp-option.selected {
  border-color: rgba(200,169,110,0.55);
  background: var(--ink2);
  box-shadow: 0 0 0 1px rgba(200,169,110,0.12);
}
.dp-option-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}
.dp-opt-key {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.3rem;
  color: var(--gold);
  line-height: 1;
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}
.dp-opt-mech {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--cream2);
}
.dp-proposal {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--cream);
  background: var(--ink);
  padding: 0.625rem 0.875rem;
  border-left: 2px solid var(--gold);
  white-space: pre-wrap;
  margin: 0 0 0.5rem 0;
}
.dp-rationale {
  font-size: 0.75rem;
  color: var(--dim);
  line-height: 1.5;
  margin: 0;
}

/* Author action buttons */
.dp-actions {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.625rem;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.dp-btn {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.55rem 0.875rem;
  border: 1px solid;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.dp-btn-primary {
  background: var(--cream);
  color: var(--ink);
  border-color: var(--cream);
}
.dp-btn-primary:hover {
  background: transparent;
  color: var(--cream);
}
.dp-btn-ghost {
  background: transparent;
  color: var(--cream2);
  border-color: var(--border);
}
.dp-btn-ghost:hover {
  border-color: var(--cream2);
  color: var(--cream);
}

/* Voice-preservation footer */
.dp-voice-note {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.875rem 1.625rem 1.25rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: var(--gold);
  line-height: 1.6;
  margin-top: auto;
}
.dp-voice-note svg { flex-shrink: 0; margin-top: 0.2rem; }

/* Left queue panel */
.queue-left {
  border-right: 1px solid var(--border);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  background: var(--ink);
  overflow-y: auto;
  max-height: 740px;
}
#queue-list {
  flex: 1;
  overflow-y: auto;
}
.queue-item {
  border-left: 2px solid transparent;
  transition: background var(--transition-fast), border-left-color var(--transition-fast);
}
.queue-item.active {
  background: var(--ink2);
  border-left-color: var(--gold);
}

/* Responsive: stack on narrow screens */
@media (max-width: 900px) {
  .queue-two-pane { grid-template-columns: 1fr; }
  .queue-left { max-height: 360px; border-right: none; border-bottom: 1px solid var(--border); }
  .queue-right.detail-panel {
    border-left: none !important;
    border-top: 1px solid var(--border);
    max-height: none;
  }
}
</style>
</head>
<body>

<!-- ── NAV ───────────────────────────────────────────────── -->
<nav class="nav">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo">RevisionGrade™</a>
    <ul class="nav-links" id="nav-links">
      <li><a href="index.html">Landing</a></li>
      <li><a href="revise.html" class="active">Revise</a></li>
      <li><a href="pricing.html">Pricing</a></li>
      <li><a href="resources.html">Resources</a></li>
    </ul>
    <a href="#" class="nav-signin">Sign In</a>
    <button class="nav-mobile-toggle" onclick="document.getElementById('nav-links').classList.toggle('open')" aria-label="Menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect y="4" width="20" height="1.5" fill="currentColor"/><rect y="9.25" width="20" height="1.5" fill="currentColor"/><rect y="14.5" width="20" height="1.5" fill="currentColor"/></svg>
    </button>
  </div>
</nav>

<!-- ── HERO ──────────────────────────────────────────────── -->
<section style="padding-top:5rem; padding-bottom:2rem;">
  <div class="container">
    <p class="eyebrow reveal" style="margin-bottom:2.5rem;">
      <span style="color:var(--red);margin-right:0.5rem;">●</span>
      Revise · Human-guided execution layer
    </p>
    <h1 class="display-hero reveal" style="line-height:0.97; margin-bottom:0; transition-delay:0.05s;">Revise is where</h1>
    <h1 class="display-hero reveal" style="line-height:0.97; margin-bottom:0; color:var(--gold); font-style:italic; transition-delay:0.10s; text-decoration:underline; text-decoration-color:var(--red); text-underline-offset:8px;">governed repair</h1>
    <h1 class="display-hero reveal" style="line-height:0.97; margin-bottom:0; transition-delay:0.15s;">happens —</h1>
    <h1 class="display-hero reveal" style="line-height:0.97; margin-bottom:3.5rem; transition-delay:0.20s;">one opportunity at a time.</h1>
  </div>
</section>

<!-- ── HERO SUBTEXT + STAT BOXES ─────────────────────────── -->
<section style="padding-bottom:5rem;">
  <div class="container">
    <p class="body-lg reveal" style="max-width:680px; margin-bottom:1rem;">
      Evaluation diagnoses. <span style="color:var(--cream);">Trustpath</span> automates safely. <strong style="font-weight:500; color:var(--cream);">Revise</strong> is the operational surface in between: a queued, evidence-anchored workspace where authors accept, reject, customize, or keep the original — line by line, without losing voice.
    </p>
    <div class="btn-group reveal" style="margin-bottom:4rem; transition-delay:0.06s;">
      <a href="#how" class="btn btn-cream">See how Revise works</a>
      <a href="#contract" class="btn btn-ghost">Read the contract</a>
    </div>

    <div class="stat-boxes reveal" style="transition-delay:0.1s;">
      <div class="stat-box">
        <p class="mono-xs gold" style="margin-bottom:0.625rem;">Six-element note</p>
        <p class="body-sm">Evidence · Symptom · Cause · Fix · Reader effect · Mistake-proofing</p>
      </div>
      <div class="stat-box">
        <p class="mono-xs gold" style="margin-bottom:0.625rem;">Governance</p>
        <p class="body-sm">Fail-closed gates · deterministic queueing · audited transitions</p>
      </div>
      <div class="stat-box">
        <p class="mono-xs gold" style="margin-bottom:0.625rem;">Voice safety</p>
        <p class="body-sm">Critic voice normalized · author voice preserved byte-for-byte</p>
      </div>
    </div>
  </div>
</section>

<!-- ── THREE LAYERS ───────────────────────────────────────── -->
<section class="section border-top bg-ink2">
  <div class="container">
    <p class="chip reveal" style="margin-bottom:3rem;">The Architecture</p>
    <h2 class="display-lg reveal" style="margin-bottom:1rem; transition-delay:0.06s;">Three layers, one primitive.</h2>
    <p class="body-lg reveal" style="max-width:640px; margin-bottom:3rem; transition-delay:0.1s;">
      RevisionGrade is a governed narrative revision orchestration platform. Every layer consumes the same operational unit: the <code style="font-family:var(--font-mono); background:var(--ink); padding:0.1em 0.4em; font-size:0.9em; color:var(--gold);">RevisionOpportunity</code>.
    </p>
    <div class="layer-grid reveal" style="transition-delay:0.14s;">
      <div class="layer-card">
        <p class="mono-xs dim" style="margin-bottom:0.5rem;">I.</p>
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:1rem;">Evaluate — Diagnose · Prioritize</p>
        <p class="body-sm">Intake, scoring, confidence, certification, top opportunities, and a clean handoff. Not an infinite issue list — a triage board.</p>
      </div>
      <div class="layer-card active" style="position:relative;">
        <span class="you-are-here">You are here</span>
        <p class="mono-xs dim" style="margin-bottom:0.5rem;">II.</p>
        <p class="mono-xs gold" style="margin-bottom:1rem;">Revise — Human-Guided Execution</p>
        <p class="body-sm">Queue-based issue resolution with options, diffs, and author control. One meaningful problem at a time. Flashcard psychology, governance discipline.</p>
      </div>
      <div class="layer-card">
        <p class="mono-xs dim" style="margin-bottom:0.5rem;">III.</p>
        <p class="mono-xs" style="color:var(--cream2); margin-bottom:1rem;">Trustpath — Autonomous · Governed</p>
        <p class="body-sm">Selective automated execution under explicit risk and safety contracts. Only the opportunities that are demonstrably safe to apply.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── HOW REVISE WORKS ───────────────────────────────────── -->
<section id="how" class="section border-top">
  <div class="container-wide">
    <p class="chip reveal" style="margin-bottom:3rem;">How Revise works</p>
    <h2 class="display-lg reveal" style="margin-bottom:0.5rem; transition-delay:0.06s;">A repair queue, not a report.</h2>
    <h2 class="display-lg reveal" style="color:var(--cream2); margin-bottom:3.5rem; transition-delay:0.1s;">Progressive disclosure of one meaningful problem at a time.</h2>

    <!-- Interactive queue mockup -->
    <div class="queue-wrap reveal" style="transition-delay:0.14s; margin-bottom:2rem;">
      <div class="queue-two-pane">

        <!-- Left: queue -->
        <div class="queue-left">
          <p class="mono-xs dim" style="margin-bottom:0.75rem;">Repair queue</p>

          <div class="filter-tabs" style="margin-bottom:1rem;">
            <button class="filter-tab active" onclick="setFilter(this,'ALL')">ALL</button>
            <button class="filter-tab" onclick="setFilter(this,'WAVE')">WAVE</button>
            <button class="filter-tab" onclick="setFilter(this,'MUST')">MUST</button>
            <button class="filter-tab" onclick="setFilter(this,'SHOULD')">SHOULD</button>
            <button class="filter-tab" onclick="setFilter(this,'COULD')">COULD</button>
          </div>

          <div id="queue-list">
            <div class="queue-item" data-tier="MUST" data-id="0" onclick="selectItem(0)">
              <span class="tier-must">MUST</span>
              <div>
                <p style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cream);line-height:1.4;">Abstract phrasing weakens river-scene tension</p>
                <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">Dialogue · Ch. 11 · evidence anchored</p>
              </div>
            </div>
            <div class="queue-item" data-tier="MUST" data-id="1" onclick="selectItem(1)">
              <span class="tier-must">MUST</span>
              <div>
                <p style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cream2);line-height:1.4;">Internal monologue duplicates dialogue subtext</p>
                <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">Pacing · Ch. 11</p>
              </div>
            </div>
            <div class="queue-item" data-tier="SHOULD" data-id="2" onclick="selectItem(2)">
              <span class="tier-should">SHOULD</span>
              <div>
                <p style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cream2);line-height:1.4;">Promise opened in Ch. 4 still unresolved at midpoint</p>
                <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">Golden Spine · cross-chapter</p>
              </div>
            </div>
            <div class="queue-item" data-tier="SHOULD" data-id="3" onclick="selectItem(3)">
              <span class="tier-should">SHOULD</span>
              <div>
                <p style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cream2);line-height:1.4;">Pressure plateaus across chapters 12–14</p>
                <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">Pacing valley · 3 chapters</p>
              </div>
            </div>
            <div class="queue-item" data-tier="COULD" data-id="4" onclick="selectItem(4)">
              <span class="tier-could">COULD</span>
              <div>
                <p style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cream2);line-height:1.4;">Filtered perception softens close-third POV</p>
                <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dim);">POV register · Ch. 7</p>
              </div>
            </div>
          </div>

          <div style="margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--border);">
            <p class="body-xs" style="font-family:var(--font-mono);">Accepted 2 · Rejected 1 · Custom 0 · Pending 4</p>
          </div>
        </div>

        <!-- Right: detail panel -->
        <article class="queue-right detail-panel" id="issue-detail">

          <!-- Header: breadcrumb + title + tags -->
          <header class="detail-head">
            <div>
              <span class="detail-crumb">Dialogue · Chapter 11 · river scene</span>
              <h3 class="detail-title">Abstract phrasing weakens river-scene tension</h3>
            </div>
            <div class="detail-tags">
              <span class="dtag dtag-must">Must</span>
              <span class="dtag dtag-spine">Spine-critical</span>
              <span class="dtag dtag-conf">Moderate confidence</span>
            </div>
          </header>

          <!-- Evidence -->
          <section class="dp-section dp-evidence">
            <h4 class="dp-section-label">Evidence</h4>
            <blockquote class="dp-quote">
              <span class="dp-quote-mark" aria-hidden="true">&ldquo;</span><span class="dp-quoted">It's okay,</span> I whispered. But even as I said it, I knew it wasn't okay.
            </blockquote>
            <p class="dp-anchor">char 1247–1330 · Chapter 11 · river scene</p>
          </section>

          <!-- Diagnosis: 2-col grid -->
          <dl class="dp-section dp-diagnosis">
            <div>
              <dt>Symptom</dt>
              <dd>Emotional contradiction is stated directly instead of dramatized.</dd>
            </div>
            <div>
              <dt>Cause</dt>
              <dd>Internal realization duplicates what the dialogue already implies, flattening the moment into commentary.</dd>
            </div>
            <div>
              <dt>Fix direction</dt>
              <dd>Replace internal explanation with a physical hesitation or interruption beat.</dd>
            </div>
            <div>
              <dt>Reader effect</dt>
              <dd>Tension escalates instead of pausing for narrator gloss.</dd>
            </div>
            <div style="grid-column:1/-1">
              <dt>Mistake-proofing</dt>
              <dd>Preserve the speaker's voice and the dialogue's rhythm. Do not introduce new information about the river or the listener's reaction.</dd>
            </div>
          </dl>

          <!-- Three proposals: stacked A / B / C -->
          <section class="dp-section dp-options" id="proposals">
            <h4 class="dp-section-label">Three structurally distinct proposals</h4>

            <article class="dp-option selected" data-key="A" onclick="selectOption(this)">
              <header class="dp-option-head">
                <span class="dp-opt-key">A</span>
                <span class="dp-opt-mech">Action-beat substitution</span>
              </header>
              <pre class="dp-proposal">&ldquo;It's okay,&rdquo; I whispered.
The lie caught halfway out.</pre>
              <p class="dp-rationale">Replaces internal gloss with a physical reaction; voice fingerprint preserved.</p>
            </article>

            <article class="dp-option" data-key="B" onclick="selectOption(this)">
              <header class="dp-option-head">
                <span class="dp-opt-key">B</span>
                <span class="dp-opt-mech">Interruption beat</span>
              </header>
              <pre class="dp-proposal">&ldquo;It's okay&mdash;&rdquo;
My voice cracked before I could finish.</pre>
              <p class="dp-rationale">Cuts the reassurance mid-line so the failure is heard, not narrated.</p>
            </article>

            <article class="dp-option" data-key="C" onclick="selectOption(this)">
              <header class="dp-option-head">
                <span class="dp-opt-key">C</span>
                <span class="dp-opt-mech">Rendering shift</span>
              </header>
              <pre class="dp-proposal">&ldquo;It's okay.&rdquo;
She looked at me long enough to know I didn't believe it.</pre>
              <p class="dp-rationale">Lets the listener carry the contradiction; closes the scene with weight.</p>
            </article>
          </section>

          <!-- Author controls -->
          <section class="dp-actions" aria-label="Author controls">
            <button class="dp-btn dp-btn-primary" onclick="acceptSelected()">Accept selected</button>
            <button class="dp-btn dp-btn-ghost">Keep original</button>
            <button class="dp-btn dp-btn-ghost">Reject all three</button>
            <button class="dp-btn dp-btn-ghost">Write custom</button>
          </section>

          <!-- Voice-preservation notice -->
          <footer class="dp-voice-note">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="1.5"/></svg>
            <span>Voice-preservation gate passed for all three. Quoted manuscript text remains byte-for-byte unchanged unless you accept a proposal.</span>
          </footer>

        </article>

      </div>
    </div>

  </div>
</section>

<!-- ── THE CONTRACT ───────────────────────────────────────── -->
<section id="contract" class="section border-top bg-ink2">
  <div class="container">
    <p class="chip reveal" style="margin-bottom:3rem;">The contract</p>
    <h2 class="display-lg reveal" style="margin-bottom:0.5rem; max-width:680px; transition-delay:0.06s;">Every opportunity carries its own reasoning chain.</h2>
    <p class="body-lg reveal" style="max-width:640px; margin-bottom:3.5rem; transition-delay:0.1s;">
      No commentary. No vague advice. Each <code style="font-family:var(--font-mono); background:var(--ink); padding:0.1em 0.4em; font-size:0.9em; color:var(--gold);">RevisionOpportunity</code> is a machine-governable work order with six required elements.
    </p>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem 3rem;" class="reveal" style="transition-delay:0.14s;">
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.14em; margin-bottom:0.5rem;">01 Evidence</p>
        <p class="body-sm">Anchored text with character offsets — the exact span being addressed. Never paraphrased.</p>
      </div>
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.14em; margin-bottom:0.5rem;">02 Symptom</p>
        <p class="body-sm">The observable problem in that text. What a reader would feel.</p>
      </div>
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.14em; margin-bottom:0.5rem;">03 Cause</p>
        <p class="body-sm">The mechanism producing the symptom. Why it happens, not just that it does.</p>
      </div>
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.14em; margin-bottom:0.5rem;">04 Fix direction</p>
        <p class="body-sm">A bounded revision move. Specific enough to act on without further interpretation.</p>
      </div>
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.14em; margin-bottom:0.5rem;">05 Reader effect</p>
        <p class="body-sm">What measurably improves if the fix is applied. Stakes, not an optional observation.</p>
      </div>
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold); text-transform:uppercase; letter-spacing:0.14em; margin-bottom:0.5rem;">06 Mistake-proofing</p>
        <p class="body-sm">What must be preserved or avoided so the fix introduces no new damage.</p>
      </div>
    </div>

    <!-- TypeScript type def -->
    <div class="code-block reveal" style="margin-top:3rem; transition-delay:0.18s; white-space:pre; overflow-x:auto; font-size:0.72rem;"><span class="code-comment">// EvaluationResultV2 — the seam between Evaluate, Revise, and Trustpath</span>
<span class="code-keyword">type</span> <span class="code-type">RevisionOpportunity</span> = {
  id: <span class="code-type">string</span>;
  criterionKey: <span class="code-type">string</span>;
  title: <span class="code-type">string</span>;
  severity: <span class="code-string">'must'</span> | <span class="code-string">'should'</span> | <span class="code-string">'could'</span>;
  leverage: <span class="code-string">'spine-critical'</span> | <span class="code-string">'high'</span> | <span class="code-string">'medium'</span> | <span class="code-string">'local'</span>;
  confidenceRisk: <span class="code-string">'low'</span> | <span class="code-string">'moderate'</span> | <span class="code-string">'high'</span>;
  evidence: { snippet: <span class="code-type">string</span>; charStart?: <span class="code-type">number</span>; charEnd?: <span class="code-type">number</span> };
  symptom: <span class="code-type">string</span>;
  cause: <span class="code-type">string</span>;
  fixDirection: <span class="code-type">string</span>;
  readerEffect: <span class="code-type">string</span>;
  mistakeProofing: <span class="code-type">string</span>;
  revisionOptions?: <span class="code-type">RevisionOption</span>[]; <span class="code-comment">// up to three</span>
  handoffTarget: <span class="code-string">'revise'</span> | <span class="code-string">'trustpath-review'</span> | <span class="code-string">'trustpath-safe'</span>;
  state: <span class="code-type">OpportunityState</span>; <span class="code-comment">// pending → reviewing → accepted | customized | rejected | deferred</span>
};</div>

    <!-- Governance guarantees -->
    <div class="gov-grid reveal" style="transition-delay:0.22s;">
      <div class="gov-card">
        <p class="gov-card-code">QG_REVISION_OPPORTUNITY_REQUIRED_FIELDS</p>
        <p style="font-family:var(--font-serif); font-size:1rem; color:var(--cream); margin-bottom:0.5rem; line-height:1.35;">Fail-closed on missing fields</p>
        <p class="body-sm">Rejects any opportunity that cannot stand on its own as a work order.</p>
      </div>
      <div class="gov-card">
        <p class="gov-card-code">QG_REVISION_OPPORTUNITY_NON_DEGENERATE</p>
        <p style="font-family:var(--font-serif); font-size:1rem; color:var(--cream); margin-bottom:0.5rem; line-height:1.35;">No semantic placeholders</p>
        <p class="body-sm">Rejects structurally complete but semantically empty payloads. Generic causes don't pass.</p>
      </div>
      <div class="gov-card">
        <p class="gov-card-code">QG_REVISE_QUEUE_DETERMINISM</p>
        <p style="font-family:var(--font-serif); font-size:1rem; color:var(--cream); margin-bottom:0.5rem; line-height:1.35;">Deterministic queue</p>
        <p class="body-sm">Identical input always yields identical ordering. No drift between sessions.</p>
      </div>
      <div class="gov-card">
        <p class="gov-card-code">QG_REVISE_HANDOFF_ID_FIDELITY</p>
        <p style="font-family:var(--font-serif); font-size:1rem; color:var(--cream); margin-bottom:0.5rem; line-height:1.35;">Lossless handoff</p>
        <p class="body-sm">Every link from Evaluate lands on the exact same opportunity in Revise.</p>
      </div>
    </div>

  </div>
</section>

<!-- ── LONG-FORM / GOLDEN SPINE ───────────────────────────── -->
<section id="long-form" class="section border-top">
  <div class="container">
    <p class="chip reveal" style="margin-bottom:3rem;">Long-form mode</p>
    <h2 class="display-lg reveal" style="max-width:700px; margin-bottom:1.5rem; transition-delay:0.06s;">
      At <em class="gold">25,000 words</em>, the architecture becomes mandatory.
    </h2>
    <p class="body-lg reveal" style="max-width:660px; margin-bottom:3.5rem; transition-delay:0.1s;">
      An 84,000-word manuscript is not a stretched chapter. Above the threshold, Revise switches to operating-system mode: <strong style="font-weight:500; color:var(--cream);">WAVE</strong> intelligence and the <em class="gold">golden spine</em> become contract-enforced surfaces, not optional metadata.
    </p>

    <div style="display:grid; grid-template-columns:1fr 320px; gap:2rem; align-items:start;" class="reveal long-form-grid" style="transition-delay:0.14s;">
      <!-- Five WAVE signals -->
      <div>
        <div style="display:flex;flex-direction:column;gap:1.25rem; margin-bottom:1.5rem;">
          <div style="display:flex;gap:1rem;"><span class="gold" style="font-family:var(--font-mono);flex-shrink:0;padding-top:0.15rem;">✦</span><div><span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--cream);">Continuity chain.</span> <span class="body-sm">Promises opened, promises closed, threads still live at the midpoint.</span></div></div>
          <div style="display:flex;gap:1rem;"><span class="gold" style="font-family:var(--font-mono);flex-shrink:0;padding-top:0.15rem;">✦</span><div><span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--cream);">Pressure continuity.</span> <span class="body-sm">Where narrative tension plateaus across chapter boundaries.</span></div></div>
          <div style="display:flex;gap:1rem;"><span class="gold" style="font-family:var(--font-mono);flex-shrink:0;padding-top:0.15rem;">✦</span><div><span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--cream);">Pacing valleys.</span> <span class="body-sm">Scene density drops mapped to specific chapter ranges.</span></div></div>
          <div style="display:flex;gap:1rem;"><span class="gold" style="font-family:var(--font-mono);flex-shrink:0;padding-top:0.15rem;">✦</span><div><span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--cream);">Unresolved promises.</span> <span class="body-sm">Setups that have not yet paid off, with evidence anchors.</span></div></div>
          <div style="display:flex;gap:1rem;"><span class="gold" style="font-family:var(--font-mono);flex-shrink:0;padding-top:0.15rem;">✦</span><div><span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--cream);">Thematic propagation.</span> <span class="body-sm">How the manuscript's motifs travel — or don't — through the second act.</span></div></div>
        </div>
        <div class="code-block" style="font-size:0.75rem;">
<span class="gold">✦</span>  If <span class="highlight-code">wordCount &gt; 25000</span> and the wave surface is missing,
   the contract <span style="color:var(--red);">fails closed</span>.
        </div>
      </div>

      <!-- Metrics sidebar -->
      <div class="card" style="font-family:var(--font-mono); font-size:0.75rem;">
        <p class="mono-xs gold" style="margin-bottom:1rem;">Golden Spine</p>
        <p class="body-xs" style="margin-bottom:1.25rem;">84,000 words · Manuscript mode</p>
        <div id="wave-metrics">
          <div class="metric-row"><div class="metric-header"><span class="dim" style="text-transform:uppercase;letter-spacing:0.12em;font-size:0.65rem;">Continuity</span><span style="color:var(--cream2);">strong</span></div><div class="metric-track"><div class="metric-fill" style="width:85%"></div></div></div>
          <div class="metric-row"><div class="metric-header"><span class="dim" style="text-transform:uppercase;letter-spacing:0.12em;font-size:0.65rem;">Pressure</span><span style="color:var(--cream2);">plateau Ch. 12–14</span></div><div class="metric-track"><div class="metric-fill" style="width:55%"></div></div></div>
          <div class="metric-row"><div class="metric-header"><span class="dim" style="text-transform:uppercase;letter-spacing:0.12em;font-size:0.65rem;">Pacing</span><span style="color:var(--cream2);">valley Ch. 13</span></div><div class="metric-track"><div class="metric-fill" style="width:45%"></div></div></div>
          <div class="metric-row"><div class="metric-header"><span class="dim" style="text-transform:uppercase;letter-spacing:0.12em;font-size:0.65rem;">Promises</span><span style="color:var(--cream2);">3 unresolved</span></div><div class="metric-track"><div class="metric-fill" style="width:70%"></div></div></div>
          <div class="metric-row"><div class="metric-header"><span class="dim" style="text-transform:uppercase;letter-spacing:0.12em;font-size:0.65rem;">Thematic</span><span style="color:var(--cream2);">propagating</span></div><div class="metric-track"><div class="metric-fill" style="width:75%"></div></div></div>
        </div>
        <div style="border-top:1px solid var(--border); padding-top:1rem; display:flex; flex-wrap:wrap; gap:0.75rem; margin-top:0.5rem;">
          <span style="color:var(--red); font-size:0.72rem;">2 spine-critical</span>
          <span class="gold" style="font-size:0.72rem;">3 high leverage</span>
          <span style="color:var(--cream2); font-size:0.72rem;">2 local</span>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- ── VOICE ──────────────────────────────────────────────── -->
<section class="section border-top bg-ink2">
  <div class="container" style="text-align:center;">
    <h2 class="display-lg reveal" style="margin-bottom:0.5rem;">Critic voice <em class="gold">normalized</em>.</h2>
    <h2 class="display-lg reveal" style="margin-bottom:2.5rem; transition-delay:0.06s;">Author voice <em class="gold">preserved, byte-for-byte</em>.</h2>
    <p class="body-lg reveal" style="max-width:600px; margin-inline:auto; margin-bottom:3rem; transition-delay:0.1s;">
      Quoted manuscript text is never altered unless you accept a proposal. Voice fingerprints — repetition, rhythm, intentional fragments — are protected at the renderer boundary. Proof-mode discipline, not a stylistic suggestion.
    </p>

    <div class="voice-panel reveal" style="max-width:680px; margin-inline:auto; text-align:left; transition-delay:0.14s;">
      <p class="mono-xs gold" style="margin-bottom:1.25rem;">Voice guardrail in action</p>
      <div class="voice-cols">
        <div>
          <p class="mono-xs dim" style="margin-bottom:0.5rem;">The text</p>
          <div class="card" style="padding:1rem; font-family:var(--font-serif); font-size:0.95rem; margin-bottom:0.625rem;">
            <p style="color:var(--cream);">"For who?"</p>
          </div>
          <p class="body-xs" style="font-family:var(--font-mono);">Colloquialism. "For whom?" is standard grammar. This is dialogue register — not an error.</p>
        </div>
        <div>
          <p class="mono-xs dim" style="margin-bottom:0.5rem;">What REVISE does</p>
          <div class="card card-gold" style="padding:1rem; font-family:var(--font-mono); font-size:0.72rem;">
            <p class="gold" style="margin-bottom:0.5rem;">COLLOQUIALISM · PROTECTED</p>
            <p class="body-sm" style="font-family:var(--font-mono);">Accepted speech pattern under dialogue register rules. "For who?" is how this character speaks. The instrument does not normalize it.</p>
          </div>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- ── CTA ────────────────────────────────────────────────── -->
<section class="section border-top">
  <div class="container" style="text-align:center; padding-block:5rem;">
    <p class="body-sm reveal" style="font-family:var(--font-mono); color:var(--dim); margin-bottom:1.5rem;">RevisionGrade is in private beta.</p>
    <h2 class="display-xl reveal" style="max-width:680px; margin-inline:auto; margin-bottom:1.5rem; transition-delay:0.06s;">
      Revise is the next epic on the ladder.
    </h2>
    <p class="body-lg reveal" style="max-width:520px; margin-inline:auto; margin-bottom:3.5rem; transition-delay:0.1s;">
      The diagnostic spine is hardened. The primitive is canonical. The execution surface is being built against governed contracts — not feature aspirations.
    </p>
    <div class="btn-group btn-group-center reveal" style="transition-delay:0.14s;">
      <a href="workbench.html" class="btn btn-cream-fill">Request access</a>
      <a href="#" class="btn btn-ghost">Tester sign in</a>
    </div>
  </div>
</section>

<!-- ── FOOTER ─────────────────────────────────────────────── -->
<footer class="footer">
  <div class="footer-inner">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-bottom:2rem;" class="footer-revise-grid">
      <div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; letter-spacing:0.18em; text-transform:uppercase; color:var(--gold); margin-bottom:0.5rem;">RevisionGrade™</p>
        <p class="body-xs">A governed revision operating system.</p>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:1.5rem; justify-content:flex-end; align-items:flex-start;">
        <a href="#how" class="body-xs" style="font-family:var(--font-mono); color:var(--dim); transition:color 0.15s;">How it works</a>
        <a href="#contract" class="body-xs" style="font-family:var(--font-mono); color:var(--dim); transition:color 0.15s;">Contract</a>
        <a href="#long-form" class="body-xs" style="font-family:var(--font-mono); color:var(--dim); transition:color 0.15s;">Long-form</a>
        <a href="#" class="body-xs" style="font-family:var(--font-mono); color:var(--dim); transition:color 0.15s;">Sign in</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>Framework-driven analysis does not replace human editorial judgment.</p>
      <p>© 2026 RevisionGrade. Publishing- &amp; Hollywood-Ready.</p>
    </div>
  </div>
</footer>

<style>
@media (max-width: 768px) {
  .long-form-grid { grid-template-columns: 1fr !important; }
  .footer-revise-grid { grid-template-columns: 1fr !important; }
  .footer-revise-grid > div:last-child { justify-content: flex-start !important; }
  [style*="grid-template-columns:repeat(3,1fr)"] { grid-template-columns: 1fr !important; }
}
</style>

<script>
// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.06 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Queue interaction
function selectItem(id) {
  document.querySelectorAll('.queue-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.queue-item')[id]?.classList.add('active');
}
// Select first by default
selectItem(0);
document.querySelectorAll('.queue-item')[0]?.classList.add('active');

// Proposal / option selection (new detail-panel style)
function selectOption(el) {
  document.querySelectorAll('.dp-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
// Legacy alias — keep for any old .proposal-card references
function selectProposal(el) {
  document.querySelectorAll('.proposal-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
// Accept selected: flash the primary button as confirmation
function acceptSelected() {
  const btn = document.querySelector('.dp-btn-primary');
  const sel = document.querySelector('.dp-option.selected');
  if (!btn) return;
  const key = sel ? sel.dataset.key : '?';
  btn.textContent = '✓ Option ' + key + ' accepted';
  btn.style.background = 'var(--success)';
  btn.style.borderColor = 'var(--success)';
  setTimeout(() => {
    btn.textContent = 'Accept selected';
    btn.style.background = '';
    btn.style.borderColor = '';
  }, 2200);
}

// Filter tabs
function setFilter(btn, tier) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.queue-item').forEach(item => {
    if (tier === 'ALL' || item.dataset.tier === tier) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}
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
