import {
  CHECKLIST_ARTIFACT_TYPES,
  type ChecklistArtifactType,
} from './checklistMatrix';
import {
  assertChecklistPhaseMayStart,
  selectLastResumeSafeArtifact,
  type ChecklistArtifactMap,
  type ChecklistArtifactState,
} from './checklistEnforcer';

const CHECKLIST_ARTIFACT_TYPE_SET = new Set<string>(CHECKLIST_ARTIFACT_TYPES);

export type RuntimeArtifactRow = {
  id?: string | null;
  artifact_type?: string | null;
  content?: unknown;
  source_hash?: string | null;
  created_at?: string | null;
};

export type WorkerPhaseEntryDecision = {
  ok: boolean;
  code: string;
  reason: string;
};

export type ResumeCheckpointDecision = {
  selected: ChecklistArtifactState | null;
  resume_mode:
    | 'checklist_resume_safe'
    | 'phase2_handoff'
    | 'chunk_checkpoint'
    | 'full_restart';
  target_phase: 'phase_1a' | 'phase_2' | 'phase_3';
  checkpoint_artifact_type?: ChecklistArtifactType;
  checkpoint_artifact_id?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeSemanticStatus(value: unknown): ChecklistArtifactState['semantic_status'] {
  if (
    value === 'valid' ||
    value === 'degraded_with_reasons' ||
    value === 'blocked' ||
    value === 'failed' ||
    value === 'unknown'
  ) {
    return value;
  }

  return 'unknown';
}

function normalizeReasonCodes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export function toChecklistArtifactState(row: RuntimeArtifactRow): ChecklistArtifactState | null {
  const artifactType = asString(row.artifact_type);
  if (!artifactType || !CHECKLIST_ARTIFACT_TYPE_SET.has(artifactType)) {
    return null;
  }

  const content = isRecord(row.content) ? row.content : {};
  const envelopeArtifactId = asString(content.artifact_id);
  const rowArtifactId = asString(row.id);
  const artifactId = envelopeArtifactId ?? rowArtifactId;

  return {
    artifact_type: artifactType as ChecklistArtifactType,
    artifact_id: artifactId,
    schema_valid: asBoolean(content.schema_valid),
    semantic_status: normalizeSemanticStatus(content.semantic_status),
    is_resume_safe: asBoolean(content.is_resume_safe),
    blocking_reason_codes: normalizeReasonCodes(content.blocking_reason_codes),
    checksum: asString(content.checksum) ?? asString(row.source_hash),
  };
}

export function toChecklistArtifactMap(rows: readonly RuntimeArtifactRow[]): ChecklistArtifactMap {
  const map: ChecklistArtifactMap = {};

  for (const row of rows) {
    const artifact = toChecklistArtifactState(row);
    if (artifact) {
      map[artifact.artifact_type] = artifact;
    }
  }

  return map;
}

export function assertWorkerPhaseEntry(
  phaseId: Parameters<typeof assertChecklistPhaseMayStart>[0],
  rows: readonly RuntimeArtifactRow[],
): WorkerPhaseEntryDecision {
  const decision = assertChecklistPhaseMayStart(phaseId, toChecklistArtifactMap(rows));
  return {
    ok: decision.ok,
    code: decision.code,
    reason: decision.reason,
  };
}

function targetPhaseForArtifact(artifactType: ChecklistArtifactType | undefined): 'phase_1a' | 'phase_2' | 'phase_3' {
  if (artifactType === 'pass12_handoff_v1' || artifactType === 'accepted_story_ledger_v1') {
    return 'phase_2';
  }

  if (
    artifactType === 'evaluation_result_v2' ||
    artifactType === 'revision_opportunity_ledger_v1'
  ) {
    return 'phase_3';
  }

  return 'phase_1a';
}

export function selectResumeCheckpoint(params: {
  rows: readonly RuntimeArtifactRow[];
  hasLegacyPhase2Handoff?: boolean;
  hasLegacyChunkCheckpoint?: boolean;
}): ResumeCheckpointDecision {
  const checklistArtifacts = params.rows
    .map(toChecklistArtifactState)
    .filter((artifact): artifact is ChecklistArtifactState => artifact !== null);

  const selected = selectLastResumeSafeArtifact(checklistArtifacts);
  if (selected) {
    return {
      selected,
      resume_mode: 'checklist_resume_safe',
      target_phase: targetPhaseForArtifact(selected.artifact_type),
      checkpoint_artifact_type: selected.artifact_type,
      checkpoint_artifact_id: selected.artifact_id ?? null,
    };
  }

  if (params.hasLegacyPhase2Handoff) {
    return {
      selected: null,
      resume_mode: 'phase2_handoff',
      target_phase: 'phase_2',
    };
  }

  if (params.hasLegacyChunkCheckpoint) {
    return {
      selected: null,
      resume_mode: 'chunk_checkpoint',
      target_phase: 'phase_1a',
    };
  }

  return {
    selected: null,
    resume_mode: 'full_restart',
    target_phase: 'phase_1a',
  };
}
