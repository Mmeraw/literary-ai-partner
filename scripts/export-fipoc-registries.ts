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
import {
  REVISE_ARTIFACT_REGISTRY,
  REVISE_AUTHORITY_SOURCE_REGISTRY,
  REVISE_FIELD_REGISTRY,
  REVISE_KICK_MATRIX,
  REVISE_PROCESS_REGISTRY,
} from '../lib/revision/reviseRegistry';

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

// ─── Revise Platform Registry Export ────────────────────────────────────────

const REVISE_OUT_DIR = path.resolve('docs/registries/revise');

function writeReviseCsv<T extends object>(filename: string, rows: T[], columns: Array<keyof T>): void {
  const lines = [
    columns.map((column) => csvEscape(String(column))).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ];
  fs.mkdirSync(REVISE_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REVISE_OUT_DIR, filename), `${lines.join('\n')}\n`, 'utf8');
}

writeReviseCsv('revise_process_registry.csv', REVISE_PROCESS_REGISTRY, [
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
  'certificationStatus',
  'fitGapStatus',
  'notes',
]);

writeReviseCsv('revise_artifact_registry.csv', REVISE_ARTIFACT_REGISTRY, [
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

writeReviseCsv('revise_field_registry.csv', REVISE_FIELD_REGISTRY, [
  'field',
  'canonicalType',
  'ownerArtifact',
  'allowedValues',
  'validationRule',
  'fitGapStatus',
]);

writeReviseCsv('revise_kick_matrix.csv', REVISE_KICK_MATRIX, [
  'kickCode',
  'triggeringStageId',
  'targetStageId',
  'triggerCondition',
  'resolution',
  'blocksAuthorExposure',
  'severity',
]);

writeReviseCsv('revise_authority_source_registry.csv', REVISE_AUTHORITY_SOURCE_REGISTRY, [
  'authorityId',
  'family',
  'title',
  'path',
  'appliesToStageIds',
  'appliesToArtifacts',
  'executionUse',
  'notes',
]);

console.log(`[fipoc:export] wrote revise registries to ${REVISE_OUT_DIR}`);
