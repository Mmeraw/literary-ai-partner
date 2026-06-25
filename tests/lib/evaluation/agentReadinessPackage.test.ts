import {
  agentReadinessAllowsAgentUse,
  buildAgentReadinessPackage,
} from '@/lib/evaluation/agentReadinessPackage'

const readyInput = {
  jobId: 'job-1',
  manuscriptId: 123,
  manuscriptVersionId: 'mv-1',
  now: '2026-06-24T00:00:00.000Z',
  phase4bStatus: 'pass' as const,
  phase5Status: 'certified' as const,
  uedPresent: true,
  storyLedgerPresent: true,
  revisionLedgerPresent: true,
  reviseDecisionsPresent: true,
  story: {
    title: 'Example Novel',
    work_type: 'novel',
    word_count: 90000,
    genre: 'upmarket suspense',
    audience: 'adult',
  },
  architecture: {
    characters: [{ name: 'A' }],
    relationships: [{ from: 'A', to: 'B' }],
    timeline: [{ event: 'opening' }],
    world_state: [{ state: 'baseline' }],
    symbols: [{ symbol: 'object' }],
  },
  revision: {
    opportunity_count: 4,
    accepted_count: 1,
    rejected_count: 1,
    pending_count: 2,
    unresolved_risks: ['one unresolved risk'],
  },
}

describe('Agent Readiness Package v1', () => {
  test('builds ready package when all gates and source authorities are present', () => {
    const pkg = buildAgentReadinessPackage(readyInput)

    expect(pkg.artifact_type).toBe('agent_readiness_package_v1')
    expect(pkg.status).toBe('ready')
    expect(pkg.blocking_reason_codes).toEqual([])
    expect(pkg.warning_reason_codes).toEqual([])
    expect(pkg.is_resume_safe).toBe(true)
    expect(agentReadinessAllowsAgentUse(pkg)).toBe(true)
  })

  test('degrades when Phase 4B warns and Revise decisions are pending', () => {
    const pkg = buildAgentReadinessPackage({
      ...readyInput,
      phase4bStatus: 'warn',
      reviseDecisionsPresent: false,
    })

    expect(pkg.status).toBe('degraded')
    expect(pkg.blocking_reason_codes).toEqual([])
    expect(pkg.warning_reason_codes).toEqual(['PHASE4B_WARN', 'REVISE_DECISIONS_PENDING'])
    expect(agentReadinessAllowsAgentUse(pkg)).toBe(true)
  })

  test('blocks when Phase 4B blocks', () => {
    const pkg = buildAgentReadinessPackage({
      ...readyInput,
      phase4bStatus: 'block',
    })

    expect(pkg.status).toBe('blocked')
    expect(pkg.blocking_reason_codes).toContain('PHASE4B_BLOCKED')
    expect(pkg.is_resume_safe).toBe(false)
    expect(agentReadinessAllowsAgentUse(pkg)).toBe(false)
  })

  test('blocks when UED is missing', () => {
    const pkg = buildAgentReadinessPackage({
      ...readyInput,
      uedPresent: false,
    })

    expect(pkg.status).toBe('blocked')
    expect(pkg.blocking_reason_codes).toContain('UED_MISSING')
  })

  test('blocks when Story Ledger authority is missing', () => {
    const pkg = buildAgentReadinessPackage({
      ...readyInput,
      storyLedgerPresent: false,
    })

    expect(pkg.status).toBe('blocked')
    expect(pkg.blocking_reason_codes).toContain('STORY_LEDGER_AUTHORITY_MISSING')
  })

  test('fails closed for malformed package exposure checks', () => {
    expect(agentReadinessAllowsAgentUse(null)).toBe(false)
    expect(agentReadinessAllowsAgentUse({ status: 'ready' })).toBe(false)
    expect(agentReadinessAllowsAgentUse({ artifact_type: 'agent_readiness_package_v1', status: 'blocked' })).toBe(false)
  })
})
