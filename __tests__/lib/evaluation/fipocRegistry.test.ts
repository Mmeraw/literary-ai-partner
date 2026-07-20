import fs from 'fs';
import path from 'path';
import {
  ARTIFACT_REGISTRY,
  AUTHORITY_SOURCE_REGISTRY,
  FIELD_REGISTRY,
  KICK_MATRIX,
  PROCESS_REGISTRY,
  RENDERER_CONSUMPTION_MATRIX,
  getArtifact,
  getBlockingKicks,
  getProcess,
  getRenderedFieldsForSurface,
  lookupKickForFailure,
  lookupKicksForStage,
} from '@/lib/evaluation/fipocRegistry';

const NON_STAGE_CONSUMERS = new Set([
  'end_user',
  'Revise Workbench',
  'TrustedPath',
]);

const NON_STAGE_PRODUCERS = new Set([
  'external_canon_build',
]);

function expectUnique(values: string[], _label: string): void {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  expect([...dupes]).toEqual([]);
}

describe('executable FIPOC registry', () => {
  test('registers every active/pr_required process with immutable IDs and no duplicates', () => {
    expect(PROCESS_REGISTRY.length).toBeGreaterThanOrEqual(20);
    expectUnique(PROCESS_REGISTRY.map((entry) => entry.stageId), 'stageId');

    for (const entry of PROCESS_REGISTRY) {
      expect(entry.stageId).toMatch(/^(S\d{2}[a-z]?_|ADJACENT_)/);
      expect(entry.processName.length).toBeGreaterThan(0);
      expect(entry.processContract.length).toBeGreaterThan(20);
      expect(entry.outputMetrics.length).toBeGreaterThan(0);
      expect(entry.dirtyDataRules.length).toBeGreaterThan(0);
      expect(entry.failureCodes.length).toBeGreaterThan(0);
    }
  });

  test('captures Phase 5 author exposure as an active proven gate', () => {
    const phase5 = getProcess('S10b_PHASE5_AUTHOR_EXPOSURE_GATE');

    expect(phase5).toBeDefined();
    expect(phase5).toEqual(expect.objectContaining({
      activeState: 'active',
      certificationStatus: 'proven',
      fitGapStatus: 'ok',
    }));
    expect(phase5?.codeSurfaces).toEqual(expect.arrayContaining([
      'lib/evaluation/authorExposureCertification.ts',
      'app/reports/[jobId]/page.tsx',
      'app/api/reports/[jobId]/download/route.ts',
      'app/api/evaluations/[jobId]/route.ts',
      'app/api/jobs/[jobId]/evaluation-result/route.ts',
      'app/api/jobs/[jobId]/artifacts/route.ts',
      'app/api/report-shares/route.ts',
      'lib/revision/workbenchQueue.ts',
    ]));
    expect(phase5?.outputArtifacts).toEqual(expect.arrayContaining([
      'unified_evaluation_document_v1',
      'author_exposure_certification_v1',
      'report_render_manifest_v1',
    ]));
    expect(phase5?.outputRequiredFields).toEqual(expect.arrayContaining([
      'dcip_compliance',
    ]));
    expect(phase5?.failureCodes).toEqual(expect.arrayContaining([
      'PHASE5_TEMPLATE_CONTRACT_FAIL',
      'PHASE5_RENDER_PARITY_FAIL',
      'PHASE5_BANNED_ENTITY',
      'PHASE5_SCORE_DRIFT',
      'PHASE5_MISSING_AUDIT',
      'PHASE5_UNCERTIFIED_OUTPUT',
    ]));
  });

  test('registers active long-form stages promoted by PR #1111', () => {
    for (const stageId of [
      'ADJACENT_WAVE',
      'ADJACENT_CANON_GOVERNANCE',
      'ADJACENT_DREAM',
      'ADJACENT_FINAL_EXTERNAL_AUDIT',
    ]) {
      const process = getProcess(stageId);
      expect(process).toBeDefined();
      expect(process?.activeState).toBe('long_form_active');
      expect(process?.certificationStatus).toBe('active_partial');
    }
  });

  test('Phase 5 governs recommendation lineage without imposing queue cardinality', () => {
    const phase5 = getProcess('S10b_PHASE5_AUTHOR_EXPOSURE_GATE');
    expect(phase5).toBeDefined();
    expect(phase5!.inputRequiredFields).toEqual(expect.arrayContaining([
      'canonicalOpportunityLedger.opportunities',
      'canonicalOpportunityLedger.source_recommendation_ids',
      'canonicalOpportunityLedger.recommendation_dispositions',
    ]));
    expect(phase5!.inputMetrics).toEqual(expect.arrayContaining([
      'disposition_coverage_ratio = 1',
      'admitted_authority_coverage_ratio = 1',
      'post_canonicalization_suppression_count derived from persisted dispositions',
      'disposition_counts, validation_counts, governing_rule_counts, and criterion_disposition_counts exactly match persisted dispositions',
      'suppressed/informational queue identity count = 0',
    ]));
    expect(phase5!.dirtyDataRules).toEqual(expect.arrayContaining([
      'canonical opportunity authority missing or malformed',
      'unknown explicit recommendation disposition or suppression-forensics version',
      'suppression-forensics counters differ from persisted dispositions',
      'held_recoverable used under recommendation_disposition_v1',
    ]));
    expect(phase5!.outputMetrics).toContain('canonical opportunity count is evidence-driven and may be zero');
  });

  test('Pass 1/2 handoff registry matches the durable producer and Phase 3 consumer contract', () => {
    const handoff = getProcess('S06b_HANDOFF_GATE');
    const pass3 = getProcess('S07_PASS3');
    const artifact = ARTIFACT_REGISTRY.find((entry) => entry.artifact === 'pass12_handoff_v1');
    const required = ['schema_version', 'pass1Output', 'pass2Output', 'chunk_count', 'captured_at'];

    expect(handoff?.outputRequiredFields).toEqual(required);
    expect(artifact?.requiredFields).toEqual(required);
    expect(pass3?.inputRequiredFields).toEqual(expect.arrayContaining(['schema_version', 'pass1Output', 'pass2Output']));
    expect(handoff?.outputRequiredFields).not.toEqual(expect.arrayContaining(['certified_payload', 'prose_quality_certification']));
    expect(handoff?.processContract).toMatch(/exact pass1Output\/pass2Output content contract/);
  });

  test('Evaluation to Revise ledger projection authorizes only admitted dispositions', () => {
    const ledger = getProcess('ADJACENT_REVISION_LEDGER');
    expect(ledger).toBeDefined();
    expect(ledger!.processContract).toMatch(/Project admitted canonical opportunities/);
    expect(ledger!.processContract).toMatch(/do not become active or Held work/);
    expect(ledger!.inputMetrics).toContain('only admitted dispositions supply ledger rows');
    expect(ledger!.outputMetrics).toContain('ledger row count equals admitted disposition count');
    expect(ledger!.dirtyDataRules).toEqual(expect.arrayContaining([
      'ledger row exists without admitted disposition',
      'admitted disposition omitted from ledger',
    ]));
  });

  test('all process output artifacts are registered with producer/consumer ownership', () => {
    const registeredArtifacts = new Set(ARTIFACT_REGISTRY.map((entry) => entry.artifact));

    for (const process of PROCESS_REGISTRY) {
      for (const artifact of process.outputArtifacts) {
        expect(registeredArtifacts.has(artifact)).toBe(true);
      }
    }

    expectUnique(ARTIFACT_REGISTRY.map((entry) => entry.artifact), 'artifact');
    for (const artifact of ARTIFACT_REGISTRY) {
      const producerKnown = NON_STAGE_PRODUCERS.has(artifact.producerStageId) || Boolean(getProcess(artifact.producerStageId));
      expect(producerKnown).toBe(true);
      expect(artifact.requiredFields.length).toBeGreaterThan(0);
      expect(artifact.completenessMetric.length).toBeGreaterThan(0);
      expect(artifact.accuracyMetric.length).toBeGreaterThan(0);
      expect(artifact.dirtyDataRule.length).toBeGreaterThan(0);
    }

    expect(getArtifact('author_exposure_certification_v1')?.requiredFields).toEqual(expect.arrayContaining([
      'dcip_compliance',
    ]));
  });

  test('artifact consumers point to registered processes or explicitly external surfaces', () => {
    for (const artifact of ARTIFACT_REGISTRY) {
      for (const consumer of artifact.consumerStageIds) {
        const known = NON_STAGE_CONSUMERS.has(consumer) || Boolean(getProcess(consumer));
        expect(known).toBe(true);
      }
    }
  });

  test('author-visible fields require UnifiedEvaluationDocument parity and forbid renderer derivation', () => {
    expect(FIELD_REGISTRY.length).toBeGreaterThanOrEqual(40);
    expectUnique(FIELD_REGISTRY.map((entry) => entry.field), 'field');

    expect(FIELD_REGISTRY.map((entry) => entry.field)).toEqual(expect.arrayContaining([
      'evaluationMode',
      'evaluationTemplateName',
      'evaluationTemplatePath',
      'overallScoreConfidence',
      'marketReadinessConfidence',
      'genreConfidence',
      'targetAudienceConfidence',
      'shelfConfidence',
      'recommendedCount',
      'optionalCount',
      'considerCount',
    ]));

    for (const field of FIELD_REGISTRY) {
      expect(field.validatorStageId).toBe('S10b_PHASE5_AUTHOR_EXPOSURE_GATE');
      expect(field.rendererMustUseUnifiedDocument).toBe(true);
      expect(field.rendererMayDerive).toBe(false);
      expect(field.parityRequired).toBe(true);
      expect(field.consumers).toEqual(expect.arrayContaining(['webpage']));
      expect(getArtifact(field.artifact)).toBeDefined();
    }
  });

  test('renderer matrix identifies webpage as critical and forbids local derivation on all surfaces', () => {
    expect(RENDERER_CONSUMPTION_MATRIX.map((entry) => entry.surface).sort()).toEqual([
      'docx',
      'dream',
      'pdf',
      'txt',
      'webpage',
    ]);

    const webpage = RENDERER_CONSUMPTION_MATRIX.find((entry) => entry.surface === 'webpage');
    expect(webpage).toEqual(expect.objectContaining({
      stageId: 'S11a_RENDERER_WEBPAGE',
      // Post-migration: the webpage renders from the single renderer contract
      // (EvaluationReportViewModel), never a raw upstream artifact.
      canonicalInput: 'EvaluationReportViewModel',
      currentFitGapStatus: 'ok',
      mayFormatOnly: true,
      rendererMayDerive: false,
    }));
    expect(webpage?.forbiddenInputs).toEqual(expect.arrayContaining([
      'direct evaluation_result_v2 rendering without Certified UED',
      'local score calculation',
      'local page calculation',
    ]));

    for (const renderer of RENDERER_CONSUMPTION_MATRIX) {
      expect(renderer.rendererMayDerive).toBe(false);
      expect(renderer.parityRequiredFields.length).toBeGreaterThan(0);
      if (['webpage', 'pdf', 'docx', 'txt'].includes(renderer.surface)) {
        expect(renderer.currentFitGapStatus).toBe('ok');
      }
    }
  });

  test('dirty-data kick matrix blocks author exposure for release-critical failures', () => {
    const blocking = getBlockingKicks();

    expect(blocking.length).toBeGreaterThan(10);
    expect(blocking.map((entry) => entry.failureCode)).toEqual(expect.arrayContaining([
      'PHASE5_RENDER_PARITY_FAIL',
      'PHASE5_TEMPLATE_CONTRACT_FAIL',
      'WAVE_DERIVATION_EMPTY',
      'DIALOGUE_CANON_EXECUTION_FAILED',
      'FINAL_AUDIT_CONTRADICTION',
    ]));

    for (const entry of blocking) {
      expect(entry.retryLimit).toBeGreaterThanOrEqual(1);
      expect(entry.kickBackTo.length).toBeGreaterThan(0);
      expect(entry.ifRetryFails.toLowerCase()).toMatch(/block|fail|quarantine/);
    }
  });

  test('rendered field helper returns the same fields as renderer parity matrix', () => {
    for (const surface of ['webpage', 'pdf', 'docx', 'txt', 'dream'] as const) {
      const helperFields = getRenderedFieldsForSurface(surface).map((entry) => entry.field).sort();
      const matrix = RENDERER_CONSUMPTION_MATRIX.find((entry) => entry.surface === surface);
      expect(matrix).toBeDefined();
      expect([...matrix!.parityRequiredFields].sort()).toEqual(helperFields);
    }
  });

  test('authority source registry exposes canon governance reference benchmark template DREAM GOLD and exemplar docs for SIPOC UI and execution', () => {
    expect(AUTHORITY_SOURCE_REGISTRY.length).toBeGreaterThanOrEqual(20);
    expectUnique(AUTHORITY_SOURCE_REGISTRY.map((entry) => entry.authorityId), 'authorityId');

    expect(AUTHORITY_SOURCE_REGISTRY.map((entry) => entry.family)).toEqual(expect.arrayContaining([
      'benchmark',
      'canon',
      'template',
      'dream',
      'gold_standard',
      'exemplar',
      'governance',
      'reference',
      'sipoc',
      'registry',
    ]));

    expect(AUTHORITY_SOURCE_REGISTRY.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'docs/governance/CONSTITUTIONAL_AUTHORITY_REGISTRY.md',
      'docs/SIPOC_EVALUATION_PROCESS.md',
      'docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md',
      'docs/canon/registered/control/BENCHMARK-CHARTER.md',
      'docs/governance/DREAM_OUTPUT_SPEC.md',
      'docs/governance/DREAM_OUTPUT_LONG_FORM_MULTI_LAYER_SPEC.md',
      'docs/governance/DREAM_STATE_LONG_FORM_MULTI_LAYER_CANON.md',
      'docs/governance/seed-phase-template-alignment-contract.md',
      'docs/governance/phase-2-calibration-template.md',
      'docs/GOLDEN_SPINE.md',
      'docs/VERIFICATION_GOLD_STANDARD.md',
      'docs/canon/intake/_md/Normalized Gold Standard CANONICAL ACCEPTANCE COMPARATOR v1.md',
      'docs/templates/evaluation/short-form-evaluation-template.md',
      'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
      'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md',
      'docs/templates/evaluation/evaluation-rendering-contract.md',
      'docs/templates/evaluation/surface-parity-matrix.md',
      'docs/benchmarks/templates/dream-longform-layered-template.md',
      'docs/gold-standards/recommendation-integrity-dream-standard.md',
      'docs/gold-standards/revise-queue-rendering-exemplars.md',
      'docs/gold-standards/sister-revise-queue-dream-ledger.md',
      'lib/evaluation/fipocRegistry.ts',
    ]));

    const knownStageIds = new Set(PROCESS_REGISTRY.map((entry) => entry.stageId));
    const knownArtifactIds = new Set(ARTIFACT_REGISTRY.map((entry) => entry.artifact));

    for (const entry of AUTHORITY_SOURCE_REGISTRY) {
      expect(entry.surfacedInSipocUi).toBe(true);
      expect(entry.executionUse.length).toBeGreaterThan(20);
      expect(entry.appliesToStageIds.length).toBeGreaterThan(0);
      expect(entry.appliesToArtifacts.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(process.cwd(), entry.path))).toBe(true);
      for (const stageId of entry.appliesToStageIds) {
        expect(knownStageIds.has(stageId)).toBe(true);
      }
      for (const artifact of entry.appliesToArtifacts) {
        expect(knownArtifactIds.has(artifact)).toBe(true);
      }
    }
  });

  test('CSV mirrors exist and have row counts matching executable registry arrays', () => {
    const registryDir = path.join(process.cwd(), 'docs/registries');
    const expectedCounts: Record<string, number> = {
      'process_registry.csv': PROCESS_REGISTRY.length,
      'artifact_registry.csv': ARTIFACT_REGISTRY.length,
      'field_registry.csv': FIELD_REGISTRY.length,
      'kick_matrix.csv': KICK_MATRIX.length,
      'renderer_consumption_matrix.csv': RENDERER_CONSUMPTION_MATRIX.length,
      'authority_source_registry.csv': AUTHORITY_SOURCE_REGISTRY.length,
    };

    for (const [filename, rowCount] of Object.entries(expectedCounts)) {
      const fullPath = path.join(registryDir, filename);
      expect(fs.existsSync(fullPath)).toBe(true);
      const lines = fs.readFileSync(fullPath, 'utf8').trim().split('\n');
      expect(lines.length - 1).toBe(rowCount);
    }
  });

  test('failureCodes are derived from stage-owned failureDefinitions', () => {
    for (const stage of PROCESS_REGISTRY) {
      expect(stage.failureCodes).toEqual(stage.failureDefinitions.map((definition) => definition.failureCode));
    }
  });
});

describe('KICK_MATRIX lookup functions', () => {
  test('lookupKickForFailure returns correct entry for QG_ARTIFACT_GATE_FAIL', () => {
    const entry = lookupKickForFailure('QG_ARTIFACT_GATE_FAIL');
    expect(entry).toBeDefined();
    expect(entry!.dirtyDataDetectedAt).toBe('S09_QUALITYGATEV2');
    expect(entry!.kickBackTo).toBe('S07_PASS3');
    expect(entry!.retryLimit).toBe(1);
    expect(entry!.blocksAuthorExposure).toBe(true);
  });

  test('lookupKickForFailure returns undefined for non-existent failure code', () => {
    expect(lookupKickForFailure('NONEXISTENT_CODE')).toBeUndefined();
  });

  test('lookupKicksForStage returns all kicks for S09_QUALITYGATEV2', () => {
    const kicks = lookupKicksForStage('S09_QUALITYGATEV2');
    expect(kicks.length).toBeGreaterThanOrEqual(1);
    expect(kicks.every((k) => k.dirtyDataDetectedAt === 'S09_QUALITYGATEV2')).toBe(true);
  });

  test('lookupKicksForStage returns empty array for stage with no kicks', () => {
    expect(lookupKicksForStage('NONEXISTENT_STAGE')).toEqual([]);
  });

  test('every KICK_MATRIX entry has valid structure', () => {
    for (const entry of KICK_MATRIX) {
      expect(entry.dirtyDataDetectedAt).toBeTruthy();
      expect(entry.failure).toBeTruthy();
      expect(entry.kickBackTo).toBeTruthy();
      expect(entry.redoAction).toBeTruthy();
      expect(entry.retryLimit).toBeGreaterThanOrEqual(1);
      expect(entry.ifRetryFails).toBeTruthy();
      expect(entry.failureCode).toBeTruthy();
      expect(typeof entry.blocksAuthorExposure).toBe('boolean');
    }
  });

  test('every KICK_MATRIX failureCode is unique', () => {
    const codes = KICK_MATRIX.map((k) => k.failureCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
