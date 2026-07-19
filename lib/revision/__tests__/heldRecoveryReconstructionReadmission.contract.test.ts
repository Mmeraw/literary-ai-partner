import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'
import {
  defaultAnchorFingerprint,
  ReadmissionContractError,
  runHeldRecoveryReconstructionReadmission,
  type AdmissionOpportunityLoadResult,
  type ReadmissionDependencies,
} from '@/lib/revision/heldRecoveryReconstructionReadmission'
import { fingerprintReconstructedAnchorAuthority } from '@/lib/revision/heldRecoveryReconstructionWorker'
import { revisionOpportunityVersionFor } from '@/lib/revision/heldRecoveryVersioning'
import { runWorkbenchAdmissionGate, type WorkbenchAdmissionInput } from '@/lib/revision/reviseAdmissionGate'
import type { ApplyAnchorCasResult } from '@/lib/revision/heldRecoveryAnchorCasWriter'
import type { ReconstructedAnchorRecord } from '@/lib/revision/heldRecoveryReconstructedAnchorLoader'

const JOB_ID = 'job-1'
const HELD_ITEM_ID = 'held-1'
const OPPORTUNITY_ID = 'opportunity-1'
const MANUSCRIPT_ID = '9007199254740993'
const MANUSCRIPT_SHA = 'manuscript-sha'
const HELD_VERSION = 'held-version-1'
const LEDGER_HASH = 'ledger-hash'
const OLD_EVIDENCE = 'old evidence'
const OLD_COORDINATES = 'old coordinates'
const NEW_EVIDENCE = 'canonical reconstructed evidence'
const NEW_COORDINATES = 'chapter 2, paragraph 4'

const heldItem = {
  heldItemId: HELD_ITEM_ID,
  opportunityId: OPPORTUNITY_ID,
  reason: { code: 'ANCHOR', source: 'test' } as never,
  producer: 'test' as never,
  persistedVersion: HELD_VERSION,
  manuscriptId: MANUSCRIPT_ID,
  manuscriptVersionSha: MANUSCRIPT_SHA,
}

function opportunity(evidenceAnchor: string, manuscriptCoordinates: string) {
  return {
    opportunityId: OPPORTUNITY_ID,
    ledgerSourceHash: LEDGER_HASH,
    sourceText: 'canonical source text',
    evidenceAnchor,
    manuscriptCoordinates,
    diagnostic: {
      symptom: 'A sufficiently long symptom',
      cause: 'A sufficiently long cause',
      fix_direction: 'Replace the passage precisely',
      reader_effect: 'A sufficiently clear reader effect',
    },
  }
}

const reconstructionBase = {
  id: 'reconstruction-row-1',
  heldItemId: HELD_ITEM_ID,
  opportunityId: OPPORTUNITY_ID,
  manuscriptId: MANUSCRIPT_ID,
  manuscriptVersionSha: MANUSCRIPT_SHA,
  heldItemPersistedVersion: HELD_VERSION,
  recoveryMethod: 'source_text_location_only' as const,
  sourceHash: 'source-hash',
  sourceStartOffset: 10,
  sourceEndOffset: 20,
  evidenceAnchor: NEW_EVIDENCE,
  manuscriptCoordinates: NEW_COORDINATES,
}

const validCompletionFingerprint = fingerprintReconstructedAnchorAuthority({
  manuscriptId: MANUSCRIPT_ID,
  manuscriptVersionSha: MANUSCRIPT_SHA,
  heldItemPersistedVersion: HELD_VERSION,
  sourceHash: reconstructionBase.sourceHash,
  sourceStartOffset: reconstructionBase.sourceStartOffset,
  sourceEndOffset: reconstructionBase.sourceEndOffset,
  recoveryMethod: reconstructionBase.recoveryMethod,
})

const reconstruction: ReconstructedAnchorRecord = {
  ...reconstructionBase,
  completionFingerprint: validCompletionFingerprint,
}

function admissionInput(
  overrides: Partial<WorkbenchAdmissionInput> = {},
): WorkbenchAdmissionInput {
  return {
    id: OPPORTUNITY_ID,
    readiness: 'ready_for_revise',
    groundingStatus: 'supported_after_relook',
    preflightStatus: 'passed',
    contextQuality: 'clean',
    anchor: NEW_COORDINATES,
    quoteHighlight: NEW_EVIDENCE,
    quoteRest: '',
    symptom: 'A sufficiently long symptom',
    cause: 'A sufficiently long distinct cause',
    fixDirection: 'Replace the passage precisely',
    readerEffect: 'A sufficiently clear reader effect',
    revisionOperation: 'replace_selected_passage',
    mode: 'direct-rewrite',
    options: [
      { key: 'A', candidateText: 'A specific replacement sentence.' },
      { key: 'B', candidateText: 'A second specific replacement sentence.' },
      { key: 'C', candidateText: 'A third specific replacement sentence.' },
    ],
    ...overrides,
  }
}

function makeLoaders(args: {
  before?: ReturnType<typeof opportunity>
  after?: ReturnType<typeof opportunity>
  afterHeldItem?: typeof heldItem
} = {}) {
  const before = args.before ?? opportunity(OLD_EVIDENCE, OLD_COORDINATES)
  const after = args.after ?? opportunity(NEW_EVIDENCE, NEW_COORDINATES)
  const loadHeldItem = jest
    .fn()
    .mockResolvedValueOnce({ status: 'loaded', value: heldItem } as never)
    .mockResolvedValue({ status: 'loaded', value: args.afterHeldItem ?? heldItem } as never)
  const loadOpportunityLedger = jest
    .fn()
    .mockResolvedValueOnce({ status: 'loaded', value: before } as never)
    .mockResolvedValue({ status: 'loaded', value: after } as never)
  const loaders = { loadHeldItem, loadOpportunityLedger } as unknown as ReadmissionDependencies['loaders']
  return { loaders, loadHeldItem, loadOpportunityLedger }
}

function casResult(status: 'anchor_updated' | 'unchanged'): ApplyAnchorCasResult {
  const common = {
    status,
    jobId: JOB_ID,
    opportunityId: OPPORTUNITY_ID,
    opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
    anchorFingerprint: 'new-fingerprint',
    ledgerSourceHash: LEDGER_HASH,
  }
  return status === 'anchor_updated'
    ? {
        ...common,
        status,
        previousAnchorFingerprint: 'old-fingerprint',
        evidenceAnchor: NEW_EVIDENCE,
        manuscriptCoordinates: NEW_COORDINATES,
      }
    : { ...common, status }
}

function makeDependencies(args: {
  loaders?: ReturnType<typeof makeLoaders>['loaders']
  loadedReconstruction?: ReconstructedAnchorRecord | null
  cas?: ApplyAnchorCasResult
  admission?: AdmissionOpportunityLoadResult
} = {}) {
  const loadReconstructedAnchor = jest.fn<ReadmissionDependencies['loadReconstructedAnchor']>(
    async () =>
      args.loadedReconstruction === null
        ? ({ status: 'missing' } as const)
        : ({ status: 'loaded', value: args.loadedReconstruction ?? reconstruction } as const),
  )
  const applyAnchorCas = jest.fn<ReadmissionDependencies['casWriter']['applyAnchorCas']>(
    async () => args.cas ?? casResult('anchor_updated'),
  )
  const loadAdmissionOpportunity = jest.fn<ReadmissionDependencies['loadAdmissionOpportunity']>(
    async () => args.admission ?? ({
      status: 'loaded',
      opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
      value: admissionInput(),
    } as const),
  )
  const runAdmissionGate = jest.fn<NonNullable<ReadmissionDependencies['runAdmissionGate']>>(
    () => ({
      admission_status: 'admission_passed' as const,
      reasons: [],
      passedCandidateCount: 3,
    }),
  )
  const deps: ReadmissionDependencies = {
    loaders: args.loaders ?? makeLoaders().loaders,
    loadReconstructedAnchor,
    casWriter: { applyAnchorCas },
    loadAdmissionOpportunity,
    runAdmissionGate,
  }
  return {
    deps,
    loadReconstructedAnchor,
    applyAnchorCas,
    loadAdmissionOpportunity,
    runAdmissionGate,
  }
}

const input = { jobId: JOB_ID, heldItemId: HELD_ITEM_ID, opportunityId: OPPORTUNITY_ID }

describe('Held Recovery reconstruction re-admission authority', () => {
  it('keeps caller input identity-only and loads reconstructed content by current held version', async () => {
    const setup = makeDependencies()
    await runHeldRecoveryReconstructionReadmission(input, setup.deps)
    expect(setup.loadReconstructedAnchor).toHaveBeenCalledWith({
      heldItemId: HELD_ITEM_ID,
      heldItemPersistedVersion: HELD_VERSION,
    })
    expect(Object.keys(input).sort()).toEqual(['heldItemId', 'jobId', 'opportunityId'])
  })

  it('preserves the canonical manuscript id beyond 2^53 when verifying completion authority', async () => {
    const setup = makeDependencies()
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toMatchObject({
      status: 'admitted',
    })
    expect(Number(MANUSCRIPT_ID)).toBe(Number('9007199254740992'))
    expect(setup.applyAnchorCas).toHaveBeenCalledTimes(1)
  })

  it('rejects a missing persisted reconstruction without calling CAS or admission', async () => {
    const setup = makeDependencies({ loadedReconstruction: null })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toEqual({
      status: 'rejected_stale',
      reason: 'reconstruction_missing',
    })
    expect(setup.applyAnchorCas).not.toHaveBeenCalled()
    expect(setup.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('rejects a completion-fingerprint mismatch without calling CAS', async () => {
    const setup = makeDependencies({
      loadedReconstruction: { ...reconstruction, completionFingerprint: 'wrong' },
    })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toEqual({
      status: 'rejected_stale',
      reason: 'completion_fingerprint_mismatch',
    })
    expect(setup.applyAnchorCas).not.toHaveBeenCalled()
  })

  it.each([
    ['held item', { heldItemId: 'other-held' }],
    ['opportunity', { opportunityId: 'other-opportunity' }],
    ['manuscript', { manuscriptId: '9007199254740992' }],
    ['manuscript version', { manuscriptVersionSha: 'other-sha' }],
    ['held version', { heldItemPersistedVersion: 'other-version' }],
  ])('fails closed on reconstructed %s identity mismatch', async (_label, patch) => {
    const setup = makeDependencies({
      loadedReconstruction: { ...reconstruction, ...patch },
    })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toBeInstanceOf(
      ReadmissionContractError,
    )
    expect(setup.applyAnchorCas).not.toHaveBeenCalled()
  })

  it('writes only the canonical persisted anchor through CAS', async () => {
    const setup = makeDependencies()
    await runHeldRecoveryReconstructionReadmission(input, setup.deps)
    expect(setup.applyAnchorCas).toHaveBeenCalledWith(
      expect.objectContaining({
        newEvidenceAnchor: NEW_EVIDENCE,
        newManuscriptCoordinates: NEW_COORDINATES,
      }),
    )
  })

  it('uses the exact SQL-parity fingerprint over the currently stored anchor as the CAS guard', async () => {
    const setup = makeDependencies()
    await runHeldRecoveryReconstructionReadmission(input, setup.deps)
    const expected = createHash('sha256')
      .update(
        JSON.stringify({
          boundary: 'held_recovery_anchor_fingerprint_v1',
          opportunity_id: OPPORTUNITY_ID,
          ledger_source_hash: LEDGER_HASH,
          evidence_anchor: OLD_EVIDENCE,
          manuscript_coordinates: OLD_COORDINATES,
        }),
      )
      .digest('hex')
    expect(defaultAnchorFingerprint({
      opportunityId: OPPORTUNITY_ID,
      ledgerSourceHash: LEDGER_HASH,
      evidenceAnchor: OLD_EVIDENCE,
      manuscriptCoordinates: OLD_COORDINATES,
    })).toBe(expected)
    expect(setup.applyAnchorCas).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAnchorFingerprint: expected }),
    )
  })
})

describe('Held Recovery reconstruction re-admission post-CAS integrity', () => {
  it('returns a bounded persistence conflict and never loads admission state', async () => {
    const setup = makeDependencies({
      cas: { status: 'persistence_conflict', reason: 'anchor_fingerprint_conflict', message: 'conflict' },
    })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toEqual({
      status: 'persistence_conflict',
      reason: 'anchor_fingerprint_conflict',
    })
    expect(setup.loadAdmissionOpportunity).not.toHaveBeenCalled()
  })

  it('fails closed when CAS says anchor_updated but the reloaded anchor is old', async () => {
    const loaders = makeLoaders({ after: opportunity(OLD_EVIDENCE, OLD_COORDINATES) }).loaders
    const setup = makeDependencies({ loaders })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toThrow(
      /post-CAS canonical anchor does not match persisted reconstruction after anchor_updated/,
    )
    expect(setup.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('fails closed when CAS says unchanged but the reloaded anchor is still old', async () => {
    const loaders = makeLoaders({ after: opportunity(OLD_EVIDENCE, OLD_COORDINATES) }).loaders
    const setup = makeDependencies({ loaders, cas: casResult('unchanged') })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toThrow(
      /post-CAS canonical anchor does not match persisted reconstruction after unchanged/,
    )
    expect(setup.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('accepts CAS unchanged only when the reloaded anchor equals persisted reconstruction', async () => {
    const setup = makeDependencies({ cas: casResult('unchanged') })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toMatchObject({
      status: 'admitted',
      anchorChanged: true,
    })
  })

  it('rejects a held-item version change before admission', async () => {
    const afterHeldItem = { ...heldItem, persistedVersion: 'held-version-2' }
    const loaders = makeLoaders({ afterHeldItem }).loaders
    const setup = makeDependencies({ loaders })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toEqual({
      status: 'rejected_stale',
      reason: 'held_item_version_changed',
    })
    expect(setup.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('fails closed when the CAS opportunity version disagrees with the canonical reload', async () => {
    const badCas = { ...casResult('anchor_updated'), opportunityVersion: 'wrong-version' }
    const setup = makeDependencies({ cas: badCas })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toThrow(
      /CAS result does not match reloaded opportunity authority/,
    )
  })
})

describe('Held Recovery reconstruction re-admission uses fully hydrated admission state', () => {
  it('passes candidates, readiness, context, grounding, and diagnostics through unchanged', async () => {
    const hydrated = admissionInput()
    const setup = makeDependencies({ admission: {
      status: 'loaded',
      opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
      value: hydrated,
    } })
    await runHeldRecoveryReconstructionReadmission(input, setup.deps)
    expect(setup.runAdmissionGate).toHaveBeenCalledWith(hydrated)
    expect(setup.runAdmissionGate.mock.calls[0][0].options).toHaveLength(3)
  })

  it('fails closed when hydrated evidence differs from canonical post-CAS evidence', async () => {
    const setup = makeDependencies({
      admission: {
        status: 'loaded',
        opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
        value: admissionInput({ quoteHighlight: 'substituted evidence' }),
      },
    })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toThrow(
      /admission opportunity evidence does not match reloaded canonical state/,
    )
    expect(setup.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('fails closed when hydrated coordinates differ from canonical post-CAS coordinates', async () => {
    const setup = makeDependencies({
      admission: {
        status: 'loaded',
        opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
        value: admissionInput({ anchor: 'substituted coordinates' }),
      },
    })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toThrow(
      /admission opportunity coordinates do not match reloaded canonical state/,
    )
  })

  it('fails closed when hydrated admission state belongs to another opportunity version', async () => {
    const setup = makeDependencies({
      admission: {
        status: 'loaded',
        opportunityVersion: 'stale-opportunity-version',
        value: admissionInput(),
      },
    })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).rejects.toThrow(
      /admission opportunity version does not match reloaded canonical state/,
    )
    expect(setup.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('proves the real admission gate withholds an otherwise hydrated item when candidates are absent', () => {
    const result = runWorkbenchAdmissionGate(admissionInput({ options: [] }))
    expect(result.admission_status).toBe('withheld')
    expect(result.passedCandidateCount).toBe(0)
  })

  it('returns unchanged and skips CAS when canonical opportunity already has the reconstruction', async () => {
    const loaders = makeLoaders({
      before: opportunity(NEW_EVIDENCE, NEW_COORDINATES),
      after: opportunity(NEW_EVIDENCE, NEW_COORDINATES),
    }).loaders
    const setup = makeDependencies({ loaders })
    await expect(runHeldRecoveryReconstructionReadmission(input, setup.deps)).resolves.toMatchObject({
      status: 'unchanged',
    })
    expect(setup.applyAnchorCas).not.toHaveBeenCalled()
    expect(setup.runAdmissionGate).toHaveBeenCalledTimes(1)
  })

  it('contains no production wiring or downstream classification/transition authority', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/revision/heldRecoveryReconstructionReadmission.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/createAdminClient|createSupabaseClient/)
    expect(source).not.toMatch(/from ['"].*(?:Classification|QueueTransition)/)
    expect(source).not.toMatch(/\b(?:applyHeldQueueTransition|queueTransitionPersistence)\s*\(/)
    expect(source).not.toMatch(/RunReadmissionInput[\s\S]{0,200}reconstructedAnchor/)
  })
})
