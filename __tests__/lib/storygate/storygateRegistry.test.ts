/**
 * Guard suite: Storygate Studio FIPOC Registry
 *
 * Authority: lib/storygate/storygateRegistry.ts
 * Governance: docs/storygate/STORYGATE_STUDIO_CANON.md
 * SIPOC: docs/SIPOC_STORYGATE_PROCESS.md
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  STORYGATE_ARTIFACT_REGISTRY,
  STORYGATE_AUTHORITY_SOURCE_REGISTRY,
  STORYGATE_CERTIFICATION_GATE_REGISTRY,
  STORYGATE_FIELD_REGISTRY,
  STORYGATE_FORBIDDEN_SCOPE_TERMS,
  STORYGATE_KICK_MATRIX,
  STORYGATE_PROCESS_REGISTRY,
  STORYGATE_READINESS_THRESHOLD,
  STORYGATE_RENDERER_MATRIX,
  STORYGATE_REQUIRED_PACKAGE_FIELDS,
  STORYGATE_SCREENING_IMPLEMENTATION_THRESHOLD,
  STORYGATE_THRESHOLD_REGISTRY,
} from '../../../lib/storygate/storygateRegistry';

const CANONICAL_SUBMISSION_STATUSES = ['SUBMITTED', 'REVIEWING', 'DECLINED', 'HOLD', 'APPROVED'] as const;
const CANONICAL_SCREENING_STATUSES = ['ELIGIBLE', 'AUTO_DECLINED', 'RECOMMEND_HUMAN_REVIEW'] as const;
const CANONICAL_VERIFICATION_STATES = ['verified', 'unverified'] as const;
const CANONICAL_VISIBILITY_VALUES = ['private', 'restricted', 'active'] as const;
const CANONICAL_ACCESS_DECISIONS = ['requested', 'approved', 'denied', 'revoked'] as const;

function csvRowCount(relativePath: string): number {
  const abs = path.resolve(__dirname, '../../../', relativePath);
  if (!fs.existsSync(abs)) return -1;
  const lines = fs.readFileSync(abs, 'utf8').split('\n').filter((line) => line.trim().length > 0);
  return lines.length - 1;
}

describe('STORYGATE_PROCESS_REGISTRY', () => {
  test('has 12 dependency-ordered stages', () => {
    expect(STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId)).toEqual([
      'SG01_CREATOR_SUBMISSION',
      'SG02_INTAKE_VALIDATION',
      'SG03_INTERNAL_SCREENING',
      'SG04_TIER_ASSIGNMENT',
      'SG05_PACKAGE_VERIFICATION',
      'SG06_READINESS_VERIFICATION',
      'SG07_INDUSTRY_VERIFICATION',
      'SG08_LISTING_ACTIVATION',
      'SG09_ACCESS_REQUEST',
      'SG10_CREATOR_ADMIN_APPROVAL',
      'SG11_CONTROLLED_ACCESS',
      'SG12_ACCESS_LOGGING_REVOCATION',
    ]);
  });

  test('stage sequences are 1-based and contiguous', () => {
    STORYGATE_PROCESS_REGISTRY.forEach((stage, index) => expect(stage.sequence).toBe(index + 1));
  });

  test('status classifications use canonical values', () => {
    const activeStates = new Set(['active', 'planned_required', 'deferred']);
    const certificationStatuses = new Set(['proven', 'partial', 'emerging', 'missing_critical']);
    const fitGapStatuses = new Set(['ok', 'gap', 'critical']);

    for (const stage of STORYGATE_PROCESS_REGISTRY) {
      expect(activeStates.has(stage.activeState)).toBe(true);
      expect(certificationStatuses.has(stage.certificationStatus)).toBe(true);
      expect(fitGapStatuses.has(stage.fitGapStatus)).toBe(true);
      expect(stage.inputArtifacts.length).toBeGreaterThan(0);
      expect(stage.outputArtifacts.length).toBeGreaterThan(0);
    }
  });

  test('SG07-SG12 are not falsely certified as complete', () => {
    const implementationSensitiveStages = STORYGATE_PROCESS_REGISTRY.filter((stage) => /^SG(07|08|09|10|11|12)_/.test(stage.stageId));
    expect(implementationSensitiveStages.length).toBeGreaterThanOrEqual(6);
    for (const stage of implementationSensitiveStages) {
      expect(['missing_critical', 'partial']).toContain(stage.certificationStatus);
      if (/^SG(09|10|11|12)_/.test(stage.stageId)) {
        expect(stage.certificationStatus).toBe('missing_critical');
        expect(stage.fitGapStatus).toBe('critical');
      }
    }
  });

  test('SG02 intake validation has active current-canon validator but remains a persistence gap', () => {
    const intake = STORYGATE_PROCESS_REGISTRY.find((stage) => stage.stageId === 'SG02_INTAKE_VALIDATION');
    expect(intake).toBeDefined();
    expect(intake).toEqual(expect.objectContaining({
      activeState: 'active',
      certificationStatus: 'partial',
      fitGapStatus: 'gap',
    }));
    expect(intake?.codeSurfaces).toContain('lib/storygate/storygateSubmissionValidator.ts');
  });

  test('failureCodes are derived from stage-owned failureDefinitions', () => {
    for (const stage of STORYGATE_PROCESS_REGISTRY) {
      expect(stage.failureCodes).toEqual(stage.failureDefinitions.map((definition) => definition.failureCode));
    }
  });
});

describe('Storygate current package canon', () => {
  test('requires market comparables and all current agent-facing package sections', () => {
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toEqual([
      'query_letter',
      'synopsis',
      'author_bio',
      'elevator_pitch',
      'agent_pitch',
      'market_comparables',
      'market_category',
      'target_audience',
      'market_position_statement',
      'sample_pages',
      'rights_declaration',
    ]);
    const packageArtifact = STORYGATE_ARTIFACT_REGISTRY.find((artifact) => artifact.artifact === 'agent_readiness_package_v1');
    expect(packageArtifact?.requiredFields).toEqual([...STORYGATE_REQUIRED_PACKAGE_FIELDS]);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'market_category')?.required).toBe(true);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'target_audience')?.required).toBe(true);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'market_position_statement')?.required).toBe(true);
  });

  test('does not include film/screen/adaptation requirements in canonical package fields', () => {
    const packageFields = STORYGATE_REQUIRED_PACKAGE_FIELDS.join(' ');
    for (const forbidden of STORYGATE_FORBIDDEN_SCOPE_TERMS) {
      expect(packageFields).not.toContain(forbidden);
    }
  });
});

describe('STORYGATE_ARTIFACT_REGISTRY', () => {
  test('all process input/output artifacts are registered', () => {
    const registeredArtifacts = new Set(STORYGATE_ARTIFACT_REGISTRY.map((artifact) => artifact.artifact));
    for (const stage of STORYGATE_PROCESS_REGISTRY) {
      for (const artifact of stage.inputArtifacts) expect(registeredArtifacts.has(artifact)).toBe(true);
      for (const artifact of stage.outputArtifacts) expect(registeredArtifacts.has(artifact)).toBe(true);
    }
  });

  test('all artifact producer/consumers are registered stages or documented non-stage references', () => {
    const stageIds = new Set(STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId));
    for (const artifact of STORYGATE_ARTIFACT_REGISTRY) {
      const externalProducer = artifact.producerStageId.includes('(external)') || artifact.producerStageId === 'Governance review';
      if (!externalProducer) expect(stageIds.has(artifact.producerStageId)).toBe(true);
      for (const consumer of artifact.consumerStageIds) {
        const nonStageConsumer = consumer.includes('Governance') || consumer.includes('Admin') || consumer.includes('(external)');
        if (!nonStageConsumer) expect(stageIds.has(consumer)).toBe(true);
      }
    }
  });

  test('controlled-access artifacts are critical where implementation is missing', () => {
    const criticalArtifacts = ['industry_verification_record_v1', 'project_listing_v1', 'access_request_v1', 'access_unlock_grant_v1', 'controlled_access_view_v1', 'access_log_event_v1'];
    const byId = new Map(STORYGATE_ARTIFACT_REGISTRY.map((artifact) => [artifact.artifact, artifact]));
    for (const id of criticalArtifacts) expect(byId.get(id)?.fitGapStatus).toBe('critical');
  });

  test('intake_validation_result_v1 is validator-backed with persistence gap', () => {
    const intake = STORYGATE_ARTIFACT_REGISTRY.find((artifact) => artifact.artifact === 'intake_validation_result_v1');
    expect(intake?.fitGapStatus).toBe('gap');
  });
});

describe('STORYGATE_FIELD_REGISTRY', () => {
  test('all fields reference registered artifacts and stages', () => {
    const artifacts = new Set(STORYGATE_ARTIFACT_REGISTRY.map((artifact) => artifact.artifact));
    const stages = new Set(STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId));
    for (const field of STORYGATE_FIELD_REGISTRY) {
      expect(artifacts.has(field.artifact)).toBe(true);
      expect(stages.has(field.sourceStageId)).toBe(true);
      expect(stages.has(field.validatorStageId)).toBe(true);
    }
  });

  test('canonical enum fields are locked', () => {
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'status')?.canonicalValues).toEqual([...CANONICAL_SUBMISSION_STATUSES]);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'screeningStatus')?.canonicalValues).toEqual([...CANONICAL_SCREENING_STATUSES]);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'verification_state')?.canonicalValues).toEqual([...CANONICAL_VERIFICATION_STATES]);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'visibility')?.canonicalValues).toEqual([...CANONICAL_VISIBILITY_VALUES]);
    expect(STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'decision')?.canonicalValues).toEqual([...CANONICAL_ACCESS_DECISIONS]);
  });

  test('readinessThreshold field is canonically 9.0', () => {
    const field = STORYGATE_FIELD_REGISTRY.find((entry) => entry.field === 'readinessThreshold');
    expect(field).toBeDefined();
    expect(field?.canonicalValues).toEqual(['9.0']);
    expect(field?.notes).toMatch(/separate gates/i);
  });
});

describe('STORYGATE_KICK_MATRIX', () => {
  test('kick codes are unique uppercase and detect at registered stages', () => {
    const stageIds = new Set(STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId));
    const codes = STORYGATE_KICK_MATRIX.map((kick) => kick.kickCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const kick of STORYGATE_KICK_MATRIX) {
      expect(kick.kickCode).toMatch(/^[A-Z_]+$/);
      expect(stageIds.has(kick.detectedAt)).toBe(true);
      expect([400, 401, 403, 404, 422, 500]).toContain(kick.httpStatus);
    }
  });

  test('market comparables missing is a blocking package failure', () => {
    const kick = STORYGATE_KICK_MATRIX.find((entry) => entry.kickCode === 'MARKET_COMPARABLES_MISSING');
    expect(kick).toBeDefined();
    expect(kick?.blocking).toBe(true);
    expect(kick?.blocksControlledAccess).toBe(true);
  });

  test('invalid package authority blocks Storygate intake and controlled access', () => {
    const kick = STORYGATE_KICK_MATRIX.find((entry) => entry.kickCode === 'PACKAGE_AUTHORITY_INVALID');
    expect(kick).toBeDefined();
    expect(kick).toEqual(expect.objectContaining({
      detectedAt: 'SG05_PACKAGE_VERIFICATION',
      blocking: true,
      blocksControlledAccess: true,
      httpStatus: 422,
    }));
    expect(kick?.description).toMatch(/renderer\/download output/i);
    expect(kick?.description).toMatch(/evaluation_report_view_model_v1/);
    expect(kick?.description).toMatch(/uncertified Agent Readiness output/i);
    expect(kick?.description).toMatch(/AR08\/AR09 gaps/i);
  });

  test('controlled-access authority kicks exist for rights, verification auditability, and bypass defense', () => {
    const rights = STORYGATE_KICK_MATRIX.find((entry) => entry.kickCode === 'RIGHTS_GATE_FAILED');
    const verificationAudit = STORYGATE_KICK_MATRIX.find((entry) => entry.kickCode === 'VERIFICATION_STATE_UNAUDITED');
    const bypass = STORYGATE_KICK_MATRIX.find((entry) => entry.kickCode === 'ACCESS_CONTROL_BYPASS');

    expect(rights).toEqual(expect.objectContaining({
      detectedAt: 'SG06_READINESS_VERIFICATION',
      blocking: true,
      blocksControlledAccess: true,
      httpStatus: 422,
    }));
    expect(verificationAudit).toEqual(expect.objectContaining({
      detectedAt: 'SG07_INDUSTRY_VERIFICATION',
      blocking: true,
      blocksControlledAccess: true,
      httpStatus: 500,
    }));
    expect(bypass).toEqual(expect.objectContaining({
      detectedAt: 'SG12_ACCESS_LOGGING_REVOCATION',
      blocking: true,
      blocksControlledAccess: true,
      httpStatus: 500,
    }));
  });
});

describe('Storygate downstream package authority boundary', () => {
  test('SG01 and SG05 reject renderer, VM, uncertified package, and stale Agent Readiness gap authority', () => {
    const creatorSubmission = STORYGATE_PROCESS_REGISTRY.find((stage) => stage.stageId === 'SG01_CREATOR_SUBMISSION');
    const packageVerification = STORYGATE_PROCESS_REGISTRY.find((stage) => stage.stageId === 'SG05_PACKAGE_VERIFICATION');
    expect(creatorSubmission?.failureCodes).toContain('PACKAGE_AUTHORITY_INVALID');
    expect(packageVerification?.failureCodes).toContain('PACKAGE_AUTHORITY_INVALID');

    const boundaryText = [
      creatorSubmission?.processContract,
      creatorSubmission?.dirtyDataRules.join(' '),
      packageVerification?.processContract,
      packageVerification?.dirtyDataRules.join(' '),
    ].join(' ');

    expect(boundaryText).toMatch(/Web\/PDF\/DOCX\/TXT renderer output/);
    expect(boundaryText).toMatch(/evaluation_report_view_model_v1/);
    expect(boundaryText).toMatch(/uncertified Agent Readiness output/);
    expect(boundaryText).toMatch(/AR08\/AR09/);
  });

  test('agent_readiness_package_v1 requires certified package authority before Storygate verification', () => {
    const artifact = STORYGATE_ARTIFACT_REGISTRY.find((entry) => entry.artifact === 'agent_readiness_package_v1');
    expect(artifact).toBeDefined();
    expect(artifact?.completenessMetric).toMatch(/certified by Agent Readiness|equivalent professional authority/i);
    expect(artifact?.dirtyDataRule).toMatch(/Web\/PDF\/DOCX\/TXT renderer output/);
    expect(artifact?.dirtyDataRule).toMatch(/evaluation_report_view_model_v1/);
    expect(artifact?.dirtyDataRule).toMatch(/uncertified Agent Readiness output/);
    expect(artifact?.dirtyDataRule).toMatch(/AR08\/AR09 gaps/);
  });
});

describe('STORYGATE_CERTIFICATION_GATE_REGISTRY', () => {
  test('required package gate is enforced by the current-canon validator', () => {
    const gate = STORYGATE_CERTIFICATION_GATE_REGISTRY.find((entry) => entry.gateId === 'SGCG02_REQUIRED_PACKAGE');
    expect(gate).toEqual(expect.objectContaining({
      enforced: true,
      testEvidence: '__tests__/lib/storygate/storygateSubmissionValidator.test.ts',
    }));
  });
});

describe('STORYGATE_AUTHORITY_SOURCE_REGISTRY', () => {
  test('current Storygate Studio canon is binding primary authority', () => {
    const canon = STORYGATE_AUTHORITY_SOURCE_REGISTRY.find((authority) => authority.authorityId === 'STORYGATE_STUDIO_CANON');
    expect(canon).toBeDefined();
    expect(canon?.authorityLevel).toBe('binding');
    expect(canon?.path).toBe('docs/storygate/STORYGATE_STUDIO_CANON.md');
  });

  test('authority source paths exist on disk', () => {
    for (const authority of STORYGATE_AUTHORITY_SOURCE_REGISTRY) {
      const abs = path.resolve(__dirname, '../../../', authority.path);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });

  test('no Storygate authority source treats Base44 as binding', () => {
    for (const authority of STORYGATE_AUTHORITY_SOURCE_REGISTRY) {
      if (authority.path.includes('base44/')) {
        expect(authority.authorityLevel).toBe('legacy_reference_only');
        expect(authority.appliesToStageIds).toHaveLength(0);
        expect(authority.appliesToArtifacts).toHaveLength(0);
      }
    }
  });

  test('Storygate binds to artifact authority chain and Agent Readiness handoff doctrine', () => {
    const authorityIds = new Set(STORYGATE_AUTHORITY_SOURCE_REGISTRY.map((authority) => authority.authorityId));
    expect(authorityIds.has('ARTIFACT_AUTHORITY_CHAIN')).toBe(true);
    expect(authorityIds.has('SIPOC_AGENT_READINESS')).toBe(true);
  });
});

describe('STORYGATE_RENDERER_MATRIX', () => {
  test('consumed artifacts are registered', () => {
    const artifacts = new Set(STORYGATE_ARTIFACT_REGISTRY.map((artifact) => artifact.artifact));
    for (const renderer of STORYGATE_RENDERER_MATRIX) {
      for (const artifact of renderer.consumedArtifacts) expect(artifacts.has(artifact)).toBe(true);
    }
  });

  test('Storygate surfaces do not consume renderer/download output or ViewModel as authority', () => {
    const forbiddenArtifacts = new Set(['evaluation_report_view_model_v1', 'web_renderer', 'pdf_renderer', 'docx_renderer', 'txt_renderer']);
    for (const renderer of STORYGATE_RENDERER_MATRIX) {
      for (const artifact of renderer.consumedArtifacts) expect(forbiddenArtifacts.has(artifact)).toBe(false);
      expect(renderer.notes).not.toMatch(/as authority from renderer/i);
    }
  });
});

describe('STORYGATE_CERTIFICATION_GATE_REGISTRY', () => {
  test('gate IDs use SGCG## pattern and apply to registered stages', () => {
    const stages = new Set(STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId));
    for (const gate of STORYGATE_CERTIFICATION_GATE_REGISTRY) {
      expect(gate.gateId).toMatch(/^SGCG\d{2}_[A-Z_]+$/);
      expect(stages.has(gate.appliesToStageId)).toBe(true);
    }
  });

  test('Storygate is registry-described, not fully SIPOC-enforced', () => {
    expect(STORYGATE_CERTIFICATION_GATE_REGISTRY.some((gate) => gate.enforced === false)).toBe(true);
    expect(STORYGATE_PROCESS_REGISTRY.some((stage) => stage.certificationStatus === 'missing_critical')).toBe(true);
  });

  test('certified package handoff boundary is registry/test enforced without runtime certification claim', () => {
    const gate = STORYGATE_CERTIFICATION_GATE_REGISTRY.find((entry) => entry.gateId === 'SGCG09_CERTIFIED_PACKAGE_HANDOFF_ONLY');
    expect(gate).toEqual(expect.objectContaining({
      appliesToStageId: 'SG05_PACKAGE_VERIFICATION',
      enforced: true,
      testEvidence: '__tests__/lib/storygate/storygateRegistry.test.ts',
    }));
    expect(gate?.description).toMatch(/renderer\/download output/);
    expect(gate?.description).toMatch(/evaluation_report_view_model_v1/);
    expect(gate?.notes).toMatch(/does not implement missing Storygate package verification runtime/i);
  });
});

describe('STORYGATE_THRESHOLD_REGISTRY', () => {
  test('locks canonical 9.0 Storygate Studio threshold', () => {
    expect(STORYGATE_READINESS_THRESHOLD).toBe(9.0);
    expect(STORYGATE_SCREENING_IMPLEMENTATION_THRESHOLD).toBe(9.0);
    expect(STORYGATE_THRESHOLD_REGISTRY).toHaveLength(1);
    expect(STORYGATE_THRESHOLD_REGISTRY[0].canonicalValue).toBe(9.0);
    expect(STORYGATE_THRESHOLD_REGISTRY[0].implementationValue).toBe(9.0);
    expect(STORYGATE_THRESHOLD_REGISTRY[0].notes).toMatch(/separate gates/i);
  });
});

describe('CSV mirrors', () => {
  const csvDir = 'docs/registries/storygate';

  test('storygate_process_registry.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_process_registry.csv`)).toBe(STORYGATE_PROCESS_REGISTRY.length);
  });

  test('storygate_artifact_registry.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_artifact_registry.csv`)).toBe(STORYGATE_ARTIFACT_REGISTRY.length);
  });

  test('storygate_field_registry.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_field_registry.csv`)).toBe(STORYGATE_FIELD_REGISTRY.length);
  });

  test('storygate_kick_matrix.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_kick_matrix.csv`)).toBe(STORYGATE_KICK_MATRIX.length);
  });

  test('storygate_authority_source_registry.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_authority_source_registry.csv`)).toBe(STORYGATE_AUTHORITY_SOURCE_REGISTRY.length);
  });

  test('storygate_renderer_matrix.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_renderer_matrix.csv`)).toBe(STORYGATE_RENDERER_MATRIX.length);
  });

  test('storygate_certification_gate_registry.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_certification_gate_registry.csv`)).toBe(STORYGATE_CERTIFICATION_GATE_REGISTRY.length);
  });

  test('storygate_threshold_registry.csv row count matches registry', () => {
    expect(csvRowCount(`${csvDir}/storygate_threshold_registry.csv`)).toBe(STORYGATE_THRESHOLD_REGISTRY.length);
  });
});
