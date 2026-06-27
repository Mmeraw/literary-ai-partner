import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildCompactConstitutionalAuthorityRegistryBlock,
  buildCompactTemplateBlock,
  getConstitutionalAuthorityStatus,
  loadConstitutionalAuthorityRegistry,
  loadDreamTemplate,
  resolveTemplateKey,
} from '@/lib/evaluation/dreamTemplateLoader';
import { buildCompleteEvaluationSeedV1 } from '@/lib/evaluation/seed/seedScaffoldFactory';
import { PASS3B_SYSTEM_PROMPT } from '@/lib/evaluation/pipeline/prompts/pass3b-longform';

const REPO_ROOT = process.cwd();
const TEMPLATE_DIR = join(REPO_ROOT, 'docs/templates/evaluation');
const BENCHMARK_DIR = join(REPO_ROOT, 'docs/benchmarks');

const CANONICAL_TEMPLATE_PATHS = [
  'short-form-evaluation-template.md',
  'long-form-multi-layer-evaluation-template.md',
  'archive/long-form-evaluation-template.md',
] as const;

function readTemplate(fileName: string): string {
  return readFileSync(join(TEMPLATE_DIR, fileName), 'utf8');
}

function readBenchmark(fileName: string): string {
  return readFileSync(join(BENCHMARK_DIR, fileName), 'utf8');
}

describe('DREAM evaluation canon — short, long, and multi-layer surfaces', () => {
  it('keeps exactly one canonical template per product evaluation mode', () => {
    for (const fileName of CANONICAL_TEMPLATE_PATHS) {
      expect(existsSync(join(TEMPLATE_DIR, fileName))).toBe(true);
    }

    const templates = CANONICAL_TEMPLATE_PATHS.map(readTemplate);
    expect(templates[0]).toContain('short_form_evaluation');
    expect(templates[1]).toContain('long_form_multi_layer_evaluation');
    expect(templates[2]).toContain('ARCHIVED');
  });

  it('routes loader keys by short, standard long, and explicit multi-layer mode', () => {
    expect(resolveTemplateKey(4_999)).toBe('short_form');
    expect(resolveTemplateKey(25_000)).toBe('long_form');
    expect(resolveTemplateKey(75_000, true)).toBe('long_form_multi_layer');

    expect(loadDreamTemplate('short_form')).toContain('short_form_evaluation');
    expect(loadDreamTemplate('long_form')).toContain('long_form_multi_layer_evaluation');
    expect(loadDreamTemplate('long_form_multi_layer')).toContain('long_form_multi_layer_evaluation');
  });

  it('keeps canonical confidence fields in the active templates', () => {
    const shortForm = readTemplate('short-form-evaluation-template.md');
    const multiLayer = readTemplate('long-form-multi-layer-evaluation-template.md');

    // Active templates must contain canonical confidence fields
    for (const template of [shortForm, multiLayer]) {
      expect(template).toContain('Genre Confidence');
      expect(template).toContain('Market Readiness Confidence');
    }
    expect(multiLayer).toContain('Shelf Confidence');

    // Retired long-form template is archived — verify it declares retirement
    const retired = readTemplate('archive/long-form-evaluation-template.md');
    expect(retired).toContain('RETIRED');
    expect(retired).toContain('long_form_multi_layer_evaluation');
  });

  it('documents short-form Genre Confidence by canonical scope band', () => {
    const shortTemplate = readTemplate('short-form-evaluation-template.md');

    expect(shortTemplate).toContain('micro_excerpt');
    expect(shortTemplate).toContain('micro_excerpt_diagnostic');
    expect(shortTemplate).toContain('light_chapter');
    expect(shortTemplate).toContain('short_excerpt_evaluation');
    expect(shortTemplate).toContain('standard_chapter');
    expect(shortTemplate).toContain('short_form_pattern_read');
    expect(shortTemplate).toContain('full_short_form_evaluation');
    expect(shortTemplate).toContain('Genre signal is provisional because the submitted text is a micro excerpt / short excerpt');
  });

  it('builds compact template blocks with canonical route labels', () => {
    const shortBlock = buildCompactTemplateBlock('short_form');
    const longBlock = buildCompactTemplateBlock('long_form');
    const multiBlock = buildCompactTemplateBlock('long_form_multi_layer');

    expect(shortBlock).toContain('DREAM SHORT-FORM EVALUATION TEMPLATE');
    expect(longBlock).toContain('DREAM LONG-FORM EVALUATION TEMPLATE');
    expect(multiBlock).toContain('DREAM LONG-FORM MULTI-LAYER EVALUATION TEMPLATE');
  });

  it('loads constitutional authority registry and keeps required authorities available', () => {
    const registry = loadConstitutionalAuthorityRegistry();
    const status = getConstitutionalAuthorityStatus();
    const compact = buildCompactConstitutionalAuthorityRegistryBlock();

    expect(registry.length).toBeGreaterThanOrEqual(6);
    expect(registry.map((entry) => entry.authorityId)).toEqual(expect.arrayContaining([
      'DCIP',
      'EVALUATION_TEMPLATE_LONG_FORM_MULTI_LAYER',
      'EVALUATION_RENDERING_CONTRACT',
      'EVALUATION_OUTPUT_MODE_CONTRACT',
      'STORY_LEDGER_TEMPLATE',
      'RUNTIME_BENCHMARK_AUTHORITY_MAP',
    ]));

    expect(status.status).toBe('pass');
    expect(status.missingRequiredAuthorities).toHaveLength(0);
    expect(compact).toContain('CONSTITUTIONAL AUTHORITY REGISTRY');
    expect(compact).toContain('Registry status: pass');
  });

  it('keeps SEED evaluation scaffolds aligned to the three canonical template paths', () => {
    const shortSeed = buildCompleteEvaluationSeedV1({ wordCount: 4_000, workType: 'short story' });
    const longSeed = buildCompleteEvaluationSeedV1({ wordCount: 40_000, workType: 'novel' });
    const multiSeed = buildCompleteEvaluationSeedV1({ wordCount: 75_000, workType: 'novel' });

    expect(shortSeed.manuscript_profile.evaluation_mode).toBe('short_form_evaluation');
    expect(shortSeed.reporting_template_path.selected_template).toBe('docs/templates/evaluation/short-form-evaluation-template.md');

    expect(longSeed.manuscript_profile.evaluation_mode).toBe('long_form_multi_layer_evaluation');
    expect(longSeed.reporting_template_path.selected_template).toBe('docs/templates/evaluation/long-form-multi-layer-evaluation-template.md');

    expect(multiSeed.manuscript_profile.evaluation_mode).toBe('long_form_multi_layer_evaluation');
    expect(multiSeed.reporting_template_path.selected_template).toBe('docs/templates/evaluation/long-form-multi-layer-evaluation-template.md');
  });

  it('uses native DREAM benchmarks with Cartel Babies as primary Pass 3B exemplar', () => {
    expect(PASS3B_SYSTEM_PROMPT).toContain('Cartel Babies');
    expect(PASS3B_SYSTEM_PROMPT).toContain('Froggin Noggin');
    expect(PASS3B_SYSTEM_PROMPT).toContain('Let the River Decide');
    expect(PASS3B_SYSTEM_PROMPT).toContain('Return to the Source');
    expect(PASS3B_SYSTEM_PROMPT).toContain('The Lost World of MythOAmphibia');
    expect(PASS3B_SYSTEM_PROMPT).toContain('Native long-form multi-layer benchmarks');
  });

  it('locks native benchmark role canon in the documented benchmark README', () => {
    const benchmarkReadme = readBenchmark('README.md');

    expect(benchmarkReadme).toContain('Cartel Babies');
    expect(benchmarkReadme).toContain('primary product exemplar');
    expect(benchmarkReadme).toContain('primary required-gold Story Ledger exemplar');
    expect(benchmarkReadme).toContain('Froggin Noggin` remains a required-gold DREAM benchmark');
    expect(benchmarkReadme).toContain('Let the River Decide` remains calibration-tier');
    expect(benchmarkReadme).toContain('When a single code or test example is needed, prefer `Cartel Babies`');
  });

  it('locks the full native long-form multi-layer benchmark family', () => {
    const index = readBenchmark('DREAM_LONGFORM_BENCHMARK_INDEX.md');

    expect(index).toContain('Froggin Noggin');
    expect(index).toContain('Cartel Babies');
    expect(index).toContain('Let the River Decide');
    expect(index).toContain('The Lost World of MythOAmphibia / DOMINATUS I');
    expect(index).toContain('lost-world-of-mythoamphibia-dream-longform-multilayer-gold-standard.md');
    expect(index).toContain('Required gold candidate');
  });

  it('locks public-domain calibration standards as calibration-only, non-runtime authority', () => {
    const index = readBenchmark('DREAM_LONGFORM_BENCHMARK_INDEX.md');

    for (const title of [
      'Dracula',
      'Great Expectations',
      'Pride and Prejudice',
      'The Awakening',
      'The Wonderful Wizard of Oz',
      'The Murder on the Links',
    ]) {
      expect(index).toContain(title);
    }

    for (const path of [
      'public-domain/dracula-dream-calibration.md',
      'public-domain/great-expectations-dream-calibration.md',
      'public-domain/pride-and-prejudice-dream-calibration.md',
      'public-domain/the-wonderful-wizard-of-oz-dream-calibration.md',
    ]) {
      expect(index).toContain(path);
    }

    expect(index).toContain('public-domain-calibration');
    expect(index).toContain('runtime-authority: false');
    expect(index).toContain('not RevisionGrade-native runtime authority');
  });
});