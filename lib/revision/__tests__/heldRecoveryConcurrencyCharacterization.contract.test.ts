import { describe, it, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'

/**
 * O-B1 CONCURRENCY CHARACTERIZATION (read-only, tests + analysis only).
 *
 * Purpose: establish the CURRENT observed concurrency contract of the two atomic
 * Held Recovery writers BEFORE any production caller is wired and BEFORE any RPC
 * change is proposed. This suite does not alter production code and does not force
 * a preferred result; it records what the shipped SQL actually does.
 *
 * Evidence source: the migration SQL bodies themselves (same string-assertion
 * pattern already used by the repo's *WriterMigration.contract.test.ts files).
 * Behavior that can ONLY be proven with a live Postgres/Supabase concurrency
 * harness is explicitly listed as it.todo, not asserted here.
 *
 * Boundary classification used throughout:
 *  - [DB-ENFORCED]  guaranteed by Postgres locking / CAS semantics in the SQL
 *  - [WRITER]       enforced by the TS writer layer, not the DB
 *  - [ORCH]         an assumption the orchestration layer must uphold
 *  - [UNPROVABLE-HERE] requires a real concurrent-transaction harness
 */

const queueSql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260718033000_create_held_recovery_queue_transition_writer.sql',
  ),
  'utf8',
)

const retrySql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260718050000_create_held_recovery_retry_schedule_writer.sql',
  ),
  'utf8',
)

describe('O-B1 characterization — queue transition RPC concurrency contract', () => {
  it('[DB-ENFORCED] serializes concurrent writers on the queue row via SELECT ... FOR UPDATE', () => {
    // The current authority row is locked before the compare-and-set. Two concurrent
    // transitions on the same held item are serialized on this row lock.
    expect(queueSql).toMatch(
      /select\s+queue_state,\s*authority_version\s+into\s+v_current_state,\s*v_current_authority_version\s+from\s+public\.held_recovery_queue_items\s+where\s+held_item_id\s*=\s*v_held_item_id\s+for\s+update/i,
    )
  })

  it('[DB-ENFORCED] applies a true compare-and-set: UPDATE is guarded by from_state AND authority_version', () => {
    // The loser of a race updates 0 rows (its expected authority_version no longer
    // matches after the winner commits) and returns rejected_stale.
    expect(queueSql).toMatch(
      /update\s+public\.held_recovery_queue_items[\s\S]*?where\s+held_item_id\s*=\s*v_held_item_id[\s\S]*?and\s+queue_state\s*=\s*v_from_state[\s\S]*?and\s+authority_version\s*=\s*v_decision_authority_version/i,
    )
    expect(queueSql).toMatch(/if\s+not\s+found\s+then[\s\S]*?rejected_stale/i)
  })

  it('[DB-ENFORCED] duplicate invocation with the same idempotency key is unique-constrained and replays deterministically', () => {
    // transition_idempotency_key is UNIQUE; a re-run short-circuits to already_applied
    // (or a typed mismatch) instead of writing a second event.
    expect(queueSql).toContain('transition_idempotency_key text not null unique')
    expect(queueSql).toMatch(
      /where\s+events\.transition_idempotency_key\s*=\s*v_transition_idempotency_key[\s\S]*?if\s+found\s+then/i,
    )
    expect(queueSql).toContain("'already_applied'")
  })

  it('[DB-ENFORCED] a same-key re-run carrying different authority is rejected, not silently accepted', () => {
    expect(queueSql).toMatch(
      /v_existing_event\.decision_authority_version\s+is\s+distinct\s+from\s+v_decision_authority_version[\s\S]*?rejected_stale/i,
    )
  })

  it('[DB-ENFORCED] final queue cardinality is singular: held_item_id is the primary key of the authority table', () => {
    // There can be at most one queue row per held item; concurrent winners cannot
    // fork it into two live states.
    expect(queueSql).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+public\.held_recovery_queue_items\s*\([\s\S]*?held_item_id\s+text\s+primary\s+key/i,
    )
  })

  it('[DB-ENFORCED / ORCH] the transition writer cannot touch decision/card-type surfaces (append-only provenance only)', () => {
    // No write to any final-decision / card-type surface exists in this RPC.
    // NOTE (characterization finding): the queue-state enum legitimately contains
    // 'recovered_pending_reclassification' and 'reclassified' as QUEUE STATES, so a
    // bare /classification/ match is a false positive. The real invariant is that the
    // RPC only INSERTs into held_recovery_queue_transition_events and UPDATEs
    // held_recovery_queue_items — it writes to no final_decision / card_type surface.
    expect(queueSql).not.toMatch(/final_decision|card_type|cardType/i)
    const writeTargets = [...queueSql.matchAll(/\b(insert\s+into|update)\s+(public\.[a-z_]+)/gi)].map(
      (m) => m[2].toLowerCase(),
    )
    expect(new Set(writeTargets)).toEqual(
      new Set([
        'public.held_recovery_queue_transition_events',
        'public.held_recovery_queue_items',
      ]),
    )
    expect(queueSql).toContain('Append-only Held Recovery queue transition provenance')
  })
})

describe('O-B1 characterization — retry schedule RPC concurrency contract (the residual window)', () => {
  it('[DB-ENFORCED] duplicate invocation with the same schedule idempotency key cannot double-insert', () => {
    expect(retrySql).toContain('schedule_idempotency_key text not null unique')
    expect(retrySql).toContain("'already_scheduled'")
    // A same-key re-run whose payload differs fails closed rather than overwriting.
    expect(retrySql).toMatch(/idempotency_conflict/i)
  })

  it('[WRITER-VS-DB GAP] staleness is checked by a plain read of the latest attempt/transition, NOT a row lock', () => {
    // The "is this schedule still current?" decision reads latest attempt + latest
    // transition with ORDER BY ... LIMIT 1 and NO "for update". This is a read, not a lock.
    expect(retrySql).toMatch(
      /select\s+a\.id::text\s+into\s+v_latest_attempt_id[\s\S]*?from\s+public\.held_recovery_attempts\s+a[\s\S]*?order\s+by\s+a\.attempt_number\s+desc[\s\S]*?limit\s+1/i,
    )
    expect(retrySql).toMatch(
      /select\s+e\.id::text\s+into\s+v_latest_transition_event_id[\s\S]*?from\s+public\.held_recovery_queue_transition_events\s+e[\s\S]*?limit\s+1/i,
    )
    // Characterization assertion: these staleness reads are NOT taken FOR UPDATE.
    const stalenessBlock = retrySql.slice(
      retrySql.indexOf('v_latest_attempt_id'),
      retrySql.indexOf('rejected_stale'),
    )
    expect(stalenessBlock).not.toMatch(/for\s+update/i)
  })

  it('[RESIDUAL WINDOW] the advisory lock key includes the schedule idempotency key, so distinct keys for the same held item do NOT mutually exclude', () => {
    // pg_advisory_xact_lock(hashtext(held_item_id), hashtext(schedule_idempotency_key)):
    // two retry-schedule calls for the SAME held item but DIFFERENT idempotency keys
    // acquire DIFFERENT advisory locks and can interleave. This is the O-B1 window:
    // the "latest attempt/transition" check can be read before a competing transition
    // commits, so a schedule can be written against an attempt/transition that is about
    // to be superseded.
    expect(retrySql).toMatch(
      /perform\s+pg_advisory_xact_lock\(\s*hashtext\(v_held_item_id\)\s*,\s*hashtext\(v_schedule_idempotency_key\)\s*\)/i,
    )
  })

  it('[DB-ENFORCED] when the staleness read DOES observe a newer attempt/transition, the schedule is rejected as superseded', () => {
    expect(retrySql).toMatch(
      /if\s+v_latest_attempt_id\s+is\s+distinct\s+from\s+v_attempt_id[\s\S]*?or\s+v_latest_transition_event_id\s+is\s+distinct\s+from\s+v_transition_event_id[\s\S]*?rejected_stale[\s\S]*?superseded_by_later_attempt_or_transition/i,
    )
  })

  it('[DB-ENFORCED / ORCH] the retry writer stores a schedule only and executes/claims nothing', () => {
    expect(retrySql).not.toMatch(/final_decision|card_type|cardType/i)
    const writeTargets = [...retrySql.matchAll(/\b(insert\s+into|update)\s+(public\.[a-z_]+)/gi)].map(
      (m) => m[2].toLowerCase(),
    )
    // The retry writer only INSERTs into its own schedule table; it never UPDATEs
    // queue state, attempts, or any downstream artifact.
    expect(new Set(writeTargets)).toEqual(new Set(['public.held_recovery_retry_schedules']))
    expect(retrySql).toContain(
      'does not execute retries, claim due work, transition queue state, or mutate downstream artifacts',
    )
  })
})

describe('O-B1 characterization — cross-writer race (retry schedule vs queue transition)', () => {
  it('[UNPROVABLE-HERE] documents the asymmetry: queue transition is row-locked CAS; retry staleness is an unlocked read', () => {
    // Both facts are asserted individually above. This test records the JOINT
    // consequence in one place for the decision record: a queue transition can
    // commit (row-locked, deterministic) in the window between the retry writer's
    // unlocked "latest transition" read and its own insert, because the retry
    // writer holds only an advisory lock keyed by its own idempotency key.
    expect(queueSql).toMatch(/for\s+update/i) // queue transition: locked CAS
    const retryStaleness = retrySql.slice(
      retrySql.indexOf('v_latest_attempt_id'),
      retrySql.indexOf('rejected_stale'),
    )
    expect(retryStaleness).not.toMatch(/for\s+update/i) // retry staleness: unlocked read
  })

  // The following require a real Postgres/Supabase harness running two concurrent
  // transactions with controlled commit ordering. They cannot be proven by SQL
  // string inspection and must NOT be simulated with fakes (a fake executor/adapter
  // would prove the fake, not the RPC). Left as explicit todos for the decision review.
  it.todo(
    'live: two retry schedules (different keys, same held item) interleave; confirm at most one survives as current and the other is superseded on read',
  )
  it.todo(
    'live: queue transition commits between the retry writer\'s staleness read and its insert; observe whether the resulting schedule row is stale-but-persisted',
  )
  it.todo(
    'live: winner/loser audit rows — confirm the losing queue transition writes NO event row (UPDATE affected 0 rows) while the winner writes exactly one',
  )
  it.todo(
    'live: stale expected authority_version on queue transition returns rejected_stale and leaves queue cardinality at exactly one row',
  )
})
