import fs from 'node:fs'
import path from 'node:path'
import {
  createSupabaseHeldRecoveryReconstructionPersistenceAdapter,
} from '@/lib/revision/heldRecoveryReconstructionWriter'
import {
  loadResumableCompletedWork,
  runHeldRecoveryReconstructionProductionContinuation,
} from '@/lib/revision/heldRecoveryReconstructionProductionCaller'
import { fingerprintReconstructedAnchorAuthority } from '@/lib/revision/heldRecoveryReconstructionWorker'
import { loadHeldRecoveryProofJobContext } from '@/lib/revision/heldRecoveryProofJobAuthority'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('Held Recovery production reachability', () => {
  const workerRoute = read('app/api/workers/process-evaluations/route.ts')
  const proofRoute = read('app/api/admin/proof/jobs/route.ts')
  const store = read('lib/jobs/jobStore.supabase.ts')
  const memoryStore = read('lib/jobs/jobStore.memory.ts')
  const caller = read('lib/revision/heldRecoveryReconstructionProductionCaller.ts')

  it('is imported and invoked by the existing exact-job evaluation worker', () => {
    expect(workerRoute).toContain("from '@/lib/revision/heldRecoveryProductionInitiationCaller'")
    expect(workerRoute).toContain("from '@/lib/revision/heldRecoveryReconstructionProductionCaller'")
    expect(workerRoute).toMatch(
      /if \(targetJobId\)[\s\S]*runHeldRecoveryProductionInitiation\(\{[\s\S]*runHeldRecoveryReconstructionProductionContinuation\(\{/,
    )
    expect(workerRoute).toContain('process.env[HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG]')
    expect(workerRoute).toMatch(/'x-job-id': targetJobId/)
  })

  it('remains a strict no-op unless the deployed exact-job target matches', async () => {
    const previous = process.env.HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_ID
    delete process.env.HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_ID
    try {
      await expect(runHeldRecoveryReconstructionProductionContinuation({
        jobId: 'job-disabled',
        workerId: 'production:held-recovery:test',
      })).resolves.toEqual({ status: 'target_disabled' })
    } finally {
      if (previous === undefined) delete process.env.HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_ID
      else process.env.HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_ID = previous
    }
  })

  it('requires the durable completed proof marker in addition to the exact env target', async () => {
    const rpc = jest.fn(async () => ({
      error: null,
      data: {
        status: 'loaded',
        job_id: 'job-1',
        job_status: 'complete',
        phase_status: 'complete',
        manuscript_id: '9007199254740993',
        user_id: 'proof-user',
        proof_target: false,
      },
    }))
    await expect(loadHeldRecoveryProofJobContext({ rpc } as never, 'job-1'))
      .resolves.toBeNull()
    expect(rpc).toHaveBeenCalledWith('get_held_recovery_proof_job_context', {
      p_job_id: 'job-1',
    })
  })

  it('preserves proof manuscript identity as precision-safe text', async () => {
    const rpc = jest.fn(async () => ({
      error: null,
      data: {
        status: 'loaded',
        job_id: 'job-1',
        job_status: 'complete',
        phase_status: 'complete',
        manuscript_id: '9007199254740993',
        user_id: 'proof-user',
        proof_target: true,
      },
    }))
    await expect(loadHeldRecoveryProofJobContext({ rpc } as never, 'job-1'))
      .resolves.toEqual({
        jobId: 'job-1',
        manuscriptId: '9007199254740993',
        userId: 'proof-user',
      })
  })

  it('creates the proof job atomically non-claimable and releases only after exact-job deployment', () => {
    expect(store).toContain('phase_status: JOB_STATUS.QUEUED')
    expect(store).toContain("phase_status: 'awaiting_approval'")
    expect(store).toContain('held_recovery_proof_hold: true')
    expect(store).toContain('held_recovery_proof_target: true')
    expect(memoryStore).toContain('held_recovery_proof_target: true')
    expect(store).not.toContain("{ phase_status: 'awaiting_approval', held_recovery_proof_hold: true }")
    expect(proofRoute).toContain('hold_for_held_recovery_proof')
    expect(proofRoute).toContain('release_held_recovery_proof')
    expect(proofRoute).toContain('targetJobId !== jobId')
    expect(proofRoute).toContain('heldProgress.held_recovery_proof_hold !== true')
    expect(proofRoute).toContain('.contains("progress", { held_recovery_proof_hold: true })')
    expect(proofRoute).toMatch(/\.eq\("phase_status", "awaiting_approval"\)/)
    expect(proofRoute).toMatch(/phase_status: "queued"/)
  })

  it('loads admission through the existing fully hydrated Workbench projection', () => {
    expect(caller).toContain('getWorkbenchQueueForHeldRecoveryReadmission')
    expect(caller).not.toContain('runCopyPasteAdmissionGate')
    expect(caller).not.toContain('runStrategyAdmissionGate')
    expect(caller).not.toContain('heldRecoveryQueueTransition')
  })

  it('resumes a completed reconstruction after a process death before persistence', async () => {
    const authority = {
      manuscriptId: '9007199254740993',
      manuscriptVersionSha: 'manuscript-version',
      heldItemPersistedVersion: 'held-version',
      sourceHash: 'source-hash',
      sourceStartOffset: 10,
      sourceEndOffset: 20,
      recoveryMethod: 'source_text_location_only' as const,
    }
    const completionFingerprint = fingerprintReconstructedAnchorAuthority(authority)
    const rpc = jest.fn(async () => ({
      error: null,
      data: {
        status: 'loaded',
        work_item_id: 'work-1',
        held_item_id: 'held-1',
        opportunity_id: 'op-1',
        manuscript_id: authority.manuscriptId,
        manuscript_version_sha: authority.manuscriptVersionSha,
        held_item_persisted_version: authority.heldItemPersistedVersion,
        source_hash: authority.sourceHash,
        source_start_offset: authority.sourceStartOffset,
        source_end_offset: authority.sourceEndOffset,
        recovery_method: authority.recoveryMethod,
        completion_fingerprint: completionFingerprint,
      },
    }))
    await expect(loadResumableCompletedWork({ rpc } as never, 'job-1', ['op-1']))
      .resolves.toEqual({
        work: expect.objectContaining({ workItemId: 'work-1', opportunityId: 'op-1' }),
        authority: { ...authority, completionFingerprint },
      })
    expect(rpc).toHaveBeenCalledWith(
      'get_completed_held_recovery_reconstruction_for_opportunities',
      {
        p_evaluation_job_id: 'job-1',
        p_opportunity_ids: ['op-1'],
      },
    )
  })

  it('fails closed when completed reconstruction authority has drifted', async () => {
    const rpc = jest.fn(async () => ({
      error: null,
      data: {
        status: 'loaded',
        work_item_id: 'work-1',
        held_item_id: 'held-1',
        opportunity_id: 'op-1',
        manuscript_id: '1',
        manuscript_version_sha: 'version',
        held_item_persisted_version: 'held-version',
        source_hash: 'source-hash',
        source_start_offset: 1,
        source_end_offset: 2,
        recovery_method: 'source_text_location_only',
        completion_fingerprint: 'forged',
      },
    }))
    await expect(loadResumableCompletedWork({ rpc } as never, 'job-1', ['op-1']))
      .rejects.toThrow(/fingerprint mismatch/)
  })

  it('fails closed when completed reconstruction returns a foreign opportunity', async () => {
    const authority = {
      manuscriptId: '1',
      manuscriptVersionSha: 'version',
      heldItemPersistedVersion: 'held-version',
      sourceHash: 'source-hash',
      sourceStartOffset: 1,
      sourceEndOffset: 2,
      recoveryMethod: 'source_text_location_only' as const,
    }
    const rpc = jest.fn(async () => ({
      error: null,
      data: {
        status: 'loaded',
        work_item_id: 'work-1',
        held_item_id: 'held-1',
        opportunity_id: 'foreign-opportunity',
        manuscript_id: authority.manuscriptId,
        manuscript_version_sha: authority.manuscriptVersionSha,
        held_item_persisted_version: authority.heldItemPersistedVersion,
        source_hash: authority.sourceHash,
        source_start_offset: authority.sourceStartOffset,
        source_end_offset: authority.sourceEndOffset,
        recovery_method: authority.recoveryMethod,
        completion_fingerprint: fingerprintReconstructedAnchorAuthority(authority),
      },
    }))
    await expect(loadResumableCompletedWork({ rpc } as never, 'job-1', ['op-1']))
      .rejects.toThrow(/foreign opportunity/)
  })
})

describe('targeted reconstruction claim authority', () => {
  const migration = read(
    'supabase/migrations/20260719220000_create_targeted_held_recovery_reconstruction_claim.sql',
  )

  it('filters before FOR UPDATE SKIP LOCKED and keeps service-role-only permissions', () => {
    expect(migration).toMatch(/where w\.opportunity_id = any\(v_opportunity_ids\)[\s\S]*for update skip locked/i)
    expect(migration).toContain('claim_held_recovery_reconstruction_work_for_opportunities_atomic')
    expect(migration).toMatch(/revoke all[\s\S]*from authenticated/i)
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i)
    expect(migration).toMatch(/create unique index[\s\S]*evaluation_jobs_one_held_recovery_proof_hold_idx/i)
    expect(migration).toMatch(/held_recovery_proof_hold'[\s\S]*= 'true'/i)
    expect(migration).not.toMatch(/insert into public\.held_recovery_reconstruction_work_items/i)
    expect(migration).not.toMatch(/held_recovery_queue_transition/i)
  })

  it('uses the target-filtered RPC when opportunity identities are supplied', async () => {
    const rpc = jest.fn(async () => ({ data: { status: 'no_work_available' }, error: null }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(
      { rpc } as never,
      { opportunityIds: ['op-1', 'op-2'] },
    )
    await expect(adapter.claimNext({ workerId: 'worker-1', leaseSeconds: 90 }))
      .resolves.toEqual({ status: 'no_work_available' })
    expect(rpc).toHaveBeenCalledWith(
      'claim_held_recovery_reconstruction_work_for_opportunities_atomic',
      {
        p_worker_id: 'worker-1',
        p_lease_seconds: 90,
        p_opportunity_ids: ['op-1', 'op-2'],
      },
    )
  })
})
