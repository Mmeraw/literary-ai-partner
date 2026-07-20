import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'
import {
  runHeldRecoveryProductionInitiation,
  selectCanonicalAnchorHeldOpportunities,
} from '@/lib/revision/heldRecoveryProductionInitiationCaller'
import type { HeldRecoveryAttemptRecord } from '@/lib/revision/heldRecoveryAttemptRecorder'
import type { WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue'

const JOB_ID = 'job-proof-1'
const OPPORTUNITY_ID = 'opportunity-1'
const MANUSCRIPT_ID = '9007199254740993'
const MANUSCRIPT_VERSION = 'manuscript_9007199254740993_job-proof-1'
const SOURCE = 'The river crossed the field, and the last witness finally spoke.'
const ANCHOR = 'the last witness'

function heldOpportunity(id = OPPORTUNITY_ID) {
  return {
    id,
    contextQuality: 'clean',
    preflightStatus: 'blocked',
    preflightReasons: [
      'truncated_anchor',
      'insufficient_anchor_grounding',
      'hydration_anchor_truncated',
    ],
    hydrationFailureReasons: ['hydration_anchor_truncated'],
    resBlockerReasons: ['truncated_anchor', 'insufficient_anchor_grounding'],
    groundingStatus: 'unsupported_blocked',
    groundingNote: null,
    classification: {
      copyPasteAdmissionReasons: [],
      strategyAdmissionReasons: [],
    },
    baseDecision: { cardType: 'withheld', reasons: ['hydration_anchor_truncated'] },
    finalDecision: { cardType: 'withheld', reasons: ['hydration_anchor_truncated'] },
  } as never
}

function queue(held = [heldOpportunity()]): WorkbenchQueuePayload {
  return {
    ok: true,
    error: null,
    manuscriptId: MANUSCRIPT_ID,
    evaluationJobId: JOB_ID,
    modeContract: null,
    manuscriptTitle: 'Proof',
    opportunities: [],
    needsTargeting: [],
    withheldUnsupported: held,
    readinessTotals: { ready_for_revise: 0, needs_targeting: 0, withheld_unsupported: held.length },
    totals: { must: 0, should: 0, could: 0 },
    scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: {},
  }
}

function dependencies() {
  const attempts: HeldRecoveryAttemptRecord[] = []
  const attemptPersistence = {
    findByIdempotencyKey: jest.fn(async (key: string) =>
      attempts.find((attempt) => attempt.idempotencyKey === key) ?? null),
    countAttemptsForSeries: jest.fn(async () => attempts.length),
    insertAttempt: jest.fn(async (record: HeldRecoveryAttemptRecord) => record),
    findByHeldItemAndOpportunity: jest.fn(async () => attempts),
  }
  const recordDeferredAttemptAndEnqueue = jest.fn(async () => ({
    status: 'enqueued' as const,
    attemptId: 'attempt-row-1',
    workItemId: 'work-row-1',
    workItemStatus: 'pending' as const,
  }))
  const initializeQueueAuthority = jest.fn(async (input: { heldItemId: string }) => ({
    status: 'created' as const,
    heldItemId: input.heldItemId,
    queueState: 'recovery_attempt_running' as const,
    authorityVersion: 'held-version',
  }))
  const chunkContent = SOURCE
  return {
    attempts,
    attemptPersistence,
    recordDeferredAttemptAndEnqueue,
    initializeQueueAuthority,
    deps: {
      supabase: {} as never,
      isEnabledForJob: (jobId: string) => jobId === JOB_ID,
      loadProofJobContext: async () => ({ jobId: JOB_ID, manuscriptId: MANUSCRIPT_ID, userId: 'proof-user' }),
      loadWorkbench: async () => queue(),
      loadCanonicalOpportunity: async () => ({
        status: 'loaded' as const,
        value: {
          ledgerSourceHash: 'ledger-source-hash',
          manuscriptVersionSha: MANUSCRIPT_VERSION,
          opportunity: { opportunity_id: OPPORTUNITY_ID },
        },
      }),
      attemptPersistence,
      reconstructionPersistence: {
        recordDeferredAttemptAndEnqueue,
        claimNext: jest.fn() as never,
        renewLease: jest.fn() as never,
        complete: jest.fn() as never,
        failTerminal: jest.fn() as never,
        supersede: jest.fn() as never,
      },
      initializeQueueAuthority,
      runtimeLoadersFor: (_jobId: string, heldItem: any) => ({
        loadHeldItem: async () => ({ status: 'loaded' as const, value: heldItem }),
        loadOpportunityLedger: async () => ({
          status: 'loaded' as const,
          value: {
            opportunityId: OPPORTUNITY_ID,
            ledgerSourceHash: 'ledger-source-hash',
            sourceText: SOURCE,
            evidenceAnchor: ANCHOR,
            manuscriptCoordinates: 'chapter 1, paragraph 1',
          },
        }),
        loadCandidateState: async () => ({ status: 'loaded' as const, value: null }),
        loadManuscriptChunks: async () => ({
          status: 'loaded' as const,
          value: [{
            id: 'chunk-1',
            manuscript_id: MANUSCRIPT_ID,
            chunk_index: 0,
            char_start: 0,
            char_end: chunkContent.length,
            content: chunkContent,
            content_hash: createHash('sha256').update(chunkContent).digest('hex'),
          }],
        }),
      }),
    },
  }
}

describe('Held Recovery production initiation', () => {
  it('does nothing when the exact-job target is disabled', async () => {
    const loadProofJobContext = jest.fn(async (_jobId: string) => null)
    await expect(runHeldRecoveryProductionInitiation({ jobId: JOB_ID }, {
      isEnabledForJob: () => false,
      loadProofJobContext,
    })).resolves.toEqual({ status: 'target_disabled' })
    expect(loadProofJobContext).not.toHaveBeenCalled()
  })

  it('collapses multiple canonical anchor signals into one origin-owned held identity', () => {
    const selected = selectCanonicalAnchorHeldOpportunities(queue())
    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({
      opportunity: { id: OPPORTUNITY_ID },
      reason: { code: 'hydration_anchor_truncated', source: 'hydration' },
      producer: 'hydration',
    })
    expect(selected[0].canonicalReasonSet).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'hydration_anchor_truncated', producer: 'hydration' }),
      expect.objectContaining({ code: 'truncated_anchor', producer: 'res_blocker' }),
      expect.objectContaining({ code: 'insufficient_anchor_grounding', producer: 'res_blocker' }),
    ]))
  })

  it('records one deferred attempt/work pair before creating one queue authority', async () => {
    const harness = dependencies()
    const result = await runHeldRecoveryProductionInitiation({ jobId: JOB_ID }, harness.deps)
    expect(result).toMatchObject({
      status: 'deferred_reconstruction_admitted',
      opportunityId: OPPORTUNITY_ID,
      runtimeOutcome: { status: 'deferred' },
      attempt: { status: 'recorded' },
      queueAuthority: { status: 'created' },
    })
    expect(harness.recordDeferredAttemptAndEnqueue).toHaveBeenCalledTimes(1)
    expect(harness.initializeQueueAuthority).toHaveBeenCalledTimes(1)
    expect(harness.recordDeferredAttemptAndEnqueue.mock.invocationCallOrder[0])
      .toBeLessThan(harness.initializeQueueAuthority.mock.invocationCallOrder[0])
    expect(harness.initializeQueueAuthority).toHaveBeenCalledWith(expect.objectContaining({
      evaluationJobId: JOB_ID,
      opportunityId: OPPORTUNITY_ID,
      manuscriptId: MANUSCRIPT_ID,
      manuscriptVersionSha: MANUSCRIPT_VERSION,
    }))
  })

  it('fails closed when more than one recoverable anchor identity is present', async () => {
    const harness = dependencies()
    harness.deps.loadWorkbench = async () => queue([
      heldOpportunity('opportunity-a'),
      heldOpportunity('opportunity-b'),
    ])
    await expect(runHeldRecoveryProductionInitiation({ jobId: JOB_ID }, harness.deps))
      .resolves.toEqual({
        status: 'ambiguous_recoverable_anchor_holds',
        opportunityIds: ['opportunity-a', 'opportunity-b'],
      })
    expect(harness.recordDeferredAttemptAndEnqueue).not.toHaveBeenCalled()
    expect(harness.initializeQueueAuthority).not.toHaveBeenCalled()
  })

  it('replays the same identity without creating a second attempt, work item, or queue authority', async () => {
    const harness = dependencies()
    const first = await runHeldRecoveryProductionInitiation({ jobId: JOB_ID }, harness.deps)
    if (first.status !== 'deferred_reconstruction_admitted') throw new Error(first.status)
    harness.attempts.push(first.attempt.record)
    ;(harness.recordDeferredAttemptAndEnqueue as any).mockResolvedValue({
      status: 'already_enqueued',
      attemptId: 'attempt-row-1',
      workItemId: 'work-row-1',
      workItemStatus: 'pending',
    })
    ;(harness.initializeQueueAuthority as any).mockImplementation(async (input: { heldItemId: string }) => ({
      status: 'already_created',
      heldItemId: input.heldItemId,
      queueState: 'recovery_attempt_running',
      authorityVersion: first.attempt.record.heldItemPersistedVersion,
    }))

    const replay = await runHeldRecoveryProductionInitiation({ jobId: JOB_ID }, harness.deps)
    expect(replay).toMatchObject({
      status: 'deferred_reconstruction_admitted',
      heldItemId: first.heldItemId,
      opportunityId: first.opportunityId,
      attempt: { status: 'already_recorded' },
      queueAuthority: { status: 'already_created' },
    })
    expect(harness.attempts).toHaveLength(1)
  })

  it('requires the completed durable proof marker before any recovery write', async () => {
    const harness = dependencies()
    harness.deps.loadProofJobContext = async () => null
    await expect(runHeldRecoveryProductionInitiation({ jobId: JOB_ID }, harness.deps))
      .resolves.toEqual({
        status: 'proof_job_not_ready',
        reason: 'complete marked proof job authority is unavailable',
      })
    expect(harness.recordDeferredAttemptAndEnqueue).not.toHaveBeenCalled()
    expect(harness.initializeQueueAuthority).not.toHaveBeenCalled()
  })
})

describe('initial queue authority migration', () => {
  const migration = fs.readFileSync(path.join(
    process.cwd(),
    'supabase/migrations/20260719233000_create_held_recovery_initial_queue_authority.sql',
  ), 'utf8')

  it('requires a deferred attempt and its paired work before queue creation', () => {
    expect(migration).toMatch(/from public\.held_recovery_attempts[\s\S]*idempotency_key = v_deferred_attempt_idempotency_key/i)
    expect(migration).toMatch(/from public\.held_recovery_reconstruction_work_items[\s\S]*originating_attempt_id = v_attempt\.id/i)
    expect(migration).toMatch(/runtime_outcome_status <> 'deferred'/i)
    expect(migration).toMatch(/insert into public\.held_recovery_queue_items/i)
    expect(migration).toMatch(/'recovery_attempt_running'/i)
  })

  it('is identity-idempotent, precision-safe, unique per job/opportunity, and service-role only', () => {
    expect(migration).toMatch(/manuscript_id::text/i)
    expect(migration).toMatch(/\^\(0\|\[1-9\]\[0-9\]\*\)\$/i)
    expect(migration).toMatch(/create unique index[\s\S]*evaluation_job_id, opportunity_id/i)
    expect(migration).toMatch(/'already_created'/i)
    expect(migration).toMatch(/revoke all[\s\S]*from authenticated/i)
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i)
  })

  it('exposes one resumable completed handoff until terminal reclassification', () => {
    expect(migration).toContain('get_completed_held_recovery_reconstruction_for_opportunities')
    expect(migration).toMatch(/p_evaluation_job_id text[\s\S]*q\.evaluation_job_id = btrim\(p_evaluation_job_id\)/i)
    expect(migration).toMatch(/q\.opportunity_id = w\.opportunity_id/i)
    expect(migration).toMatch(/q\.manuscript_id = w\.manuscript_id/i)
    expect(migration).toMatch(/w\.status = 'completed'[\s\S]*q\.queue_state <> 'reclassified'/i)
    expect(migration).toMatch(/v_count <> 1[\s\S]*'ambiguous_completed_work'/i)
    expect(migration).toMatch(/details ->> 'completion_fingerprint'/i)
  })
})
