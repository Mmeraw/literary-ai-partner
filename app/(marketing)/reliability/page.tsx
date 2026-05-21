import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reliability — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reliability — RevisionGrade</title>
  <meta name="description" content="Framework-driven analysis governed by contract. Every evaluation is auditable, fail-closed, and zero-silent-failure. Not a promise — a governed contract." />
  <meta property="og:title" content="Reliability — RevisionGrade" />
  <meta property="og:description" content="Not a promise. A governed contract." />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <link href="https://api.fontshare.com/v2/css?f[]=switzer@400,450,500&display=swap" rel="stylesheet" />

  <style>
    /* ─── Design Tokens ─────────────────────────────────────────────── */
    :root {
      --ink:        #0D0A05;
      --surface:    #14110C;
      --raised:     #1E180F;
      --cream:      #F5EFE0;
      --cream2:     #DDD5C2;
      --cream3:     #B8AE9C;
      --gold:       #C8A96E;
      --gold-mute:  #a8893b;
      --border:     rgba(200, 169, 110, 0.15);
      --border-strong: rgba(200, 169, 110, 0.35);

      --ease-out:   cubic-bezier(0.16, 1, 0.3, 1);
      --ease-in:    cubic-bezier(0.4, 0, 1, 1);
      --ease-io:    cubic-bezier(0.4, 0, 0.2, 1);
      --transition: 180ms cubic-bezier(0.16, 1, 0.3, 1);

      --font-display: 'Instrument Serif', Georgia, serif;
      --font-body:    'Switzer', system-ui, sans-serif;
      --font-mono:    'SF Mono', 'Fira Mono', 'Cascadia Code', monospace;
    }

    /* ─── Reset ─────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--ink);
      color: var(--cream);
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    img { display: block; max-width: 100%; }
    a { color: inherit; text-decoration: none; }

    /* ─── Utility ────────────────────────────────────────────────────── */
    .container {
      width: 100%;
      max-width: 1160px;
      margin-inline: auto;
      padding-inline: clamp(1.25rem, 5vw, 4rem);
    }
    .mono {
      font-family: var(--font-mono);
      font-size: 0.68rem;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: var(--cream3);
    }
    .gold { color: var(--gold); }
    .rule {
      border: none;
      border-top: 1px solid var(--border-strong);
      margin: 0;
    }

    /* ─── Scroll-reveal (Intersection Observer) ──────────────────────── */
    .reveal {
      opacity: 0;
      transform: translateY(18px);
      transition:
        opacity 0.7s var(--ease-out),
        transform 0.7s var(--ease-out);
      will-change: opacity, transform;
    }
    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .reveal-delay-1 { transition-delay: 0.08s; }
    .reveal-delay-2 { transition-delay: 0.16s; }
    .reveal-delay-3 { transition-delay: 0.24s; }
    .reveal-delay-4 { transition-delay: 0.32s; }

    /* ─── NAV ────────────────────────────────────────────────────────── */
    .nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(13, 10, 5, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      transition: box-shadow 0.3s var(--ease-out);
    }
    .nav--scrolled { box-shadow: 0 1px 24px rgba(0,0,0,0.5); }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
    }
    .nav-logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .nav-logo svg { width: 28px; height: 28px; }
    .nav-wordmark {
      font-family: var(--font-display);
      font-size: 1rem;
      color: var(--cream);
      letter-spacing: 0.04em;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 2rem;
      list-style: none;
    }
    .nav-links a {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--cream3);
      transition: color var(--transition);
    }
    .nav-links a:hover,
    .nav-links a.active { color: var(--gold); }
    .nav-links a.active {
      border-bottom: 1px solid var(--gold);
      padding-bottom: 1px;
    }

    /* hamburger */
    .nav-toggle {
      display: none;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      width: 32px;
      height: 32px;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }
    .nav-toggle span {
      display: block;
      height: 1px;
      background: var(--cream3);
      transition: background var(--transition);
    }
    .nav-toggle:hover span { background: var(--gold); }

    /* ─── HERO ───────────────────────────────────────────────────────── */
    .hero {
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      padding-block: clamp(5rem, 8vh, 7rem);
      overflow: hidden;
    }
    /* subtle noise texture overlay */
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(ellipse 80% 60% at 50% 100%, rgba(200,169,110,0.04) 0%, transparent 70%),
        url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
    }
    /* gold gradient line at bottom of hero */
    .hero::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gold-mute), transparent);
      opacity: 0.6;
    }

    .hero-label {
      margin-bottom: 2.5rem;
      animation: fadeUp 0.8s var(--ease-out) both;
      animation-delay: 0.1s;
    }
    .hero-display {
      font-family: 'Instrument Serif', 'Georgia', 'Times New Roman', serif;
      font-weight: 400;
      font-style: normal;
      font-size: clamp(72px, 14vw, 180px);
      line-height: 0.92;
      letter-spacing: -0.03em;
      color: var(--cream);
      margin-bottom: 1.8rem;
      animation: fadeUp 0.9s var(--ease-out) both;
      animation-delay: 0.2s;
      text-shadow: 0 2px 60px rgba(200,169,110,0.08);
    }
    .hero-subtitle {
      font-family: var(--font-display);
      font-style: italic;
      font-size: clamp(1.35rem, 3vw, 2.2rem);
      color: var(--cream2);
      line-height: 1.2;
      margin-bottom: 2.5rem;
      animation: fadeUp 1s var(--ease-out) both;
      animation-delay: 0.35s;
    }
    .hero-rule {
      width: 100%;
      max-width: 480px;
      height: 1px;
      background: linear-gradient(90deg, var(--gold-mute), transparent);
      margin-bottom: 2rem;
      animation: expandRule 1s var(--ease-out) both;
      animation-delay: 0.5s;
    }
    .hero-body {
      font-size: 0.9rem;
      color: var(--cream3);
      max-width: 52ch;
      animation: fadeUp 1s var(--ease-out) both;
      animation-delay: 0.6s;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(22px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes expandRule {
      from { transform: scaleX(0); transform-origin: left; opacity: 0; }
      to   { transform: scaleX(1); transform-origin: left; opacity: 1; }
    }

    /* ─── THREE PILLARS ─────────────────────────────────────────────── */
    .s-pillars {
      background: var(--surface);
      padding-block: clamp(3rem, 5vw, 5rem);
      border-bottom: 1px solid var(--border);
      position: relative;
      overflow: hidden;
    }
    /* faint vertical gold line behind the heading */
    .s-pillars::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      width: 1px;
      height: 100%;
      background: linear-gradient(180deg, transparent, rgba(200,169,110,0.08) 30%, rgba(200,169,110,0.08) 70%, transparent);
      pointer-events: none;
    }

    .pillars-intro {
      max-width: 820px;
      margin-bottom: clamp(3.5rem, 6vw, 5.5rem);
    }
    .pillars-eyebrow {
      margin-bottom: 1.5rem;
    }
    .pillars-heading {
      font-family: var(--font-display);
      font-size: clamp(2rem, 5vw, 3.6rem);
      color: var(--cream);
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
    }
    /* The  italic / Noun upright split */
    .pillar-the {
      font-style: italic;
      color: var(--gold);
    }
    .pillar-noun {
      font-style: normal;
    }
    .pillars-subhead {
      font-size: 1rem;
      color: var(--cream3);
      max-width: 52ch;
      line-height: 1.65;
    }

    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--border);
      position: relative;
    }
    .pillar {
      background: var(--raised);
      padding: clamp(2rem, 4vw, 3rem) clamp(1.5rem, 3vw, 2.5rem);
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      position: relative;
    }
    /* animated top gold bar */
    .pillar::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--gold), var(--gold-mute));
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.6s var(--ease-out);
    }
    .pillar.visible::before {
      transform: scaleX(1);
    }
    .pillar-index {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gold-mute);
    }
    .pillar-name {
      font-family: var(--font-display);
      font-size: clamp(1.8rem, 3.5vw, 2.6rem);
      line-height: 1.05;
      color: var(--cream);
      letter-spacing: -0.02em;
    }
    .pillar-rule {
      width: 2.5rem;
      height: 1px;
      background: var(--gold-mute);
      opacity: 0.5;
    }
    .pillar-desc {
      font-size: 0.95rem;
      color: var(--cream2);
      line-height: 1.7;
    }
    .pillar-tag {
      margin-top: auto;
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 0.58rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--gold);
      border: 1px solid rgba(200,169,110,0.25);
      padding: 0.35rem 0.7rem;
      border-radius: 2px;
      width: fit-content;
    }

    /* ─── SECTION SHARED ─────────────────────────────────────────────── */
    .section {
      padding-block: clamp(4rem, 8vw, 7rem);
      border-bottom: 1px solid var(--border);
    }
    .section-label {
      margin-bottom: 2.5rem;
    }
    .section-heading {
      font-family: var(--font-display);
      font-size: clamp(1.7rem, 4vw, 2.9rem);
      color: var(--cream);
      line-height: 1.15;
      margin-bottom: 1.5rem;
    }
    .section-body {
      font-size: 1rem;
      color: var(--cream2);
      max-width: 60ch;
      line-height: 1.7;
    }

    /* ─── SECTION 1 — THE CONTRACT ───────────────────────────────────── */
    .s-contract { background: var(--ink); }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      margin-top: 3.5rem;
    }
    .stat-cell {
      background: var(--surface);
      padding: clamp(2rem, 4vw, 3rem) clamp(1.5rem, 3vw, 2.5rem);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .stat-number {
      font-family: var(--font-display);
      font-size: clamp(3rem, 7vw, 5.5rem);
      line-height: 1;
      color: var(--gold);
      letter-spacing: -0.03em;
    }
    .stat-desc {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--cream3);
      line-height: 1.5;
    }

    /* ─── SECTION 2 — WHAT RELIABILITY MEANS ────────────────────────── */
    .s-meaning { background: var(--surface); }
    .pull-quote {
      font-family: var(--font-display);
      font-style: italic;
      font-size: clamp(1.4rem, 3.5vw, 2.4rem);
      color: var(--cream);
      line-height: 1.25;
      max-width: 720px;
      padding-left: 2rem;
      border-left: 2px solid var(--gold-mute);
      margin-bottom: 3.5rem;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5px;
      background: var(--border);
    }
    .card {
      background: var(--raised);
      padding: clamp(1.5rem, 3vw, 2.5rem);
      border-top: 2px solid var(--gold-mute);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .card-title {
      font-family: var(--font-display);
      font-size: 1.15rem;
      color: var(--cream);
      letter-spacing: 0.01em;
    }
    .card-body {
      font-size: 0.92rem;
      color: var(--cream3);
      line-height: 1.65;
    }

    /* ─── SECTION 3 — THE NUMBERS ────────────────────────────────────── */
    .s-numbers { background: var(--ink); }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      margin-top: 3.5rem;
    }
    .kpi-box {
      background: var(--surface);
      padding: clamp(1.5rem, 3vw, 2rem) clamp(1.25rem, 2.5vw, 2rem);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      position: relative;
    }
    .kpi-box::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, var(--gold-mute), transparent);
      opacity: 0.5;
    }
    .kpi-value {
      font-family: var(--font-display);
      font-size: clamp(2rem, 4.5vw, 3.2rem);
      color: var(--cream);
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .kpi-sublabel {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--gold);
    }
    .kpi-label {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--cream3);
      margin-top: 0.25rem;
    }

    /* ─── SECTION 4 — THE GUARANTEE ──────────────────────────────────── */
    .s-guarantee {
      background: var(--raised);
      text-align: center;
      padding-block: clamp(5rem, 10vw, 9rem);
      position: relative;
      overflow: hidden;
    }
    /* radial glow */
    .s-guarantee::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 700px;
      height: 400px;
      background: radial-gradient(ellipse, rgba(200,169,110,0.05) 0%, transparent 70%);
      pointer-events: none;
    }
    .guarantee-heading {
      font-family: var(--font-display);
      font-size: clamp(2rem, 5vw, 3.8rem);
      color: var(--cream);
      line-height: 1.1;
      margin-bottom: 2.5rem;
      position: relative;
    }
    .guarantee-body {
      font-size: 1rem;
      color: var(--cream2);
      line-height: 1.75;
      max-width: 58ch;
      margin-inline: auto;
      position: relative;
    }
    .guarantee-body p + p { margin-top: 1.2em; }

    /* ─── FOOTER ─────────────────────────────────────────────────────── */
    .footer {
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding-block: 2.5rem;
    }
    .footer-inner {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .footer-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .footer-tagline {
      font-family: var(--font-mono);
      font-size: 0.62rem;
      letter-spacing: 0.1em;
      color: var(--cream3);
      text-transform: uppercase;
    }
    .footer-domain {
      font-family: var(--font-mono);
      font-size: 0.62rem;
      letter-spacing: 0.1em;
      color: var(--gold-mute);
      text-transform: lowercase;
    }
    .footer-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 1.5rem;
      list-style: none;
      border-top: 1px solid var(--border);
      padding-top: 1.25rem;
    }
    .footer-nav a {
      font-family: var(--font-mono);
      font-size: 0.62rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--cream3);
      transition: color var(--transition);
    }
    .footer-nav a:hover { color: var(--gold); }

    /* ─── DECORATIVE — gold micro-line dividers ───────────────────────── */
    .gold-rule {
      height: 1px;
      background: linear-gradient(90deg, var(--gold-mute) 0%, transparent 60%);
      margin-block: 2rem;
      opacity: 0.4;
    }

    /* ─── RESPONSIVE ─────────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .nav-links { display: none; }
      .nav-toggle { display: flex; }
      .nav-links.open {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1.25rem;
        position: absolute;
        top: 56px;
        left: 0;
        right: 0;
        background: rgba(13,10,5,0.97);
        backdrop-filter: blur(14px);
        padding: 1.75rem clamp(1.25rem, 5vw, 4rem);
        border-bottom: 1px solid var(--border);
        z-index: 99;
      }
      .pillars-grid { grid-template-columns: 1fr; }
      .stats-row { grid-template-columns: 1fr; }
      .cards-grid { grid-template-columns: 1fr; }
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 480px) {
      .kpi-grid { grid-template-columns: 1fr; }
      .footer-top { flex-direction: column; gap: 0.5rem; }
    }

    /* ─── Reduced motion ─────────────────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .reveal,
      .hero-label,
      .hero-display,
      .hero-subtitle,
      .hero-rule,
      .hero-body {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  </style>
</head>
<body>

  <!-- ─── NAV ──────────────────────────────────────────────────────── -->
  <nav class="nav" id="nav" role="navigation" aria-label="Main navigation">
    <div class="container">
      <div class="nav-inner">
        <a href="#" class="nav-logo" aria-label="RevisionGrade home">
          <!-- SVG mark: stylised RG letterform -->
          <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="26" height="26" rx="4" stroke="rgba(200,169,110,0.3)" stroke-width="1"/>
            <!-- R left vertical -->
            <rect x="6" y="7" width="2" height="14" fill="#C8A96E"/>
            <!-- R top bowl -->
            <path d="M8 7 H14 Q17 7 17 10.5 Q17 14 14 14 H8" stroke="#C8A96E" stroke-width="2" fill="none"/>
            <!-- R leg -->
            <line x1="14" y1="14" x2="17" y2="21" stroke="#C8A96E" stroke-width="2" stroke-linecap="round"/>
            <!-- G arc -->
            <path d="M22 9 Q19 7 17.5 10.5 Q16 14 18 17 Q20 20 22 18.5 V15.5 H19.5" stroke="#C8A96E" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="nav-wordmark">RevisionGrade</span>
        </a>

        <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul class="nav-links" id="navLinks">
          <li><a href="#">Landing</a></li>
          <li><a href="#">Revise</a></li>
          <li><a href="#">Pricing</a></li>
          <li><a href="#">Resources</a></li>
          <li><a href="#">Dashboard</a></li>
          <li><a href="#" class="active">Workbench</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <main>

    <!-- ─── HERO ────────────────────────────────────────────────────── -->
    <section class="hero" aria-labelledby="hero-heading">
      <div class="container">
        <p class="hero-label mono">RevisionGrade™ &nbsp;·&nbsp; Layer-Zero Canon</p>

        <h1 id="hero-heading" class="hero-display">RELIABILITY</h1>

        <p class="hero-subtitle">"Not a promise. A governed contract."</p>

        <div class="hero-rule" aria-hidden="true"></div>

        <p class="hero-body">
          Framework-driven analysis. Not a replacement for human editorial judgment.
        </p>
      </div>
    </section>

    <!-- ─── THREE PILLARS ─────────────────────────────────────────────── -->
    <section class="s-pillars" aria-labelledby="pillars-heading">
      <div class="container">

        <div class="pillars-intro">
          <div class="pillars-eyebrow reveal">
            <span class="mono">The Foundation &nbsp;·&nbsp; Why Reliability Is Credible</span>
          </div>
          <h2 id="pillars-heading" class="pillars-heading reveal reveal-delay-1">
            Three pillars.<br>One guarantee.
          </h2>
          <p class="pillars-subhead reveal reveal-delay-2">
            RELIABILITY is not a property of the output alone. It flows from the
            three governed systems that produce it — each auditable, each fail-closed,
            each a named contract between RevisionGrade and every author it serves.
          </p>
        </div>

        <div class="pillars-grid" role="list">

          <!-- Pillar 1: The Engine -->
          <article class="pillar reveal" role="listitem">
            <span class="pillar-index">Pillar 01</span>
            <h3 class="pillar-name">
              <span class="pillar-the">The&thinsp;</span><span class="pillar-noun">Engine</span>
            </h3>
            <div class="pillar-rule" aria-hidden="true"></div>
            <p class="pillar-desc">
              The AI evaluation core that reads structurally, narratively, and at manuscript scale simultaneously. It does not skim for surface errors — it holds the entire text in context and interrogates coherence, causality, and craft at every level. Every pass it makes is logged against a defined contract before its output advances.
            </p>
            <span class="pillar-tag">AI Evaluation Core</span>
          </article>

          <!-- Pillar 2: The Instrument -->
          <article class="pillar reveal reveal-delay-1" role="listitem">
            <span class="pillar-index">Pillar 02</span>
            <h3 class="pillar-name">
              <span class="pillar-the">The&thinsp;</span><span class="pillar-noun">Instrument</span>
            </h3>
            <div class="pillar-rule" aria-hidden="true"></div>
            <p class="pillar-desc">
              The canonical 13-criteria framework that governs what gets flagged and what does not. No criterion is implicit. Each maps to a specific, testable claim about the manuscript — and every claim must clear a defined threshold before the engine issues a finding. The Instrument is why two evaluations of the same text converge.
            </p>
            <span class="pillar-tag">13-Criteria Framework</span>
          </article>

          <!-- Pillar 3: The Methodology -->
          <article class="pillar reveal reveal-delay-2" role="listitem">
            <span class="pillar-index">Pillar 03</span>
            <h3 class="pillar-name">
              <span class="pillar-the">The&thinsp;</span><span class="pillar-noun">Methodology</span>
            </h3>
            <div class="pillar-rule" aria-hidden="true"></div>
            <p class="pillar-desc">
              The governed contract between analysis and editorial judgment. The Methodology defines what RevisionGrade will assert, what it will decline to assert, and how every finding is bounded by evidential scope. It is the reason an evaluation can be audited, disputed, and improved — and the reason it is never confused with a final editorial decision.
            </p>
            <span class="pillar-tag">Governed Contract</span>
          </article>

        </div>
      </div>
    </section>

    <!-- ─── SECTION 1 — THE CONTRACT ────────────────────────────────── -->
    <section class="section s-contract" aria-labelledby="s1-heading">
      <div class="container">
        <div class="section-label reveal">
          <span class="mono">Section 01 &nbsp;—&nbsp; The Contract</span>
        </div>

        <h2 id="s1-heading" class="section-heading reveal reveal-delay-1">
          Every evaluation is governed,<br>not guessed.
        </h2>

        <div class="stats-row" role="list">
          <div class="stat-cell reveal" role="listitem">
            <span class="stat-number gold">11</span>
            <span class="stat-desc">Canonical pipeline steps</span>
          </div>
          <div class="stat-cell reveal reveal-delay-1" role="listitem">
            <span class="stat-number gold">100%</span>
            <span class="stat-desc">Failed-closed on detected failure</span>
          </div>
          <div class="stat-cell reveal reveal-delay-2" role="listitem">
            <span class="stat-number gold">0</span>
            <span class="stat-desc">Silent failures tolerated</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── SECTION 2 — WHAT RELIABILITY MEANS ──────────────────────── -->
    <section class="section s-meaning" aria-labelledby="s2-heading">
      <div class="container">
        <div class="section-label reveal">
          <span class="mono">Section 02 &nbsp;—&nbsp; What Reliability Means Here</span>
        </div>

        <h2 id="s2-heading" class="sr-only">What Reliability Means</h2>

        <blockquote class="pull-quote reveal reveal-delay-1">
          "Reliability is not uptime. It is the guarantee that what we tell you is true."
        </blockquote>

        <div class="cards-grid" role="list">
          <article class="card reveal" role="listitem">
            <h3 class="card-title">Fail-closed architecture</h3>
            <p class="card-body">
              Every step either passes its contract or stops the pipeline. No partial output reaches an author.
            </p>
          </article>
          <article class="card reveal reveal-delay-1" role="listitem">
            <h3 class="card-title">Auditable step contracts</h3>
            <p class="card-body">
              Every job persists input.spec, metric, and output.spec at each of 11 pipeline stages. Nothing is hidden.
            </p>
          </article>
          <article class="card reveal reveal-delay-2" role="listitem">
            <h3 class="card-title">Zero silent failures</h3>
            <p class="card-body">
              Every failure has a ledger entry. Absent failures are visible, not hidden.
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- ─── SECTION 3 — THE NUMBERS ─────────────────────────────────── -->
    <section class="section s-numbers" aria-labelledby="s3-heading">
      <div class="container">
        <div class="section-label reveal">
          <span class="mono">Section 03 &nbsp;—&nbsp; The Numbers &nbsp;·&nbsp; 24h Window</span>
        </div>

        <h2 id="s3-heading" class="section-heading reveal reveal-delay-1">
          What the ledger shows.
        </h2>

        <div class="kpi-grid" role="list">
          <div class="kpi-box reveal" role="listitem">
            <span class="kpi-value">64.3%</span>
            <span class="kpi-sublabel">Pass rate</span>
            <span class="kpi-label">9 / 14 PASS</span>
          </div>
          <div class="kpi-box reveal reveal-delay-1" role="listitem">
            <span class="kpi-value">5 / 5</span>
            <span class="kpi-sublabel">Failed-closed</span>
            <span class="kpi-label">no silent fails</span>
          </div>
          <div class="kpi-box reveal reveal-delay-2" role="listitem">
            <span class="kpi-value">186s</span>
            <span class="kpi-sublabel">p50 duration</span>
            <span class="kpi-label">budget 720s</span>
          </div>
          <div class="kpi-box reveal reveal-delay-3" role="listitem">
            <span class="kpi-value">87.4%</span>
            <span class="kpi-sublabel">Coverage avg</span>
            <span class="kpi-label">target ≥ 99.5%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── SECTION 4 — THE GUARANTEE ───────────────────────────────── -->
    <section class="s-guarantee" aria-labelledby="s4-heading">
      <div class="container">
        <div class="section-label reveal" style="margin-bottom:2rem;">
          <span class="mono">Section 04 &nbsp;—&nbsp; The Guarantee</span>
        </div>

        <h2 id="s4-heading" class="guarantee-heading reveal reveal-delay-1">
          We will tell you when we are wrong.
        </h2>

        <div class="guarantee-body reveal reveal-delay-2">
          <p>
            If the engine cannot complete a step with integrity, it stops and reports — rather than generating plausible-sounding output that cannot be verified. Every termination is logged, timestamped, and surfaced. You see the failure before it reaches your authors.
          </p>
          <p>
            This is not a quality-of-life feature. It is the foundation of trust. A system that hides its own failures cannot be trusted. A system that reports them can be improved. RevisionGrade's reliability guarantee is architectural: the pipeline is fail-closed or it does not ship.
          </p>
        </div>
      </div>
    </section>

  </main>

  <!-- ─── FOOTER ────────────────────────────────────────────────────── -->
  <footer class="footer" role="contentinfo">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-top">
          <p class="footer-tagline">
            Framework-driven analysis. Not a replacement for human editorial judgment.
          </p>
          <span class="footer-domain">revisiongrade.com</span>
        </div>
        <ul class="footer-nav" role="list" aria-label="Site pages">
          <li><a href="#">Landing</a></li>
          <li><a href="#">Revise</a></li>
          <li><a href="#">Pricing</a></li>
          <li><a href="#">Resources</a></li>
          <li><a href="#">Dashboard</a></li>
          <li><a href="#">Workbench</a></li>
        </ul>
      </div>
    </div>
  </footer>

  <!-- ─── SCRIPTS ───────────────────────────────────────────────────── -->
  <script>
    // ── Scroll reveal (Intersection Observer) ──────────────────────────
    const revealEls = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(el => io.observe(el));

    // ── Nav scroll-aware ────────────────────────────────────────────────
    const nav = document.getElementById('nav');
    let lastY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > 40) {
        nav.classList.add('nav--scrolled');
      } else {
        nav.classList.remove('nav--scrolled');
      }
      lastY = y;
    }, { passive: true });

    // ── Mobile nav toggle ───────────────────────────────────────────────
    const toggle = document.getElementById('navToggle');
    const links  = document.getElementById('navLinks');
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });

    // Close mobile nav on link click
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  </script>

</body>
</html>
`

  return (
    <div
      style={{ all: 'initial', display: 'block' } as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
