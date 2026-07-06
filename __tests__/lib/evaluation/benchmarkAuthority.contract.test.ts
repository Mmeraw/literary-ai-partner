import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type BenchmarkContract = {
  schema_version: string;
  contract_id: string;
  mode: string;
  route: string;
  word_count_band: string;
  word_count?: number | null;
  benchmark_tier?: string;
  benchmark_status?: string;
  scores_are_authoritative?: boolean;
  score_authority?: string;
  score_source?: string;
  manuscript_profile: {
    title: string;
    word_count?: number;
    manuscript_scope?: string;
    genre: string;
    target_audience: string;
  };
  required_surfaces: string[];
  expected_section_order: string[];
  required_public_strings: string[];
  surface_required_strings?: {
    txt?: string[];
    html?: string[];
    docx?: string[];
  };
  forbidden_public_strings: string[];
  required_criterion_keys?: string[];
  required_diagnostic_fields?: string[];
  required_dream_keys?: string[];
  required_revision_queue_display_rule?: {
    must_render_clean_display_text: boolean;
    forbidden_raw_tokens: string[];
  };
};

type ManifestEntry = {
  id: string;
  mode: string;
  tier: string;
  runtime_authority: boolean;
  dir: string;
  contract_file?: string;
  contract_only?: boolean;
  benchmark_status?: string;
};

type BenchmarkManifest = { contracts: ManifestEntry[] };

const CONTRACT_ROOT = join(process.cwd(), 'tests/benchmark-authority');

function loadManifest(): BenchmarkManifest {
  return JSON.parse(readFileSync(join(CONTRACT_ROOT, 'manifest.json'), 'utf8')) as BenchmarkManifest;
}

function contractPathForEntry(entry: ManifestEntry): string {
  return `${entry.dir}/${entry.contract_file ?? 'expected.json'}`;
}
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

  // Contract-validity governance (not quantity). The required public surface is
  // the truly stable, contract-level set — it may be small. The real proof that a
  // contract is "enough" is the renderer-contract coverage in
  // benchmarkAuthority.renderer.test.ts, not an arbitrary string count. We only
  // assert the contract is internally valid: present profile, non-empty unique
  // surfaces, no required/forbidden overlap, and CMOS-clean public strings.
  test('each active contract is internally valid as a product golden', () => {
    for (const [, relativePath] of ACTIVE_CONTRACTS) {
      const contract = loadContract(relativePath);
      expect(contract.manuscript_profile.title).toBeTruthy();
      expect(contract.manuscript_profile.word_count).toBeGreaterThan(0);
      expect(contract.manuscript_profile.genre).toBeTruthy();
      expect(contract.manuscript_profile.target_audience).toBeTruthy();
      expect(contract.expected_section_order.length).toBeGreaterThanOrEqual(10);

      const required = contract.required_public_strings;
      const forbidden = contract.forbidden_public_strings;

      // Non-empty surfaces — stable contract content must exist, however small.
      expect(required.length).toBeGreaterThan(0);
      expect(forbidden.length).toBeGreaterThan(0);

      // Uniqueness — no duplicate contract strings in either surface.
      expect(new Set(required).size).toBe(required.length);
      expect(new Set(forbidden).size).toBe(forbidden.length);

      // Every required string is a non-empty stable public string.
      for (const value of required) {
        expect(typeof value).toBe('string');
        expect(value.trim().length).toBeGreaterThan(0);
      }

      // A string can never be both required and forbidden.
      const overlap = forbidden.filter((value) => required.includes(value));
      expect(overlap).toEqual([]);

      // CMOS: required public strings carry no space-padded em dashes.
      const spacedEmDash = required.filter((value) => / \u2014 /.test(value));
      expect(spacedEmDash).toEqual([]);
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

  test('Froggin Noggin long-form contract is grounded in the first-100-pages canon and free of contradictions', () => {
    const contract = loadContract('long-form-multi-layer/froggin-noggin.expected.json');

    expect(contract.schema_version).toBe('benchmark_authority_contract_v1');
    expect(contract.contract_id).toBe('long-form-multi-layer-froggin-noggin');
    expect(contract.mode).toBe('long_form_multi_layer_evaluation');
    expect(contract.route).toBe('LONG_FORM');

    expect(contract.manuscript_profile.title).toBe('Froggin Noggin');
    expect(contract.manuscript_profile.word_count).toBe(51_252);
    expect(contract.required_public_strings.length).toBeGreaterThanOrEqual(20);
    expect(contract.forbidden_public_strings.length).toBeGreaterThanOrEqual(8);

    // No fabricated full-novel metadata.
    const allText = JSON.stringify(contract);
    expect(allText).not.toContain('127036');
    expect(allText).not.toContain('127,036');
    expect(allText).not.toContain("sanitized children");

    // A string can never be both required and forbidden.
    const required = new Set(contract.required_public_strings);
    const overlap = contract.forbidden_public_strings.filter((value) => required.has(value));
    expect(overlap).toEqual([]);

    // "DREAM Long-Form Multi-Layer Evaluation" is the public report-type label,
    // so bare "DREAM" is not forbidden for long-form contracts. The label must
    // render as a public surface string instead.
    expect(contract.forbidden_public_strings).not.toContain('DREAM');
    expect(contract.surface_required_strings?.txt).toContain('DREAM Long-Form Multi-Layer Evaluation');
    expect(contract.surface_required_strings?.html).toContain('DREAM Long-Form Multi-Layer Evaluation');
    expect(contract.surface_required_strings?.docx).toContain('DREAM Long-Form Multi-Layer Evaluation');
    // No bare "DREAM" token may sit in the universal required surface.
    expect(contract.required_public_strings.filter((value) => value === 'DREAM')).toEqual([]);

    // CMOS: em dashes carry no surrounding spaces in any public string.
    const spacedEmDash = contract.required_public_strings.filter((value) => / \u2014 /.test(value));
    expect(spacedEmDash).toEqual([]);
  });

  test('every manifest contract that claims authoritative scores names a source', () => {
    const manifest = loadManifest();
    for (const entry of manifest.contracts) {
      const contract = loadContract(contractPathForEntry(entry));
      if (contract.scores_are_authoritative) {
        expect(contract.score_source).toBeTruthy();
      }
    }
  });

  test('long-form multi-layer contracts treat the DREAM label as public, not forbidden', () => {
    const manifest = loadManifest();
    const longForm = manifest.contracts.filter(
      (entry) => entry.mode === 'long_form_multi_layer_evaluation',
    );
    expect(longForm.length).toBeGreaterThan(0);

    for (const entry of longForm) {
      const contract = loadContract(contractPathForEntry(entry));
      // Bare "DREAM" is a public product label, never a forbidden token.
      expect(contract.forbidden_public_strings).not.toContain('DREAM');
      // The label is provable on every public surface.
      for (const surface of ['txt', 'html', 'docx'] as const) {
        expect(contract.surface_required_strings?.[surface]).toContain(
          'DREAM Long-Form Multi-Layer Evaluation',
        );
      }
      // Genuine internal artifacts stay forbidden.
      expect(contract.forbidden_public_strings).toEqual(
        expect.arrayContaining(['revision_opportunity_ledger', 'raw_prompt']),
      );
    }
  });

  test('MythOAmphibia candidate contract is grounded, surface-aware, and provenance-tagged', () => {
    const contract = loadContract('long-form-multi-layer/mythoamphibia.expected.json');

    expect(contract.schema_version).toBe('benchmark_authority_contract_v1');
    expect(contract.contract_id).toBe('long-form-multi-layer-mythoamphibia');
    expect(contract.mode).toBe('long_form_multi_layer_evaluation');
    expect(contract.route).toBe('LONG_FORM');

    // No fabricated word count — scope/band only.
    expect(contract.word_count).toBeNull();
    expect(contract.word_count_band).toBeTruthy();
    expect(contract.manuscript_profile.manuscript_scope).toBeTruthy();
    expect(contract.benchmark_tier).toBe('required-gold-candidate');

    // Authoritative scores must name their source.
    expect(contract.scores_are_authoritative).toBe(true);
    expect(contract.score_source).toMatch(/canon_corrected_truth_target_v1\.md$/);

    // Universal required surface is the title plus the canonical-13 criterion labels.
    expect(contract.required_public_strings).toEqual(
      expect.arrayContaining([
        'The Lost World of MythOAmphibia',
        'Concept & Core Premise',
        'Narrative Drive & Momentum',
        'Character Depth & Psychological Coherence',
        'Point of View & Voice Control',
        'Scene Construction & Function',
        'Dialogue Authenticity & Subtext',
        'Thematic Integration',
        'World-Building & Environmental Logic',
        'Pacing & Structural Balance',
        'Prose Control & Line-Level Craft',
        'Tonal Authority & Consistency',
        'Narrative Closure & Promises Kept',
        'Professional Readiness & Market Positioning',
      ]),
    );
    expect(contract.required_criterion_keys).toHaveLength(13);

    // A string can never be both required and forbidden.
    const required = new Set(contract.required_public_strings);
    const overlap = contract.forbidden_public_strings.filter((value) => required.has(value));
    expect(overlap).toEqual([]);

    // CMOS: em dashes carry no surrounding spaces in any public string.
    const spacedEmDash = contract.required_public_strings.filter((value) => / \u2014 /.test(value));
    expect(spacedEmDash).toEqual([]);
  });

  // ─── Nomenclature Invariant Tests ───────────────────────────────────────────
  // Enforces the controlled vocabulary from docs/benchmarks/BENCHMARK_NOMENCLATURE.md

  const ALLOWED_TIERS = ['required-gold', 'required-gold-candidate', 'calibration', 'calibration-only'];
  const ALLOWED_MODES = ['short_form_evaluation', 'long_form_multi_layer_evaluation'];

  test('manifest uses only allowed tier values', () => {
    const manifest = loadManifest();
    for (const entry of manifest.contracts) {
      expect(ALLOWED_TIERS).toContain(entry.tier);
    }
  });

  test('manifest uses only allowed mode values', () => {
    const manifest = loadManifest();
    for (const entry of manifest.contracts) {
      expect(ALLOWED_MODES).toContain(entry.mode);
    }
  });

  test('calibration-only entries cannot have runtime_authority true', () => {
    const manifest = loadManifest();
    const calibOnly = manifest.contracts.filter((e) => e.tier === 'calibration-only');
    expect(calibOnly.length).toBeGreaterThan(0);
    for (const entry of calibOnly) {
      expect(entry.runtime_authority).toBe(false);
    }
  });

  test('required-gold entries must have runtime_authority true', () => {
    const manifest = loadManifest();
    const reqGold = manifest.contracts.filter((e) => e.tier === 'required-gold');
    expect(reqGold.length).toBeGreaterThan(0);
    for (const entry of reqGold) {
      expect(entry.runtime_authority).toBe(true);
    }
  });

  test('required-gold-candidate entries must have benchmark_status "candidate"', () => {
    const manifest = loadManifest();
    const candidates = manifest.contracts.filter((e) => e.tier === 'required-gold-candidate');
    for (const entry of candidates) {
      expect(entry.benchmark_status).toBe('candidate');
    }
  });

  test('calibration entries must have runtime_authority false', () => {
    const manifest = loadManifest();
    const calib = manifest.contracts.filter((e) => e.tier === 'calibration');
    for (const entry of calib) {
      expect(entry.runtime_authority).toBe(false);
    }
  });

  test('contract_only entries are skipped by renderer (no builder required), others require builders', () => {
    const manifest = loadManifest();
    const contractOnlyEntries = manifest.contracts.filter((e) => e.contract_only === true);
    const renderedEntries = manifest.contracts.filter((e) => !e.contract_only);

    // At least one contract_only and one rendered entry must exist.
    expect(contractOnlyEntries.length).toBeGreaterThan(0);
    expect(renderedEntries.length).toBeGreaterThan(0);

    // contract_only entries must not claim runtime_authority.
    for (const entry of contractOnlyEntries) {
      expect(entry.runtime_authority).toBe(false);
    }
  });
});
