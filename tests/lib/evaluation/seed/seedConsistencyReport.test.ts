import { buildSeedConsistencyReport } from '@/lib/evaluation/seed/seedConsistencyReport';

describe('buildSeedConsistencyReport', () => {

  // ── Type contract ─────────────────────────────────────────────────────────

  test('SeedEntityStatus does not include contradicted (U3-002)', () => {
    // Compile-time enforcement: if contradicted were still in the union,
    // this test would fail to compile. This is a runtime guard as well.
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice'],
      extractedEntityNames: ['Alice'],
    });

    const statuses = report.seed_entities.map((e) => e.status);
    for (const s of statuses) {
      expect(['confirmed', 'missed']).toContain(s);
    }
  });

  test('contradicted_count is not present on report (U3-002)', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice'],
      extractedEntityNames: [],
    });

    // TypeScript type should not have this field; confirm at runtime too.
    expect('contradicted_count' in report).toBe(false);
  });

  // ── Confirmed path ────────────────────────────────────────────────────────

  test('seed entity found by exact name → confirmed', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice'],
      extractedEntityNames: ['Alice'],
    });

    expect(report.verdict).toBe('consistent');
    expect(report.confirmed_count).toBe(1);
    expect(report.missed_count).toBe(0);
    expect(report.drift_ratio).toBe(0);
    expect(report.seed_entities[0]?.status).toBe('confirmed');
    expect(report.seed_entities[0]?.extraction_match).toBe('Alice');
  });

  test('seed entity found by fuzzy name match → confirmed', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice Hoffman'],
      extractedEntityNames: ['alice hoffman'],
    });

    expect(report.confirmed_count).toBe(1);
    expect(report.missed_count).toBe(0);
  });

  // ── Missed path ───────────────────────────────────────────────────────────

  test('seed entity not found in extraction → missed', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Bob'],
      extractedEntityNames: ['Alice'],
    });

    expect(report.missed_count).toBe(1);
    expect(report.confirmed_count).toBe(0);
    const bobEntry = report.seed_entities.find((e) => e.seed_entity_name === 'Bob');
    expect(bobEntry?.status).toBe('missed');
  });

  test('drift_ratio is missed / seed count (no contradicted term)', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice', 'Bob', 'Carol'],
      extractedEntityNames: ['Alice'],
    });

    // 2 missed, 3 seed → drift = 2/3 ≈ 0.667
    expect(report.missed_count).toBe(2);
    expect(report.drift_ratio).toBeCloseTo(2 / 3, 2);
  });

  // ── Verdict thresholds ────────────────────────────────────────────────────

  test('consistent verdict when all seed entities confirmed', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice', 'Bob'],
      extractedEntityNames: ['Alice', 'Bob'],
    });

    expect(report.verdict).toBe('consistent');
  });

  test('minor_drift verdict when drift_ratio > 0.2', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'],
      extractedEntityNames: ['Alice', 'Bob', 'Carol'],
    });

    // 2 missed / 5 = 0.4 drift → minor_drift
    expect(report.drift_ratio).toBeCloseTo(0.4, 2);
    expect(report.verdict).toBe('minor_drift');
  });

  test('significant_drift verdict when drift_ratio > 0.5', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice', 'Bob'],
      extractedEntityNames: ['Carol'],
    });

    // 2 missed / 2 = 1.0 → significant_drift
    expect(report.verdict).toBe('significant_drift');
  });

  // ── Contamination path ────────────────────────────────────────────────────

  test('prefixed pronoun extracted entity is marked contaminated', () => {
    // isEntityTypingContaminated requires a prefix pattern (e.g. "he_1", "she_narrator").
    // Bare lowercase pronouns like "she" alone do not trigger contamination.
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice'],
      extractedEntityNames: ['Alice', 'she_narrator'],
    });

    expect(report.contaminated_count).toBe(1);
    expect(report.verdict).toBe('contamination_detected');
    const contaminated = report.extraction_entities.find((e) => e.extracted_name === 'she_narrator');
    expect(contaminated?.status).toBe('contaminated');
  });

  // ── Novel entity path ─────────────────────────────────────────────────────

  test('entity in extraction not in seed → novel_unjustified', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice'],
      extractedEntityNames: ['Alice', 'Zara'],
    });

    const zara = report.extraction_entities.find((e) => e.extracted_name === 'Zara');
    expect(zara?.status).toBe('novel_unjustified');
  });

  // ── Abstract seed entity filtering ───────────────────────────────────────

  test('abstract seed entity (compound slash name) is filtered out', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Protagonist/Alice', 'Bob'],
      extractedEntityNames: ['Bob'],
    });

    // Protagonist/Alice is abstract and should be filtered — only Bob counted
    expect(report.seed_entity_count).toBe(1);
    expect(report.confirmed_count).toBe(1);
  });

  test('abstract seed entity (theme) is filtered out', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['theme', 'Alice'],
      extractedEntityNames: ['Alice'],
    });

    expect(report.seed_entity_count).toBe(1);
    expect(report.confirmed_count).toBe(1);
  });

  // ── Empty inputs ──────────────────────────────────────────────────────────

  test('empty seed with novel extraction → minor_drift (novel count exceeds seed count)', () => {
    // novelUnjustifiedCount (1) > seedCount (0) triggers minor_drift.
    // drift_ratio is 0 because there are no seed entities to miss.
    const report = buildSeedConsistencyReport({
      seedEntityNames: [],
      extractedEntityNames: ['Alice'],
    });

    expect(report.verdict).toBe('minor_drift');
    expect(report.confirmed_count).toBe(0);
    expect(report.missed_count).toBe(0);
    expect(report.drift_ratio).toBe(0);
    expect(report.novel_unjustified_count).toBe(1);
  });

  test('empty seed with empty extraction → consistent verdict', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: [],
      extractedEntityNames: [],
    });

    expect(report.verdict).toBe('consistent');
    expect(report.confirmed_count).toBe(0);
    expect(report.missed_count).toBe(0);
    expect(report.drift_ratio).toBe(0);
  });

  test('empty extraction → all seed entities missed', () => {
    const report = buildSeedConsistencyReport({
      seedEntityNames: ['Alice', 'Bob'],
      extractedEntityNames: [],
    });

    expect(report.missed_count).toBe(2);
    expect(report.confirmed_count).toBe(0);
    expect(report.verdict).toBe('significant_drift');
  });

});
