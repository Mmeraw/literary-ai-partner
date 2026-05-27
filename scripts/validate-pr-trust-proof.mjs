#!/usr/bin/env node
/**
 * PR Trust-Proof Validator
 *
 * Validates that a PR body contains all required trust-proof sections and
 * makes concrete non-trivial claims in each one.
 *
 * Invocation:
 *   node scripts/validate-pr-trust-proof.mjs [--pr-body-file <path>]
 *   node scripts/validate-pr-trust-proof.mjs [--pr-number <n>]
 *   PR_BODY="..." node scripts/validate-pr-trust-proof.mjs
 *
 * In CI (GitHub Actions), the PR body is injected via ${{ github.event.pull_request.body }}
 * and written to a temp file before this script runs.
 *
 * Exit codes:
 *   0 — all required sections present and non-trivial
 *   1 — one or more required sections missing or trivially empty
 */

import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

// ─── Required sections ──────────────────────────────────────────────────────
// Each entry: heading text that must appear as a ## or ### header,
// plus a minimum content check.

const REQUIRED_SECTIONS = [
  {
    heading: 'Unauthorized Input Sources',
    aliases: ['unauthorized input sources', 'unauthorized inputs'],
    description: 'Must state whether unauthorized input sources are introduced and explicitly say "No unauthorized input sources" or describe what was added.',
    minContentWords: 4,
    forbidTrivial: ['n/a', 'none', 'tbd', 'todo', 'see above'],
  },
  {
    heading: 'Internal Process Leakage',
    aliases: ['internal process leakage', 'process leakage'],
    description: 'Must state whether internal process details leak to public surfaces.',
    minContentWords: 4,
    forbidTrivial: ['n/a', 'none', 'tbd', 'todo'],
  },
  {
    heading: 'Input → Action → Output',
    aliases: ['input → action → output', 'input > action > output', 'input action output', 'input/action/output'],
    description: 'Must describe the explicit flow: what goes in, what happens, what comes out.',
    minContentWords: 6,
    forbidTrivial: ['n/a', 'none', 'tbd', 'todo'],
  },
  {
    heading: 'Public-Safe Quality/Status Metrics',
    aliases: ['public-safe quality', 'quality/status metrics', 'public safe quality', 'status metrics'],
    description: 'Must identify which quality or status metrics are exposed publicly and confirm they are safe.',
    minContentWords: 4,
    forbidTrivial: ['n/a', 'none', 'tbd', 'todo'],
  },
  {
    heading: 'Runtime/Pipeline Expansion',
    aliases: ['runtime/pipeline expansion', 'runtime expansion', 'pipeline expansion', 'hidden runtime'],
    description: 'Must state whether hidden runtime or pipeline expansion is introduced.',
    minContentWords: 4,
    forbidTrivial: ['n/a', 'tbd', 'todo'],
  },
  {
    heading: 'Latency Impact',
    aliases: ['latency impact', 'latency increase'],
    description: 'Must state the expected latency impact and confirm no unnecessary latency increase.',
    minContentWords: 4,
    forbidTrivial: ['n/a', 'tbd', 'todo'],
  },
  {
    heading: 'Post-Merge Sanity Sweep',
    aliases: ['post-merge sanity sweep', 'post merge sanity', 'sanity sweep'],
    description: 'Must include concrete post-merge verification instructions (commands or steps).',
    minContentWords: 8,
    forbidTrivial: ['n/a', 'tbd', 'todo', 'none'],
  },
  {
    heading: 'Actionlint Status',
    aliases: ['actionlint status', 'actionlint'],
    description:
      'Must state whether actionlint has been run and what the result is, or explicitly state it is unproven in this environment.',
    minContentWords: 4,
    forbidTrivial: ['n/a', 'tbd', 'todo'],
  },
];

// ─── Process Change requirement ─────────────────────────────────────────────
// PRs that touch runtime paths MUST include a "Process Change" statement.
const PROCESS_CHANGE_PATTERN = /process\s+change\s*:\s*(yes|no\s*—)/i;
const RUNTIME_INDICATORS = [
  /lib\/evaluation\/processor/i,
  /lib\/evaluation\/pipeline/i,
  /app\/api\/workers/i,
  /lib\/jobs\//i,
  /lib\/evaluation\/orchestration/i,
];

// ─── Load PR body ────────────────────────────────────────────────────────────

function loadPrBody() {
  // 1. --pr-body-file <path>
  const fileArgIdx = process.argv.indexOf('--pr-body-file');
  if (fileArgIdx !== -1 && process.argv[fileArgIdx + 1]) {
    const filePath = process.argv[fileArgIdx + 1];
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: --pr-body-file path not found: ${filePath}`);
      process.exit(1);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  // 2. PR_BODY env var
  if (process.env.PR_BODY) return process.env.PR_BODY;

  // 3. PR_BODY_FILE env var
  if (process.env.PR_BODY_FILE) {
    if (!fs.existsSync(process.env.PR_BODY_FILE)) {
      console.error(`ERROR: PR_BODY_FILE not found: ${process.env.PR_BODY_FILE}`);
      process.exit(1);
    }
    return fs.readFileSync(process.env.PR_BODY_FILE, 'utf-8');
  }

  // 4. stdin
  try {
    return fs.readFileSync('/dev/stdin', 'utf-8');
  } catch {
    console.error(
      'ERROR: No PR body provided.\n' +
      'Pass via: --pr-body-file <path> | PR_BODY="..." | PR_BODY_FILE=<path> | stdin'
    );
    process.exit(1);
  }
}

// ─── Section extractor ───────────────────────────────────────────────────────

/**
 * Extract the text content that follows a heading match.
 * Returns the content up to the next heading of equal or higher level.
 */
function extractSectionContent(body, heading, aliases) {
  const lines = body.split('\n');
  let sectionStart = -1;
  let sectionLevel = 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
    const text = headingMatch[2].toLowerCase().trim();

    const allTerms = [heading.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
    if (allTerms.some(t => text.includes(t))) {
      sectionStart = i + 1;
      sectionLevel = level;
      break;
    }
  }

  if (sectionStart === -1) return null;

  const contentLines = [];
  for (let i = sectionStart; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.trim().match(/^(#{1,4})\s+/);
    if (headingMatch && headingMatch[1].length <= sectionLevel) break;
    contentLines.push(line);
  }

  return contentLines.join('\n').trim();
}

// ─── Trivial content check ───────────────────────────────────────────────────

function isTrivial(content, rule) {
  const lower = content.toLowerCase().replace(/[\s\-\*_]/g, ' ').trim();
  if (lower.length === 0) return true;
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount < rule.minContentWords) return true;
  if (rule.forbidTrivial && rule.forbidTrivial.some(t => lower === t || lower === t + '.')) return true;
  return false;
}

// ─── Main validation ─────────────────────────────────────────────────────────

function validate() {
  const body = loadPrBody();
  const failures = [];
  const warnings = [];

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(' PR Trust-Proof Validator');
  console.log('══════════════════════════════════════════════════════════\n');

  // ── Required sections ────────────────────────────────────────────────────
  for (const rule of REQUIRED_SECTIONS) {
    const content = extractSectionContent(body, rule.heading, rule.aliases);

    if (content === null) {
      failures.push(`MISSING SECTION: "## ${rule.heading}"\n  ${rule.description}`);
      continue;
    }

    if (isTrivial(content, rule)) {
      failures.push(
        `TRIVIAL SECTION: "## ${rule.heading}" — content is too short or non-committal.\n` +
        `  Required: ${rule.description}\n` +
        `  Found: ${content.slice(0, 80).replace(/\n/g, ' ')}`
      );
      continue;
    }

    console.log(`  ✓  ${rule.heading}`);
  }

  // ── Process Change check ─────────────────────────────────────────────────
  const touchesRuntime = RUNTIME_INDICATORS.some(r => r.test(body));
  if (touchesRuntime && !PROCESS_CHANGE_PATTERN.test(body)) {
    warnings.push(
      'ADVISORY: PR body references runtime paths but does not include a "Process Change: yes/no" statement.\n' +
      '  Add: "Process Change: yes" or "Process Change: no — reason: ..."'
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  console.log('');

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  ⚠  ${w}`));
    console.log('');
  }

  if (failures.length > 0) {
    console.log(`\n❌  Trust-proof validation FAILED — ${failures.length} issue(s):\n`);
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f}`);
      console.log('');
    });
    console.log(
      'Every PR must prove:\n' +
      '  • no unauthorized input sources\n' +
      '  • no internal process leakage\n' +
      '  • clear Input → Action → Output\n' +
      '  • public-safe quality/status metrics\n' +
      '  • no hidden runtime/pipeline expansion\n' +
      '  • no unnecessary latency increase\n' +
      '  • post-merge sanity sweep instructions\n' +
      '  • actionlint status stated\n'
    );
    process.exit(1);
  }

  console.log('✅  Trust-proof validation PASSED — all required sections present and non-trivial.\n');
  process.exit(0);
}

validate();
