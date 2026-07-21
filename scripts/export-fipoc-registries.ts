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
  REVISE_CERTIFICATION_GATE_REGISTRY,
  REVISE_FIELD_REGISTRY,
  REVISE_KICK_MATRIX,
  REVISE_PROCESS_REGISTRY,
  REVISE_RENDERER_CONSUMPTION_MATRIX,
} from '../lib/revision/reviseRegistry';
import {
  AGENT_READINESS_ARTIFACT_REGISTRY,
  AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY,
  AGENT_READINESS_CERTIFICATION_GATE_REGISTRY,
  AGENT_READINESS_FIELD_REGISTRY,
  AGENT_READINESS_KICK_MATRIX,
  AGENT_READINESS_PROCESS_REGISTRY,
  AGENT_READINESS_RENDERER_MATRIX,
  SECTION_WORD_LIMIT_REGISTRY,
} from '../lib/agent-readiness/agentReadinessRegistry';
import {
  STORYGATE_ARTIFACT_REGISTRY,
  STORYGATE_AUTHORITY_SOURCE_REGISTRY,
  STORYGATE_CERTIFICATION_GATE_REGISTRY,
  STORYGATE_FIELD_REGISTRY,
  STORYGATE_KICK_MATRIX,
  STORYGATE_PROCESS_REGISTRY,
  STORYGATE_RENDERER_MATRIX,
  STORYGATE_THRESHOLD_REGISTRY,
} from '../lib/storygate/storygateRegistry';

const OUT_DIR = path.resolve('docs/registries');

function csvEscape(value: unknown): string {
  const raw = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function writeCsv<T extends object>(filename: string, rows: readonly T[], columns: Array<keyof T>): void {
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
  'failureRecoveryContracts',
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

function writeReviseCsv<T extends object>(filename: string, rows: readonly T[], columns: Array<keyof T>): void {
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

writeReviseCsv('revise_renderer_consumption_matrix.csv', REVISE_RENDERER_CONSUMPTION_MATRIX, [
  'surface',
  'stageId',
  'codeSurface',
  'canonicalInput',
  'forbiddenInputs',
  'mayFormatOnly',
  'mayMutateState',
  'requiredCertificationGate',
  'parityRequiredFields',
  'currentFitGapStatus',
  'remediationPr',
]);

writeReviseCsv('revise_certification_gate_registry.csv', REVISE_CERTIFICATION_GATE_REGISTRY, [
  'gateId',
  'stageId',
  'gateName',
  'requiredInputArtifacts',
  'requiredChecks',
  'outputArtifact',
  'blockingFailureCodes',
  'certificationStatus',
  'fitGapStatus',
  'notes',
]);

console.log(`[fipoc:export] wrote revise registries to ${REVISE_OUT_DIR}`);

// ─── Agent Readiness Package Exports ─────────────────────────────────────────

const AR_OUT_DIR = path.join(OUT_DIR, 'agent-readiness');
if (!fs.existsSync(AR_OUT_DIR)) fs.mkdirSync(AR_OUT_DIR, { recursive: true });

function writeArCsv<T extends object>(filename: string, rows: readonly T[], columns: Array<keyof T>): void {
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((col) => csvEscape(row[col])).join(',')),
  ];
  fs.writeFileSync(path.join(AR_OUT_DIR, filename), lines.join('\n') + '\n', 'utf8');
}

writeArCsv('agent_readiness_process_registry.csv', AGENT_READINESS_PROCESS_REGISTRY, [
  'sequence',
  'stageId',
  'processName',
  'activeState',
  'supplier',
  'inputArtifacts',
  'outputArtifacts',
  'certificationStatus',
  'fitGapStatus',
  'notes',
]);

writeArCsv('agent_readiness_artifact_registry.csv', AGENT_READINESS_ARTIFACT_REGISTRY, [
  'artifact',
  'producerStageId',
  'consumerStageIds',
  'requiredFields',
  'completenessMetric',
  'accuracyMetric',
  'dirtyDataRule',
  'requiredForPackageAssembly',
  'fitGapStatus',
]);

writeArCsv('agent_readiness_field_registry.csv', AGENT_READINESS_FIELD_REGISTRY, [
  'field',
  'artifact',
  'required',
  'nullable',
  'canonicalValues',
  'sourceStageId',
  'validatorStageId',
  'uiRendered',
  'notes',
]);

writeArCsv('agent_readiness_kick_matrix.csv', AGENT_READINESS_KICK_MATRIX, [
  'kickCode',
  'detectedAt',
  'description',
  'blocking',
  'blocksPackageAssembly',
  'remediation',
  'httpStatus',
]);

writeArCsv('agent_readiness_authority_source_registry.csv', AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY, [
  'authorityId',
  'family',
  'title',
  'path',
  'appliesToStageIds',
  'appliesToArtifacts',
  'executionUse',
  'notes',
]);

writeArCsv('agent_readiness_renderer_matrix.csv', AGENT_READINESS_RENDERER_MATRIX, [
  'surface',
  'route',
  'consumedArtifacts',
  'consumedFields',
  'writeCapability',
  'notes',
]);

writeArCsv('agent_readiness_certification_gate_registry.csv', AGENT_READINESS_CERTIFICATION_GATE_REGISTRY, [
  'gateId',
  'description',
  'appliesToStageId',
  'enforced',
  'testEvidence',
  'notes',
]);

writeArCsv('section_word_limit_registry.csv', SECTION_WORD_LIMIT_REGISTRY, [
  'section',
  'wordLimit',
  'wordMinimum',
  'hasMinimum',
]);

console.log(`[fipoc:export] wrote agent-readiness registries to ${AR_OUT_DIR}`);

// ─── Storygate Studio Registry Exports ──────────────────────────────────────

const STORYGATE_OUT_DIR = path.join(OUT_DIR, 'storygate');
if (!fs.existsSync(STORYGATE_OUT_DIR)) fs.mkdirSync(STORYGATE_OUT_DIR, { recursive: true });

function writeStorygateCsv<T extends object>(filename: string, rows: readonly T[], columns: Array<keyof T>): void {
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((col) => csvEscape(row[col])).join(',')),
  ];
  fs.writeFileSync(path.join(STORYGATE_OUT_DIR, filename), `${lines.join('\n')}\n`, 'utf8');
}

writeStorygateCsv('storygate_process_registry.csv', STORYGATE_PROCESS_REGISTRY, [
  'sequence',
  'stageId',
  'processName',
  'activeState',
  'supplier',
  'inputArtifacts',
  'outputArtifacts',
  'certificationStatus',
  'fitGapStatus',
  'notes',
]);

writeStorygateCsv('storygate_artifact_registry.csv', STORYGATE_ARTIFACT_REGISTRY, [
  'artifact',
  'producerStageId',
  'consumerStageIds',
  'requiredFields',
  'completenessMetric',
  'accuracyMetric',
  'dirtyDataRule',
  'requiredForControlledAccess',
  'fitGapStatus',
]);

writeStorygateCsv('storygate_field_registry.csv', STORYGATE_FIELD_REGISTRY, [
  'field',
  'artifact',
  'required',
  'nullable',
  'canonicalValues',
  'sourceStageId',
  'validatorStageId',
  'uiRendered',
  'notes',
]);

writeStorygateCsv('storygate_kick_matrix.csv', STORYGATE_KICK_MATRIX, [
  'kickCode',
  'detectedAt',
  'description',
  'blocking',
  'blocksControlledAccess',
  'remediation',
  'httpStatus',
]);

writeStorygateCsv('storygate_authority_source_registry.csv', STORYGATE_AUTHORITY_SOURCE_REGISTRY, [
  'authorityId',
  'family',
  'authorityLevel',
  'title',
  'path',
  'appliesToStageIds',
  'appliesToArtifacts',
  'executionUse',
  'notes',
]);

writeStorygateCsv('storygate_renderer_matrix.csv', STORYGATE_RENDERER_MATRIX, [
  'surface',
  'route',
  'consumedArtifacts',
  'consumedFields',
  'writeCapability',
  'notes',
]);

writeStorygateCsv('storygate_certification_gate_registry.csv', STORYGATE_CERTIFICATION_GATE_REGISTRY, [
  'gateId',
  'description',
  'appliesToStageId',
  'enforced',
  'testEvidence',
  'notes',
]);

writeStorygateCsv('storygate_threshold_registry.csv', STORYGATE_THRESHOLD_REGISTRY, [
  'thresholdId',
  'canonicalValue',
  'implementationValue',
  'appliesToStageIds',
  'fitGapStatus',
  'notes',
]);

console.log(`[fipoc:export] wrote storygate registries to ${STORYGATE_OUT_DIR}`);
