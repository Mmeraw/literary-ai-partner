import fs from 'fs';
import path from 'path';
import {
  ARTIFACT_REGISTRY,
  AUTHORITY_SOURCE_REGISTRY,
  FIELD_REGISTRY,
  KICK_MATRIX,
  PROCESS_REGISTRY,
  RENDERER_CONSUMPTION_MATRIX,
} from '../lib/evaluation/fipocRegistry';

const OUT_DIR = path.resolve('docs/registries');

function csvEscape(value: unknown): string {
  const raw = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function writeCsv<T extends object>(filename: string, rows: T[], columns: Array<keyof T>): void {
  const lines = [
    columns.map((column) => csvEscape(String(column))).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, filename), `${lines.join('\n')}\n`, 'utf8');
}

writeCsv('process_registry.csv', PROCESS_REGISTRY, [
  'sequence',
  'phase',
  'stageId',
  'processName',
  'activeState',
  'supplier',
  'inputArtifacts',
  'inputRequiredFields',
  'inputMetrics',
  'codeSurfaces',
  'processContract',
  'outputArtifacts',
  'outputRequiredFields',
  'outputMetrics',
  'forwardKick',
  'backwardKick',
  'dirtyDataRules',
  'retryBudget',
  'failureCodes',
  'consumers',
  'uiExposed',
  'reviseHandoff',
  'certificationStatus',
  'fitGapStatus',
  'notes',
]);

writeCsv('artifact_registry.csv', ARTIFACT_REGISTRY, [
  'artifact',
  'producerStageId',
  'consumerStageIds',
  'requiredFields',
  'completenessMetric',
  'accuracyMetric',
  'dirtyDataRule',
  'regenerationOwnerStageId',
  'requiredForAuthorExposure',
  'fitGapStatus',
]);

writeCsv('field_registry.csv', FIELD_REGISTRY, [
  'field',
  'artifact',
  'canonicalPath',
  'unifiedDocumentPath',
  'required',
  'nullable',
  'sourceStageId',
  'validatorStageId',
  'consumers',
  'uiRendered',
  'rendererMustUseUnifiedDocument',
  'rendererMayDerive',
  'parityRequired',
]);

writeCsv('kick_matrix.csv', KICK_MATRIX, [
  'dirtyDataDetectedAt',
  'failure',
  'kickBackTo',
  'redoAction',
  'retryLimit',
  'ifRetryFails',
  'failureCode',
  'blocksAuthorExposure',
]);

writeCsv('renderer_consumption_matrix.csv', RENDERER_CONSUMPTION_MATRIX, [
  'surface',
  'stageId',
  'codeSurface',
  'canonicalInput',
  'forbiddenInputs',
  'mayFormatOnly',
  'rendererMayDerive',
  'parityRequiredFields',
  'currentFitGapStatus',
  'remediationPr',
]);

writeCsv('authority_source_registry.csv', AUTHORITY_SOURCE_REGISTRY, [
  'authorityId',
  'family',
  'title',
  'path',
  'appliesToStageIds',
  'appliesToArtifacts',
  'runtimeBinding',
  'surfacedInSipocUi',
  'executionUse',
  'notes',
]);

console.log(`[fipoc:export] wrote registries to ${OUT_DIR}`);
