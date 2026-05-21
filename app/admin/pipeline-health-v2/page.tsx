import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pipeline Health v2 — RevisionGrade™',
}

export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pipeline Health v2 — RevisionGrade</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #0D0A05;
      --surface: #14110C;
      --raised: #1E180F;
      --border: rgba(200,169,110,0.15);
      --cream: #F5EFE0;
      --cream2: #DDD5C2;
      --cream3: #B8AE9C;
      --gold: #C8A96E;
      --gold-mute: #a8893b;
      --green: #4a9e6b;
      --green-bg: rgba(74,158,107,0.12);
      --yellow: #d4a843;
      --yellow-bg: rgba(212,168,67,0.12);
      --red: #d05a4a;
      --red-bg: rgba(208,90,74,0.12);
      --gray: #6B6560;
      --gray-bg: rgba(107,101,96,0.12);
      --mono: 'JetBrains Mono', monospace;
      --sans: 'Inter', sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; -webkit-font-smoothing: antialiased; }
    body { background: var(--ink); color: var(--cream2); font-family: var(--sans); line-height: 1.55; min-height: 100vh; }

    /* ── Top bar ── */
    .topbar {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .topbar-left { display: flex; flex-direction: column; gap: 2px; }
    .topbar-title { font-size: 15px; font-weight: 600; color: var(--cream); letter-spacing: -0.01em; }
    .topbar-sub { font-size: 11px; color: var(--cream3); font-family: var(--mono); }
    .topbar-right { display: flex; align-items: center; gap: 12px; }
    .badge { font-size: 11px; font-family: var(--mono); background: var(--raised); border: 1px solid var(--border); color: var(--cream3); padding: 4px 10px; border-radius: 4px; }
    .badge.gold { border-color: var(--gold-mute); color: var(--gold); }
    .updated { font-size: 11px; color: var(--gray); font-family: var(--mono); }

    /* ── What changed banner ── */
    .banner {
      background: rgba(200,169,110,0.07);
      border-bottom: 1px solid var(--border);
      padding: 10px 24px;
      font-size: 12px;
      color: var(--cream3);
      font-family: var(--mono);
    }
    .banner strong { color: var(--gold); }

    /* ── Shell ── */
    .shell { max-width: 1360px; margin: 0 auto; padding: 24px; display: grid; gap: 20px; }

    /* ── KPI strip ── */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
    }
    .kpi {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 18px;
    }
    .kpi-label { font-size: 10px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--cream3); margin-bottom: 6px; }
    .kpi-value { font-size: 28px; font-weight: 700; color: var(--cream); line-height: 1; margin-bottom: 4px; }
    .kpi-sub { font-size: 11px; color: var(--cream3); }
    .kpi-sub.warn { color: var(--yellow); }
    .kpi-sub.fail { color: var(--red); }
    .kpi-sub.ok { color: var(--green); }

    /* ── Section heading ── */
    .section-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-title { font-size: 12px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); }
    .section-note { font-size: 11px; color: var(--cream3); font-family: var(--mono); }

    /* ── SIPOC strip ── */
    .sipoc-strip {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
    }
    .sipoc-stages {
      display: flex;
      gap: 8px;
      min-width: max-content;
    }
    .stage {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--raised);
      min-width: 88px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .stage:hover { border-color: var(--gold-mute); }
    .stage.ok { border-color: rgba(74,158,107,0.3); }
    .stage.warn { border-color: rgba(212,168,67,0.35); }
    .stage.fail { border-color: rgba(208,90,74,0.35); }
    .stage.skip { opacity: 0.5; }
    .stage-num { font-size: 10px; font-family: var(--mono); color: var(--cream3); }
    .stage-name { font-size: 11px; font-weight: 600; color: var(--cream); text-align: center; line-height: 1.3; }
    .stage-detail { font-size: 10px; font-family: var(--mono); color: var(--cream3); text-align: center; line-height: 1.4; }
    .stage-dot { width: 8px; height: 8px; border-radius: 50%; }
    .stage.ok .stage-dot { background: var(--green); }
    .stage.warn .stage-dot { background: var(--yellow); }
    .stage.fail .stage-dot { background: var(--red); }
    .stage.skip .stage-dot { background: var(--gray); }

    /* ── Job table ── */
    .jobs-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .jobs-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      font-size: 10px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--cream3); padding: 10px 14px; text-align: left;
      border-bottom: 1px solid var(--border); background: var(--raised);
    }
    td { padding: 11px 14px; font-size: 12px; border-bottom: 1px solid rgba(200,169,110,0.06); vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr.expandable { cursor: pointer; }
    tr.expandable:hover td { background: rgba(200,169,110,0.03); }
    .job-id { font-family: var(--mono); color: var(--gold); font-size: 11px; }
    .job-title { color: var(--cream); font-weight: 500; }
    .job-words { font-family: var(--mono); color: var(--cream3); }
    .coverage { font-family: var(--mono); font-size: 11px; display: flex; align-items: center; gap: 5px; }
    .cov-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .cov-ok { background: var(--green); }
    .cov-warn { background: var(--yellow); }
    .cov-fail { background: var(--red); }
    .status-pill {
      display: inline-block; font-size: 10px; font-family: var(--mono); font-weight: 600;
      padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .sp-pass { background: var(--green-bg); color: var(--green); }
    .sp-fail { background: var(--red-bg); color: var(--red); }
    .sp-warn { background: var(--yellow-bg); color: var(--yellow); }
    .expand-arrow { color: var(--cream3); font-size: 11px; font-family: var(--mono); }
    tr.expanded-row td { background: rgba(200,169,110,0.03); }

    /* ── Step contract ── */
    .step-contract {
      display: none;
      padding: 0 18px 18px;
    }
    .step-contract.open { display: block; }
    .contract-title {
      font-size: 11px; font-family: var(--mono); color: var(--cream3);
      padding: 12px 0 10px; border-top: 1px solid var(--border);
      text-transform: uppercase; letter-spacing: 0.1em;
    }
    .contract-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .contract-table th {
      font-size: 10px; background: transparent; padding: 6px 10px;
      color: var(--gold); border-bottom: 1px solid var(--border);
    }
    .contract-table td { font-size: 11px; font-family: var(--mono); padding: 7px 10px; color: var(--cream2); border-bottom: 1px solid rgba(200,169,110,0.05); }
    .contract-table td.dim { color: var(--gray); font-style: italic; }
    .check-ok { color: var(--green); }
    .check-fail { color: var(--red); }
    .check-skip { color: var(--gray); }

    /* ── Pass timings ── */
    .timings { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .timing-box { background: var(--raised); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; }
    .timing-label { font-size: 10px; font-family: var(--mono); color: var(--cream3); margin-bottom: 4px; }
    .timing-val { font-size: 14px; font-weight: 600; font-family: var(--mono); }
    .timing-val.over { color: var(--red); }
    .timing-val.ok { color: var(--green); }
    .timing-val.skip { color: var(--gray); }

    /* ── Chunk table ── */
    .chunk-table-wrap { overflow-x: auto; margin-top: 12px; }
    .chunk-label { font-size: 10px; font-family: var(--mono); color: var(--cream3); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }

    /* ── Bottom panels ── */
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 18px;
    }
    .coverage-bars { display: grid; gap: 8px; margin-top: 10px; }
    .cov-row { display: flex; align-items: center; gap: 10px; }
    .cov-label { font-size: 11px; font-family: var(--mono); color: var(--cream3); min-width: 90px; }
    .cov-bar-track { flex: 1; height: 6px; background: var(--raised); border-radius: 3px; overflow: hidden; }
    .cov-bar-fill { height: 100%; border-radius: 3px; }
    .cov-count { font-size: 11px; font-family: var(--mono); color: var(--cream3); min-width: 36px; text-align: right; }

    .taxonomy-rows { display: grid; gap: 4px; margin-top: 10px; }
    .tax-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-radius: 4px; background: var(--raised); }
    .tax-code { font-size: 11px; font-family: var(--mono); color: var(--cream2); }
    .tax-count { font-size: 13px; font-weight: 700; font-family: var(--mono); }
    .tax-count.nonzero { color: var(--red); }
    .tax-count.zero { color: var(--gray); }

    .sipoc-fixtures { display: grid; gap: 6px; margin-top: 10px; }
    .fixture-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 4px; background: var(--raised); }
    .fx-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .fx-ok { background: var(--green); }
    .fx-fail { background: var(--red); }
    .fx-skip { background: var(--gray); }
    .fx-label { font-size: 11px; font-family: var(--mono); color: var(--cream2); flex: 1; }
    .fx-stage { font-size: 10px; font-family: var(--mono); color: var(--cream3); }

    .recovery-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .rec-box { background: var(--raised); border-radius: 6px; padding: 10px 12px; }
    .rec-label { font-size: 10px; font-family: var(--mono); color: var(--cream3); margin-bottom: 4px; }
    .rec-val { font-size: 22px; font-weight: 700; font-family: var(--mono); }

    .sources { font-size: 10px; font-family: var(--mono); color: var(--gray); line-height: 1.8; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
    .sources a { color: var(--gold-mute); text-decoration: none; }
    .sources a:hover { color: var(--gold); }
  </style>
</head>
<body>

  <!-- Top bar -->
  <div class="topbar">
    <div class="topbar-left">
      <div class="topbar-title">Pipeline Health — /admin/pipeline-health-v2</div>
      <div class="topbar-sub">SIPOC step-contract granularity · target state after PR-D1 → PR-D4 · canonical 11-step contract live · range: 24h · auto-refresh: 30s</div>
    </div>
    <div class="topbar-right">
      <span class="badge gold">Range ▾</span>
      <span class="badge">Filter ▾</span>
      <span class="badge">Refresh</span>
      <span class="updated">updated 12s ago</span>
    </div>
  </div>

  <!-- What changed -->
  <div class="banner">
    <strong>What changed:</strong> per-step input.spec / metric / output.spec is now persisted and rendered for every job. Coverage % is a first-class column. The SIPOC strip enumerates all 11 canonical steps. Clicking any job ID expands the full step contract inline — no docx autopsy.
  </div>

  <div class="shell">

    <!-- KPI strip -->
    <div class="kpi-strip">
      <div class="kpi">
        <div class="kpi-label">Jobs (24h)</div>
        <div class="kpi-value">14</div>
        <div class="kpi-sub ok">+3 vs prior 24h</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Pass rate</div>
        <div class="kpi-value">64.3%</div>
        <div class="kpi-sub warn">9 / 14 PASS</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">p50 duration</div>
        <div class="kpi-value">186s</div>
        <div class="kpi-sub ok">budget 720 s</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Coverage (avg)</div>
        <div class="kpi-value">87.4%</div>
        <div class="kpi-sub fail">target ≥ 99.5%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Failed-closed</div>
        <div class="kpi-value">5 / 5</div>
        <div class="kpi-sub ok">no silent fails</div>
      </div>
    </div>

    <!-- SIPOC strip -->
    <div>
      <div class="section-head">
        <span class="section-title">SIPOC Pipeline · 11-stage contract</span>
        <span class="section-note">click a stage to filter jobs · bar = aggregate health (24h)</span>
      </div>
      <div class="sipoc-strip">
        <div class="sipoc-stages">
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">0</span>
            <span class="stage-name">Intake</span>
            <span class="stage-detail">14 ✓<br>word_count<br>scope captured</span>
          </div>
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">1</span>
            <span class="stage-name">Queue &amp; claim</span>
            <span class="stage-detail">14 atomic<br>0 double-claim</span>
          </div>
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">2</span>
            <span class="stage-name">Routing</span>
            <span class="stage-detail">long: 6<br>short: 8</span>
          </div>
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">3</span>
            <span class="stage-name">Chunking</span>
            <span class="stage-detail">Σ words OK<br>14/14 match</span>
          </div>
          <div class="stage fail">
            <span class="stage-dot"></span>
            <span class="stage-num">4</span>
            <span class="stage-name">Pass 1 craft</span>
            <span class="stage-detail">3 truncated<br>cov p50: 87%</span>
          </div>
          <div class="stage warn">
            <span class="stage-dot"></span>
            <span class="stage-num">5</span>
            <span class="stage-name">Pass 2 editorial</span>
            <span class="stage-detail">11 / 11<br>div p95: 0.31</span>
          </div>
          <div class="stage skip">
            <span class="stage-dot"></span>
            <span class="stage-num">6</span>
            <span class="stage-name">Chapter rollup</span>
            <span class="stage-detail">not built<br>PR-C pending</span>
          </div>
          <div class="stage warn">
            <span class="stage-dot"></span>
            <span class="stage-num">7</span>
            <span class="stage-name">Pass 3 synth</span>
            <span class="stage-detail">10/11<br>1 timeout</span>
          </div>
          <div class="stage fail">
            <span class="stage-dot"></span>
            <span class="stage-num">8</span>
            <span class="stage-name">Pass 4 xcheck</span>
            <span class="stage-detail">2 finish=length<br>retry: 1/2</span>
          </div>
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">9</span>
            <span class="stage-name">Quality gate</span>
            <span class="stage-detail">9 PASS<br>5 FAIL persisted</span>
          </div>
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">10</span>
            <span class="stage-name">Persistence</span>
            <span class="stage-detail">14 canonical<br>0 dup row_hash</span>
          </div>
          <div class="stage ok">
            <span class="stage-dot"></span>
            <span class="stage-num">11</span>
            <span class="stage-name">Renderer</span>
            <span class="stage-detail">9 releasable<br>0 leak on FAIL</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Job table -->
    <div>
      <div class="section-head">
        <span class="section-title">Recent Jobs · 14 · sorted by recency</span>
        <span class="section-note">click row to expand step contract</span>
      </div>
      <div class="jobs-panel">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Manuscript</th>
              <th>Words</th>
              <th>Coverage</th>
              <th>Stage</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="jobsBody">
            <!-- Expanded row: 26220f5b -->
            <tr class="expandable expanded-row" onclick="toggleContract('c1')">
              <td><span class="expand-arrow" id="a1">▾</span> <span class="job-id">26220f5b…</span></td>
              <td><span class="job-title">Cartel Babies (6054)</span></td>
              <td><span class="job-words">137,758</span></td>
              <td><div class="coverage"><span class="cov-dot cov-fail"></span>4.9 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">pass1_craft</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">722.4 s</span></td>
              <td><span class="status-pill sp-fail">PASS1_TIMEOUT</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0">
              <div class="step-contract open" id="c1">
                <div class="contract-title">Step Contract · job 26220f5b-62fe-4079-8804-e69bdc0edc5f</div>
                <table class="contract-table">
                  <thead><tr><th>#</th><th>Step</th><th>input.spec</th><th>Metric persisted</th><th>output.spec</th><th>last_event_at</th></tr></thead>
                  <tbody>
                    <tr><td>0</td><td>Intake</td><td class="check-ok">✓</td><td>word_count=137758 · scope=manuscript · submission_id=ms_6054</td><td class="check-ok">✓</td><td>10:32:01</td></tr>
                    <tr><td>1</td><td>Queue &amp; claim</td><td class="check-ok">✓</td><td>job_id=26220f5b · claimed_at=10:32:03 · worker_id=w-3</td><td class="check-ok">✓</td><td>10:32:03</td></tr>
                    <tr><td>2</td><td>Routing</td><td class="check-ok">✓</td><td>route=long · threshold=25000 · word_count=137758</td><td class="check-ok">✓</td><td>10:32:03</td></tr>
                    <tr><td>3</td><td>Chunking</td><td class="check-ok">✓</td><td>chunks_expected=98 · chunks_persisted=98 · Σ words=137758</td><td class="check-ok">✓</td><td>10:32:09</td></tr>
                    <tr><td>4</td><td>Pass 1 craft</td><td class="check-ok">✓</td><td>pass1_ms_p50=7,340 · prompt_window_chars=40000 · evidence_quote_count=0 (p50) · truncated=true · retried_n=2 · chunks_with_evidence=6/98</td><td class="check-fail">✗</td><td>10:44:03</td></tr>
                    <tr><td>5</td><td>Pass 2 editorial</td><td class="check-skip">—</td><td class="dim">never reached (upstream failed-closed)</td><td class="check-skip">—</td><td>—</td></tr>
                    <tr><td>6</td><td>Chapter rollup</td><td class="check-skip">—</td><td class="dim">not built (PR-C pending) · step inert</td><td class="check-skip">—</td><td>—</td></tr>
                    <tr><td>7</td><td>Pass 3 synth</td><td class="check-skip">—</td><td class="dim">never reached</td><td class="check-skip">—</td><td>—</td></tr>
                    <tr><td>8</td><td>Pass 4 xcheck</td><td class="check-skip">—</td><td class="dim">never reached</td><td class="check-skip">—</td><td>—</td></tr>
                    <tr><td>9</td><td>Quality gate</td><td class="check-skip">—</td><td class="dim">never reached</td><td class="check-skip">—</td><td>—</td></tr>
                    <tr><td>10</td><td>Persistence</td><td class="check-skip">—</td><td>failure persisted: error_code=PASS1_TIMEOUT · row_hash=set</td><td class="check-ok">✓</td><td>10:44:03</td></tr>
                    <tr><td>11</td><td>Renderer</td><td class="check-ok">✓</td><td>releasable=false · gate=FAIL · UI suppressed</td><td class="check-ok">✓</td><td>10:44:04</td></tr>
                  </tbody>
                </table>
                <div class="chunk-label">Pass timings · 720 s budget</div>
                <div class="timings">
                  <div class="timing-box"><div class="timing-label">P1 craft</div><div class="timing-val over">720,000 ms</div></div>
                  <div class="timing-box"><div class="timing-label">P2 edit</div><div class="timing-val skip">—</div></div>
                  <div class="timing-box"><div class="timing-label">P3 synth</div><div class="timing-val skip">—</div></div>
                  <div class="timing-box"><div class="timing-label">P4 xcheck</div><div class="timing-val skip">—</div></div>
                </div>
                <div class="chunk-label">Per-chunk Pass-1 telemetry (98 chunks) · top 5 longest</div>
                <div class="chunk-table-wrap">
                  <table class="contract-table">
                    <thead><tr><th>chunk</th><th>words</th><th>pass1_ms</th><th>prompt_window_chars</th><th>truncated</th><th>evidence_count</th></tr></thead>
                    <tbody>
                      <tr><td>14</td><td>1,402</td><td>45,012</td><td>40,000</td><td class="check-fail">true</td><td>0</td></tr>
                      <tr><td>22</td><td>1,388</td><td>44,901</td><td>40,000</td><td class="check-fail">true</td><td>0</td></tr>
                      <tr><td>31</td><td>1,411</td><td>44,772</td><td>40,000</td><td class="check-fail">true</td><td>0</td></tr>
                      <tr><td>47</td><td>1,365</td><td>44,610</td><td>40,000</td><td class="check-fail">true</td><td>1</td></tr>
                      <tr><td>5</td><td>1,290</td><td>7,182</td><td>38,402</td><td class="check-ok">false</td><td>3</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </td></tr>

            <!-- Remaining jobs -->
            <tr class="expandable" onclick="toggleContract('c2')">
              <td><span class="expand-arrow" id="a2">▸</span> <span class="job-id">a91f3c02…</span></td>
              <td><span class="job-title">The Pale Orchard (6041)</span></td>
              <td><span class="job-words">96,210</span></td>
              <td><div class="coverage"><span class="cov-dot cov-ok"></span>99.8 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">renderer</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">238.0 s</span></td>
              <td><span class="status-pill sp-pass">PASS</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0"><div class="step-contract" id="c2"><div class="contract-title">Step contract — click row above to expand</div></div></td></tr>

            <tr class="expandable" onclick="toggleContract('c3')">
              <td><span class="expand-arrow" id="a3">▸</span> <span class="job-id">7d4e0a18…</span></td>
              <td><span class="job-title">Borrowed Salt (6053)</span></td>
              <td><span class="job-words">82,447</span></td>
              <td><div class="coverage"><span class="cov-dot cov-warn"></span>91.2 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">pass4_xcheck</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">412.7 s</span></td>
              <td><span class="status-pill sp-warn">PASS4_FINISH_LENGTH</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0"><div class="step-contract" id="c3"><div class="contract-title">Step contract — click row above to expand</div></div></td></tr>

            <tr class="expandable" onclick="toggleContract('c4')">
              <td><span class="expand-arrow" id="a4">▸</span> <span class="job-id">5be20fbc…</span></td>
              <td><span class="job-title">Tide Lockstep (6049)</span></td>
              <td><span class="job-words">31,802</span></td>
              <td><div class="coverage"><span class="cov-dot cov-ok"></span>100.0 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">renderer</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">142.1 s</span></td>
              <td><span class="status-pill sp-pass">PASS</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0"><div class="step-contract" id="c4"><div class="contract-title">Step contract — click row above to expand</div></div></td></tr>

            <tr class="expandable" onclick="toggleContract('c5')">
              <td><span class="expand-arrow" id="a5">▸</span> <span class="job-id">2c8a14e1…</span></td>
              <td><span class="job-title">House of Cinders (6045)</span></td>
              <td><span class="job-words">119,640</span></td>
              <td><div class="coverage"><span class="cov-dot cov-fail"></span>72.3 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">pass1_craft</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">631.5 s</span></td>
              <td><span class="status-pill sp-warn">PASS1_TRUNCATED</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0"><div class="step-contract" id="c5"><div class="contract-title">Step contract — click row above to expand</div></div></td></tr>

            <tr class="expandable" onclick="toggleContract('c6')">
              <td><span class="expand-arrow" id="a6">▸</span> <span class="job-id">9f1c8d40…</span></td>
              <td><span class="job-title">Brass Pulpit (6038)</span></td>
              <td><span class="job-words">7,210</span></td>
              <td><div class="coverage"><span class="cov-dot cov-ok"></span>100.0 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">renderer</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">38.6 s</span></td>
              <td><span class="status-pill sp-pass">PASS</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0"><div class="step-contract" id="c6"><div class="contract-title">Step contract — click row above to expand</div></div></td></tr>

            <tr class="expandable" onclick="toggleContract('c7')">
              <td><span class="expand-arrow" id="a7">▸</span> <span class="job-id">b0e4a51a…</span></td>
              <td><span class="job-title">Quiet Tributary (6032)</span></td>
              <td><span class="job-words">14,901</span></td>
              <td><div class="coverage"><span class="cov-dot cov-ok"></span>99.5 %</div></td>
              <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream3)">renderer</span></td>
              <td><span style="font-family:var(--mono);font-size:11px">71.4 s</span></td>
              <td><span class="status-pill sp-pass">PASS</span></td>
            </tr>
            <tr><td colspan="7" style="padding:0"><div class="step-contract" id="c7"><div class="contract-title">Step contract — click row above to expand</div></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bottom panels: coverage, taxonomy, fixtures, recovery -->
    <div class="bottom-grid">

      <!-- Coverage distribution -->
      <div class="panel">
        <div class="section-title" style="margin-bottom:10px">Coverage distribution · 24h</div>
        <div class="coverage-bars">
          <div class="cov-row">
            <span class="cov-label">≥ 99.5 %</span>
            <div class="cov-bar-track"><div class="cov-bar-fill" style="width:64%;background:var(--green)"></div></div>
            <span class="cov-count">9 jobs</span>
          </div>
          <div class="cov-row">
            <span class="cov-label">90 – 99.5 %</span>
            <div class="cov-bar-track"><div class="cov-bar-fill" style="width:14%;background:var(--yellow)"></div></div>
            <span class="cov-count">2 jobs</span>
          </div>
          <div class="cov-row">
            <span class="cov-label">&lt; 90 %</span>
            <div class="cov-bar-track"><div class="cov-bar-fill" style="width:21%;background:var(--red)"></div></div>
            <span class="cov-count">3 jobs</span>
          </div>
        </div>
        <div style="margin-top:12px;font-size:10px;font-family:var(--mono);color:var(--gray)">green ≥ 99.5 · yellow 90–99.5 · red &lt; 90</div>
      </div>

      <!-- Failure taxonomy -->
      <div class="panel">
        <div class="section-title" style="margin-bottom:10px">Failure taxonomy · live</div>
        <div class="taxonomy-rows">
          <div class="tax-row"><span class="tax-code">PASS1_TIMEOUT</span><span class="tax-count nonzero">2</span></div>
          <div class="tax-row"><span class="tax-code">PASS1_TRUNCATED</span><span class="tax-count nonzero">1</span></div>
          <div class="tax-row"><span class="tax-code">PASS4_FINISH_LENGTH</span><span class="tax-count nonzero">1</span></div>
          <div class="tax-row"><span class="tax-code">JSON_PARSE_FAILED_TRUNCATED</span><span class="tax-count nonzero">1</span></div>
          <div class="tax-row"><span class="tax-code">LONG_FORM_CHUNK_MATERIALIZATION_FAILED</span><span class="tax-count zero">0</span></div>
          <div class="tax-row"><span class="tax-code">PASS3_TIMEOUT</span><span class="tax-count zero">0</span></div>
          <div class="tax-row"><span class="tax-code">CHUNK_TIMEOUT</span><span class="tax-count zero">0</span></div>
          <div class="tax-row"><span class="tax-code">QG_FAILED_THRESHOLD</span><span class="tax-count zero">0</span></div>
          <div class="tax-row"><span class="tax-code">DUP_ROW_HASH</span><span class="tax-count zero">0</span></div>
          <div class="tax-row"><span class="tax-code">DOUBLE_CLAIM</span><span class="tax-count zero">0</span></div>
        </div>
        <div style="margin-top:10px;font-size:10px;font-family:var(--mono);color:var(--gray)">Zero-count rows are visible so absent failures are auditable — not hidden.</div>
      </div>

      <!-- SIPOC fixtures + Recovery -->
      <div style="display:grid;gap:16px">
        <div class="panel">
          <div class="section-title" style="margin-bottom:6px">SIPOC fixtures · last run</div>
          <div style="font-size:10px;font-family:var(--mono);color:var(--gray);margin-bottom:8px">commit d1f4a02 · 14m ago · 9 / 11 passing</div>
          <div class="sipoc-fixtures">
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s01</span><span class="fx-label">intake</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s02</span><span class="fx-label">queue</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s03</span><span class="fx-label">claim</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s04</span><span class="fx-label">chunking</span></div>
            <div class="fixture-row"><span class="fx-dot fx-fail"></span><span class="fx-stage">s05</span><span class="fx-label">P1 fail-closed on truncation</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s06</span><span class="fx-label">P2 per-chunk</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s07</span><span class="fx-label">P3 reduce</span></div>
            <div class="fixture-row"><span class="fx-dot fx-fail"></span><span class="fx-stage">s08</span><span class="fx-label">persistence row_hash</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s09</span><span class="fx-label">quality gate</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s10</span><span class="fx-label">canonical row</span></div>
            <div class="fixture-row"><span class="fx-dot fx-ok"></span><span class="fx-stage">s11</span><span class="fx-label">renderer/releasability</span></div>
            <div class="fixture-row"><span class="fx-dot fx-skip"></span><span class="fx-stage">s12?</span><span class="fx-label">P4 fixture not built</span></div>
          </div>
        </div>

        <div class="panel">
          <div class="section-title" style="margin-bottom:10px">Self-recovery · 24h</div>
          <div class="recovery-stats">
            <div class="rec-box"><div class="rec-label">Retries triggered</div><div class="rec-val" style="color:var(--cream)">12</div></div>
            <div class="rec-box"><div class="rec-label">Retry success</div><div class="rec-val" style="color:var(--green)">9</div></div>
            <div class="rec-box"><div class="rec-label">Retry exhausted</div><div class="rec-val" style="color:var(--red)">3</div></div>
            <div class="rec-box"><div class="rec-label">Silent fail</div><div class="rec-val" style="color:var(--green)">0</div></div>
          </div>
        </div>
      </div>

    </div>

    <!-- Sources -->
    <div class="sources">
      sources: pipeline_step_observations (view) · job_ledger_events · pass1_chunk_findings · pass2_chunk_findings · quality_gate_diagnostics_v1 · pass_outputs_diagnostic_v1 · artifacts/sipoc/sipoc-results.json<br>
      endpoints: GET /api/admin/pipeline-health/jobs/[id]/steps · /steps/[k]/chunks · /taxonomy
    </div>

  </div>

  <script>
    function toggleContract(id) {
      const panel = document.getElementById(id);
      const row = panel.closest('tr').previousElementSibling;
      const arrow = row.querySelector('.expand-arrow');
      const isOpen = panel.classList.contains('open');
      panel.classList.toggle('open', !isOpen);
      if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
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
