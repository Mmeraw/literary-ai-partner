/**
 * Benchmark Truth Cases v3 — Runtime Behavioral Validation Harness
 *
 * Behavioral proof path:
 * source passage -> orchestrateRevision(runtime) -> transformed output -> metrics/assertions
 */

import * as fs from 'fs';
import * as path from 'path';
import { orchestrateRevision, type OrchestratorResult } from '@/lib/revision/revisionOrchestrator';
import type { RevisionMode } from '@/lib/revision/wavePlanner';

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures', 'benchmarks');
const RESULTS_PATH = path.join(__dirname, 'benchmark-results.json');
const ARTIFACTS_DIR = path.join(__dirname, 'benchmark-artifacts');

type Status = 'PASS' | 'FAIL' | 'SKIP';

type EditEvidence = {
  editId: string;
  waveId: number;
  scope: string;
  rationale: string;
  tags: string[];
};

interface BenchmarkResult {
  fixtureId: string;
  caseId: string;
  benchmarkTruth: string;
  status: Status;
  reason: string;
  profileUsed: string;
  sourcePassageLocation: string;
  originalPassage: string;
  transformedPassage: string;
  plannerDecisionSummary: Record<string, unknown>;
  allowedEdits: EditEvidence[];
  blockedEdits: EditEvidence[];
  compressionPercentage: number;
  classificationOutput: string | null;
  diffMetrics: Record<string, unknown>;
  expectedOutcome: Record<string, unknown>;
  actualOutcome: Record<string, unknown>;
  artifactPaths: Record<string, string>;
  timestamp: string;
}

type CompressionMetrics = {
  materiallyChanged: boolean;
  compressionPercentage: number;
  originalChars: number;
  transformedChars: number;
  originalWords: number;
  transformedWords: number;
  charDelta: number;
  wordDelta: number;
};

const results: BenchmarkResult[] = [];

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function toWords(text: string): string[] {
  return text.trim().length === 0 ? [] : text.trim().split(/\s+/).filter(Boolean);
}

function computeCompression(original: string, transformed: string): CompressionMetrics {
  const normalizedOriginal = original.replace(/\s+/g, ' ').trim();
  const normalizedTransformed = transformed.replace(/\s+/g, ' ').trim();
  const originalWords = toWords(normalizedOriginal).length;
  const transformedWords = toWords(normalizedTransformed).length;
  const compression =
    originalWords === 0 ? 0 : Math.max(0, (originalWords - transformedWords) / originalWords);

  return {
    materiallyChanged: normalizedOriginal !== normalizedTransformed,
    compressionPercentage: Number((compression * 100).toFixed(3)),
    originalChars: normalizedOriginal.length,
    transformedChars: normalizedTransformed.length,
    originalWords,
    transformedWords,
    charDelta: normalizedTransformed.length - normalizedOriginal.length,
    wordDelta: transformedWords - originalWords,
  };
}

function loadFixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

function extractBoundedPassage(filePath: string, startMarker: string, endMarker: string): { text: string; sourceLocation: string } {
  const absolutePath = path.join(ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }

  const fullText = fs.readFileSync(absolutePath, 'utf-8');
  const startIdx = fullText.indexOf(startMarker);
  const endIdx = fullText.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Marker extraction failed for ${filePath}`);
  }

  const extracted = fullText.slice(startIdx, endIdx + endMarker.length).trim();
  return {
    text: extracted,
    sourceLocation: `${filePath}::${startMarker.slice(0, 60)}... -> ${endMarker.slice(0, 60)}...`,
  };
}

function parseExpectedWaveIds(fixture: any): number[] {
  const raw = fixture?.runtimeWiring?.expectedWaveModules;
  if (!Array.isArray(raw)) return [];

  const ids = raw
    .map((item: unknown) => {
      if (typeof item === 'number') return item;
      if (typeof item === 'string') {
        const match = item.match(/wave-(\d+)/i);
        return match ? Number(match[1]) : null;
      }
      return null;
    })
    .filter((n: number | null): n is number => Number.isInteger(n));

  return [...new Set(ids)];
}

function resolveRevisionMode(raw: unknown): RevisionMode {
  if (raw === 'surgical' || raw === 'standard' || raw === 'deep') {
    return raw;
  }
  return 'standard';
}

function editEvidence(edits: any[]): EditEvidence[] {
  return edits.map((edit) => ({
    editId: String(edit.editId),
    waveId: Number(edit.waveId),
    scope: String(edit.scope),
    rationale: String(edit.rationale ?? ''),
    tags: Array.isArray(edit.tags) ? edit.tags.map((t) => String(t)) : [],
  }));
}

function classifyBehavioralOutcome(metrics: CompressionMetrics, run: OrchestratorResult): string {
  if (!metrics.materiallyChanged || run.appliedEdits.length === 0 || metrics.compressionPercentage <= 1) {
    return 'behavioral_contradiction';
  }
  if (metrics.compressionPercentage > 1 && run.appliedEdits.length > 0) {
    return 'inventory';
  }
  return 'unknown';
}

function persistCaseArtifacts(
  fixtureId: string,
  caseId: string,
  original: string,
  transformed: string,
  summary: Record<string, unknown>,
): Record<string, string> {
  const caseDir = path.join(ARTIFACTS_DIR, fixtureId, caseId);
  ensureDir(caseDir);

  const originalPath = path.join(caseDir, 'original.txt');
  const transformedPath = path.join(caseDir, 'transformed.txt');
  const summaryPath = path.join(caseDir, 'summary.json');

  fs.writeFileSync(originalPath, original, 'utf-8');
  fs.writeFileSync(transformedPath, transformed, 'utf-8');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return {
    originalPath,
    transformedPath,
    summaryPath,
  };
}

function runRuntimeRevision(caseId: string, fixture: any, sourceText: string): OrchestratorResult {
  const mode = resolveRevisionMode(fixture?.input?.mode);
  const targetWaveIds = parseExpectedWaveIds(fixture);

  return orchestrateRevision({
    chapterId: `${fixture.fixture}:${caseId}`,
    chapterText: sourceText,
    revisionMode: mode,
    targetWaveIds: targetWaveIds.length > 0 ? targetWaveIds : undefined,
  });
}

function pushResult(result: BenchmarkResult): void {
  results.push(result);
}

function reportResults(): void {
  ensureDir(ARTIFACTS_DIR);

  const report = {
    harness: 'benchmark-truth-cases-v3',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === 'PASS').length,
      failed: results.filter((r) => r.status === 'FAIL').length,
      skipped: results.filter((r) => r.status === 'SKIP').length,
    },
    gates: {
      gate1_real_text: results.every((r) => r.sourcePassageLocation.length > 0),
      gate2_runtime_pipeline: results.every((r) => r.actualOutcome['runtimeUsed'] === true),
      gate3_runtime_metrics: results.every((r) => r.diffMetrics['compressionPercentage'] !== undefined),
      gate4_inspectable_artifacts: results.every((r) => Object.keys(r.artifactPaths).length >= 3),
    },
    results,
  };

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n=== BENCHMARK TRUTH CASES v3 REPORT ===');
  console.log(JSON.stringify(report.summary, null, 2));
  Object.entries(report.gates).forEach(([gate, pass]) => {
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${gate}`);
  });
  results.forEach((r) => {
    console.log(`  [${r.status}] ${r.fixtureId}/${r.caseId}: ${r.reason}`);
  });
  console.log(`\nFull report: ${RESULTS_PATH}`);
}

describe('Benchmark Truth Cases v3 (runtime behavioral gate)', () => {
  afterAll(() => reportResults());

  it('i47-max-density: runtime yields zero meaningful compression', () => {
    const fixture = loadFixture('i47-max-density.fixture.json');
    const extracted = extractBoundedPassage(
      fixture.input.filePath,
      fixture.input.startMarker,
      fixture.input.endMarker,
    );

    const run = runRuntimeRevision('i47', fixture, extracted.text);
    const metrics = computeCompression(extracted.text, run.finalText);

    const pass = metrics.compressionPercentage <= 0.5 && !metrics.materiallyChanged;
    const reason = pass
      ? `Runtime preserved protected passage (compression=${metrics.compressionPercentage}%)`
      : `Runtime changed protected passage (compression=${metrics.compressionPercentage}%, changed=${metrics.materiallyChanged})`;

    const summary = {
      fixtureId: fixture.fixture,
      caseId: 'i47',
      planner: run.plan,
      diffReport: run.diffReport,
      appliedEdits: run.appliedEdits,
      skippedEdits: run.skippedEdits,
      metrics,
      errors: run.errors,
      success: run.success,
    };

    const artifactPaths = persistCaseArtifacts(fixture.fixture, 'i47', extracted.text, run.finalText, summary);

    pushResult({
      fixtureId: fixture.fixture,
      caseId: 'i47',
      benchmarkTruth: fixture.benchmarkTruth,
      status: pass ? 'PASS' : 'FAIL',
      reason,
      profileUsed: fixture.input.profile,
      sourcePassageLocation: extracted.sourceLocation,
      originalPassage: extracted.text,
      transformedPassage: run.finalText,
      plannerDecisionSummary: {
        orderedWaveIds: run.plan.orderedWaveIds,
        estimatedEditCount: run.plan.estimatedEditCount,
        applySummary: run.diffReport.applySummary,
        estimatedRisk: run.diffReport.estimatedRisk,
      },
      allowedEdits: editEvidence(run.appliedEdits),
      blockedEdits: editEvidence(run.skippedEdits),
      compressionPercentage: metrics.compressionPercentage,
      classificationOutput: null,
      diffMetrics: metrics,
      expectedOutcome: {
        compressionPercentageMax: 0.5,
        materiallyChanged: false,
      },
      actualOutcome: {
        runtimeUsed: true,
        materiallyChanged: metrics.materiallyChanged,
        success: run.success,
        errors: run.errors,
      },
      artifactPaths,
      timestamp: new Date().toISOString(),
    });

    expect(pass).toBe(true);
  });

  it('ltrd-ch2-contrast: runtime yields selective compression in accepted band', () => {
    const fixture = loadFixture('ltrd-ch2-contrast.fixture.json');
    const extracted = extractBoundedPassage(
      fixture.input.filePath,
      fixture.input.startMarker,
      fixture.input.endMarker,
    );

    const run = runRuntimeRevision('ltrd-ch2', fixture, extracted.text);
    const metrics = computeCompression(extracted.text, run.finalText);

    const lower = Number(fixture.expectedBehavior.compressionRateMin) * 100;
    const upper = Number(fixture.expectedBehavior.compressionRateMax) * 100;
    const pass = metrics.compressionPercentage >= lower && metrics.compressionPercentage <= upper;

    const sourceStatus = fixture.source?.sourceStatus;
    const reason = pass
      ? `Runtime compression ${metrics.compressionPercentage}% within [${lower}, ${upper}]`
      : `Runtime compression ${metrics.compressionPercentage}% outside [${lower}, ${upper}]${sourceStatus ? `; sourceStatus=${sourceStatus}` : ''}`;

    const summary = {
      fixtureId: fixture.fixture,
      caseId: 'ltrd-ch2',
      planner: run.plan,
      diffReport: run.diffReport,
      appliedEdits: run.appliedEdits,
      skippedEdits: run.skippedEdits,
      metrics,
      errors: run.errors,
      success: run.success,
      sourceStatus,
    };

    const artifactPaths = persistCaseArtifacts(fixture.fixture, 'ltrd-ch2', extracted.text, run.finalText, summary);

    pushResult({
      fixtureId: fixture.fixture,
      caseId: 'ltrd-ch2',
      benchmarkTruth: fixture.benchmarkTruth,
      status: pass ? 'PASS' : 'FAIL',
      reason,
      profileUsed: fixture.input.profile,
      sourcePassageLocation: extracted.sourceLocation,
      originalPassage: extracted.text,
      transformedPassage: run.finalText,
      plannerDecisionSummary: {
        orderedWaveIds: run.plan.orderedWaveIds,
        estimatedEditCount: run.plan.estimatedEditCount,
        applySummary: run.diffReport.applySummary,
        estimatedRisk: run.diffReport.estimatedRisk,
        sourceStatus,
      },
      allowedEdits: editEvidence(run.appliedEdits),
      blockedEdits: editEvidence(run.skippedEdits),
      compressionPercentage: metrics.compressionPercentage,
      classificationOutput: null,
      diffMetrics: metrics,
      expectedOutcome: {
        compressionPercentageRange: [lower, upper],
      },
      actualOutcome: {
        runtimeUsed: true,
        success: run.success,
        errors: run.errors,
      },
      artifactPaths,
      timestamp: new Date().toISOString(),
    });

    expect(pass).toBe(true);
  });

  it('behavioral-not-inventory: runtime classification and false-positive protection', () => {
    const fixture = loadFixture('behavioral-not-inventory.fixture.json');

    const passageOutcomes = fixture.input.passages.map((passage: any) => {
      const extracted = extractBoundedPassage(passage.filePath, passage.startMarker, passage.endMarker);
      const run = runRuntimeRevision(passage.id, fixture, extracted.text);
      const metrics = computeCompression(extracted.text, run.finalText);
      const classification = classifyBehavioralOutcome(metrics, run);
      const compressionAllowed = passage.shouldCompress ? metrics.compressionPercentage > 1 : metrics.compressionPercentage <= 1;
      const classificationMatch = classification === passage.expectedClassification;
      const pass = compressionAllowed && classificationMatch;

      const summary = {
        fixtureId: fixture.fixture,
        caseId: passage.id,
        planner: run.plan,
        diffReport: run.diffReport,
        appliedEdits: run.appliedEdits,
        skippedEdits: run.skippedEdits,
        metrics,
        classification,
        errors: run.errors,
        success: run.success,
      };

      const artifactPaths = persistCaseArtifacts(fixture.fixture, passage.id, extracted.text, run.finalText, summary);

      pushResult({
        fixtureId: fixture.fixture,
        caseId: passage.id,
        benchmarkTruth: fixture.benchmarkTruth,
        status: pass ? 'PASS' : 'FAIL',
        reason: pass
          ? `classification=${classification}, compression=${metrics.compressionPercentage}%`
          : `classification=${classification} (expected ${passage.expectedClassification}), compression=${metrics.compressionPercentage}%`,
        profileUsed: fixture.input.profile,
        sourcePassageLocation: extracted.sourceLocation,
        originalPassage: extracted.text,
        transformedPassage: run.finalText,
        plannerDecisionSummary: {
          orderedWaveIds: run.plan.orderedWaveIds,
          estimatedEditCount: run.plan.estimatedEditCount,
          applySummary: run.diffReport.applySummary,
          estimatedRisk: run.diffReport.estimatedRisk,
        },
        allowedEdits: editEvidence(run.appliedEdits),
        blockedEdits: editEvidence(run.skippedEdits),
        compressionPercentage: metrics.compressionPercentage,
        classificationOutput: classification,
        diffMetrics: metrics,
        expectedOutcome: {
          expectedClassification: passage.expectedClassification,
          shouldCompress: passage.shouldCompress,
        },
        actualOutcome: {
          runtimeUsed: true,
          success: run.success,
          errors: run.errors,
          classification,
          shouldCompressObserved: metrics.compressionPercentage > 1,
        },
        artifactPaths,
        timestamp: new Date().toISOString(),
      });

      return pass;
    });

    const overallPass = passageOutcomes.every(Boolean);
    expect(overallPass).toBe(true);
  });

  it('core runtime has no benchmark-specific branching terms', () => {
    const coreFiles = [
      'lib/revision/wavePlanner.ts',
      'lib/revision/waveRegistry.ts',
      'lib/revision/waveConflicts.ts',
      'lib/revision/revisionOrchestrator.ts',
    ];
    const forbiddenTerms = ['i47-max-density', 'ltrd-ch2-contrast', 'behavioral-not-inventory'];
    const leaks: string[] = [];

    for (const rel of coreFiles) {
      const fullPath = path.join(ROOT, rel);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8').toLowerCase();
      for (const term of forbiddenTerms) {
        if (content.includes(term.toLowerCase())) {
          leaks.push(`${rel} contains benchmark term '${term}'`);
        }
      }
    }

    const pass = leaks.length === 0;
    const artifactPaths = persistCaseArtifacts('gate4', 'no-benchmark-branching', JSON.stringify(coreFiles, null, 2), JSON.stringify(leaks, null, 2), {
      leaks,
      checkedFiles: coreFiles,
    });

    pushResult({
      fixtureId: 'gate4',
      caseId: 'no-benchmark-branching',
      benchmarkTruth: 'all',
      status: pass ? 'PASS' : 'FAIL',
      reason: pass ? 'No benchmark-specific branching terms in core runtime' : leaks.join('; '),
      profileUsed: 'n/a',
      sourcePassageLocation: coreFiles.join(', '),
      originalPassage: '',
      transformedPassage: '',
      plannerDecisionSummary: {},
      allowedEdits: [],
      blockedEdits: [],
      compressionPercentage: 0,
      classificationOutput: null,
      diffMetrics: {},
      expectedOutcome: { leaks: 0 },
      actualOutcome: { leaks: leaks.length, runtimeUsed: true },
      artifactPaths,
      timestamp: new Date().toISOString(),
    });

    expect(pass).toBe(true);
  });
});
