import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'
import type { ApplyAnchorCasResult } from '@/lib/revision/heldRecoveryAnchorCasWriter'
import type { BuildReconstructedAnchorContentInput } from '@/lib/revision/heldRecoveryReconstructedAnchorContent'
import type { ReconstructedAnchorRecord } from '@/lib/revision/heldRecoveryReconstructedAnchorLoader'
import type { ReconstructedAnchorInsertResult } from '@/lib/revision/heldRecoveryReconstructedAnchorWriter'
import {
  HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG,
  isHeldRecoveryReconstructionReadmissionEnabledForJob,
  persistReconstructedAnchorAndReadmit,
  runHeldRecoveryReconstructionReadmissionCaller,
  type HeldRecoveryReadmissionAuditEvent,
} from '@/lib/revision/heldRecoveryReconstructionReadmissionCaller'
import type { ReadmissionDependencies } from '@/lib/revision/heldRecoveryReconstructionReadmission'
import { fingerprintReconstructedAnchorAuthority } from '@/lib/revision/heldRecoveryReconstructionWorker'
import { sourceHashForCanonicalChunkContent } from '@/lib/revision/heldRecoveryRuntimeInputs'
import { revisionOpportunityVersionFor, sourceHashFor } from '@/lib/revision/heldRecoveryVersioning'
import type { WorkbenchAdmissionInput } from '@/lib/revision/reviseAdmissionGate'

const JOB_ID = 'job-controlled-live-proof'
const HELD_ITEM_ID = 'held-1'
const OPPORTUNITY_ID = 'opportunity-1'
const MANUSCRIPT_ID = '9007199254740993'
const MANUSCRIPT_SHA = 'manuscript-sha'
const HELD_VERSION = 'held-version-1'
const LEDGER_HASH = 'ledger-source-hash'
const OLD_EVIDENCE = 'old canonical evidence'
const OLD_COORDINATES = 'old canonical coordinates'
const NEW_EVIDENCE = 'reconstructed canonical evidence'
const NEW_COORDINATES = 'chapter 2, paragraph 4'
const SOURCE_TEXT = `Before ${NEW_EVIDENCE} after.`
const SOURCE_START = SOURCE_TEXT.indexOf(NEW_EVIDENCE)
const SOURCE_END = SOURCE_START + NEW_EVIDENCE.length
const SOURCE_HASH = sourceHashFor({ source_text: SOURCE_TEXT })
const PERSISTENCE_FLAG = 'HELD_RECOVERY_RECONSTRUCTED_ANCHOR_PERSISTENCE_ENABLED'

const completionFingerprint = fingerprintReconstructedAnchorAuthority({
  manuscriptId: MANUSCRIPT_ID,
  manuscriptVersionSha: MANUSCRIPT_SHA,
  heldItemPersistedVersion: HELD_VERSION,
  sourceHash: SOURCE_HASH,
  sourceStartOffset: SOURCE_START,
  sourceEndOffset: SOURCE_END,
  recoveryMethod: 'source_text_location_only',
})

function reconstructionInput(
  overrides: Partial<BuildReconstructedAnchorContentInput> = {},
): BuildReconstructedAnchorContentInput {
  return {
    authority: {
      manuscriptId: MANUSCRIPT_ID,
      manuscriptVersionSha: MANUSCRIPT_SHA,
      heldItemPersistedVersion: HELD_VERSION,
      sourceHash: SOURCE_HASH,
      sourceStartOffset: SOURCE_START,
      sourceEndOffset: SOURCE_END,
      recoveryMethod: 'source_text_location_only',
      completionFingerprint,
    },
    canonicalSource: {
      manuscriptId: MANUSCRIPT_ID,
      manuscriptVersionSha: MANUSCRIPT_SHA,
      text: SOURCE_TEXT,
    },
    chunk: {
      chunkId: 'chunk-0',
      manuscriptId: MANUSCRIPT_ID,
      manuscriptVersionSha: MANUSCRIPT_SHA,
      contentAbsoluteStart: 0,
      contentAbsoluteEnd: SOURCE_TEXT.length,
      content: SOURCE_TEXT,
      contentHash: sourceHashForCanonicalChunkContent(SOURCE_TEXT),
    },
    canonicalManuscriptCoordinates: NEW_COORDINATES,
    ...overrides,
  }
}

function persistenceInput(reconstruction = reconstructionInput()) {
  return {
    heldItemId: HELD_ITEM_ID,
    opportunityId: OPPORTUNITY_ID,
    expectedAuthorityVersion: 'queue-authority-v1',
    reconstruction,
  }
}

function insertedResult(status: 'inserted' | 'already_applied' = 'inserted') {
  return {
    status,
    row: {
      id: 'reconstructed-anchor-1',
      heldItemId: HELD_ITEM_ID,
      heldItemPersistedVersion: HELD_VERSION,
      completionFingerprint,
    },
  } as const
}

function reconstructionRecord(
  overrides: Partial<ReconstructedAnchorRecord> = {},
): ReconstructedAnchorRecord {
  return {
    id: 'reconstructed-anchor-1',
    heldItemId: HELD_ITEM_ID,
    opportunityId: OPPORTUNITY_ID,
    manuscriptId: MANUSCRIPT_ID,
    manuscriptVersionSha: MANUSCRIPT_SHA,
    heldItemPersistedVersion: HELD_VERSION,
    sourceHash: SOURCE_HASH,
    sourceStartOffset: SOURCE_START,
    sourceEndOffset: SOURCE_END,
    recoveryMethod: 'source_text_location_only',
    evidenceAnchor: NEW_EVIDENCE,
    manuscriptCoordinates: NEW_COORDINATES,
    completionFingerprint,
    ...overrides,
  }
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
    symptom: 'A sufficiently detailed observable symptom',
    cause: 'A sufficiently detailed and distinct causal mechanism',
    fixDirection: 'Replace the passage with a precise local repair',
    readerEffect: 'The reader can follow the intended change clearly',
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

function readmissionSetup(options: {
  reconstruction?: ReconstructedAnchorRecord
  admissionOpportunityVersion?: string
  admission?: WorkbenchAdmissionInput
  heldVersionAfter?: string
} = {}) {
  let evidenceAnchor = OLD_EVIDENCE
  let manuscriptCoordinates = OLD_COORDINATES
  let loadCount = 0

  const heldItem = (persistedVersion = HELD_VERSION) => ({
    heldItemId: HELD_ITEM_ID,
    opportunityId: OPPORTUNITY_ID,
    reason: { code: 'ANCHOR', source: 'test' } as never,
    producer: 'test' as never,
    persistedVersion,
    manuscriptId: MANUSCRIPT_ID,
    manuscriptVersionSha: MANUSCRIPT_SHA,
  })
  const canonicalOpportunity = () => ({
    opportunityId: OPPORTUNITY_ID,
    ledgerSourceHash: LEDGER_HASH,
    sourceText: SOURCE_TEXT,
    evidenceAnchor,
    manuscriptCoordinates,
  })

  const loadHeldItem = jest.fn(async () => {
    loadCount += 1
    const persistedVersion = loadCount > 1 && options.heldVersionAfter
      ? options.heldVersionAfter
      : HELD_VERSION
    return { status: 'loaded', value: heldItem(persistedVersion) } as const
  })
  const loadOpportunityLedger = jest.fn(async () => ({
    status: 'loaded' as const,
    value: canonicalOpportunity(),
  }))
  const loadReconstructedAnchor = jest.fn<ReadmissionDependencies['loadReconstructedAnchor']>(
    async () => ({
      status: 'loaded',
      value: options.reconstruction ?? reconstructionRecord(),
    }),
  )
  const applyAnchorCas = jest.fn<ReadmissionDependencies['casWriter']['applyAnchorCas']>(
    async () => {
      evidenceAnchor = NEW_EVIDENCE
      manuscriptCoordinates = NEW_COORDINATES
      return {
        status: 'anchor_updated',
        jobId: JOB_ID,
        opportunityId: OPPORTUNITY_ID,
        opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
        anchorFingerprint: 'new-anchor-fingerprint',
        previousAnchorFingerprint: 'old-anchor-fingerprint',
        ledgerSourceHash: LEDGER_HASH,
        evidenceAnchor: NEW_EVIDENCE,
        manuscriptCoordinates: NEW_COORDINATES,
      } satisfies ApplyAnchorCasResult
    },
  )
  const loadAdmissionOpportunity = jest.fn<ReadmissionDependencies['loadAdmissionOpportunity']>(
    async () => ({
      status: 'loaded',
      opportunityVersion:
        options.admissionOpportunityVersion ??
        revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
      value: options.admission ?? admissionInput(),
    }),
  )
  const runAdmissionGate = jest.fn<NonNullable<ReadmissionDependencies['runAdmissionGate']>>(
    () => ({
      admission_status: 'admission_passed',
      reasons: [],
      passedCandidateCount: 3,
    }),
  )
  const deps: ReadmissionDependencies = {
    loaders: { loadHeldItem, loadOpportunityLedger } as never,
    loadReconstructedAnchor,
    casWriter: { applyAnchorCas },
    loadAdmissionOpportunity,
    runAdmissionGate,
  }

  return {
    deps,
    loadHeldItem,
    loadReconstructedAnchor,
    applyAnchorCas,
    loadAdmissionOpportunity,
    runAdmissionGate,
  }
}

function persistenceAdapter(result: ReconstructedAnchorInsertResult) {
  const insertReconstructedAnchor = jest.fn(async () => result)
  return { adapter: { insertReconstructedAnchor }, insertReconstructedAnchor }
}

function callerDependencies(options: {
  persistenceResult?: ReconstructedAnchorInsertResult
  enabled?: boolean
  readmission?: ReturnType<typeof readmissionSetup>
  audit?: (event: HeldRecoveryReadmissionAuditEvent) => void
} = {}) {
  const persistence = persistenceAdapter(options.persistenceResult ?? insertedResult())
  const readmission = options.readmission ?? readmissionSetup()
  return {
    deps: {
      persistence: { adapter: persistence.adapter },
      readmission: readmission.deps,
      isEnabledForJob: () => options.enabled ?? true,
      audit: options.audit,
    },
    persistence,
    readmission,
  }
}

let persistenceFlagSnapshot: string | undefined

beforeEach(() => {
  persistenceFlagSnapshot = process.env[PERSISTENCE_FLAG]
  process.env[PERSISTENCE_FLAG] = '1'
})

afterEach(() => {
  if (persistenceFlagSnapshot === undefined) delete process.env[PERSISTENCE_FLAG]
  else process.env[PERSISTENCE_FLAG] = persistenceFlagSnapshot
})

describe('Held Recovery reconstructed-anchor Readmission feature gate', () => {
  it('enables exactly one configured evaluation job and rejects boolean/list shortcuts', () => {
    expect(isHeldRecoveryReconstructionReadmissionEnabledForJob(JOB_ID, {})).toBe(false)
    expect(isHeldRecoveryReconstructionReadmissionEnabledForJob(JOB_ID, {
      [HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG]: 'true',
    })).toBe(false)
    expect(isHeldRecoveryReconstructionReadmissionEnabledForJob(JOB_ID, {
      [HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG]: `${JOB_ID},other-job`,
    })).toBe(false)
    expect(isHeldRecoveryReconstructionReadmissionEnabledForJob(JOB_ID, {
      [HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG]: JOB_ID,
    })).toBe(true)
    expect(isHeldRecoveryReconstructionReadmissionEnabledForJob('other-job', {
      [HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG]: JOB_ID,
    })).toBe(false)
  })

  it('preserves canonical persistence and performs no Readmission when disabled', async () => {
    const setup = callerDependencies({ enabled: false })
    const result = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )

    expect(result).toMatchObject({
      status: 'readmission_gate_disabled',
      persistence: { status: 'inserted' },
    })
    expect(setup.persistence.insertReconstructedAnchor).toHaveBeenCalledTimes(1)
    expect(setup.readmission.loadHeldItem).not.toHaveBeenCalled()
    expect(setup.readmission.loadReconstructedAnchor).not.toHaveBeenCalled()
    expect(setup.readmission.runAdmissionGate).not.toHaveBeenCalled()
  })
})

describe('Held Recovery reconstructed-anchor Readmission runtime handoff', () => {
  it('invokes identity-only Readmission exactly once after canonical persistence succeeds', async () => {
    const setup = callerDependencies()
    const result = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )

    expect(result).toMatchObject({
      status: 'readmission_completed',
      persistence: { status: 'inserted' },
      readmission: { status: 'admitted' },
    })
    expect(setup.readmission.loadReconstructedAnchor).toHaveBeenCalledTimes(1)
    expect(setup.readmission.loadReconstructedAnchor).toHaveBeenCalledWith({
      heldItemId: HELD_ITEM_ID,
      heldItemPersistedVersion: HELD_VERSION,
    })
    expect(setup.readmission.loadAdmissionOpportunity).toHaveBeenCalledTimes(1)
    expect(setup.readmission.runAdmissionGate).toHaveBeenCalledTimes(1)
  })

  it('never invokes Readmission when reconstruction content fails canonical persistence', async () => {
    const invalid = reconstructionInput({
      canonicalSource: {
        manuscriptId: '123',
        manuscriptVersionSha: MANUSCRIPT_SHA,
        text: SOURCE_TEXT,
      },
    })
    const setup = callerDependencies()
    const result = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput(invalid) },
      setup.deps,
    )

    expect(result).toEqual({
      status: 'persistence_not_completed',
      persistence: {
        status: 'reconstruction_rejected',
        reason: 'manuscript_identity_mismatch',
      },
    })
    expect(setup.persistence.insertReconstructedAnchor).not.toHaveBeenCalled()
    expect(setup.readmission.loadHeldItem).not.toHaveBeenCalled()
    expect(setup.readmission.runAdmissionGate).not.toHaveBeenCalled()
  })

  it.each<ReconstructedAnchorInsertResult>([
    { status: 'rejected_missing', heldItemId: HELD_ITEM_ID },
    {
      status: 'rejected_stale',
      heldItemId: HELD_ITEM_ID,
      expectedAuthorityVersion: 'queue-authority-v1',
      actualAuthorityVersion: 'queue-authority-v2',
    },
    {
      status: 'rejected_conflict',
      heldItemId: HELD_ITEM_ID,
      heldItemPersistedVersion: HELD_VERSION,
      existingCompletionFingerprint: 'existing',
      submittedCompletionFingerprint: completionFingerprint,
    },
  ])('leaves unrelated persistence outcome $status unchanged', async (persistenceResult) => {
    const setup = callerDependencies({ persistenceResult })
    const result = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )

    expect(result).toEqual({ status: 'persistence_not_completed', persistence: persistenceResult })
    expect(setup.readmission.loadHeldItem).not.toHaveBeenCalled()
    expect(setup.readmission.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('passes fully hydrated candidates to the existing Workbench admission gate', async () => {
    const hydrated = admissionInput()
    const readmission = readmissionSetup({ admission: hydrated })
    readmission.runAdmissionGate.mockImplementation((input) => {
      expect(input).toBe(hydrated)
      expect(input.options?.map((option) => option.key)).toEqual(['A', 'B', 'C'])
      expect(input.options?.every((option) => Boolean(option.candidateText))).toBe(true)
      return { admission_status: 'admission_passed', reasons: [], passedCandidateCount: 3 }
    })
    const setup = callerDependencies({ readmission })

    await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )
    expect(readmission.runAdmissionGate).toHaveBeenCalledTimes(1)
  })

  it('replays against the same canonical opportunity without a duplicate or second CAS', async () => {
    const readmission = readmissionSetup()
    const events: HeldRecoveryReadmissionAuditEvent[] = []
    const first = callerDependencies({ readmission, audit: (event) => events.push(event) })
    const replay = callerDependencies({
      readmission,
      persistenceResult: insertedResult('already_applied'),
      audit: (event) => events.push(event),
    })

    const firstResult = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      first.deps,
    )
    const replayResult = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      replay.deps,
    )

    expect(firstResult).toMatchObject({
      status: 'readmission_completed',
      readmission: { status: 'admitted' },
    })
    expect(replayResult).toMatchObject({
      status: 'readmission_completed',
      persistence: { status: 'already_applied' },
      readmission: { status: 'unchanged' },
    })
    expect(readmission.applyAnchorCas).toHaveBeenCalledTimes(1)
    expect(readmission.loadAdmissionOpportunity).toHaveBeenCalledTimes(2)
    expect(events
      .filter((event) => event.event === 'workbench_admission_evaluated')
      .every((event) => event.duplicateOpportunityCreated === false)).toBe(true)
  })
})

describe('Held Recovery reconstructed-anchor Readmission fail-closed authority', () => {
  it('fails closed on reconstructed-anchor identity mismatch', async () => {
    const readmission = readmissionSetup({
      reconstruction: reconstructionRecord({ opportunityId: 'other-opportunity' }),
    })
    const setup = callerDependencies({ readmission })

    await expect(persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )).rejects.toThrow(/persisted reconstructed-anchor identity does not match/)
    expect(readmission.applyAnchorCas).not.toHaveBeenCalled()
    expect(readmission.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('fails closed on hydrated opportunity-version mismatch', async () => {
    const readmission = readmissionSetup({ admissionOpportunityVersion: 'stale-version' })
    const setup = callerDependencies({ readmission })

    await expect(persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )).rejects.toThrow(/admission opportunity version does not match/)
    expect(readmission.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('rejects completion-fingerprint mismatch before Workbench admission', async () => {
    const readmission = readmissionSetup({
      reconstruction: reconstructionRecord({ completionFingerprint: 'wrong-fingerprint' }),
    })
    const setup = callerDependencies({ readmission })

    const result = await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )
    expect(result).toMatchObject({
      status: 'readmission_completed',
      readmission: {
        status: 'rejected_stale',
        reason: 'completion_fingerprint_mismatch',
      },
    })
    expect(readmission.applyAnchorCas).not.toHaveBeenCalled()
    expect(readmission.runAdmissionGate).not.toHaveBeenCalled()
  })

  it('the Readmission invocation boundary accepts exactly three stable identities', async () => {
    const readmission = readmissionSetup()
    await runHeldRecoveryReconstructionReadmissionCaller(
      { jobId: JOB_ID, heldItemId: HELD_ITEM_ID, opportunityId: OPPORTUNITY_ID },
      { readmission: readmission.deps, audit: () => undefined },
    )
    expect(readmission.loadReconstructedAnchor).toHaveBeenCalledTimes(1)
  })
})

describe('Held Recovery reconstructed-anchor Readmission audit and scope', () => {
  it('logs bounded persistence, canonical verification, and Workbench identity evidence', async () => {
    const events: HeldRecoveryReadmissionAuditEvent[] = []
    const setup = callerDependencies({ audit: (event) => events.push(event) })

    await persistReconstructedAnchorAndReadmit(
      { jobId: JOB_ID, persistence: persistenceInput() },
      setup.deps,
    )

    expect(events.map((event) => event.event)).toEqual([
      'reconstruction_persisted',
      'canonical_anchor_verified',
      'workbench_admission_evaluated',
    ])
    expect(events[0]).toMatchObject({
      jobId: JOB_ID,
      heldItemId: HELD_ITEM_ID,
      opportunityId: OPPORTUNITY_ID,
      persistenceStatus: 'inserted',
      existingOpportunityOnly: true,
      duplicateOpportunityCreated: false,
    })
    expect(events[1]).toMatchObject({
      readmissionStatus: 'admitted',
      canonicalAnchorVerified: true,
      opportunityVersion: revisionOpportunityVersionFor(OPPORTUNITY_ID, LEDGER_HASH),
    })
    expect(events[2]).toMatchObject({
      admissionStatus: 'admission_passed',
      passedCandidateCount: 3,
    })
    const serialized = JSON.stringify(events)
    expect(serialized).not.toContain(NEW_EVIDENCE)
    expect(serialized).not.toContain(NEW_COORDINATES)
    expect(serialized).not.toContain('specific replacement sentence')
  })

  it('contains no parallel classification, queue transition, persistence model, API, or cron', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/revision/heldRecoveryReconstructionReadmissionCaller.ts'),
      'utf8',
    )
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(codeOnly).not.toMatch(/workbenchQueueProjection|heldRecoveryQueueTransition/)
    expect(codeOnly).not.toMatch(/\.from\(|\.insert\(|\.update\(|\.delete\(/)
    expect(codeOnly).not.toMatch(/cron|route\.ts|app\/api/)
    expect(codeOnly).not.toMatch(/Unit 8/)
  })
})
