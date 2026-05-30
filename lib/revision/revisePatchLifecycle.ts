import { createHash } from 'crypto'
import {
  candidateTextIsCopyPasteReady,
  operationRequiresStructuralPreview,
  type PatchApplicationStatus,
  type RevisionOperation,
} from '@/lib/revision/reviseCardContract'

export type ReviseDecisionStatus =
  | 'pending'
  | 'accepted_a'
  | 'accepted_b'
  | 'accepted_c'
  | 'custom_written'
  | 'kept_original'
  | 'deferred'
  | 'rejected'

export type CustomPatchSourceOption =
  | 'from_scratch'
  | 'edited_from_a'
  | 'edited_from_b'
  | 'edited_from_c'

export type SourceLocationSnapshot = {
  chapter_index?: number
  paragraph_index?: number
  start_offset?: number
  end_offset?: number
}

export type BasePatchContext = {
  reviseQueueItemId: string
  revisionOperation: RevisionOperation
  sourceTextSnapshot: string
  sourceLocation: SourceLocationSnapshot
  baseManuscriptVersionId: string
  sourceTextHash: string
}

export type CandidatePatch = BasePatchContext & {
  selectedSource: 'A' | 'B' | 'C' | 'custom' | 'original'
  patchText: string
}

export type CustomRevisionPatch = BasePatchContext & {
  sourceOption?: CustomPatchSourceOption
  customText: string
  createdAt: string
  updatedAt?: string
  appliedAt?: string
  applicationStatus: PatchApplicationStatus
}

export type PatchPreview = {
  previewId: string
  reviseQueueItemId: string
  selectedSource: CandidatePatch['selectedSource']
  revisionOperation: RevisionOperation
  beforeText: string
  afterText: string
  sourceTextHash: string
  baseManuscriptVersionId: string
  structuralPreviewRequired: boolean
  generatedAt: string
}

export type ApplyPatchInput = {
  preview: PatchPreview
  decisionStatus: ReviseDecisionStatus
  applicationStatus: PatchApplicationStatus
  currentSourceText: string
  currentSourceTextHash: string
  requestedAt: string
}

export type ApplyPatchResult =
  | {
      ok: true
      applicationStatus: 'applied'
      selectedSource: CandidatePatch['selectedSource']
      manuscriptVersionBefore: string
      manuscriptVersionAfter: string
      appliedPatchRecord: {
        revise_queue_item_id: string
        selected_source: CandidatePatch['selectedSource']
        revision_operation: RevisionOperation
        before_text: string
        after_text: string
        manuscript_version_before: string
        manuscript_version_after: string
        applied_at: string
      }
    }
  | {
      ok: false
      applicationStatus: Exclude<PatchApplicationStatus, 'applied'>
      reason: string
    }

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function ensurePatchProse(value: string | null | undefined): { ok: boolean; reason: string | null } {
  if (!candidateTextIsCopyPasteReady(value)) {
    return {
      ok: false,
      reason: 'Patch text must be copy-paste manuscript prose, not meta-instructions.',
    }
  }

  return { ok: true, reason: null }
}

export function buildCandidatePatch(input: {
  reviseQueueItemId: string
  selectedSource: CandidatePatch['selectedSource']
  revisionOperation: RevisionOperation
  sourceTextSnapshot: string
  sourceLocation: SourceLocationSnapshot
  baseManuscriptVersionId: string
  patchText: string
}): CandidatePatch {
  return {
    reviseQueueItemId: input.reviseQueueItemId,
    selectedSource: input.selectedSource,
    revisionOperation: input.revisionOperation,
    sourceTextSnapshot: input.sourceTextSnapshot,
    sourceLocation: input.sourceLocation,
    baseManuscriptVersionId: input.baseManuscriptVersionId,
    sourceTextHash: sha256(input.sourceTextSnapshot),
    patchText: input.patchText,
  }
}

export function buildCustomPatch(input: {
  reviseQueueItemId: string
  revisionOperation: RevisionOperation
  sourceTextSnapshot: string
  sourceLocation: SourceLocationSnapshot
  baseManuscriptVersionId: string
  customText: string
  sourceOption?: CustomPatchSourceOption
  createdAt: string
}): CustomRevisionPatch {
  return {
    reviseQueueItemId: input.reviseQueueItemId,
    revisionOperation: input.revisionOperation,
    sourceTextSnapshot: input.sourceTextSnapshot,
    sourceLocation: input.sourceLocation,
    baseManuscriptVersionId: input.baseManuscriptVersionId,
    sourceTextHash: sha256(input.sourceTextSnapshot),
    sourceOption: input.sourceOption,
    customText: input.customText,
    createdAt: input.createdAt,
    applicationStatus: 'not_applied',
  }
}

export function buildPatchPreview(candidate: CandidatePatch, generatedAt: string): PatchPreview {
  return {
    previewId: `preview:${candidate.reviseQueueItemId}:${sha256(`${candidate.selectedSource}:${candidate.patchText}`).slice(0, 12)}`,
    reviseQueueItemId: candidate.reviseQueueItemId,
    selectedSource: candidate.selectedSource,
    revisionOperation: candidate.revisionOperation,
    beforeText: candidate.sourceTextSnapshot,
    afterText: candidate.patchText,
    sourceTextHash: candidate.sourceTextHash,
    baseManuscriptVersionId: candidate.baseManuscriptVersionId,
    structuralPreviewRequired: operationRequiresStructuralPreview(candidate.revisionOperation),
    generatedAt,
  }
}

export function applyPatchFromPreview(input: ApplyPatchInput): ApplyPatchResult {
  if (input.applicationStatus !== 'previewed') {
    return {
      ok: false,
      applicationStatus: 'failed',
      reason: 'Patch apply blocked: preview confirmation is required before apply.',
    }
  }

  if (
    input.decisionStatus !== 'accepted_a'
    && input.decisionStatus !== 'accepted_b'
    && input.decisionStatus !== 'accepted_c'
    && input.decisionStatus !== 'custom_written'
  ) {
    return {
      ok: false,
      applicationStatus: 'failed',
      reason: 'Patch apply blocked: decision_status must be accepted_a/accepted_b/accepted_c/custom_written.',
    }
  }

  if (sha256(input.currentSourceText) !== input.currentSourceTextHash) {
    return {
      ok: false,
      applicationStatus: 'failed',
      reason: 'Current source text hash mismatch with provided currentSourceText.',
    }
  }

  if (input.currentSourceTextHash !== input.preview.sourceTextHash) {
    return {
      ok: false,
      applicationStatus: 'conflict_detected',
      reason: 'Patch apply blocked: source anchor changed since preview generation.',
    }
  }

  const nextVersionId = `mv:${input.preview.baseManuscriptVersionId}:${sha256(`${input.preview.previewId}:${input.requestedAt}`).slice(0, 12)}`

  return {
    ok: true,
    applicationStatus: 'applied',
    selectedSource: input.preview.selectedSource,
    manuscriptVersionBefore: input.preview.baseManuscriptVersionId,
    manuscriptVersionAfter: nextVersionId,
    appliedPatchRecord: {
      revise_queue_item_id: input.preview.reviseQueueItemId,
      selected_source: input.preview.selectedSource,
      revision_operation: input.preview.revisionOperation,
      before_text: input.preview.beforeText,
      after_text: input.preview.afterText,
      manuscript_version_before: input.preview.baseManuscriptVersionId,
      manuscript_version_after: nextVersionId,
      applied_at: input.requestedAt,
    },
  }
}
