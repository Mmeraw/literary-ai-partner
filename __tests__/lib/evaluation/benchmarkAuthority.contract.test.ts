import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type BenchmarkContract = {
  schema_version: string;
  contract_id: string;
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

const CONTRACT_ROOT = join(process.cwd(), 'tests/benchmark-authority');
const ACTIVE_CONTRACTS = [
  ['short form', 'short-form/expected.json', 'short_form_evaluation'],
  ['long-form multi-layer', 'long-form-multi-layer/expected.json', 'long_form_multi_layer_evaluation'],
] as const;

function loadContract(relativePath: string): BenchmarkContract {
  const fullPath = join(CONTRACT_ROOT, relativePath);
  expect(existsSync(fullPath)).toBe(true);
  return JSON.parse(readFileSync(fullPath, 'utf8')) as BenchmarkContract;
}

describe('benchmark authority contract package', () => {
  test('declares exactly the two active product-mode benchmark contracts', () => {
    expect(existsSync(join(CONTRACT_ROOT, 'README.md'))).toBe(true);
    expect(existsSync(join(CONTRACT_ROOT, 'long-form/expected.json'))).toBe(false);

    for (const [, relativePath, expectedMode] of ACTIVE_CONTRACTS) {
      const contract = loadContract(relativePath);
      expect(contract.schema_version).toBe('benchmark_authority_contract_v1');
      expect(contract.mode).toBe(expectedMode);
      expect(contract.mode).not.toBe('long_form_evaluation');
      expect(contract.route).toMatch(/^(SHORT_FORM|LONG_FORM)$/);
      expect(contract.contract_id).toBeTruthy();
      expect(contract.word_count_band).toBeTruthy();
    }
  });

  test('requires all renderer surfaces for every active benchmark contract', () => {
    const requiredSurfaces = ['view_model', 'txt', 'html_pdf', 'docx'];

    for (const [, relativePath] of ACTIVE_CONTRACTS) {
      const contract = loadContract(relativePath);
      expect(contract.required_surfaces).toEqual(requiredSurfaces);
    }
  });

  test('each active contract has enough public content to function as a product golden', () => {
    for (const [, relativePath] of ACTIVE_CONTRACTS) {
      const contract = loadContract(relativePath);
      expect(contract.manuscript_profile.title).toBeTruthy();
      expect(contract.manuscript_profile.word_count).toBeGreaterThan(0);
      expect(contract.manuscript_profile.genre).toBeTruthy();
      expect(contract.manuscript_profile.target_audience).toBeTruthy();
      expect(contract.expected_section_order.length).toBeGreaterThanOrEqual(10);
      expect(contract.required_public_strings.length).toBeGreaterThanOrEqual(20);
      expect(contract.forbidden_public_strings.length).toBeGreaterThanOrEqual(8);
    }
  });

  test('short form contract locks out DREAM and internal artifact leakage', () => {
    const contract = loadContract('short-form/expected.json');

    expect(contract.mode).toBe('short_form_evaluation');
    expect(contract.expected_section_order).not.toContain('structural_stack');
    expect(contract.expected_section_order).not.toContain('story_ledger');
    expect(contract.forbidden_public_strings).toEqual(expect.arrayContaining([
      'DREAM',
      'Story Ledger',
      'WAVE',
      'revision_opportunity_ledger',
      'chain_of_thought',
    ]));
    expect(contract.required_diagnostic_fields).toEqual(expect.arrayContaining([
      'anchor_snippet',
      'symptom',
      'mechanism',
      'specific_fix',
      'reader_effect',
      'mistake_proofing',
    ]));
  });

  test('DREAM contract requires the full multi-layer surface and clean revision queue display', () => {
    const contract = loadContract('long-form-multi-layer/expected.json');

    expect(contract.mode).toBe('long_form_multi_layer_evaluation');
    expect(contract.manuscript_profile.word_count).toBeGreaterThanOrEqual(75_000);
    expect(contract.required_dream_keys).toEqual(expect.arrayContaining([
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
    expect(contract.required_revision_queue_display_rule?.must_render_clean_display_text).toBe(true);
    expect(contract.required_revision_queue_display_rule?.forbidden_raw_tokens).toEqual(expect.arrayContaining([
      '[LOCATION:',
      '[OPERATION:',
    ]));
  });

  test('forbidden leakage vocabulary is never also required public content', () => {
    for (const [name, relativePath] of ACTIVE_CONTRACTS) {
      const contract = loadContract(relativePath);
      const required = new Set(contract.required_public_strings);
      const overlap = contract.forbidden_public_strings.filter((value) => required.has(value));
      expect(overlap).toEqual([]);
      expect(name).toBeTruthy();
    }
  });
});
