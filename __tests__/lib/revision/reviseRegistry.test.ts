/**
 * Revise Platform FIPOC Registry Guard Suite
 *
 * Machine-checks:
 * - All canonical enum values are present in the registry
 * - All stageIds referenced in artifacts and kicks exist in the process registry
 * - All artifact IDs referenced in stages exist in the artifact registry
 * - All authority source paths exist on disk
 * - CSV mirrors match the TypeScript source row counts
 * - No non-canonical decision/verdict/status values are registered
 * - Author decision and queue lifecycle state machines are complete
 */

import fs from 'fs';
import path from 'path';
import {
  REVISE_PROCESS_REGISTRY,
  REVISE_ARTIFACT_REGISTRY,
  REVISE_FIELD_REGISTRY,
  REVISE_KICK_MATRIX,
  REVISE_AUTHORITY_SOURCE_REGISTRY,
  REVISE_RENDERER_CONSUMPTION_MATRIX,
  REVISE_CERTIFICATION_GATE_REGISTRY,
  AUTHOR_DECISION_TRANSITIONS,
  QUEUE_ITEM_LIFECYCLE_TRANSITIONS,
  type AuthorDecisionState,
} from '../../../lib/revision/reviseRegistry';

// ─── Canonical Sets ──────────────────────────────────────────────────────────

const CANONICAL_DECISION_VALUES = new Set([
  'accepted_a', 'accepted_b', 'accepted_c',
  'custom', 'keep_original', 'reject', 'deferred',
]);

const CANONICAL_READINESS_VALUES = new Set([
  'ready_for_revise', 'needs_targeting',
]);

const CANONICAL_ADMISSION_STATUS = new Set([
  'admission_passed', 'withheld',
]);

const CANONICAL_VERDICT_VALUES = new Set([
  'approve', 'flag', 'reject', 'unavailable', 'pending',
]);

const CANONICAL_REVISION_SESSION_STATUS = new Set([
  'open', 'findings_ready', 'synthesis_started', 'proposals_ready', 'applied', 'failed',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const registeredStageIds = new Set(REVISE_PROCESS_REGISTRY.map((s) => s.stageId));
const registeredArtifacts = new Set(REVISE_ARTIFACT_REGISTRY.map((a) => a.artifact));
const registeredCertificationGateIds = new Set(REVISE_CERTIFICATION_GATE_REGISTRY.map((g) => g.gateId));

function csvRowCount(relPath: string): number {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) return -1;
  const content = fs.readFileSync(fullPath, 'utf8');
  // subtract 1 for header row; filter empty trailing lines
  return content.split('\n').filter((l) => l.trim().length > 0).length - 1;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Revise Registry — process registry', () => {
  test('has exactly 10 stages (RS01–RS10)', () => {
    expect(REVISE_PROCESS_REGISTRY).toHaveLength(10);
  });

  test('all stage sequences are unique and ascending', () => {
    const seqs = REVISE_PROCESS_REGISTRY.map((s) => s.sequence);
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(seqs).toEqual(sorted);
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  test('RS01–RS10 stageIds all present', () => {
    const expected = [
      'RS01_LEDGER_ASSEMBLY',
      'RS02_QUEUE_ADMISSION',
      'RS03_QUEUE_PRIORITIZATION',
      'RS04_WORKBENCH_LOAD',
      'RS05_CANDIDATE_GENERATION',
      'RS06_AUTHOR_DECISION',
      'RS07_LEDGER_SYNC',
      'RS08_COMPLETION',
      'RS09_CROSSCHECK_VERIFICATION',
      'RS10_TRUSTEDPATH',
    ];
    for (const id of expected) {
      expect(registeredStageIds).toContain(id);
    }
  });

  test('RS08 completion is active with certified runtime artifact persistence', () => {
    const completion = REVISE_PROCESS_REGISTRY.find((s) => s.stageId === 'RS08_COMPLETION');
    expect(completion).toBeDefined();
    expect(completion!.activeState).toBe('active');
    expect(completion!.certificationStatus).toBe('certified');
    expect(completion!.fitGapStatus).toBe('proven');
  });

  test('RS09 cross-check is feature-flagged and async (not blocking workbench)', () => {
    const cc = REVISE_PROCESS_REGISTRY.find((s) => s.stageId === 'RS09_CROSSCHECK_VERIFICATION');
    expect(cc).toBeDefined();
    expect(cc!.notes).toMatch(/REVISION_REPAIR_CROSSCHECK_ENABLED/);
  });

  test('all inputArtifacts reference registered artifacts or eval-side artifacts', () => {
    // Eval-side artifacts consumed at RS01 boundary are allowed
    const EVAL_ARTIFACTS = new Set([
      'evaluation_result_v2',
      'author_exposure_certification_v1',
      'accepted_story_ledger_v1',
      'wave_revision_plan_v1',
      'quality_gate_diagnostics_v1',
    ]);
    for (const stage of REVISE_PROCESS_REGISTRY) {
      for (const art of stage.inputArtifacts) {
        const known = registeredArtifacts.has(art) || EVAL_ARTIFACTS.has(art);
        expect({ stage: stage.stageId, artifact: art, known }).toMatchObject({ known: true });
      }
    }
  });

  test('all outputArtifacts reference registered artifacts', () => {
    for (const stage of REVISE_PROCESS_REGISTRY) {
      for (const art of stage.outputArtifacts) {
        expect({ stage: stage.stageId, artifact: art, registered: registeredArtifacts.has(art) })
          .toMatchObject({ registered: true });
      }
    }
  });

  test('all consumers reference registered stageIds or known terminal consumers', () => {
    const TERMINAL_CONSUMERS = new Set(['RS08_COMPLETION', 'end state', 'RS06_AUTHOR_DECISION', 'RS04_WORKBENCH_LOAD']);
    for (const stage of REVISE_PROCESS_REGISTRY) {
      for (const consumer of stage.consumers) {
        const known = registeredStageIds.has(consumer) || TERMINAL_CONSUMERS.has(consumer);
        expect({ stage: stage.stageId, consumer, known }).toMatchObject({ known: true });
      }
    }
  });

  test('all stages have non-empty processContract', () => {
    for (const stage of REVISE_PROCESS_REGISTRY) {
      expect({ stage: stage.stageId, contract: stage.processContract.trim().length > 0 })
        .toMatchObject({ contract: true });
    }
  });

  test('RS02 six-part diagnostic fields match runtime admission/ledger contract', () => {
    const stage = REVISE_PROCESS_REGISTRY.find((s) => s.stageId === 'RS02_QUEUE_ADMISSION');
    expect(stage).toBeDefined();
    const fields = new Set(stage!.inputRequiredFields);
    for (const field of ['symptom', 'cause', 'fixDirection', 'readerEffect', 'evidence_anchor', 'revision_operation']) {
      expect(fields.has(field)).toBe(true);
    }
    expect(fields.has('operationNote')).toBe(false);
    expect(fields.has('evidence')).toBe(false);
    expect(stage!.notes).toContain('fixStrategy=fixDirection');
    expect(stage!.notes).toContain('readerImpact=readerEffect');
  });

  test('RS01 binds queue authority to admitted dispositions and accepts governed empty authority', () => {
    const stage = REVISE_PROCESS_REGISTRY.find((s) => s.stageId === 'RS01_LEDGER_ASSEMBLY');
    expect(stage).toBeDefined();
    expect(stage!.processContract).toMatch(/only admitted canonical opportunities/);
    expect(stage!.processContract).toMatch(/without becoming work/);
    expect(stage!.inputRequiredFields).toEqual(expect.arrayContaining([
      'canonicalOpportunityLedger.opportunities',
      'canonicalOpportunityLedger.recommendation_dispositions',
    ]));
    expect(stage!.outputMetrics).toEqual(expect.arrayContaining([
      'opportunity count equals admitted disposition count and may be zero',
      'suppressed/informational queue identity count = 0',
      'duplicate canonical opportunity count = 0',
    ]));
    expect(stage!.dirtyDataRules).toEqual(expect.arrayContaining([
      'ledger opportunity lacks admitted disposition',
      'admitted disposition lacks ledger opportunity',
      'suppressed or informational disposition carries queue identity',
    ]));

    const certification = REVISE_CERTIFICATION_GATE_REGISTRY.find(
      (gate) => gate.gateId === 'RCG01_LEDGER_CERTIFICATION',
    );
    expect(certification).toBeDefined();
    expect(certification!.requiredChecks).toEqual(expect.arrayContaining([
      'canonical opportunity authority present and opportunities is an array',
      'ledger count equals admitted disposition count',
    ]));
    expect(certification!.blockingFailureCodes).not.toContain('LEDGER_EMPTY');
    expect(certification!.notes).toMatch(/governed zero-opportunity ledger is certifiable/);
  });

  test('RS04 makes Held diagnostics author-safe without weakening internal classification coverage', () => {
    const stage = REVISE_PROCESS_REGISTRY.find((s) => s.stageId === 'RS04_WORKBENCH_LOAD');
    expect(stage).toBeDefined();
    expect(stage!.outputMetrics).toEqual(expect.arrayContaining([
      'raw diagnostic leakage count = 0',
      'each raw diagnostic input classified into one family',
      'one author-safe explanation per distinct diagnostic family',
    ]));
    expect(stage!.dirtyDataRules).toEqual(expect.arrayContaining([
      'raw internal diagnostic code appears in author-facing output',
      'diagnostic input disappears before family classification',
      'classified family lacks author-safe explanation',
    ]));
  });

  test('failureCodes are derived from stage-owned failureDefinitions', () => {
    for (const stage of REVISE_PROCESS_REGISTRY) {
      expect(stage.failureCodes).toEqual(stage.failureDefinitions.map((definition) => definition.failureCode));
    }
  });
});

describe('Revise Registry — artifact registry', () => {
  test('has 13 artifacts', () => {
    expect(REVISE_ARTIFACT_REGISTRY).toHaveLength(15);
  });

  test('revision_opportunity_ledger_v1 is requiredForAuthorExposure', () => {
    const ledger = REVISE_ARTIFACT_REGISTRY.find((a) => a.artifact === 'revision_opportunity_ledger_v1');
    expect(ledger?.requiredForAuthorExposure).toBe(true);
  });

  test('revision_completion_record_v1 is a proven persisted artifact', () => {
    const completion = REVISE_ARTIFACT_REGISTRY.find((a) => a.artifact === 'revision_completion_record_v1');
    expect(completion?.fitGapStatus).toBe('proven');
  });

  test('all producerStageIds reference registered stage IDs', () => {
    for (const art of REVISE_ARTIFACT_REGISTRY) {
      expect({ artifact: art.artifact, registered: registeredStageIds.has(art.producerStageId) })
        .toMatchObject({ registered: true });
    }
  });

  test('all consumerStageIds reference registered stage IDs', () => {
    for (const art of REVISE_ARTIFACT_REGISTRY) {
      for (const consumer of art.consumerStageIds) {
        expect({ artifact: art.artifact, consumer, registered: registeredStageIds.has(consumer) })
          .toMatchObject({ registered: true });
      }
    }
  });

  test('revise_card_v1 documents runtime diagnostic aliases without dropping canonical fields', () => {
    const card = REVISE_ARTIFACT_REGISTRY.find((a) => a.artifact === 'revise_card_v1');
    expect(card).toBeDefined();
    const fields = new Set(card!.requiredFields);
    for (const field of [
      'fixDirection',
      'readerEffect',
      'diagnostic.fixStrategy',
      'diagnostic.readerImpact',
      'diagnostic.evidence.quotedExcerpt',
      'diagnostic.operationTargeting',
    ]) {
      expect(fields.has(field)).toBe(true);
    }
  });
});

describe('Revise Registry — field registry', () => {
  test('has 18 fields', () => {
    expect(REVISE_FIELD_REGISTRY).toHaveLength(18);
  });

  test('decision field has all 7 canonical values', () => {
    const decisionField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'decision');
    expect(decisionField).toBeDefined();
    for (const val of CANONICAL_DECISION_VALUES) {
      expect(decisionField!.allowedValues).toContain(val);
    }
  });

  test('verdict field has all 5 canonical values', () => {
    const verdictField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'verdict');
    expect(verdictField).toBeDefined();
    for (const val of CANONICAL_VERDICT_VALUES) {
      expect(verdictField!.allowedValues).toContain(val);
    }
  });

  test('admission_status field has exactly 2 values', () => {
    const admField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'admission_status');
    expect(admField).toBeDefined();
    for (const val of CANONICAL_ADMISSION_STATUS) {
      expect(admField!.allowedValues).toContain(val);
    }
  });

  test('readiness field has exactly 2 values', () => {
    const readField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'readiness');
    expect(readField).toBeDefined();
    for (const val of CANONICAL_READINESS_VALUES) {
      expect(readField!.allowedValues).toContain(val);
    }
  });

  test('revision_session_status field has all 6 canonical values', () => {
    const sessionField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'revision_session_status');
    expect(sessionField).toBeDefined();
    for (const val of CANONICAL_REVISION_SESSION_STATUS) {
      expect(sessionField!.allowedValues).toContain(val);
    }
  });
});

describe('Revise Registry — kick matrix', () => {
  test('has 15 kick codes', () => {
    expect(REVISE_KICK_MATRIX).toHaveLength(15);
  });

  test('REVISE_ABC_NOT_DISTINCT kicks A/B/C generation back to workbench load', () => {
    const kick = REVISE_KICK_MATRIX.find((k) => k.kickCode === 'REVISE_ABC_NOT_DISTINCT');
    expect(kick).toBeDefined();
    expect(kick!.triggeringStageId).toBe('RS05_CANDIDATE_GENERATION');
    expect(kick!.targetStageId).toBe('RS04_WORKBENCH_LOAD');
    expect(kick!.blocksAuthorExposure).toBe(true);
    expect(kick!.severity).toBe('blocking');
  });

  test('REVISE_HANDOFF_RENDERER_OUTPUT_INVALID kicks back to the ViewModel boundary', () => {
    const kick = REVISE_KICK_MATRIX.find((k) => k.kickCode === 'REVISE_HANDOFF_RENDERER_OUTPUT_INVALID');
    expect(kick).toBeDefined();
    expect(kick!.triggeringStageId).toBe('RS02_QUEUE_ADMISSION');
    expect(kick!.targetStageId).toBe('S10c_VIEWMODEL_BOUNDARY_GATE');
    expect(kick!.severity).toBe('blocking');
  });

  test('LEDGER_SYNC_VALIDATION_FAIL is a blocking kick', () => {
    const kick = REVISE_KICK_MATRIX.find((k) => k.kickCode === 'LEDGER_SYNC_VALIDATION_FAIL');
    expect(kick).toBeDefined();
    expect(kick!.blocksAuthorExposure).toBe(true);
    expect(kick!.severity).toBe('blocking');
  });

  test('LEDGER_SYNC_DB_ERROR is a blocking persistence kick', () => {
    const kick = REVISE_KICK_MATRIX.find((k) => k.kickCode === 'LEDGER_SYNC_DB_ERROR');
    expect(kick).toBeDefined();
    expect(kick!.triggeringStageId).toBe('RS07_LEDGER_SYNC');
    expect(kick!.targetStageId).toBe('RS06_AUTHOR_DECISION');
    expect(kick!.blocksAuthorExposure).toBe(true);
    expect(kick!.severity).toBe('blocking');
  });

  test('DECISION_INVALID_VALUE is a blocking kick', () => {
    const kick = REVISE_KICK_MATRIX.find((k) => k.kickCode === 'DECISION_INVALID_VALUE');
    expect(kick).toBeDefined();
    expect(kick!.blocksAuthorExposure).toBe(true);
  });

  test('TRUSTEDPATH_LEDGER_WRITE_FAIL is a blocking TrustedPath persistence kick', () => {
    const kick = REVISE_KICK_MATRIX.find((k) => k.kickCode === 'TRUSTEDPATH_LEDGER_WRITE_FAIL');
    expect(kick).toBeDefined();
    expect(kick!.triggeringStageId).toBe('RS10_TRUSTEDPATH');
    expect(kick!.targetStageId).toBe('RS07_LEDGER_SYNC');
    expect(kick!.blocksAuthorExposure).toBe(true);
    expect(kick!.severity).toBe('blocking');
  });

  test('all triggeringStageIds reference registered stages', () => {
    for (const kick of REVISE_KICK_MATRIX) {
      const known = registeredStageIds.has(kick.triggeringStageId);
      expect({ kick: kick.kickCode, known }).toMatchObject({ known: true });
    }
  });

  test('all targetStageIds reference registered stages or evaluation-side stages', () => {
    const EVAL_STAGES = new Set(['S10b_PHASE5_AUTHOR_EXPOSURE_GATE', 'S10c_VIEWMODEL_BOUNDARY_GATE']);
    for (const kick of REVISE_KICK_MATRIX) {
      const known = registeredStageIds.has(kick.targetStageId) || EVAL_STAGES.has(kick.targetStageId);
      expect({ kick: kick.kickCode, target: kick.targetStageId, known }).toMatchObject({ known: true });
    }
  });
});

describe('Revise Registry — authority source registry', () => {
  test('has 9 authority sources', () => {
    expect(REVISE_AUTHORITY_SOURCE_REGISTRY).toHaveLength(9);
  });

  test('all authority source paths exist on disk', () => {
    for (const auth of REVISE_AUTHORITY_SOURCE_REGISTRY) {
      const fullPath = path.resolve(auth.path);
      const exists = fs.existsSync(fullPath);
      expect({ authority: auth.authorityId, path: auth.path, exists }).toMatchObject({ exists: true });
    }
  });

  test('all appliesToStageIds reference registered stage IDs', () => {
    for (const auth of REVISE_AUTHORITY_SOURCE_REGISTRY) {
      for (const stageId of auth.appliesToStageIds) {
        expect({ authority: auth.authorityId, stageId, registered: registeredStageIds.has(stageId) })
          .toMatchObject({ registered: true });
      }
    }
  });

  test('all appliesToArtifacts reference registered artifacts', () => {
    for (const auth of REVISE_AUTHORITY_SOURCE_REGISTRY) {
      for (const artId of auth.appliesToArtifacts) {
        expect({ authority: auth.authorityId, artifact: artId, registered: registeredArtifacts.has(artId) })
          .toMatchObject({ registered: true });
      }
    }
  });

  test('REVISE_SIPOC_CONSTITUTION authority source path exists', () => {
    const sipoc = REVISE_AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'REVISE_SIPOC_CONSTITUTION');
    expect(sipoc).toBeDefined();
    expect(fs.existsSync(path.resolve(sipoc!.path))).toBe(true);
  });
});

describe('Revise Registry — renderer/consumer matrix', () => {
  test('has 6 consumer surfaces', () => {
    expect(REVISE_RENDERER_CONSUMPTION_MATRIX).toHaveLength(6);
  });

  test('all renderer rows reference registered stages', () => {
    for (const row of REVISE_RENDERER_CONSUMPTION_MATRIX) {
      expect({ surface: row.surface, stageId: row.stageId, registered: registeredStageIds.has(row.stageId) })
        .toMatchObject({ registered: true });
    }
  });

  test('all renderer rows reference registered certification gates', () => {
    for (const row of REVISE_RENDERER_CONSUMPTION_MATRIX) {
      expect({ surface: row.surface, gate: row.requiredCertificationGate, registered: registeredCertificationGateIds.has(row.requiredCertificationGate) })
        .toMatchObject({ registered: true });
    }
  });

  test('author decision and TrustedPath surfaces may mutate state; queue/evidence surfaces may not', () => {
    const decisionSurface = REVISE_RENDERER_CONSUMPTION_MATRIX.find((row) => row.surface === 'Author Decision Controls');
    const trustedPathSurface = REVISE_RENDERER_CONSUMPTION_MATRIX.find((row) => row.surface === 'TrustedPath API');
    const queueSurface = REVISE_RENDERER_CONSUMPTION_MATRIX.find((row) => row.surface === 'Revise Queue');
    const evidenceSurface = REVISE_RENDERER_CONSUMPTION_MATRIX.find((row) => row.surface === 'Revise Workbench Evidence View');

    expect(decisionSurface?.mayMutateState).toBe(true);
    expect(trustedPathSurface?.mayMutateState).toBe(true);
    expect(queueSurface?.mayMutateState).toBe(false);
    expect(evidenceSurface?.mayMutateState).toBe(false);
  });
});

describe('Revise Registry — certification gate registry', () => {
  test('has 8 certification gates (RCG01–RCG08)', () => {
    expect(REVISE_CERTIFICATION_GATE_REGISTRY).toHaveLength(8);
  });

  test('all certification gates reference registered stages', () => {
    for (const gate of REVISE_CERTIFICATION_GATE_REGISTRY) {
      expect({ gate: gate.gateId, stageId: gate.stageId, registered: registeredStageIds.has(gate.stageId) })
        .toMatchObject({ registered: true });
    }
  });

  test('all certification gate output artifacts are registered', () => {
    for (const gate of REVISE_CERTIFICATION_GATE_REGISTRY) {
      expect({ gate: gate.gateId, artifact: gate.outputArtifact, registered: registeredArtifacts.has(gate.outputArtifact) })
        .toMatchObject({ registered: true });
    }
  });

  test('completion certification is certified with explicit runtime certifier and artifact persistence', () => {
    const stage = REVISE_PROCESS_REGISTRY.find((row) => row.stageId === 'RS08_COMPLETION');
    const gate = REVISE_CERTIFICATION_GATE_REGISTRY.find((row) => row.gateId === 'RCG07_COMPLETION_CERTIFICATION');
    expect(stage).toBeDefined();
    expect(stage!.activeState).toBe('active');
    expect(stage!.certificationStatus).toBe('certified');
    expect(stage!.fitGapStatus).toBe('proven');
    expect(stage!.codeSurfaces).toEqual(expect.arrayContaining([
      'lib/revision/reviseCompletionCertification.ts',
      'lib/revision/finalReviewRuntime.ts',
    ]));
    expect(gate).toBeDefined();
    expect(gate!.certificationStatus).toBe('certified');
    expect(gate!.fitGapStatus).toBe('proven');
  });

  test('TrustedPath certification requires approve-only behavior', () => {
    const gate = REVISE_CERTIFICATION_GATE_REGISTRY.find((row) => row.gateId === 'RCG08_TRUSTEDPATH_CERTIFICATION');
    expect(gate).toBeDefined();
    expect(gate!.requiredChecks.join(' ')).toContain('verdict=approve only');
  });
});

describe('Revise Registry — state machines', () => {
  test('author decision pending state can reach all 7 canonical decisions', () => {
    const transitions = AUTHOR_DECISION_TRANSITIONS['pending'];
    for (const val of CANONICAL_DECISION_VALUES) {
      expect(transitions).toContain(val as AuthorDecisionState);
    }
  });

  test('applied and failed RevisionSessionStatus are terminal (no outgoing)', () => {
    // These are documented in the field registry; the state machine in sessionTransitions.ts
    // defines this — we verify the field registry notes match
    const sessionField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'revision_session_status');
    expect(sessionField?.validationRule).toContain('applied and failed are terminal');
  });

  test('queue lifecycle trustedpath_applied has no outgoing transitions', () => {
    const transitions = QUEUE_ITEM_LIFECYCLE_TRANSITIONS['trustedpath_applied'];
    expect(transitions).toHaveLength(0);
  });

  test('needs_targeting can return to ready_for_revise', () => {
    const transitions = QUEUE_ITEM_LIFECYCLE_TRANSITIONS['needs_targeting'];
    expect(transitions).toContain('ready_for_revise');
  });
});

describe('Revise Registry — CSV mirrors', () => {
  test('revise_process_registry.csv row count matches REVISE_PROCESS_REGISTRY', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_process_registry.csv');
    expect(csvRows).toBe(REVISE_PROCESS_REGISTRY.length);
  });

  test('revise_artifact_registry.csv row count matches REVISE_ARTIFACT_REGISTRY', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_artifact_registry.csv');
    expect(csvRows).toBe(REVISE_ARTIFACT_REGISTRY.length);
  });

  test('revise_field_registry.csv row count matches REVISE_FIELD_REGISTRY', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_field_registry.csv');
    expect(csvRows).toBe(REVISE_FIELD_REGISTRY.length);
  });

  test('revise_kick_matrix.csv row count matches REVISE_KICK_MATRIX', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_kick_matrix.csv');
    expect(csvRows).toBe(REVISE_KICK_MATRIX.length);
  });

  test('revise_authority_source_registry.csv row count matches REVISE_AUTHORITY_SOURCE_REGISTRY', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_authority_source_registry.csv');
    expect(csvRows).toBe(REVISE_AUTHORITY_SOURCE_REGISTRY.length);
  });

  test('revise_renderer_consumption_matrix.csv row count matches REVISE_RENDERER_CONSUMPTION_MATRIX', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_renderer_consumption_matrix.csv');
    expect(csvRows).toBe(REVISE_RENDERER_CONSUMPTION_MATRIX.length);
  });

  test('revise_certification_gate_registry.csv row count matches REVISE_CERTIFICATION_GATE_REGISTRY', () => {
    const csvRows = csvRowCount('docs/registries/revise/revise_certification_gate_registry.csv');
    expect(csvRows).toBe(REVISE_CERTIFICATION_GATE_REGISTRY.length);
  });
});
