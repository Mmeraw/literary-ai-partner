import {
  getEvaluationContract,
  type EvaluationMode,
} from '@/lib/evaluation/contracts/evaluationContractRegistry';

const ACTIVE_MODES: EvaluationMode[] = [
  'short_form_evaluation',
  'long_form_multi_layer_evaluation',
];

function allSections(mode: EvaluationMode) {
  const contract = getEvaluationContract(mode);
  return [...contract.requiredSections, ...contract.optionalSections].sort((a, b) => a.order - b.order);
}

function expectNoSetDelta(actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((item) => !actualSet.has(item));
  const extra = actual.filter((item) => !expectedSet.has(item));
  expect({ missing, extra }).toEqual({ missing: [], extra: [] });
}

describe('executable report contract bindings', () => {
  test.each(ACTIVE_MODES)('%s has ViewModel field bindings', (mode) => {
    const contract = getEvaluationContract(mode);

    expect(contract.productLifecycle).toBe('active');
    expect(contract.viewModelFieldBindings?.length).toBeGreaterThan(0);
  });

  test.each(ACTIVE_MODES)('%s binds every active product section', (mode) => {
    const sections = allSections(mode);
    const bindings = getEvaluationContract(mode).viewModelFieldBindings ?? [];

    expect(bindings.length).toBe(sections.length);
    expectNoSetDelta(
      bindings.map((binding) => binding.sectionId),
      sections.map((section) => section.id),
    );
  });

  test.each(ACTIVE_MODES)('%s gives every binding at least one ViewModel path', (mode) => {
    const bindings = getEvaluationContract(mode).viewModelFieldBindings ?? [];

    for (const binding of bindings) {
      expect(binding.viewModelPaths.length).toBeGreaterThan(0);
    }
  });

  test.each(ACTIVE_MODES)('%s forbids renderers from synthesizing bound fields', (mode) => {
    const bindings = getEvaluationContract(mode).viewModelFieldBindings ?? [];

    for (const binding of bindings) {
      expect(binding.rendererMaySynthesize).toBe(false);
    }
  });

  test('historical long_form_evaluation may opt out of ViewModel bindings', () => {
    const contract = getEvaluationContract('long_form_evaluation');

    expect(contract.productLifecycle).toBe('historical_compatibility');
    expect(contract.viewModelFieldBindings ?? []).toHaveLength(0);
  });

  test.each(ACTIVE_MODES)('%s forbids raw runtime/renderer input sources', (mode) => {
    const forbiddenInputs = getEvaluationContract(mode).forbiddenRendererInputs ?? [];

    expect(forbiddenInputs).toEqual(expect.arrayContaining([
      'UnifiedEvaluationDocument',
      'LongformDreamDocument',
      'evaluation_result',
      'dreamDoc',
      'sanitizeAuthorFacingDisplayValue',
      'mistakeProofText',
      'correctScopeLanguage',
    ]));
  });
});
