import fs from 'node:fs'
import path from 'node:path'
import {
  createSupabaseHeldRecoveryReconstructionPersistenceAdapter,
} from '@/lib/revision/heldRecoveryReconstructionWriter'
import { runHeldRecoveryReconstructionProductionContinuation } from '@/lib/revision/heldRecoveryReconstructionProductionCaller'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('Held Recovery production reachability', () => {
  const workerRoute = read('app/api/workers/process-evaluations/route.ts')
  const proofRoute = read('app/api/admin/proof/jobs/route.ts')
  const store = read('lib/jobs/jobStore.supabase.ts')
  const caller = read('lib/revision/heldRecoveryReconstructionProductionCaller.ts')

  it('is imported and invoked by the existing exact-job evaluation worker', () => {
    expect(workerRoute).toContain("from '@/lib/revision/heldRecoveryReconstructionProductionCaller'")
    expect(workerRoute).toMatch(
      /if \(targetJobId\)[\s\S]*runHeldRecoveryReconstructionProductionContinuation\(\{[\s\S]*jobId: targetJobId/,
    )
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

  it('creates the proof job atomically non-claimable and releases only after exact-job deployment', () => {
    expect(store).toContain('phase_status: JOB_STATUS.QUEUED')
    expect(store).toContain("phase_status: 'awaiting_approval'")
    expect(store).toContain('held_recovery_proof_hold: true')
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
