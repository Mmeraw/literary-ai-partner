import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCompactTemplateBlock, loadDreamTemplate, resolveTemplateKey } from '@/lib/evaluation/dreamTemplateLoader';
import { buildCompleteEvaluationSeedV1 } from '@/lib/evaluation/seed/seedScaffoldFactory';
import { PASS3B_SYSTEM_PROMPT } from '@/lib/evaluation/pipeline/prompts/pass3b-longform';

const REPO_ROOT = process.cwd();
const TEMPLATE_DIR = join(REPO_ROOT, 'docs/templates/evaluation');

const CANONICAL_TEMPLATE_PATHS = [
  'short-form-evaluation-template.md',
  'long-form-evaluation-template.md',
  'long-form-multi-layer-evaluation-template.md',
] as const;

function readTemplate(fileName: string): string {
  return readFileSync(join(TEMPLATE_DIR, fileName), 'utf8');
}

describe('DREAM evaluation canon — short, long, and multi-layer surfaces', () => {
  it('keeps exactly one canonical template per product evaluation mode', () => {
    for (const fileName of CANONICAL_TEMPLATE_PATHS) {
      expect(existsSync(join(TEMPLATE_DIR, fileName))).toBe(true);
    }

    const templates = CANONICAL_TEMPLATE_PATHS.map(readTemplate);
    expect(templates[0]).toContain('short_form_evaluation');
    expect(templates[1]).toContain('long_form_evaluation');
    expect(templates[2]).toContain('long_form_multi_layer_evaluation');
  });

  it('routes loader keys by short, standard long, and explicit multi-layer mode', () => {
    expect(resolveTemplateKey(4_999)).toBe('short_form');
    expect(resolveTemplateKey(25_000)).toBe('long_form');
    expect(resolveTemplateKey(75_000, true)).toBe('long_form_multi_layer');

    expect(loadDreamTemplate('short_form')).toContain('short_form_evaluation');
    expect(loadDreamTemplate('long_form')).toContain('long_form_evaluation');
    expect(loadDreamTemplate('long_form_multi_layer')).toContain('long_form_multi_layer_evaluation');
  });

  it('keeps canonical confidence fields in the full templates', () => {
    const templates = CANONICAL_TEMPLATE_PATHS.map(readTemplate);

    for (const template of templates) {
      expect(template).toContain('Genre Confidence');
      expect(template).toContain('Market Readiness Confidence');
    }
    expect(templates[2]).toContain('Shelf Confidence');
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

  it('keeps SEED evaluation scaffolds aligned to the three canonical template paths', () => {
    const shortSeed = buildCompleteEvaluationSeedV1({ wordCount: 4_000, workType: 'short story' });
    const longSeed = buildCompleteEvaluationSeedV1({ wordCount: 40_000, workType: 'novel' });
    const multiSeed = buildCompleteEvaluationSeedV1({ wordCount: 75_000, workType: 'novel' });

    expect(shortSeed.manuscript_profile.evaluation_mode).toBe('short_form_evaluation');
    expect(shortSeed.reporting_template_path.selected_template).toBe('docs/templates/evaluation/short-form-evaluation-template.md');

    expect(longSeed.manuscript_profile.evaluation_mode).toBe('long_form_evaluation');
    expect(longSeed.reporting_template_path.selected_template).toBe('docs/templates/evaluation/long-form-evaluation-template.md');

    expect(multiSeed.manuscript_profile.evaluation_mode).toBe('long_form_multi_layer_evaluation');
    expect(multiSeed.reporting_template_path.selected_template).toBe('docs/templates/evaluation/long-form-multi-layer-evaluation-template.md');
  });

  it('uses native DREAM benchmarks with Cartel Babies as primary Pass 3B exemplar', () => {
    expect(PASS3B_SYSTEM_PROMPT).toContain('Cartel Babies DREAM evaluation (docs/benchmarks/cartel-babies-dream.md) — primary required-gold product exemplar');
    expect(PASS3B_SYSTEM_PROMPT).toContain('Froggin Noggin DREAM evaluation (docs/benchmarks/froggin-noggin-dream.md) — required-gold benchmark');
    expect(PASS3B_SYSTEM_PROMPT).toContain('Let the River Decide DREAM evaluation (docs/benchmarks/let-the-river-decide-dream.md, calibration-tier)');
  });
});