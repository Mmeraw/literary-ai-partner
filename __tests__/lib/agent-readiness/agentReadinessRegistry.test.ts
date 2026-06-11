/**
 * Guard suite: Agent Readiness Package FIPOC Registry
 *
 * Authority: lib/agent-readiness/agentReadinessRegistry.ts
 * Governance: docs/SIPOC_AGENT_READINESS_PROCESS.md
 *
 * These tests are release-blocking. They enforce referential integrity,
 * canonical enum contracts, word limit contracts, and cross-registry
 * consistency across the Agent Readiness FIPOC.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AGENT_READINESS_PROCESS_REGISTRY,
  AGENT_READINESS_ARTIFACT_REGISTRY,
  AGENT_READINESS_FIELD_REGISTRY,
  AGENT_READINESS_KICK_MATRIX,
  AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY,
  AGENT_READINESS_RENDERER_MATRIX,
  AGENT_READINESS_CERTIFICATION_GATE_REGISTRY,
  SECTION_WORD_LIMIT_REGISTRY,
} from '../../../lib/agent-readiness/agentReadinessRegistry';

// ─── Constants ───────────────────────────────────────────────────────────────

const CANONICAL_SECTIONS = [
  'query_letter',
  'what_makes_unique',
  'synopsis',
  'query_pitch',
  'comparables',
  'author_bio',
] as const;

const CANONICAL_SECTION_STATUSES = ['draft', 'approved'] as const;
const CANONICAL_PACKAGE_STATUSES = ['Not Started', 'Draft', 'Approved', 'Exported'] as const;
const CANONICAL_GENERATE_MODES = ['generate', 'regenerate', 'improve'] as const;
const CANONICAL_EXPORT_FORMATS = ['txt', 'docx'] as const;

function csvRowCount(relativePath: string): number {
  const abs = path.resolve(__dirname, '../../../', relativePath);
  if (!fs.existsSync(abs)) return -1;
  const lines = fs.readFileSync(abs, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  return lines.length - 1; // exclude header
}

// ─── Process Registry ─────────────────────────────────────────────────────────

describe('AGENT_READINESS_PROCESS_REGISTRY', () => {
  test('has 9 stages', () => {
    expect(AGENT_READINESS_PROCESS_REGISTRY).toHaveLength(9);
  });

  test('stage sequences are 1-based and contiguous', () => {
    const seqs = AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.sequence);
    for (let i = 0; i < seqs.length; i++) {
      expect(seqs[i]).toBe(i + 1);
    }
  });

  test('all stageIds are unique', () => {
    const ids = AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.stageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all stageIds match AR\u03B4\u03B4_UPPER_SNAKE pattern', () => {
    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      expect(stage.stageId).toMatch(/^AR\d{2}_[A-Z_]+$/);
    }
  });

  test('activeState values are canonical', () => {
    const valid = new Set(['active', 'planned_required', 'deferred']);
    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      expect(valid.has(stage.activeState)).toBe(true);
    }
  });

  test('certificationStatus values are canonical', () => {
    const valid = new Set(['proven', 'partial', 'emerging', 'missing_critical']);
    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      expect(valid.has(stage.certificationStatus)).toBe(true);
    }
  });

  test('fitGapStatus values are canonical', () => {
    const valid = new Set(['ok', 'gap', 'critical']);
    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      expect(valid.has(stage.fitGapStatus)).toBe(true);
    }
  });

  test('all stageIds are referenced by at least one artifact as producer or consumer', () => {
    const stageIds = new Set(AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.stageId));
    const referencedStages = new Set<string>();

    for (const artifact of AGENT_READINESS_ARTIFACT_REGISTRY) {
      // Producers that are stages (not external)
      if (stageIds.has(artifact.producerStageId)) {
        referencedStages.add(artifact.producerStageId);
      }
      for (const c of artifact.consumerStageIds) {
        if (stageIds.has(c)) referencedStages.add(c);
      }
    }

    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      expect(referencedStages.has(stage.stageId)).toBe(true);
    }
  });

  test('each stage has at least one inputArtifact and one outputArtifact', () => {
    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      expect(stage.inputArtifacts.length).toBeGreaterThan(0);
      expect(stage.outputArtifacts.length).toBeGreaterThan(0);
    }
  });
});

// ─── Artifact Registry ────────────────────────────────────────────────────────

describe('AGENT_READINESS_ARTIFACT_REGISTRY', () => {
  test('has 12 artifacts', () => {
    expect(AGENT_READINESS_ARTIFACT_REGISTRY).toHaveLength(12);
  });

  test('all artifact IDs are unique', () => {
    const ids = AGENT_READINESS_ARTIFACT_REGISTRY.map((a) => a.artifact);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all artifact IDs end in _v1 or are documented external', () => {
    for (const artifact of AGENT_READINESS_ARTIFACT_REGISTRY) {
      const endsWithVersion = artifact.artifact.match(/_v\d+$/) !== null;
      const isExternalStatic = artifact.producerStageId.includes('(external)') || artifact.producerStageId.includes('(static)') || artifact.producerStageId === 'none';
      // External static artifacts may not follow _v1 convention
      if (!isExternalStatic) {
        expect(endsWithVersion).toBe(true);
      }
    }
  });

  test('fitGapStatus values are canonical', () => {
    const valid = new Set(['ok', 'gap', 'critical']);
    for (const artifact of AGENT_READINESS_ARTIFACT_REGISTRY) {
      expect(valid.has(artifact.fitGapStatus)).toBe(true);
    }
  });

  test('all artifacts referenced in process registry inputArtifacts/outputArtifacts are registered', () => {
    const registeredArtifacts = new Set(AGENT_READINESS_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const stage of AGENT_READINESS_PROCESS_REGISTRY) {
      for (const art of stage.inputArtifacts) {
        expect(registeredArtifacts.has(art)).toBe(true);
      }
      for (const art of stage.outputArtifacts) {
        expect(registeredArtifacts.has(art)).toBe(true);
      }
    }
  });

  test('all appliesToArtifacts in authority source registry reference registered artifacts', () => {
    const registeredArtifacts = new Set(AGENT_READINESS_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const auth of AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY) {
      for (const art of auth.appliesToArtifacts) {
        expect(registeredArtifacts.has(art)).toBe(true);
      }
    }
  });

  test('all artifacts consumed by renderer matrix are registered', () => {
    const registeredArtifacts = new Set(AGENT_READINESS_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const renderer of AGENT_READINESS_RENDERER_MATRIX) {
      for (const art of renderer.consumedArtifacts) {
        expect(registeredArtifacts.has(art)).toBe(true);
      }
    }
  });
});

// ─── Field Registry ───────────────────────────────────────────────────────────

describe('AGENT_READINESS_FIELD_REGISTRY', () => {
  test('has 15 fields', () => {
    expect(AGENT_READINESS_FIELD_REGISTRY).toHaveLength(15);
  });

  test('all field names are unique', () => {
    const names = AGENT_READINESS_FIELD_REGISTRY.map((f) => f.field);
    expect(new Set(names).size).toBe(names.length);
  });

  test('section field has exactly 6 canonical values', () => {
    const sectionField = AGENT_READINESS_FIELD_REGISTRY.find((f) => f.field === 'section' && f.artifact === 'section_generation_request_v1');
    expect(sectionField).toBeDefined();
    expect(sectionField!.canonicalValues).toEqual([...CANONICAL_SECTIONS]);
  });

  test('status field has exactly 2 canonical values', () => {
    const statusField = AGENT_READINESS_FIELD_REGISTRY.find((f) => f.field === 'status');
    expect(statusField).toBeDefined();
    expect(statusField!.canonicalValues).toEqual([...CANONICAL_SECTION_STATUSES]);
  });

  test('packageStatus field has exactly 4 canonical values', () => {
    const pkgField = AGENT_READINESS_FIELD_REGISTRY.find((f) => f.field === 'packageStatus');
    expect(pkgField).toBeDefined();
    expect(pkgField!.canonicalValues).toEqual([...CANONICAL_PACKAGE_STATUSES]);
  });

  test('mode field has exactly 3 canonical values', () => {
    const modeField = AGENT_READINESS_FIELD_REGISTRY.find((f) => f.field === 'mode');
    expect(modeField).toBeDefined();
    expect(modeField!.canonicalValues).toEqual([...CANONICAL_GENERATE_MODES]);
  });

  test('format field has exactly 2 canonical values', () => {
    const formatField = AGENT_READINESS_FIELD_REGISTRY.find((f) => f.field === 'format');
    expect(formatField).toBeDefined();
    expect(formatField!.canonicalValues).toEqual([...CANONICAL_EXPORT_FORMATS]);
  });

  test('all fields reference an artifact that is registered', () => {
    const registeredArtifacts = new Set(AGENT_READINESS_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const field of AGENT_READINESS_FIELD_REGISTRY) {
      expect(registeredArtifacts.has(field.artifact)).toBe(true);
    }
  });

  test('all fields reference a sourceStageId or validatorStageId that is registered', () => {
    const registeredStages = new Set(AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.stageId));
    for (const field of AGENT_READINESS_FIELD_REGISTRY) {
      expect(registeredStages.has(field.sourceStageId)).toBe(true);
      expect(registeredStages.has(field.validatorStageId)).toBe(true);
    }
  });
});

// ─── Kick Matrix ──────────────────────────────────────────────────────────────

describe('AGENT_READINESS_KICK_MATRIX', () => {
  test('has 11 kick codes', () => {
    expect(AGENT_READINESS_KICK_MATRIX).toHaveLength(11);
  });

  test('all kick codes are unique', () => {
    const codes = AGENT_READINESS_KICK_MATRIX.map((k) => k.kickCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('all kick codes are UPPER_SNAKE_CASE', () => {
    for (const kick of AGENT_READINESS_KICK_MATRIX) {
      expect(kick.kickCode).toMatch(/^[A-Z_]+$/);
    }
  });

  test('all detectedAt stage IDs reference registered stages or external', () => {
    const registeredStages = new Set(AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.stageId));
    for (const kick of AGENT_READINESS_KICK_MATRIX) {
      expect(registeredStages.has(kick.detectedAt)).toBe(true);
    }
  });

  test('httpStatus values are valid HTTP status codes', () => {
    const validCodes = new Set([400, 401, 403, 404, 422, 500]);
    for (const kick of AGENT_READINESS_KICK_MATRIX) {
      expect(validCodes.has(kick.httpStatus)).toBe(true);
    }
  });

  test('quality gate kicks are detected at AR03_QUALITY_GATE', () => {
    const qualityGateKicks = [
      'OUTPUT_TOO_SHORT',
      'EDITORIAL_META_LANGUAGE',
      'UNRESOLVED_PLACEHOLDER',
      'WORD_LIMIT_EXCEEDED',
      'OUTPUT_TOO_THIN',
    ];
    const kicksByCode = new Map(AGENT_READINESS_KICK_MATRIX.map((k) => [k.kickCode, k]));
    for (const code of qualityGateKicks) {
      const kick = kicksByCode.get(code);
      expect(kick).toBeDefined();
      expect(kick!.detectedAt).toBe('AR03_QUALITY_GATE');
    }
  });

  test('SECTIONS_NOT_ALL_APPROVED blocks package assembly', () => {
    const kick = AGENT_READINESS_KICK_MATRIX.find((k) => k.kickCode === 'SECTIONS_NOT_ALL_APPROVED');
    expect(kick).toBeDefined();
    expect(kick!.blocksPackageAssembly).toBe(true);
  });

  test('UNAUTHENTICATED blocks package assembly', () => {
    const kick = AGENT_READINESS_KICK_MATRIX.find((k) => k.kickCode === 'UNAUTHENTICATED');
    expect(kick).toBeDefined();
    expect(kick!.blocksPackageAssembly).toBe(true);
    expect(kick!.httpStatus).toBe(401);
  });
});

// ─── Authority Source Registry ────────────────────────────────────────────────

describe('AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY', () => {
  test('has 9 authority sources', () => {
    expect(AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY).toHaveLength(9);
  });

  test('all authorityIds are unique', () => {
    const ids = AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY.map((a) => a.authorityId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all authority source paths exist on disk', () => {
    for (const auth of AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY) {
      const abs = path.resolve(__dirname, '../../../', auth.path);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });

  test('all appliesToStageIds reference registered stages', () => {
    const registeredStages = new Set(AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.stageId));
    for (const auth of AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY) {
      for (const stageId of auth.appliesToStageIds) {
        expect(registeredStages.has(stageId)).toBe(true);
      }
    }
  });

  test('AI_GOVERNANCE applies to all 9 stages', () => {
    const gov = AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'AI_GOVERNANCE');
    expect(gov).toBeDefined();
    expect(gov!.appliesToStageIds).toHaveLength(9);
  });

  test('SIPOC_AGENT_READINESS authority source references the docs file', () => {
    const sipoc = AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'SIPOC_AGENT_READINESS');
    expect(sipoc).toBeDefined();
    expect(sipoc!.path).toBe('docs/SIPOC_AGENT_READINESS_PROCESS.md');
    // Must apply to all 9 stages
    expect(sipoc!.appliesToStageIds).toHaveLength(9);
    // File must exist on disk
    const abs = path.resolve(__dirname, '../../../', sipoc!.path);
    expect(fs.existsSync(abs)).toBe(true);
  });
});

// ─── Renderer / Consumer Matrix ────────────────────────────────────────────────

describe('AGENT_READINESS_RENDERER_MATRIX', () => {
  test('has 8 renderer surfaces', () => {
    expect(AGENT_READINESS_RENDERER_MATRIX).toHaveLength(8);
  });

  test('all surface names are unique', () => {
    const names = AGENT_READINESS_RENDERER_MATRIX.map((r) => r.surface);
    expect(new Set(names).size).toBe(names.length);
  });

  test('all routes are unique', () => {
    const routes = AGENT_READINESS_RENDERER_MATRIX.map((r) => r.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  test('all consumed artifacts reference registered artifacts', () => {
    const registeredArtifacts = new Set(AGENT_READINESS_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const renderer of AGENT_READINESS_RENDERER_MATRIX) {
      for (const art of renderer.consumedArtifacts) {
        expect(registeredArtifacts.has(art)).toBe(true);
      }
    }
  });
});

// ─── Certification Gate Registry ──────────────────────────────────────────────

describe('AGENT_READINESS_CERTIFICATION_GATE_REGISTRY', () => {
  test('has 8 certification gates', () => {
    expect(AGENT_READINESS_CERTIFICATION_GATE_REGISTRY).toHaveLength(8);
  });

  test('all gateIds are unique', () => {
    const ids = AGENT_READINESS_CERTIFICATION_GATE_REGISTRY.map((g) => g.gateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all gateIds match ARCG\u03B4\u03B4_UPPER_SNAKE pattern', () => {
    for (const gate of AGENT_READINESS_CERTIFICATION_GATE_REGISTRY) {
      expect(gate.gateId).toMatch(/^ARCG\d{2}_[A-Z_]+$/);
    }
  });

  test('all appliesToStageId values reference registered stages', () => {
    const registeredStages = new Set(AGENT_READINESS_PROCESS_REGISTRY.map((s) => s.stageId));
    for (const gate of AGENT_READINESS_CERTIFICATION_GATE_REGISTRY) {
      expect(registeredStages.has(gate.appliesToStageId)).toBe(true);
    }
  });

  test('quality gate (ARCG03) is enforced', () => {
    const gate = AGENT_READINESS_CERTIFICATION_GATE_REGISTRY.find((g) => g.gateId === 'ARCG03_QUALITY_GATE');
    expect(gate).toBeDefined();
    expect(gate!.enforced).toBe(true);
  });

  test('ARCG06 author bio fact gate is not enforced (rubric-only)', () => {
    const gate = AGENT_READINESS_CERTIFICATION_GATE_REGISTRY.find((g) => g.gateId === 'ARCG06_AUTHOR_BIO_NO_INVENTED_FACTS');
    expect(gate).toBeDefined();
    expect(gate!.enforced).toBe(false);
  });
});

// ─── Section Word Limit Registry ──────────────────────────────────────────────

describe('SECTION_WORD_LIMIT_REGISTRY', () => {
  test('has 6 entries — one per canonical section', () => {
    expect(SECTION_WORD_LIMIT_REGISTRY).toHaveLength(6);
  });

  test('covers all canonical section types', () => {
    const registered = new Set(SECTION_WORD_LIMIT_REGISTRY.map((s) => s.section));
    for (const section of CANONICAL_SECTIONS) {
      expect(registered.has(section)).toBe(true);
    }
  });

  test('query_letter limit is 450, minimum is 200', () => {
    const entry = SECTION_WORD_LIMIT_REGISTRY.find((s) => s.section === 'query_letter');
    expect(entry!.wordLimit).toBe(450);
    expect(entry!.wordMinimum).toBe(200);
  });

  test('synopsis limit is 500, minimum is 150', () => {
    const entry = SECTION_WORD_LIMIT_REGISTRY.find((s) => s.section === 'synopsis');
    expect(entry!.wordLimit).toBe(500);
    expect(entry!.wordMinimum).toBe(150);
  });

  test('query_pitch limit is 50, has no minimum', () => {
    const entry = SECTION_WORD_LIMIT_REGISTRY.find((s) => s.section === 'query_pitch');
    expect(entry!.wordLimit).toBe(50);
    expect(entry!.hasMinimum).toBe(false);
    expect(entry!.wordMinimum).toBeNull();
  });

  test('author_bio limit is 150, minimum is 50', () => {
    const entry = SECTION_WORD_LIMIT_REGISTRY.find((s) => s.section === 'author_bio');
    expect(entry!.wordLimit).toBe(150);
    expect(entry!.wordMinimum).toBe(50);
  });

  test('all word limits are positive integers', () => {
    for (const entry of SECTION_WORD_LIMIT_REGISTRY) {
      expect(entry.wordLimit).toBeGreaterThan(0);
      expect(Number.isInteger(entry.wordLimit)).toBe(true);
    }
  });

  test('all word minimums are null or positive integers', () => {
    for (const entry of SECTION_WORD_LIMIT_REGISTRY) {
      if (entry.wordMinimum !== null) {
        expect(entry.wordMinimum).toBeGreaterThan(0);
        expect(Number.isInteger(entry.wordMinimum)).toBe(true);
      }
    }
  });
});

// ─── CSV Row Counts ───────────────────────────────────────────────────────────

describe('CSV mirrors', () => {
  const csvDir = 'docs/registries/agent-readiness';

  test('agent_readiness_process_registry.csv row count matches AGENT_READINESS_PROCESS_REGISTRY', () => {
    const csvRows = csvRowCount(`${csvDir}/agent_readiness_process_registry.csv`);
    expect(csvRows).toBe(AGENT_READINESS_PROCESS_REGISTRY.length);
  });

  test('agent_readiness_artifact_registry.csv row count matches AGENT_READINESS_ARTIFACT_REGISTRY', () => {
    const csvRows = csvRowCount(`${csvDir}/agent_readiness_artifact_registry.csv`);
    expect(csvRows).toBe(AGENT_READINESS_ARTIFACT_REGISTRY.length);
  });

  test('agent_readiness_field_registry.csv row count matches AGENT_READINESS_FIELD_REGISTRY', () => {
    const csvRows = csvRowCount(`${csvDir}/agent_readiness_field_registry.csv`);
    expect(csvRows).toBe(AGENT_READINESS_FIELD_REGISTRY.length);
  });

  test('agent_readiness_kick_matrix.csv row count matches AGENT_READINESS_KICK_MATRIX', () => {
    const csvRows = csvRowCount(`${csvDir}/agent_readiness_kick_matrix.csv`);
    expect(csvRows).toBe(AGENT_READINESS_KICK_MATRIX.length);
  });

  test('agent_readiness_authority_source_registry.csv row count matches AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY', () => {
    const csvRows = csvRowCount(`${csvDir}/agent_readiness_authority_source_registry.csv`);
    expect(csvRows).toBe(AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY.length);
  });

  test('section_word_limit_registry.csv row count matches SECTION_WORD_LIMIT_REGISTRY', () => {
    const csvRows = csvRowCount(`${csvDir}/section_word_limit_registry.csv`);
    expect(csvRows).toBe(SECTION_WORD_LIMIT_REGISTRY.length);
  });
});

// ─── Known Gap Guards ──────────────────────────────────────────────────────────

describe('Known gap guards (audit-locked)', () => {
  test('AR07_BATCH_GENERATION is a batch orchestrator — not a package assembly stage', () => {
    const stage = AGENT_READINESS_PROCESS_REGISTRY.find((s) => s.stageId === 'AR07_BATCH_GENERATION');
    expect(stage).toBeDefined();
    // generate-all is the code surface for AR07 (batch generation), not AR08
    expect(stage!.codeSurfaces).toContain('app/api/agent-readiness/generate-all/route.ts');
    // AR07 does NOT produce agent_readiness_package_v1 (that belongs to AR08_EXPORT)
    expect(stage!.outputArtifacts).not.toContain('agent_readiness_package_v1');
    // AR07 produces section_generation_result_v1 (same as AR02)
    expect(stage!.outputArtifacts).toContain('section_generation_result_v1');
  });

  test('AR08_EXPORT is the combined assembly+export stage (no separate package assembly route)', () => {
    const stage = AGENT_READINESS_PROCESS_REGISTRY.find((s) => s.stageId === 'AR08_EXPORT');
    expect(stage).toBeDefined();
    expect(stage!.codeSurfaces).toContain('app/api/agent-readiness/download/route.ts');
    // The download route is both assembly and export
    expect(stage!.processContract).toMatch(/both the assembly and export step/i);
  });

  test('AR05_AUTHOR_REVIEW is marked critical — approval is not persisted to DB', () => {
    const stage = AGENT_READINESS_PROCESS_REGISTRY.find((s) => s.stageId === 'AR05_AUTHOR_REVIEW');
    expect(stage).toBeDefined();
    expect(stage!.fitGapStatus).toBe('critical');
    expect(stage!.certificationStatus).toBe('missing_critical');
    // The notes must document the gap explicitly
    expect(stage!.notes).toMatch(/KNOWN GAP/i);
    expect(stage!.notes).toMatch(/Approve button/i);
  });

  test('AR06_COMPLETENESS_CHECK is marked critical — download gated on allSectionsStarted not allSectionsApproved', () => {
    const stage = AGENT_READINESS_PROCESS_REGISTRY.find((s) => s.stageId === 'AR06_COMPLETENESS_CHECK');
    expect(stage).toBeDefined();
    expect(stage!.fitGapStatus).toBe('critical');
    expect(stage!.certificationStatus).toBe('missing_critical');
    expect(stage!.notes).toMatch(/KNOWN GAP/i);
    expect(stage!.notes).toMatch(/allSectionsStarted/i);
  });

  test('agent_readiness_package_v1 is marked critical — assembled inline, not from DB', () => {
    const artifact = AGENT_READINESS_ARTIFACT_REGISTRY.find((a) => a.artifact === 'agent_readiness_package_v1');
    expect(artifact).toBeDefined();
    expect(artifact!.fitGapStatus).toBe('critical');
    // Producer is AR08_EXPORT (assembly+export), not AR07
    expect(artifact!.producerStageId).toBe('AR08_EXPORT');
    expect(artifact!.dirtyDataRule).toMatch(/KNOWN GAP/i);
  });

  test('author_review_decision_v1 is marked critical — decision not persisted to DB', () => {
    const artifact = AGENT_READINESS_ARTIFACT_REGISTRY.find((a) => a.artifact === 'author_review_decision_v1');
    expect(artifact).toBeDefined();
    expect(artifact!.fitGapStatus).toBe('critical');
    expect(artifact!.dirtyDataRule).toMatch(/KNOWN GAP/i);
  });

  test('AR04_SECTION_PERSISTENCE is marked critical — DB failure is non-fatal', () => {
    const stage = AGENT_READINESS_PROCESS_REGISTRY.find((s) => s.stageId === 'AR04_SECTION_PERSISTENCE');
    expect(stage).toBeDefined();
    expect(stage!.fitGapStatus).toBe('critical');
    expect(stage!.certificationStatus).toBe('missing_critical');
    expect(stage!.notes).toMatch(/KNOWN GAP/i);
    expect(stage!.notes).toMatch(/non-fatal/i);
  });

  test('AR08_EXPORT is marked gap — export does not enforce completeness or approval', () => {
    const stage = AGENT_READINESS_PROCESS_REGISTRY.find((s) => s.stageId === 'AR08_EXPORT');
    expect(stage).toBeDefined();
    expect(stage!.fitGapStatus).toBe('gap');
    expect(stage!.certificationStatus).toBe('partial');
    // The contract must document the actual gate: at least one section, not all 6 approved
    expect(stage!.processContract).toMatch(/at least one section/i);
    expect(stage!.notes).toMatch(/KNOWN GAP/i);
    // Must NOT falsely claim the API enforces all-6-approved
    expect(stage!.processContract).not.toMatch(/blocked.*all.*6.*approved/i);
  });

  test('agent_readiness_section_v1 artifact is marked critical — persistence non-fatal', () => {
    const artifact = AGENT_READINESS_ARTIFACT_REGISTRY.find((a) => a.artifact === 'agent_readiness_section_v1');
    expect(artifact).toBeDefined();
    expect(artifact!.fitGapStatus).toBe('critical');
    expect(artifact!.dirtyDataRule).toMatch(/KNOWN GAP/i);
  });

  test('SIPOC_AGENT_READINESS authority source doc exists on disk', () => {
    const sipoc = AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'SIPOC_AGENT_READINESS');
    expect(sipoc).toBeDefined();
    const abs = path.resolve(__dirname, '../../../', sipoc!.path);
    expect(fs.existsSync(abs)).toBe(true);
  });
});
