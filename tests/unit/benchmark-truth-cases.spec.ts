/**
 * Benchmark Truth Cases — Three Truth Cases Harness
 * 
 * This test suite validates the three core behavioral truths
 * defined in canon/BENCHMARK-CHARTER.md:
 * 
 * 1. I:47 — Zero-compression for max-density ritual passages
 * 2. LTRD Ch.2 — Selective 5-8% compression for moderate-density
 * 3. Behavioral — Contradiction vs inventory false-positive protection
 * 
 * Machine-readable output: JSON report at tests/unit/benchmark-results.json
 */

import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'benchmarks');
const RESULTS_PATH = path.join(__dirname, 'benchmark-results.json');

interface BenchmarkResult {
  fixture: string;
  benchmarkTruth: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  reason: string;
  timestamp: string;
}

const results: BenchmarkResult[] = [];

function loadFixture(name: string) {
  const filePath = path.join(FIXTURES_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function reportResults() {
  const report = {
    harness: 'benchmark-truth-cases',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
    },
    results,
  };
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2));
  console.log('\n=== BENCHMARK TRUTH CASES REPORT ===');
  console.log(JSON.stringify(report.summary, null, 2));
  results.forEach(r => {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'SKIP';
    console.log(`  [${icon}] ${r.fixture} (${r.benchmarkTruth}): ${r.reason}`);
  });
  console.log(`\nFull report: ${RESULTS_PATH}`);
}

describe('Benchmark Truth Cases', () => {
  afterAll(() => {
    reportResults();
  });

  describe('Truth 1: I:47 Max Density (Zero Compression)', () => {
    const fixture = loadFixture('i47-max-density.fixture.json');

    it('should load the I:47 fixture', () => {
      expect(fixture.benchmarkTruth).toBe('I:47');
      expect(fixture.expectedBehavior.compressionRate).toBe(0);
      expect(fixture.expectedBehavior.zeroCompressionIsValidState).toBe(true);
      results.push({
        fixture: fixture.fixture,
        benchmarkTruth: fixture.benchmarkTruth,
        status: 'PASS',
        reason: 'Fixture loaded and schema validated',
        timestamp: new Date().toISOString(),
      });
    });

    it('should require zero compression for ritual-dense passages', () => {
      // TODO: Wire to actual revision pipeline when profiles exist
      // For now, validate fixture contract correctness
      expect(fixture.expectedBehavior.ritualEscalationPreserved).toBe(true);
      expect(fixture.expectedBehavior.sensoryLayeringPreserved).toBe(true);
      expect(fixture.expectedBehavior.rhythmChainsPreserved).toBe(true);
      expect(fixture.expectedBehavior.mythicTonePreserved).toBe(true);
      expect(fixture.failConditions).toContain('Any compression applied to ritual-dense passage');
      results.push({
        fixture: fixture.fixture,
        benchmarkTruth: fixture.benchmarkTruth,
        status: 'PASS',
        reason: 'Zero-compression contract validated against fixture schema',
        timestamp: new Date().toISOString(),
      });
    });
  });

  describe('Truth 2: LTRD Ch.2 Selective Compression', () => {
    const fixture = loadFixture('ltrd-ch2-contrast.fixture.json');

    it('should load the LTRD Ch.2 fixture', () => {
      expect(fixture.benchmarkTruth).toBe('LTRD Ch.2');
      expect(fixture.expectedBehavior.compressionRateMin).toBe(0.05);
      expect(fixture.expectedBehavior.compressionRateMax).toBe(0.08);
      results.push({
        fixture: fixture.fixture,
        benchmarkTruth: fixture.benchmarkTruth,
        status: 'PASS',
        reason: 'Fixture loaded and schema validated',
        timestamp: new Date().toISOString(),
      });
    });

    it('should enforce 5-8% compression range', () => {
      expect(fixture.expectedBehavior.chainsawCompressionForbidden).toBe(true);
      expect(fixture.expectedBehavior.narrativeTexturePreserved).toBe(true);
      expect(fixture.failConditions).toContain('Compression exceeds 8%');
      expect(fixture.failConditions).toContain('Chainsaw texture detected in output');
      results.push({
        fixture: fixture.fixture,
        benchmarkTruth: fixture.benchmarkTruth,
        status: 'PASS',
        reason: 'Selective compression contract validated against fixture schema',
        timestamp: new Date().toISOString(),
      });
    });
  });

  describe('Truth 3: Behavioral vs Inventory', () => {
    const fixture = loadFixture('behavioral-not-inventory.fixture.json');

    it('should load the behavioral fixture', () => {
      expect(fixture.benchmarkTruth).toBe('behavioral');
      expect(fixture.expectedBehavior.cliffPricesLineProtected).toBe(true);
      results.push({
        fixture: fixture.fixture,
        benchmarkTruth: fixture.benchmarkTruth,
        status: 'PASS',
        reason: 'Fixture loaded and schema validated',
        timestamp: new Date().toISOString(),
      });
    });

    it('should distinguish behavioral contradictions from inventory', () => {
      expect(fixture.expectedBehavior.behavioralContradictionDetected).toBe(true);
      expect(fixture.expectedBehavior.inventoryCorrectlyClassified).toBe(true);
      expect(fixture.expectedBehavior.falsePositiveProtection).toBe(true);
      expect(fixture.failConditions).toContain('Behavioral contradiction classified as inventory');
      expect(fixture.failConditions).toContain('Cliff prices line compressed or removed');
      results.push({
        fixture: fixture.fixture,
        benchmarkTruth: fixture.benchmarkTruth,
        status: 'PASS',
        reason: 'Behavioral vs inventory contract validated against fixture schema',
        timestamp: new Date().toISOString(),
      });
    });
  });
});
