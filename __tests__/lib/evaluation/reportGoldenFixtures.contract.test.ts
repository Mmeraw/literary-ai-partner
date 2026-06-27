import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type ReportGoldenFixture = {
  schema_version: string;
  fixture_id: string;
  mode: string;
  route: string;
  word_count_band: string;
  manuscript_profile: {
    title: string;
    word_count: number;
    genre: string;
    target_audience: string;
  };
  required_surfaces: string[];
  expected_section_order: string[];
  required_public_strings: string[];
  forbidden_public_strings: string[];
  required_criterion_keys?: string[];
  required_diagnostic_fields?: string[];
  required_dream_keys?: string[];
  required_revision_queue_display_rule?: {
    must_render_clean_display_text: boolean;
    forbidden_raw_tokens: string[];
  };
};

const FIXTURE_ROOT = join(process.cwd(), 'tests/fixtures/report-golden');
const ACTIVE_FIXTURES = [
  ['short form', 'short-form/expected.json', 'short_form_evaluation'],
  ['long-form multi-layer', 'long-form-multi-layer/expected.json', 'long_form_multi_layer_evaluation'],
] as const;

function loadFixture(relativePath: string): ReportGoldenFixture {
  const fullPath = join(FIXTURE_ROOT, relativePath);
  expect(existsSync(fullPath)).toBe(true);
  return JSON.parse(readFileSync(fullPath, 'utf8')) as ReportGoldenFixture;
}

describe('report golden fixture package', () => {
  test('declares exactly the two active product-mode golden fixtures', () => {
    expect(existsSync(join(FIXTURE_ROOT, 'README.md'))).toBe(true);
    expect(existsSync(join(FIXTURE_ROOT, 'long-form/expected.json'))).toBe(false);

    for (const [, relativePath, expectedMode] of ACTIVE_FIXTURES) {
      const fixture = loadFixture(relativePath);
      expect(fixture.schema_version).toBe('report_golden_fixture_v1');
      expect(fixture.mode).toBe(expectedMode);
      expect(fixture.mode).not.toBe('long_form_evaluation');
      expect(fixture.route).toMatch(/^(SHORT_FORM|LONG_FORM)$/);
      expect(fixture.fixture_id).toBeTruthy();
      expect(fixture.word_count_band).toBeTruthy();
    }
  });

  test('requires all renderer surfaces for every active golden fixture', () => {
    const requiredSurfaces = ['view_model', 'txt', 'html_pdf', 'docx'];

    for (const [, relativePath] of ACTIVE_FIXTURES) {
      const fixture = loadFixture(relativePath);
      expect(fixture.required_surfaces).toEqual(requiredSurfaces);
    }
  });

  test('each active fixture has enough public content to function as a product golden', () => {
    for (const [, relativePath] of ACTIVE_FIXTURES) {
      const fixture = loadFixture(relativePath);
      expect(fixture.manuscript_profile.title).toBeTruthy();
      expect(fixture.manuscript_profile.word_count).toBeGreaterThan(0);
      expect(fixture.manuscript_profile.genre).toBeTruthy();
      expect(fixture.manuscript_profile.target_audience).toBeTruthy();
      expect(fixture.expected_section_order.length).toBeGreaterThanOrEqual(10);
      expect(fixture.required_public_strings.length).toBeGreaterThanOrEqual(20);
      expect(fixture.forbidden_public_strings.length).toBeGreaterThanOrEqual(8);
    }
  });

  test('short form fixture locks out DREAM and internal artifact leakage', () => {
    const fixture = loadFixture('short-form/expected.json');

    expect(fixture.mode).toBe('short_form_evaluation');
    expect(fixture.expected_section_order).not.toContain('structural_stack');
    expect(fixture.expected_section_order).not.toContain('story_ledger');
    expect(fixture.forbidden_public_strings).toEqual(expect.arrayContaining([
      'DREAM',
      'Story Ledger',
      'WAVE',
      'revision_opportunity_ledger',
      'chain_of_thought',
    ]));
    expect(fixture.required_diagnostic_fields).toEqual(expect.arrayContaining([
      'anchor_snippet',
      'symptom',
      'mechanism',
      'specific_fix',
      'reader_effect',
      'mistake_proofing',
    ]));
  });

  test('DREAM fixture requires the full multi-layer surface and clean revision queue display', () => {
    const fixture = loadFixture('long-form-multi-layer/expected.json');

    expect(fixture.mode).toBe('long_form_multi_layer_evaluation');
    expect(fixture.manuscript_profile.word_count).toBeGreaterThanOrEqual(75_000);
    expect(fixture.required_dream_keys).toEqual(expect.arrayContaining([
      'executive_verdict',
      'dream_scores',
      'market_shelf',
      'structural_stack',
      'arc_map',
      'criterion_analyses',
      'symbolic_audit',
      'reader_experience',
      'revision_plan',
      'acceptance_checks',
    ]));
    expect(fixture.required_revision_queue_display_rule?.must_render_clean_display_text).toBe(true);
    expect(fixture.required_revision_queue_display_rule?.forbidden_raw_tokens).toEqual(expect.arrayContaining([
      '[LOCATION:',
      '[OPERATION:',
    ]));
  });

  test('forbidden leakage vocabulary is never also required public content', () => {
    for (const [name, relativePath] of ACTIVE_FIXTURES) {
      const fixture = loadFixture(relativePath);
      const required = new Set(fixture.required_public_strings);
      const overlap = fixture.forbidden_public_strings.filter((value) => required.has(value));
      expect(overlap).toEqual([]);
      expect(name).toBeTruthy();
    }
  });
});
