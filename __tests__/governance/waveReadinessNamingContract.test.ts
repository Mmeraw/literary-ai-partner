/**
 * WAVE Readiness Naming Contract Test
 *
 * Governance: WAVE can diagnose and plan. Revise (Queue / TrustedPath) repairs.
 *
 * This test scans active app/components/lib source paths and fails if any
 * public or runtime-facing string contains forbidden WAVE doctrine violations.
 *
 * It does NOT fail on internal compatibility identifiers — those are explicitly
 * whitelisted and must not be renamed without a separate migration/rename PR.
 *
 * Forbidden in active public/runtime copy (display strings, progress messages,
 * comments that describe user-facing behavior, log messages surfaced to operators):
 *
 *   WAVE Revision          — implies WAVE is a repair phase
 *   WAVE revision complete — user-facing progress copy with wrong doctrine
 *   Preparing WAVE revision plan — user-facing UI copy with wrong doctrine
 *   repair through WAVE    — falsely implies WAVE repairs manuscript
 *   WAVE repairs           — falsely implies WAVE repairs manuscript
 *   WAVE is Pass 4         — incorrect pipeline position labelling
 *   Pass 4 status          — leaks internal pass numbering into public status
 *
 * Allowed internal compatibility identifiers (NOT forbidden):
 *   wave_revision                — DB column / artifact type key
 *   wave_revision_plan_v1        — artifact type string
 *   executeWaveRevision          — function name (internal)
 *   WaveRevisionPlanArtifact     — TypeScript type name (internal)
 *   WaveRevisionResult           — TypeScript type name (internal)
 *   WaveRevisionProof*           — type names in proof validators (internal)
 *   waveRevision (camelCase)     — variable / import names (internal)
 *   deriveWaveRevisionProof      — function name (internal)
 *   buildWaveProofProgressPatch  — function name (internal)
 *
 * Scan scope: app/ components/ lib/
 * Exclusions: archive/ docs/archive/ docs/canon/intake/ .github/pr-bodies/
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ─────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '../../');

const SCAN_DIRS = ['app', 'components', 'lib'];

const EXCLUDED_PATHS = [
  'archive',
  'docs/archive',
  'docs/canon/intake',
  '.github/pr-bodies',
  '__tests__',
  'node_modules',
  '.next',
  '.git',
];

const EXCLUDED_FILE_SUFFIXES = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
];

// ─── Forbidden patterns ─────────────────────────────────────────────────────
// Each entry: { pattern, description, allowedContexts }
// allowedContexts: if a line also matches one of these, it is not a violation
// (used for whitelist comments like "// internal: wave_revision")

type ForbiddenRule = {
  pattern: RegExp;
  description: string;
  // If the matched line is a pure symbol reference (identifier chars only around the match),
  // it is considered an internal identifier and not a violation.
  internalIdentifierPattern?: RegExp;
};

const FORBIDDEN_RULES: ForbiddenRule[] = [
  {
    // "WAVE Revision" as a display/doc/log string — NOT as a TypeScript identifier
    // Allow: waveRevision, WaveRevision, wave_revision (identifier contexts)
    // Forbid: 'WAVE Revision', "WAVE Revision", WAVE Revision (as human-readable copy)
    pattern: /['"`\s]WAVE\s+[Rr]evision(?!\s*(Plan|Proof|Phase|Guide|Result|Artifact|Handoff|Run|Status|proof|plan|guide|result|artifact|handoff|run|status)[A-Za-z])/,
    description:
      'Active surface contains "WAVE Revision" as display/log copy. Use "WAVE Readiness Layer" instead.',
    internalIdentifierPattern: /\b(waveRevision|WaveRevision|wave_revision|WaveRevisionPlanArtifact|WaveRevisionResult|WaveRevisionProof|deriveWaveRevisionProof|buildWaveProofProgressPatch|executeWaveRevision)\b/,
  },
  {
    pattern: /WAVE\s+revision\s+complete/i,
    description:
      'Active surface contains "WAVE revision complete". Use "WAVE readiness layer complete" instead.',
  },
  {
    pattern: /[Pp]reparing\s+WAVE\s+revision\s+plan/,
    description:
      'Active surface contains "Preparing WAVE revision plan". Use "Preparing WAVE readiness plan" instead.',
  },
  {
    pattern: /repair\s+through\s+WAVE/i,
    description:
      'Active surface contains "repair through WAVE". WAVE diagnoses and plans — Revise Queue / TrustedPath repairs.',
  },
  {
    pattern: /WAVE\s+repairs/i,
    description:
      'Active surface contains "WAVE repairs". WAVE diagnoses and plans — it does not repair.',
  },
  {
    pattern: /WAVE\s+is\s+Pass\s+4/i,
    description:
      'Active surface contains "WAVE is Pass 4". WAVE is the long-form readiness layer, not Pass 4.',
  },
  {
    pattern: /Pass\s+4\s+status/i,
    description:
      'Active surface contains "Pass 4 status". Use "Quality Gate status" or "cross-check status" instead.',
  },
  {
    // starting revision phase — internal log string that implies WAVE = revision workflow
    pattern: /starting\s+revision\s+phase/i,
    description:
      'Active surface contains "starting revision phase". Use "starting WAVE readiness layer" instead.',
  },
  {
    // Revision phase complete — internal log that implies WAVE = revision workflow
    pattern: /[Rr]evision\s+phase\s+complete/,
    description:
      'Active surface contains "Revision phase complete". Use "WAVE readiness layer complete" instead.',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function isExcluded(filePath: string): boolean {
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  if (EXCLUDED_PATHS.some((ex) => rel.startsWith(ex))) return true;
  if (EXCLUDED_FILE_SUFFIXES.some((s) => filePath.endsWith(s))) return true;
  return false;
}

function collectFiles(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_PATHS.some((ex) => full.includes(ex))) walk(full);
      } else if (ext.some((e) => entry.name.endsWith(e))) {
        if (!isExcluded(full)) results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

type Violation = {
  file: string;
  line: number;
  text: string;
  rule: string;
};

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');

  for (const rule of FORBIDDEN_RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!rule.pattern.test(line)) continue;

      // If the rule has an internalIdentifierPattern and the WHOLE line is
      // primarily an identifier context (import, type declaration, function
      // signature, variable name), skip — it's not display copy.
      if (rule.internalIdentifierPattern) {
        const trimmed = line.trim();
        // Lines that are purely TypeScript type/function/import declarations
        // referencing the internal identifier are not display violations.
        const isIdentifierContext =
          /^\s*(import|export|type|interface|const|let|var|function|async function|class|extends|implements|return|=|=>)\b/.test(trimmed) &&
          rule.internalIdentifierPattern.test(line);
        if (isIdentifierContext) continue;

        // Pure identifier token usage (e.g. object property, generic type arg)
        const onlyInternalMatch = rule.internalIdentifierPattern.test(line) &&
          !/['"`]WAVE\s+Revision['"`]/.test(line);
        if (onlyInternalMatch) continue;
      }

      violations.push({
        file: path.relative(REPO_ROOT, filePath),
        line: i + 1,
        text: line.trim().slice(0, 120),
        rule: rule.description,
      });
    }
  }

  return violations;
}

// ─── Test ──────────────────────────────────────────────────────────────────

describe('WAVE Readiness Naming Contract', () => {
  const exts = ['.ts', '.tsx', '.js', '.jsx'];
  const allViolations: Violation[] = [];

  beforeAll(() => {
    for (const dir of SCAN_DIRS) {
      const absDir = path.join(REPO_ROOT, dir);
      const files = collectFiles(absDir, exts);
      for (const file of files) {
        allViolations.push(...scanFile(file));
      }
    }
  });

  it('has no forbidden WAVE Revision display/log copy in active source paths', () => {
    if (allViolations.length === 0) return;

    const report = allViolations
      .map((v) => `  ${v.file}:${v.line}\n    Rule: ${v.rule}\n    Text: ${v.text}`)
      .join('\n\n');

    fail(
      `Found ${allViolations.length} naming contract violation(s):\n\n${report}\n\n` +
      `Doctrine: WAVE can diagnose and plan. Revise (Queue / TrustedPath) repairs.\n` +
      `Use "WAVE Readiness Layer" for public/runtime copy. ` +
      `Internal identifiers (wave_revision, wave_revision_plan_v1, executeWaveRevision, etc.) are exempt.`
    );
  });

  it('confirms WAVE Readiness Layer doctrine is present in progressLabels.ts', () => {
    const filePath = path.join(REPO_ROOT, 'lib/evaluation/phase-architecture-v2/progressLabels.ts');
    if (!fs.existsSync(filePath)) return; // skip if file not present

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/WAVE Readiness Layer/);
    expect(content).toMatch(/WAVE can diagnose and plan/);
  });

  it('confirms processor.ts active progress messages do not say WAVE revision complete', () => {
    const filePath = path.join(REPO_ROOT, 'lib/evaluation/processor.ts');
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    // Must not have the old forbidden string as a message literal
    expect(content).not.toMatch(/'WAVE revision complete'/);
    expect(content).not.toMatch(/"WAVE revision complete"/);
  });

  it('confirms phase-helpers.ts does not say Preparing WAVE revision plan', () => {
    const filePath = path.join(REPO_ROOT, 'lib/ui/phase-helpers.ts');
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/Preparing WAVE revision plan/);
    expect(content).toMatch(/WAVE readiness/i);
  });

  it('confirms waveRevision.ts log strings do not say "starting revision phase"', () => {
    const filePath = path.join(REPO_ROOT, 'lib/evaluation/waveRevision.ts');
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/starting revision phase/i);
    expect(content).not.toMatch(/Revision phase complete/);
  });
});
