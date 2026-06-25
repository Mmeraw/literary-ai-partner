export type AgentReadinessStatus = 'ready' | 'degraded' | 'blocked'

export type AgentReadinessInput = {
  jobId: string
  manuscriptId?: string | number | null
  manuscriptVersionId?: string | null
  now?: string
  phase4bStatus?: 'pass' | 'warn' | 'block' | 'missing'
  phase5Status?: 'certified' | 'blocked' | 'missing' | 'internal_bypass'
  uedPresent?: boolean
  storyLedgerPresent?: boolean
  revisionLedgerPresent?: boolean
  reviseDecisionsPresent?: boolean
  story?: {
    title?: string | null
    work_type?: string | null
    word_count?: number | null
    genre?: string | null
    audience?: string | null
  }
  architecture?: {
    characters?: unknown[]
    relationships?: unknown[]
    timeline?: unknown[]
    world_state?: unknown[]
    symbols?: unknown[]
  }
  revision?: {
    opportunity_count?: number
    accepted_count?: number
    rejected_count?: number
    pending_count?: number
    unresolved_risks?: string[]
  }
}

export type AgentReadinessPackageV1 = {
  artifact_type: 'agent_readiness_package_v1'
  schema_version: 1
  job_id: string
  manuscript_id: string | number | null
  manuscript_version_id: string | null
  status: AgentReadinessStatus
  created_at: string
  authority_basis: {
    phase4b_status: 'pass' | 'warn' | 'block' | 'missing'
    phase5_status: 'certified' | 'blocked' | 'missing' | 'internal_bypass'
    ued_present: boolean
    story_ledger_present: boolean
    revision_ledger_present: boolean
    revise_decisions_present: boolean
  }
  blocking_reason_codes: string[]
  warning_reason_codes: string[]
  story: {
    title: string | null
    work_type: string | null
    word_count: number | null
    genre: string | null
    audience: string | null
  }
  architecture: {
    characters: unknown[]
    relationships: unknown[]
    timeline: unknown[]
    world_state: unknown[]
    symbols: unknown[]
  }
  revision: {
    opportunity_count: number
    accepted_count: number
    rejected_count: number
    pending_count: number
    unresolved_risks: string[]
  }
  agent_instructions: {
    must_preserve: string[]
    must_not_invent: string[]
    safe_actions: string[]
    blocked_actions: string[]
  }
  summary: string
  is_resume_safe: boolean
}

function determineStatus(blocking: string[], warnings: string[]): AgentReadinessStatus {
  if (blocking.length > 0) return 'blocked'
  if (warnings.length > 0) return 'degraded'
  return 'ready'
}

export function buildAgentReadinessPackage(input: AgentReadinessInput): AgentReadinessPackageV1 {
  const phase4bStatus = input.phase4bStatus ?? 'missing'
  const phase5Status = input.phase5Status ?? 'missing'
  const uedPresent = input.uedPresent === true
  const storyLedgerPresent = input.storyLedgerPresent === true
  const revisionLedgerPresent = input.revisionLedgerPresent === true
  const reviseDecisionsPresent = input.reviseDecisionsPresent === true

  const blocking: string[] = []
  const warnings: string[] = []

  if (phase4bStatus === 'block') blocking.push('PHASE4B_BLOCKED')
  if (phase4bStatus === 'missing') warnings.push('PHASE4B_MISSING')
  if (phase4bStatus === 'warn') warnings.push('PHASE4B_WARN')

  if (phase5Status === 'blocked') blocking.push('PHASE5_BLOCKED')
  if (phase5Status === 'missing') warnings.push('PHASE5_MISSING')
  if (phase5Status === 'internal_bypass') warnings.push('PHASE5_INTERNAL_BYPASS')

  if (!uedPresent) blocking.push('UED_MISSING')
  if (!storyLedgerPresent) blocking.push('STORY_LEDGER_AUTHORITY_MISSING')
  if (!revisionLedgerPresent) warnings.push('REVISION_LEDGER_MISSING')
  if (!reviseDecisionsPresent) warnings.push('REVISE_DECISIONS_PENDING')

  const status = determineStatus(blocking, warnings)

  return {
    artifact_type: 'agent_readiness_package_v1',
    schema_version: 1,
    job_id: input.jobId,
    manuscript_id: input.manuscriptId ?? null,
    manuscript_version_id: input.manuscriptVersionId ?? null,
    status,
    created_at: input.now ?? new Date().toISOString(),
    authority_basis: {
      phase4b_status: phase4bStatus,
      phase5_status: phase5Status,
      ued_present: uedPresent,
      story_ledger_present: storyLedgerPresent,
      revision_ledger_present: revisionLedgerPresent,
      revise_decisions_present: reviseDecisionsPresent,
    },
    blocking_reason_codes: blocking,
    warning_reason_codes: warnings,
    story: {
      title: input.story?.title ?? null,
      work_type: input.story?.work_type ?? null,
      word_count: input.story?.word_count ?? null,
      genre: input.story?.genre ?? null,
      audience: input.story?.audience ?? null,
    },
    architecture: {
      characters: input.architecture?.characters ?? [],
      relationships: input.architecture?.relationships ?? [],
      timeline: input.architecture?.timeline ?? [],
      world_state: input.architecture?.world_state ?? [],
      symbols: input.architecture?.symbols ?? [],
    },
    revision: {
      opportunity_count: input.revision?.opportunity_count ?? 0,
      accepted_count: input.revision?.accepted_count ?? 0,
      rejected_count: input.revision?.rejected_count ?? 0,
      pending_count: input.revision?.pending_count ?? 0,
      unresolved_risks: input.revision?.unresolved_risks ?? [],
    },
    agent_instructions: {
      must_preserve: [
        'accepted Story Ledger authority',
        'author corrections',
        'certified UED facts',
        'canon-safe character identity',
        'timeline order',
        'evidence-backed revision decisions',
        'unresolved risks as risks',
      ],
      must_not_invent: [
        'new manuscript facts',
        'unsupported backstory',
        'unsupported endings',
        'unsupported character motives',
        'unsupported continuity',
        'market positioning that contradicts certified evaluation',
      ],
      safe_actions: [
        'summarize certified architecture',
        'prepare revision plans from accepted opportunities',
        'prepare support material from certified UED fields',
        'identify unresolved questions',
      ],
      blocked_actions: [
        'change manuscript content without accepted Revise decision',
        'treat benchmark prose as manuscript evidence',
        'override accepted Story Ledger',
        'override Phase 4B or Phase 5 blocks',
        'infer missing story facts from genre convention',
      ],
    },
    summary:
      status === 'ready'
        ? 'Agent Readiness Package is ready for downstream use.'
        : status === 'degraded'
          ? 'Agent Readiness Package is degraded and may be used only with explicit warnings.'
          : 'Agent Readiness Package is blocked and must not be used downstream.',
    is_resume_safe: status !== 'blocked',
  }
}

export function agentReadinessAllowsAgentUse(pkg: unknown): boolean {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return false
  const record = pkg as Record<string, unknown>
  if (record.artifact_type !== 'agent_readiness_package_v1') return false
  return record.status === 'ready' || record.status === 'degraded'
}
