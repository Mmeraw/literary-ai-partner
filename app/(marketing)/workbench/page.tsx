import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Revise Workbench — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Revise Workbench — RevisionGrade</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Switzer:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    /* ── Design tokens ─────────────────────────────────────────── */
    :root {
      --ink:            #0D0A05;
      --ink2:           #1A1208;
      --ink3:           #261A0A;
      --surface:        #12100B;
      --surface-raised: #1C160E;
      --cream:          #F5EFE0;
      --cream2:         #C8BEA8;
      --gold:           #C8A96E;
      --gold-mute:      #a8893b;
      --gold-dim:       rgba(200,169,110,0.18);
      --red:            #7A2B1A;
      --dim:            #6B6560;
      --border:         rgba(216,209,192,0.14);
      --border-strong:  rgba(216,209,192,0.28);
      --font-display:   'Instrument Serif', Georgia, serif;
      --font-body:      'Switzer', system-ui, sans-serif;
      --radius:         6px;
      --radius-sm:      4px;
      --radius-md:      8px;
      /* tags */
      --must:   #7A2B1A;
      --should: #5a4a1a;
      --could:  #1a3a2a;
      --high:   #7A2B1A;
      --medium: #5a4a1a;
      --low:    #1a3a2a;
      --spine:  #2a1a5a;
      --local:  #1a3a4a;
      --deferred: #3a3a3a;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      overflow: hidden;
      background: var(--ink);
      color: var(--cream);
      font-family: var(--font-body);
      font-size: 14px;
      line-height: 1.6;
    }

    /* ── Top bar ───────────────────────────────────────────────── */
    .wb-topbar {
      height: 52px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      flex-shrink: 0;
      position: relative;
      z-index: 10;
    }
    .wb-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-body);
      font-weight: 500;
      font-size: 13px;
      color: var(--cream);
      letter-spacing: 0.01em;
      text-decoration: none;
    }
    .wb-brand svg { opacity: 0.7; }
    .wb-brand .tm { font-size: 9px; vertical-align: super; opacity: 0.5; }
    .wb-manuscript {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: var(--dim);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .wb-manuscript span {
      color: var(--cream2);
      text-transform: none;
      letter-spacing: 0;
      font-size: 13px;
    }
    .wb-actions-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .wb-progress {
      font-size: 11px;
      color: var(--dim);
      letter-spacing: 0.04em;
    }
    .wb-progress strong { color: var(--gold); }

    /* ── Layout ────────────────────────────────────────────────── */
    .wb-layout {
      display: flex;
      height: calc(100vh - 52px);
      overflow: hidden;
    }

    /* ── Queue pane (left) ─────────────────────────────────────── */
    .wb-queue {
      width: 280px;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .wb-queue-head {
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .wb-queue-head h2 {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dim);
      margin-bottom: 8px;
    }
    .queue-stats {
      display: flex;
      gap: 14px;
      font-size: 11px;
      color: var(--dim);
    }
    .queue-stats .stat-val { color: var(--cream2); font-weight: 500; }
    .queue-stats .stat-val.accepted { color: var(--gold); }
    .queue-stats .stat-val.rejected { color: #A7472A; }

    .wb-queue-list {
      overflow-y: auto;
      flex: 1;
      padding: 8px 0;
    }
    .wb-queue-list::-webkit-scrollbar { width: 3px; }
    .wb-queue-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

    .q-item {
      padding: 10px 16px;
      cursor: pointer;
      border-left: 2px solid transparent;
      transition: background 0.12s, border-color 0.12s;
      position: relative;
    }
    .q-item:hover { background: var(--surface-raised,#1C160E); }
    .q-item.is-active {
      background: var(--ink3);
      border-left-color: var(--gold);
    }
    .q-item.is-done {
      opacity: 0.45;
      pointer-events: none;
    }
    .q-item.is-done .q-title::after {
      content: attr(data-decision);
      display: inline-block;
      margin-left: 6px;
      font-size: 10px;
      font-family: var(--font-body);
      color: var(--gold);
      font-style: normal;
      font-weight: 500;
    }

    .q-tags {
      display: flex;
      gap: 4px;
      margin-bottom: 5px;
      flex-wrap: wrap;
    }
    .q-tag {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
    }
    .q-tag.tag-must    { background: rgba(122,43,26,0.35); color: #d98b78; border: 1px solid rgba(122,43,26,0.5); }
    .q-tag.tag-should  { background: rgba(90,74,26,0.35);  color: #c8a96e; border: 1px solid rgba(90,74,26,0.5); }
    .q-tag.tag-could   { background: rgba(26,58,42,0.35);  color: #7fa36b; border: 1px solid rgba(26,58,42,0.5); }
    .q-tag.tag-deferred{ background: rgba(58,58,58,0.35);  color: #999;    border: 1px solid rgba(58,58,58,0.5); }
    .q-tag.tag-high    { background: rgba(122,43,26,0.2);  color: #d98b78; border: 1px solid rgba(122,43,26,0.35); }
    .q-tag.tag-medium  { background: rgba(90,74,26,0.2);   color: #c8a96e; border: 1px solid rgba(90,74,26,0.35); }
    .q-tag.tag-low     { background: rgba(26,58,42,0.2);   color: #7fa36b; border: 1px solid rgba(26,58,42,0.35); }
    .q-tag.tag-spine   { background: rgba(42,26,90,0.35);  color: #a09fe0; border: 1px solid rgba(42,26,90,0.5); }
    .q-tag.tag-local   { background: rgba(26,58,74,0.35);  color: #7dd3d8; border: 1px solid rgba(26,58,74,0.5); }
    .q-tag.tag-conf    { display: none; }

    .q-title {
      font-family: var(--font-display);
      font-size: 13px;
      line-height: 1.35;
      color: var(--cream);
    }
    .q-crumb {
      font-size: 10px;
      color: var(--dim);
      margin-top: 3px;
      letter-spacing: 0.02em;
    }
    .q-item.is-active .q-title { color: var(--cream); }

    /* ── Detail pane (right) ───────────────────────────────────── */
    .wb-detail {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--ink);
    }

    .wb-detail-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 28px 36px 24px;
    }
    .wb-detail-scroll::-webkit-scrollbar { width: 4px; }
    .wb-detail-scroll::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

    /* Case header */
    .case-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .case-crumb {
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--dim);
      margin-bottom: 6px;
    }
    .case-title {
      font-family: var(--font-display);
      font-size: 22px;
      line-height: 1.25;
      color: var(--cream);
      max-width: 640px;
    }
    .case-tags {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .c-tag {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 3px 7px;
      border-radius: var(--radius-sm);
    }
    .c-tag.tag-must    { background: rgba(122,43,26,0.35); color: #d98b78; border: 1px solid rgba(122,43,26,0.5); }
    .c-tag.tag-should  { background: rgba(90,74,26,0.35);  color: #c8a96e; border: 1px solid rgba(90,74,26,0.5); }
    .c-tag.tag-could   { background: rgba(26,58,42,0.35);  color: #7fa36b; border: 1px solid rgba(26,58,42,0.5); }
    .c-tag.tag-deferred{ background: rgba(58,58,58,0.35);  color: #999;    border: 1px solid rgba(58,58,58,0.5); }
    .c-tag.tag-high    { background: rgba(122,43,26,0.2);  color: #d98b78; border: 1px solid rgba(122,43,26,0.35); }
    .c-tag.tag-medium  { background: rgba(90,74,26,0.2);   color: #c8a96e; border: 1px solid rgba(90,74,26,0.35); }
    .c-tag.tag-local   { background: rgba(26,58,74,0.35);  color: #7dd3d8; border: 1px solid rgba(26,58,74,0.5); }
    .c-tag.tag-spine   { background: rgba(42,26,90,0.35);  color: #a09fe0; border: 1px solid rgba(42,26,90,0.5); }
    .c-tag.tag-conf    { background: var(--surface); color: var(--dim); border: 1px solid var(--border); }

    /* Evidence blockquote */
    .evidence {
      background: var(--surface-raised,#1C160E);
      border-left: 2px solid var(--gold);
      border-radius: var(--radius);
      padding: 14px 18px;
      margin-bottom: 18px;
    }
    .evidence blockquote {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 16px;
      line-height: 1.55;
      color: var(--cream);
    }
    .evidence blockquote em { color: var(--gold); font-style: italic; }
    .evidence .anchor {
      font-size: 10px;
      color: var(--dim);
      margin-top: 6px;
      letter-spacing: 0.04em;
    }

    /* Diagnosis grid */
    .diagnosis-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-bottom: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .diag-cell {
      padding: 12px 16px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .diag-cell:nth-child(2n) { border-right: none; }
    .diag-cell:nth-last-child(-n+2) { border-bottom: none; }
    .diag-cell.full-width {
      grid-column: 1 / -1;
      border-right: none;
    }
    .diag-label {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 4px;
    }
    .diag-text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--cream2);
    }

    /* Options */
    .options-label {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dim);
      margin-bottom: 10px;
    }
    .options-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .opt-card {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 16px;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.15s, background 0.15s;
      position: relative;
    }
    .opt-card:hover { border-color: var(--border-strong); }
    .opt-card.is-selected {
      border-color: var(--gold-mute) !important;
      background: var(--surface-raised,#1C160E);
    }
    .opt-card.is-selected .opt-proposal { border-left-color: var(--gold); }
    .opt-card:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
    .opt-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .opt-key {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 18px;
      color: var(--gold);
      width: 20px;
      flex-shrink: 0;
    }
    .opt-mech {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dim);
    }
    .opt-proposal {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      line-height: 1.55;
      color: var(--cream);
      border-left: 2px solid var(--border-strong);
      padding: 6px 12px;
      margin-bottom: 8px;
      white-space: pre-wrap;
    }
    .opt-rationale {
      font-size: 12px;
      color: var(--cream2);
      line-height: 1.5;
    }

    /* ── Action bar ────────────────────────────────────────────── */
    .wb-action-bar {
      flex-shrink: 0;
      padding: 14px 36px;
      border-top: 1px solid var(--border);
      background: var(--surface);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      padding: 9px 18px;
      border-radius: var(--radius);
      border: 1px solid var(--border-strong);
      cursor: pointer;
      transition: all 0.15s;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
    .btn-ghost {
      background: transparent;
      color: var(--cream2);
    }
    .btn-ghost:hover { background: var(--surface-raised,#1C160E); color: var(--cream); }
    .btn-primary {
      background: var(--gold);
      color: var(--ink);
      border-color: var(--gold);
      font-weight: 600;
    }
    .btn-primary:hover { background: #d4b87a; }
    .btn-accept { /* ghost by default, .ready makes it primary */ }
    .btn-accept.ready {
      background: var(--gold);
      color: var(--ink);
      border-color: var(--gold);
      font-weight: 600;
    }
    .btn-accept.ready:hover { background: #d4b87a; }

    .action-spacer { flex: 1; }
    .voice-note {
      font-size: 11px;
      color: var(--dim);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .voice-note::before {
      content: '✓';
      color: var(--gold);
      font-size: 10px;
    }

    /* Custom textarea */
    .custom-wrap {
      padding: 12px 36px;
      background: var(--ink);
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .custom-wrap textarea {
      width: 100%;
      background: var(--surface);
      color: var(--cream);
      border: 1px solid var(--border-strong);
      border-left: 2px solid var(--gold);
      border-radius: var(--radius);
      padding: 10px 14px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      line-height: 1.55;
      resize: vertical;
      outline: none;
      transition: border-color 0.15s;
      min-height: 80px;
    }
    .custom-wrap textarea:focus { border-color: var(--gold); }
    .custom-row { display: flex; gap: 8px; }
    .custom-row .btn { padding: 7px 14px; font-size: 12px; }

    /* ── Decision log ──────────────────────────────────────────── */
    .wb-log {
      width: 300px;
      flex-shrink: 0;
      background: var(--surface);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .wb-log-head {
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .wb-log-head h2 {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dim);
    }
    .wb-log-list {
      overflow-y: auto;
      flex: 1;
      padding: 8px 0;
    }
    .wb-log-list::-webkit-scrollbar { width: 3px; }
    .wb-log-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

    .log-empty {
      padding: 20px 16px;
      font-size: 12px;
      color: var(--dim);
      font-style: italic;
    }

    .log-entry {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .log-decision {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .log-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
    }
    .log-badge.accepted  { background: rgba(200,169,110,0.2); color: var(--gold); border: 1px solid rgba(200,169,110,0.3); }
    .log-badge.kept      { background: rgba(127,163,107,0.15); color: #7fa36b; border: 1px solid rgba(127,163,107,0.3); }
    .log-badge.rejected  { background: rgba(167,71,42,0.2); color: #d98b78; border: 1px solid rgba(167,71,42,0.3); }
    .log-badge.custom    { background: rgba(125,211,216,0.15); color: #7dd3d8; border: 1px solid rgba(125,211,216,0.3); }
    .log-option {
      font-size: 11px;
      color: var(--cream2);
    }
    .log-title {
      font-size: 12px;
      color: var(--cream);
      line-height: 1.35;
      margin-bottom: 2px;
      font-family: var(--font-display);
    }
    .log-crumb {
      font-size: 10px;
      color: var(--dim);
    }

    /* ── Empty / done states ───────────────────────────────────── */
    .case-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--dim);
      text-align: center;
      gap: 12px;
    }
    .case-empty .done-icon { font-size: 32px; opacity: 0.4; }
    .case-empty h3 { font-family: var(--font-display); font-size: 20px; color: var(--cream2); }
    .case-empty p { font-size: 13px; max-width: 320px; line-height: 1.6; }
  </style>
</head>
<body>

<!-- ── Top bar ─────────────────────────────────────────────────── -->
<header class="wb-topbar">
  <a href="/revise" class="wb-brand">
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="2" fill="currentColor" opacity="0.08"/>
      <path d="M9 8 L9 24 M9 8 L18 8 Q23 8 23 13 Q23 17 19 18 L23 24 M9 16 L18 16"
        stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"/>
    </svg>
    RevisionGrade<span class="tm">™</span>
  </a>
  <div class="wb-manuscript">
    Revise workbench &nbsp;·&nbsp; <span id="msTitle">The River Manuscript</span>
  </div>
  <div class="wb-actions-top">
    <span class="wb-progress">
      <strong id="progressDone">0</strong> of <strong id="progressTotal">7</strong> resolved
    </span>
  </div>
</header>

<!-- ── Main layout ─────────────────────────────────────────────── -->
<div class="wb-layout">

  <!-- Queue (left) -->
  <aside class="wb-queue">
    <div class="wb-queue-head">
      <h2>Repair Queue</h2>
      <div class="queue-stats">
        <span><span class="stat-val accepted" id="statAccepted">0</span> accepted</span>
        <span><span class="stat-val" id="statKept">0</span> kept</span>
        <span><span class="stat-val rejected" id="statRejected">0</span> rejected</span>
      </div>
    </div>
    <div class="wb-queue-list" id="queueList">
      <!-- populated by JS -->
    </div>
  </aside>

  <!-- Detail (center) -->
  <main class="wb-detail" id="detailPane">
    <div class="wb-detail-scroll" id="detailScroll">
      <div class="case-empty">
        <div class="done-icon">⟵</div>
        <h3>Select an issue</h3>
        <p>Pick any item from the repair queue to begin working through it.</p>
      </div>
    </div>
    <!-- Action bar (hidden until item selected) -->
    <div class="wb-action-bar" id="actionBar" style="display:none;">
      <button class="btn btn-ghost btn-accept" id="btnAccept">Accept selected</button>
      <button class="btn btn-ghost" id="btnKeep">Keep original</button>
      <button class="btn btn-ghost" id="btnReject">Reject all three</button>
      <button class="btn btn-ghost" id="btnCustom">Write custom</button>
      <div class="action-spacer"></div>
      <div class="voice-note">Voice-preservation gate active</div>
    </div>
    <!-- Custom textarea (inserted by JS) -->
  </main>

  <!-- Decision log (right) -->
  <aside class="wb-log">
    <div class="wb-log-head">
      <h2>Session Log</h2>
    </div>
    <div class="wb-log-list" id="logList">
      <div class="log-empty" id="logEmpty">No decisions yet.<br>Start working through the queue.</div>
    </div>
  </aside>

</div>

<script>
(function () {
  'use strict';

  /* ── Queue data ──────────────────────────────────────────────── */
  const CASES = [
    {
      id: 1,
      crumb: 'Dialogue · Chapter 11 · river scene',
      title: 'Abstract phrasing weakens river-scene tension',
      tags: [['tag-must','Must'],['tag-spine','Spine-critical'],['tag-conf','Moderate confidence']],
      anchor: 'char 1247–1330 · Chapter 11 · river scene',
      quote: { highlight: 'It\\'s okay,', rest: ' I whispered. But even as I said it, I knew it wasn\\'t okay.' },
      diagnosis: {
        symptom: 'Emotional contradiction is stated directly instead of dramatized.',
        cause: 'Internal realization duplicates what the dialogue already implies, flattening the moment into commentary.',
        fix: 'Replace internal explanation with a physical hesitation or interruption beat.',
        effect: 'Tension escalates instead of pausing for narrator gloss.',
        proof: 'Preserve the speaker\\'s voice and the dialogue\\'s rhythm. Do not introduce new information about the river or the listener\\'s reaction.',
      },
      options: [
        { key:'A', mech:'Action-beat substitution', text:'"It\\'s okay," I whispered.\\nThe lie caught halfway out.', rationale:'Replaces internal gloss with a physical reaction; voice fingerprint preserved.' },
        { key:'B', mech:'Interruption beat', text:'"It\\'s okay—"\\nMy voice cracked before I could finish.', rationale:'Cuts the reassurance mid-line so the failure is heard, not narrated.' },
        { key:'C', mech:'Rendering shift', text:'"It\\'s okay."\\nShe looked at me long enough to know I didn\\'t believe it.', rationale:'Lets the listener carry the contradiction; closes the scene with weight.' },
      ],
    },
    {
      id: 2,
      crumb: 'Pacing · Chapter 11 · scene close',
      title: 'Internal monologue duplicates dialogue subtext',
      tags: [['tag-must','Must'],['tag-high','High'],['tag-conf','High confidence']],
      anchor: 'char 1331–1462 · Chapter 11 · scene close',
      quote: { highlight: 'I knew it wasn\\'t okay.', rest: ' That was the whole problem, really — knowing things and saying nothing.' },
      diagnosis: {
        symptom: 'Narrator restates the emotional verdict the prior dialogue already delivered.',
        cause: 'Pass-through interiority used as a crutch where action would advance the scene.',
        fix: 'Cut the recap line; let the next beat carry the consequence.',
        effect: 'Scene momentum returns; reader is trusted to hold the contradiction.',
        proof: 'Do not remove the next paragraph\\'s sensory anchors — they are not duplicative.',
      },
      options: [
        { key:'A', mech:'Excision', text:'[remove sentence]\\n— scene continues with the next paragraph —', rationale:'Cleanest cut. Preserves rhythm by removing the restatement entirely.' },
        { key:'B', mech:'Compression', text:'I knew. That was the problem.', rationale:'Keeps the cadence but trims the recap to a single fragment.' },
        { key:'C', mech:'Substitution', text:'I looked at the river. The river didn\\'t care.', rationale:'Replaces interiority with a sensory beat that re-grounds the scene.' },
      ],
    },
    {
      id: 3,
      crumb: 'Golden Spine · cross-chapter',
      title: 'Promise opened in Ch. 4 still unresolved at midpoint',
      tags: [['tag-should','Should'],['tag-medium','Medium'],['tag-conf','Moderate confidence']],
      anchor: 'Ch. 4 setup → Ch. 12 expected payoff',
      quote: { highlight: 'He promised himself he would tell her.', rest: ' By the time the river scene arrived, he still had not.' },
      diagnosis: {
        symptom: 'A primary character promise is opened in Act I but receives no acknowledgment by midpoint.',
        cause: 'The narrative spine carries this thread silently rather than tightening pressure on it.',
        fix: 'Surface the promise in Ch. 12 — even one beat of avoidance, denial, or near-confession.',
        effect: 'Pressure continuity is restored across the second-act plateau.',
        proof: 'Don\\'t resolve the promise here. The Ch. 18 payoff still owns that beat.',
      },
      options: [
        { key:'A', mech:'Avoidance beat', text:'He almost said it. He drank instead.', rationale:'Lightest possible touch; keeps the promise live without spending it.' },
        { key:'B', mech:'Reader-only acknowledgment', text:'(narration) The thing he had promised himself in May had not been said.', rationale:'Gives the reader the spine cue without burdening the scene.' },
        { key:'C', mech:'Near-confession', text:'"There\\'s something—" he started. Then the call came in, and he let it go.', rationale:'Highest leverage: applies pressure visibly without resolving the promise.' },
      ],
    },
    {
      id: 4,
      crumb: 'Pacing valley · Ch. 12–14',
      title: 'Pressure plateaus across chapters 12–14',
      tags: [['tag-should','Should'],['tag-medium','Medium'],['tag-conf','Moderate confidence']],
      anchor: 'Ch. 12 §3 → Ch. 14 §1 · scene density 0.42',
      quote: { highlight: 'Three chapters of conversation', rest: ' separate the inciting confrontation from the next consequence.' },
      diagnosis: {
        symptom: 'Narrative pressure flattens across the second-act seam.',
        cause: 'Scene-density drops below 0.5 with no compensating subplot escalation or threat introduction.',
        fix: 'Insert one consequence-bearing scene or compress two slow chapters into one.',
        effect: 'Reader engagement curve recovers ahead of the Ch. 15 turn.',
        proof: 'Preserve the quiet character work in Ch. 13 §2 — that beat earns the later cost.',
      },
      options: [
        { key:'A', mech:'Compression', text:'Merge Ch. 12 §4 into Ch. 13 §1; cut transitional travel.', rationale:'Removes a soft seam without losing scene content.' },
        { key:'B', mech:'Escalation insertion', text:'Introduce one external pressure event in Ch. 13 — a deadline, a witness, a leak.', rationale:'Re-establishes stakes without disturbing existing beats.' },
        { key:'C', mech:'Subplot weave', text:'Move the Ch. 16 subplot reveal earlier so it resonates against the Ch. 12 confrontation.', rationale:'Highest leverage; uses material that already exists, rebalances the spine.' },
      ],
    },
    {
      id: 5,
      crumb: 'Voice · Ch. 11, p. 132',
      title: 'Filtered perception softens close-third POV',
      tags: [['tag-could','Could'],['tag-local','Local'],['tag-conf','High confidence']],
      anchor: 'char 4089–4131 · Ch. 11, p. 132',
      quote: { highlight: 'She could see the boat', rest: ' moving downstream, slowly, against the dimming light.' },
      diagnosis: {
        symptom: 'Filter verb ("could see") inserts narrative distance into a close-third moment.',
        cause: 'Habitual perception phrasing; not a deliberate stylistic choice elsewhere.',
        fix: 'Drop the filter; render the perception directly.',
        effect: 'POV closeness is restored; the image lands without mediation.',
        proof: 'Do not alter the character\\'s observational rhythm — only remove the filter verb.',
      },
      options: [
        { key:'A', mech:'Filter removal', text:'The boat moved downstream, slowly, against the dimming light.', rationale:'Direct rendering; matches the chapter\\'s established close-third voice.' },
        { key:'B', mech:'Active substitution', text:'She watched the boat move downstream against the dimming light.', rationale:'Keeps the act of seeing but as action, not capability.' },
        { key:'C', mech:'Compression', text:'Downstream, the boat moved against the dimming light.', rationale:'Removes the filter and the perceiver, foregrounding the image itself.' },
      ],
    },
    {
      id: 6,
      crumb: 'Prose control · Ch. 11',
      title: 'Adverb stack thins on key reassurance line',
      tags: [['tag-could','Could'],['tag-local','Local'],['tag-conf','High confidence']],
      anchor: 'char 1198–1246 · Ch. 11',
      quote: { highlight: 'she said softly, gently, almost apologetically', rest: ', reaching for his hand.' },
      diagnosis: {
        symptom: 'Three adverbs stack on a single attribution, diluting tonal precision.',
        cause: 'Uncertainty about whether dialogue alone carries the emotional weight.',
        fix: 'Choose one adverb or replace the stack with a physical beat.',
        effect: 'Tone sharpens; reader receives one clear signal instead of three competing ones.',
        proof: 'Keep the gesture ("reaching for his hand") — it carries the tonal load on its own.',
      },
      options: [
        { key:'A', mech:'Single-adverb selection', text:'she said gently, reaching for his hand.', rationale:'Smallest change; preserves the attribution shape.' },
        { key:'B', mech:'Adverb removal', text:'she said, reaching for his hand.', rationale:'Lets the gesture do the tonal work; cleanest.' },
        { key:'C', mech:'Beat substitution', text:'She reached for his hand. "It\\'s okay."', rationale:'Reorders so the gesture leads; eliminates attribution overhead.' },
      ],
    },
    {
      id: 7,
      crumb: 'WAVE · Act II',
      title: 'Thematic propagation thin in Act II',
      tags: [['tag-deferred','Deferred'],['tag-conf','Low confidence']],
      anchor: 'Cross-chapter · Ch. 12–17',
      quote: { highlight: 'The river motif', rest: ' established in Ch. 1, 4, and 11 does not recur with sufficient density across Act II.' },
      diagnosis: {
        symptom: 'Central motif loses presence in the manuscript\\'s middle.',
        cause: 'Act II focuses on consequence rather than image; thematic substrate goes quiet.',
        fix: 'Re-thread the motif across two Act-II chapters with light, non-decorative anchors.',
        effect: 'Thematic continuity restored without flagging the motif as theme-on-the-nose.',
        proof: 'Avoid placing the motif in dialogue. Image-only re-entries.',
      },
      options: [
        { key:'A', mech:'Image cameo', text:'Add a single river-light reflection in Ch. 13 §2 (kitchen window).', rationale:'Lightest possible re-entry; preserves Act-II tone.' },
        { key:'B', mech:'Sound cameo', text:'Add an off-stage water sound in Ch. 15 §1 (background to scene).', rationale:'Sensory substrate without visual repetition.' },
        { key:'C', mech:'Object echo', text:'Reintroduce the boat oar (Ch. 4 prop) once in Ch. 16 §3.', rationale:'Highest leverage; uses an existing object to carry the motif.' },
      ],
    },
  ];

  /* ── State ───────────────────────────────────────────────────── */
  let activeId = null;
  let decisions = {}; // id → { decision, option, label }
  const counts = { accepted: 0, kept: 0, rejected: 0, custom: 0 };

  /* ── DOM refs ────────────────────────────────────────────────── */
  const queueList   = document.getElementById('queueList');
  const detailScroll= document.getElementById('detailScroll');
  const actionBar   = document.getElementById('actionBar');
  const logList     = document.getElementById('logList');
  const logEmpty    = document.getElementById('logEmpty');
  const btnAccept   = document.getElementById('btnAccept');
  const btnKeep     = document.getElementById('btnKeep');
  const btnReject   = document.getElementById('btnReject');
  const btnCustom   = document.getElementById('btnCustom');
  const statAccepted= document.getElementById('statAccepted');
  const statKept    = document.getElementById('statKept');
  const statRejected= document.getElementById('statRejected');
  const progressDone= document.getElementById('progressDone');
  const progressTotal=document.getElementById('progressTotal');

  /* ── Build queue list ────────────────────────────────────────── */
  progressTotal.textContent = CASES.length;

  CASES.forEach(function (c) {
    var item = document.createElement('div');
    item.className = 'q-item';
    item.dataset.id = c.id;

    var tagsHTML = c.tags.map(function (t) {
      if (t[0] === 'tag-conf') return '';
      return '<span class="q-tag ' + t[0] + '">' + t[1] + '</span>';
    }).join('');

    item.innerHTML =
      '<div class="q-tags">' + tagsHTML + '</div>' +
      '<div class="q-title" data-decision="">' + c.title + '</div>' +
      '<div class="q-crumb">' + c.crumb + '</div>';

    item.addEventListener('click', function () { activateCase(c.id); });
    queueList.appendChild(item);
  });

  /* ── Activate a case ─────────────────────────────────────────── */
  function activateCase(id) {
    activeId = id;

    // Update queue highlights
    document.querySelectorAll('.q-item').forEach(function (el) {
      el.classList.remove('is-active');
      if (parseInt(el.dataset.id) === id) el.classList.add('is-active');
    });

    // Reset panel state
    resetPanel();
    renderDetail(id);
    actionBar.style.display = 'flex';
  }

  /* ── Render detail ───────────────────────────────────────────── */
  function renderDetail(id) {
    var c = CASES.find(function (x) { return x.id === id; });
    if (!c) return;

    var tagsHTML = c.tags.map(function (t) {
      return '<span class="c-tag ' + t[0] + '">' + t[1] + '</span>';
    }).join('');

    var optsHTML = c.options.map(function (o) {
      return '<div class="opt-card" tabindex="0" data-key="' + o.key + '">' +
        '<div class="opt-header">' +
          '<span class="opt-key">' + o.key + '</span>' +
          '<span class="opt-mech">' + o.mech + '</span>' +
        '</div>' +
        '<pre class="opt-proposal">' + escHtml(o.text) + '</pre>' +
        '<p class="opt-rationale">' + escHtml(o.rationale) + '</p>' +
      '</div>';
    }).join('');

    detailScroll.innerHTML =
      '<div class="case-head">' +
        '<div>' +
          '<div class="case-crumb">' + escHtml(c.crumb) + '</div>' +
          '<h2 class="case-title">' + escHtml(c.title) + '</h2>' +
          '<div class="case-tags">' + tagsHTML + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="evidence">' +
        '<blockquote><em>' + escHtml(c.quote.highlight) + '</em>' + escHtml(c.quote.rest) + '</blockquote>' +
        '<div class="anchor">' + escHtml(c.anchor) + '</div>' +
      '</div>' +
      '<div class="diagnosis-grid">' +
        '<div class="diag-cell"><div class="diag-label">Symptom</div><div class="diag-text">' + escHtml(c.diagnosis.symptom) + '</div></div>' +
        '<div class="diag-cell"><div class="diag-label">Cause</div><div class="diag-text">' + escHtml(c.diagnosis.cause) + '</div></div>' +
        '<div class="diag-cell"><div class="diag-label">Fix direction</div><div class="diag-text">' + escHtml(c.diagnosis.fix) + '</div></div>' +
        '<div class="diag-cell"><div class="diag-label">Reader effect</div><div class="diag-text">' + escHtml(c.diagnosis.effect) + '</div></div>' +
        '<div class="diag-cell full-width"><div class="diag-label">Mistake-proofing</div><div class="diag-text">' + escHtml(c.diagnosis.proof) + '</div></div>' +
      '</div>' +
      '<div class="options-label">Three structurally distinct proposals</div>' +
      '<div class="options-list">' + optsHTML + '</div>';

    // Bind option cards
    detailScroll.querySelectorAll('.opt-card').forEach(function (card) {
      card.addEventListener('click', function () {
        detailScroll.querySelectorAll('.opt-card').forEach(function (c) { c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        updateAcceptState();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });

    detailScroll.scrollTop = 0;
  }

  /* ── Reset panel ─────────────────────────────────────────────── */
  function resetPanel() {
    // Clear option selection (will be re-rendered anyway, but belt-and-suspenders)
    detailScroll.querySelectorAll('.opt-card').forEach(function (c) { c.classList.remove('is-selected'); });
    // Reset Accept button
    btnAccept.textContent = 'Accept selected';
    btnAccept.className = 'btn btn-ghost btn-accept';
    clearTimeout(btnAccept._pulse);
    // Remove custom textarea
    var cw = document.querySelector('.custom-wrap');
    if (cw) cw.remove();
  }

  /* ── Accept button state ─────────────────────────────────────── */
  function updateAcceptState() {
    var sel = detailScroll.querySelector('.opt-card.is-selected');
    if (sel) {
      btnAccept.classList.add('ready');
    } else {
      btnAccept.classList.remove('ready');
    }
  }

  /* ── Pulse helper ────────────────────────────────────────────── */
  function pulse(btn, msg, success) {
    var orig = btn.textContent;
    var origClass = btn.className;
    btn.textContent = msg;
    btn.className = 'btn ' + (success ? 'btn-primary' : 'btn-ghost');
    clearTimeout(btn._pulse);
    btn._pulse = setTimeout(function () {
      if (btn.textContent === msg) {
        btn.textContent = orig;
        btn.className = origClass;
      }
    }, 2000);
  }

  /* ── Mark item done ──────────────────────────────────────────── */
  function markDone(id, decision, optionLabel) {
    decisions[id] = { decision: decision, option: optionLabel };

    // Update queue item
    var qItem = queueList.querySelector('[data-id="' + id + '"]');
    if (qItem) {
      qItem.classList.add('is-done');
      var titleEl = qItem.querySelector('.q-title');
      if (titleEl) titleEl.dataset.decision = decision;
    }

    // Update counts
    var decKey = decision.toLowerCase().replace(' ', '');
    if (decKey === 'accepted') counts.accepted++;
    else if (decKey === 'keptoriginal') { decKey = 'kept'; counts.kept++; }
    else if (decKey === 'rejectedall') { decKey = 'rejected'; counts.rejected++; }
    else if (decKey === 'custom') counts.custom++;

    statAccepted.textContent = counts.accepted;
    statKept.textContent = counts.kept + counts.custom;
    statRejected.textContent = counts.rejected;
    progressDone.textContent = Object.keys(decisions).length;

    // Add log entry
    addLogEntry(id, decision, optionLabel);
  }

  /* ── Add log entry ───────────────────────────────────────────── */
  function addLogEntry(id, decision, optionLabel) {
    if (logEmpty) logEmpty.style.display = 'none';

    var c = CASES.find(function (x) { return x.id === id; });
    if (!c) return;

    var badgeClass = '';
    var badgeText  = '';
    if (decision === 'Accepted') { badgeClass = 'accepted'; badgeText = 'Accepted'; }
    else if (decision === 'Kept original') { badgeClass = 'kept'; badgeText = 'Kept'; }
    else if (decision === 'Rejected all') { badgeClass = 'rejected'; badgeText = 'Rejected'; }
    else if (decision === 'Custom') { badgeClass = 'custom'; badgeText = 'Custom'; }

    var entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML =
      '<div class="log-title">' + escHtml(c.title) + '</div>' +
      '<div class="log-decision">' +
        '<span class="log-badge ' + badgeClass + '">' + badgeText + '</span>' +
        (optionLabel ? '<span class="log-option">' + escHtml(optionLabel) + '</span>' : '') +
      '</div>' +
      '<div class="log-crumb">' + escHtml(c.crumb) + '</div>';

    logList.insertBefore(entry, logList.firstChild);
  }

  /* ── Advance to next undone item ─────────────────────────────── */
  function advanceQueue() {
    var items = Array.from(queueList.querySelectorAll('.q-item:not(.is-done)'));
    // find the one after current
    var current = queueList.querySelector('.q-item.is-active');
    var allItems = Array.from(queueList.querySelectorAll('.q-item'));
    var idx = current ? allItems.indexOf(current) : -1;
    // try items after current first
    var next = null;
    for (var i = idx + 1; i < allItems.length; i++) {
      if (!allItems[i].classList.contains('is-done')) { next = allItems[i]; break; }
    }
    // wrap around
    if (!next) {
      for (var j = 0; j < idx; j++) {
        if (!allItems[j].classList.contains('is-done')) { next = allItems[j]; break; }
      }
    }

    if (next) {
      setTimeout(function () { next.click(); }, 800);
    } else {
      // All done
      setTimeout(function () {
        activeId = null;
        actionBar.style.display = 'none';
        detailScroll.innerHTML =
          '<div class="case-empty">' +
          '<div class="done-icon">✓</div>' +
          '<h3>Queue complete</h3>' +
          '<p>All ' + CASES.length + ' opportunities have been resolved. Review the session log, then close this workbench.</p>' +
          '</div>';
        document.querySelectorAll('.q-item').forEach(function (el) { el.classList.remove('is-active'); });
      }, 800);
    }
  }

  /* ── Action button handlers ──────────────────────────────────── */
  btnAccept.addEventListener('click', function () {
    var sel = detailScroll.querySelector('.opt-card.is-selected');
    if (!sel) { pulse(btnAccept, 'Select A, B, or C first', false); return; }
    var key = sel.dataset.key;
    var mech = sel.querySelector('.opt-mech') ? sel.querySelector('.opt-mech').textContent : '';
    pulse(btnAccept, '✓ Option ' + key + ' accepted', true);
    markDone(activeId, 'Accepted', 'Option ' + key + ' — ' + mech);
    advanceQueue();
  });

  btnKeep.addEventListener('click', function () {
    pulse(btnKeep, 'Original kept', true);
    markDone(activeId, 'Kept original', 'Original text preserved');
    advanceQueue();
  });

  btnReject.addEventListener('click', function () {
    pulse(btnReject, 'All three rejected', false);
    detailScroll.querySelectorAll('.opt-card').forEach(function (c) { c.classList.remove('is-selected'); });
    updateAcceptState();
    markDone(activeId, 'Rejected all', 'No option selected');
    advanceQueue();
  });

  btnCustom.addEventListener('click', function () {
    var existing = document.querySelector('.custom-wrap');
    if (existing) { existing.remove(); return; }

    var wrap = document.createElement('div');
    wrap.className = 'custom-wrap';

    var ta = document.createElement('textarea');
    ta.placeholder = 'Write your own revision here…';
    ta.rows = 3;

    var row = document.createElement('div');
    row.className = 'custom-row';

    var okBtn = document.createElement('button');
    okBtn.textContent = 'Accept custom';
    okBtn.className = 'btn btn-primary';
    okBtn.addEventListener('click', function () {
      if (!ta.value.trim()) { ta.style.borderColor = '#7A2B1A'; ta.focus(); return; }
      var preview = ta.value.trim().substring(0, 60) + (ta.value.length > 60 ? '…' : '');
      pulse(btnCustom, '✓ Custom accepted', true);
      wrap.remove();
      markDone(activeId, 'Custom', '"' + preview + '"');
      advanceQueue();
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.addEventListener('click', function () { wrap.remove(); });

    row.appendChild(okBtn);
    row.appendChild(cancelBtn);
    wrap.appendChild(ta);
    wrap.appendChild(row);

    // Insert after action bar
    actionBar.insertAdjacentElement('afterend', wrap);
    ta.focus();
  });

  /* ── Utility ─────────────────────────────────────────────────── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // Auto-open first item
  activateCase(CASES[0].id);

})();
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
