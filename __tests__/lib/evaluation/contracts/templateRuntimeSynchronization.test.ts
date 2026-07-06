import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getEvaluationContract,
  type EvaluationContract,
  type EvaluationMode,
} from '@/lib/evaluation/contracts/evaluationContractRegistry';

const ACTIVE_MODES: EvaluationMode[] = [
  'short_form_evaluation',
  'long_form_multi_layer_evaluation',
];

type TemplateSection = {
  title: string;
  required: boolean;
};

function readTemplate(contract: EvaluationContract): string {
  return readFileSync(join(process.cwd(), contract.templatePath), 'utf8');
}

function extractBacktickMetadata(template: string, label: string): string {
  const prefix = `**${label}:** `;
  const line = template.split('\n').find((candidate) => candidate.startsWith(prefix));

  if (!line) {
    throw new Error(`Missing template metadata field: ${label}`);
  }

  const firstTick = line.indexOf('`');
  const secondTick = line.indexOf('`', firstTick + 1);

  if (firstTick === -1 || secondTick === -1) {
    throw new Error(`Template metadata field is not backtick-bound: ${label}`);
  }

  return line.slice(firstTick + 1, secondTick);
}

function extractReportType(template: string): string {
  const line = template.split('\n').find((candidate) => candidate.startsWith('Report Type: '));

  if (!line) {
    throw new Error('Missing Report Type line in template Title Block');
  }

  return line.replace('Report Type: ', '').trim();
}

function normalizeTemplateSectionTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/,\s*when available$/iu, '')
    .replace(/\s+or\s+layer-aware architecture map$/iu, '')
    .trim();
}

function extractRequiredReportShape(template: string): TemplateSection[] {
  const start = template.indexOf('## Required Report Shape');
  const end = template.indexOf('---', start + 1);

  if (start === -1 || end === -1) {
    throw new Error('Missing Required Report Shape block');
  }

  const shapeBlock = template.slice(start, end);
  let inWhereApplicableBlock = false;

  return shapeBlock
    .split('\n')
    .flatMap((line) => {
      if (line.includes('where applicable')) {
        inWhereApplicableBlock = true;
      }

      if (line.includes('always produced') || line.includes('Closing sections') || line.includes('Required Shared Sections')) {
        inWhereApplicableBlock = false;
      }

      const match = line.match(/^\s*\d+\.\s+(.+)$/u);
      if (!match?.[1]) return [];

      const rawTitle = match[1].trim();
      const title = normalizeTemplateSectionTitle(rawTitle);
      const required = !inWhereApplicableBlock && !/,\s*when available$/iu.test(rawTitle);

      return [{ title, required }];
    });
}

function contractSections(contract: EvaluationContract): TemplateSection[] {
  return [...contract.requiredSections, ...contract.optionalSections]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      title: section.title,
      required: section.required,
    }));
}

describe('template to executable contract synchronization', () => {
  test.each(ACTIVE_MODES)('%s template metadata matches the executable contract', (mode) => {
    const contract = getEvaluationContract(mode);
    const template = readTemplate(contract);

    expect(extractBacktickMetadata(template, 'Canonical mode')).toBe(contract.mode);
    expect(extractBacktickMetadata(template, 'Route')).toBe(contract.route);
    expect(extractBacktickMetadata(template, 'Output mode')).toBe(contract.outputMode);
    expect(extractReportType(template)).toBe(contract.reportType);
  });

  test.each(ACTIVE_MODES)('%s template report shape matches contract sections and order', (mode) => {
    const contract = getEvaluationContract(mode);
    const template = readTemplate(contract);

    expect(extractRequiredReportShape(template)).toEqual(contractSections(contract));
  });

  test.each(ACTIVE_MODES)('%s template forbids renderer synthesis and contract binds every section', (mode) => {
    const contract = getEvaluationContract(mode);
    const template = readTemplate(contract);
    const sections = contractSections(contract);
    const bindings = contract.viewModelFieldBindings ?? [];

    expect(template).toContain('Renderers must not');
    expect(bindings.map((binding) => binding.sectionTitle)).toEqual(sections.map((section) => section.title));
    expect(bindings.every((binding) => binding.rendererMaySynthesize === false)).toBe(true);
  });
});
