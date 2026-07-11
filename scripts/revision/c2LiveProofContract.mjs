/**
 * C2 Live Proof — Evidence Artifact Contract
 * ------------------------------------------------------------------------
 * VERIFIER-ONLY. This module defines the fail-closed evidence contract for the
 * live "Let the River Decide" Revise proof. It contains NO production runtime
 * behavior, NO thresholds, NO admission logic — it only DESCRIBES the boundaries
 * that a live run must genuinely execute, and computes an honest overall verdict.
 *
 * Design principles (per operator direction, 2026-07-11):
 *  - Verifier-first: capture the actual attrition at every boundary; diagnose
 *    nothing speculatively.
 *  - Fail closed: no overall C2 PASS unless EVERY required live boundary has
 *    actually executed AND reconciled. Deterministic test success is NEVER live
 *    proof.
 *  - Honest stages: later lifecycle steps (accept / customize / export / persist)
 *    are DISTINCT stages. They are NOT_EXECUTED until genuinely exercised by a
 *    controlled operator action — never fabricated as success by merely watching
 *    an evaluation job complete.
 */

/** Per-boundary status vocabulary. Fail-closed default is NOT_EXECUTED. */
export const STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_EXECUTED: 'NOT_EXECUTED',
});

/**
 * Canonical ordered list of C2 proof boundaries.
 *
 * `required_for_pass` — must be PASS for the run to earn overall C2 PASS.
 * `stage`            — 'evaluation' boundaries are provable by watching the job;
 *                      'operator_action' stages require a controlled human/API
 *                      action and default to NOT_EXECUTED until exercised.
 */
export const C2_BOUNDARIES = Object.freeze([
  {
    key: 'evaluation_job_identity',
    stage: 'evaluation',
    required_for_pass: true,
    description: 'Fresh evaluation job created and reached terminal complete with a certified UED identity.',
  },
  {
    key: 'opportunity_supply',
    stage: 'evaluation',
    required_for_pass: true,
    description: 'Fresh evaluation produced the full canonical opportunity supply (count > 0, reconciled to artifact).',
  },
  {
    key: 'preflight_disposition',
    stage: 'evaluation',
    required_for_pass: true,
    description: 'Preflight clean/advisory/blocked counts captured with reason codes; advisory repair_required is NOT auto-blocked.',
  },
  {
    key: 'hydration_outcome',
    stage: 'evaluation',
    required_for_pass: true,
    description: 'Per-opportunity anchor hydration outcome captured with lookup diagnostics; at least one real anchor resolves.',
  },
  {
    key: 'candidate_generation',
    stage: 'operator_action',
    required_for_pass: true,
    description: 'Candidate revisions generated for at least one hydrated, admissible opportunity.',
  },
  {
    key: 'final_admission',
    stage: 'operator_action',
    required_for_pass: true,
    description: 'At least one candidate earns final workbench admission through the real admission gate.',
  },
  {
    key: 'workbench_visible',
    stage: 'operator_action',
    required_for_pass: true,
    description: 'The workbench queue displays admitted opportunities (readinessTotals.ready_for_revise reconciles with admitted).',
  },
  {
    key: 'accept_or_customize',
    stage: 'operator_action',
    required_for_pass: true,
    description: 'A revision is accepted or customized via a controlled operator action (distinct stage; NOT provable by watching eval).',
  },
  {
    key: 'revised_manuscript_persist',
    stage: 'operator_action',
    required_for_pass: true,
    description: 'The revised manuscript persists correctly (new version / revised text durably written).',
  },
  {
    key: 'revision_history_persist',
    stage: 'operator_action',
    required_for_pass: true,
    description: 'Revision-history / completion evidence persists correctly and reconciles with the accepted action.',
  },
  {
    key: 'negative_control',
    stage: 'evaluation',
    required_for_pass: true,
    description: 'A fabricated / unsupported anchor is classified no_match and remains withheld (fail-closed control).',
  },
]);

/** Build an empty, fail-closed evidence skeleton: every boundary NOT_EXECUTED. */
export function createEvidenceSkeleton(meta = {}) {
  const boundaries = {};
  for (const b of C2_BOUNDARIES) {
    boundaries[b.key] = {
      key: b.key,
      stage: b.stage,
      required_for_pass: b.required_for_pass,
      description: b.description,
      status: STATUS.NOT_EXECUTED,
      executed: false,
      reconciled: false,
      detail: null,
      evidence: {},
    };
  }
  return {
    artifact_version: 'c2_live_proof_v1',
    generated_at: new Date().toISOString(),
    mode: meta.mode ?? 'dry_run', // 'dry_run' | 'live'
    target_environment: meta.target_environment ?? null,
    manuscript_id: meta.manuscript_id ?? null,
    manuscript_label: meta.manuscript_label ?? null,
    commit_sha: meta.commit_sha ?? null,
    node_env: meta.node_env ?? null,
    // Populated only by a real live run — never fabricated in dry-run.
    costs: { model_calls: null, prompt_tokens: null, completion_tokens: null, usd_estimate: null },
    timing_ms: { total: null, evaluation: null, hydration: null, candidate_generation: null },
    artifact_hashes: {},
    boundaries,
    overall: { status: STATUS.NOT_EXECUTED, reason: 'No live boundaries executed.' },
  };
}

/**
 * Record a boundary result. `executed` MUST be true for a real observation;
 * `reconciled` MUST be true when the observed value was cross-checked against an
 * independent source (e.g. artifact count vs queue count).
 */
export function recordBoundary(evidence, key, { status, executed, reconciled = false, detail = null, data = {} }) {
  const b = evidence.boundaries[key];
  if (!b) throw new Error(`Unknown C2 boundary: ${key}`);
  if (!Object.values(STATUS).includes(status)) throw new Error(`Invalid status for ${key}: ${status}`);
  b.status = status;
  b.executed = Boolean(executed);
  b.reconciled = Boolean(reconciled);
  b.detail = detail;
  b.evidence = data;
  return b;
}

/**
 * Compute the honest overall verdict. FAIL-CLOSED:
 *  - overall PASS requires: mode === 'live' AND every required boundary is PASS
 *    AND executed AND reconciled.
 *  - if any required boundary is FAIL -> overall FAIL.
 *  - otherwise (any required boundary NOT_EXECUTED, or dry_run) -> NOT_EXECUTED.
 * Deterministic/dry-run success can never be reported as live PASS.
 */
export function computeOverall(evidence) {
  const required = C2_BOUNDARIES.filter((b) => b.required_for_pass).map((b) => b.key);
  const anyFail = required.some((k) => evidence.boundaries[k].status === STATUS.FAIL);
  if (anyFail) {
    const failed = required.filter((k) => evidence.boundaries[k].status === STATUS.FAIL);
    evidence.overall = { status: STATUS.FAIL, reason: `Required boundaries FAILED: ${failed.join(', ')}` };
    return evidence.overall;
  }

  if (evidence.mode !== 'live') {
    evidence.overall = {
      status: STATUS.NOT_EXECUTED,
      reason: 'Dry-run / readiness mode: no live boundaries executed. Live PASS is impossible without --live.',
    };
    return evidence.overall;
  }

  const notReady = required.filter((k) => {
    const b = evidence.boundaries[k];
    return !(b.status === STATUS.PASS && b.executed && b.reconciled);
  });
  if (notReady.length > 0) {
    evidence.overall = {
      status: STATUS.NOT_EXECUTED,
      reason: `Live run incomplete. Boundaries not PASS+executed+reconciled: ${notReady.join(', ')}`,
    };
    return evidence.overall;
  }

  evidence.overall = { status: STATUS.PASS, reason: 'All required live boundaries executed and reconciled.' };
  return evidence.overall;
}

/** Human-readable one-line-per-boundary summary for logs/PR evidence. */
export function renderSummary(evidence) {
  const lines = [];
  lines.push(`C2 Live Proof — ${evidence.artifact_version}`);
  lines.push(`mode=${evidence.mode} env=${evidence.target_environment ?? 'n/a'} manuscript=${evidence.manuscript_id ?? 'n/a'} commit=${evidence.commit_sha ?? 'n/a'}`);
  for (const b of C2_BOUNDARIES) {
    const e = evidence.boundaries[b.key];
    const flags = `${e.executed ? 'exec' : '----'}/${e.reconciled ? 'recon' : '-----'}`;
    lines.push(`  [${e.status.padEnd(12)}] ${flags}  ${b.key}${e.detail ? ' — ' + e.detail : ''}`);
  }
  lines.push(`OVERALL: ${evidence.overall.status} — ${evidence.overall.reason}`);
  return lines.join('\n');
}
