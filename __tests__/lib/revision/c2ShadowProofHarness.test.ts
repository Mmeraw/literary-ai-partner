/**
 * C2 Pre-Live SHADOW Proof Harness — VERIFIER-ONLY (issue #1272, gap C)
 * ============================================================================
 * Closes the candidate-generation and accept/persistence NOT_EXECUTED gaps that
 * the live-only `scripts/revision/c2LiveProofHarness.mjs` cannot exercise without
 * a paid model call and production writes.
 *
 * This harness drives the REAL product authorities for every C2 boundary against
 * CONTROLLED fixtures, a STUBBED provider (the OpenAI module is mocked — no paid
 * call, no network), and TEST persistence (an in-memory Supabase double — no
 * production write). It records each boundary into the SAME fail-closed contract
 * the live harness uses (`c2LiveProofContract.mjs`) and emits machine-readable
 * evidence + a human-readable boundary summary.
 *
 * SAFETY / HONESTY:
 *  - Mode is 'shadow'. A green run earns SHADOW_PASS, a token that is DISTINCT
 *    from the live PASS and can NEVER be promoted to live proof (see the contract
 *    fail-closed logic + its tests). This is pre-live proof only.
 *  - It changes NO thresholds, scoring, caps, admission rules, or product
 *    behavior. It only composes existing authorities under controlled inputs.
 *  - It makes NO real provider call, creates NO job, and writes NO production data.
 *
 * Candidate generation is exercised through the REAL `runPass4VoiceRewrite`
 * runner with the OpenAI client stubbed, for BOTH a short and a long passage, so
 * short-form and long-form candidate synthesis are both proven pre-live.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Mock } from 'jest-mock';

import {
  createEvidenceSkeleton,
  recordBoundary,
  computeOverall,
  renderSummary,
  STATUS,
  OVERALL_STATUS,
} from '../../../scripts/revision/c2LiveProofContract.mjs';

import {
  revisionCandidateHash,
  revisionOpportunityVersion,
} from '@/lib/revision/decisionAuthorityIdentity';

// ---------------------------------------------------------------------------
// Controlled fixtures
// ---------------------------------------------------------------------------

// Deterministic hydration / admission / negative-control fixture (short form).
const shortManuscriptChunk =
  'The hallway was empty. He waited by the door — one hand resting on the frame, while the silence lengthened. She did not answer.';

const shortPassage =
  'He waited by the door — one hand resting on the frame, while the silence lengthened.';

// Longer, multi-paragraph fixture (long form) — a distinct grounded passage.
const longManuscriptChunk = [
  'The market had emptied by the time she reached the square.',
  'Rosa set the crate down beside the fountain and pressed both palms flat against the cold stone rim, breathing through the ache in her shoulders while the vendors folded their awnings one by one.',
  'She counted the coins twice, and both times the total came up short of what the landlord would demand at dusk.',
  'A gull wheeled overhead and settled on the well, watching her with a flat indifferent eye.',
].join(' ');

const longPassage =
  'Rosa set the crate down beside the fountain and pressed both palms flat against the cold stone rim, breathing through the ache in her shoulders while the vendors folded their awnings one by one.';

const diagnosticFields = {
  symptom:
    'The beat stalls on physical action without translating the delay into character pressure, so the tension stays observational.',
  cause:
    'The prose records the physical action but omits the internal decision pressure that would give the pause narrative consequence.',
  fixDirection:
    'Add one restrained physical or interior beat that turns the waiting into a visible decision point.',
  readerEffect:
    'The reader experiences suspended anticipation and understands why the delay matters rather than watching an idle pause.',
};

// Grounded A/B/C candidates the STUBBED provider will "generate" for the short
// passage. These are the proven-admissible candidate texts from the deterministic
// integration layer, so the real admission gate can admit them.
const shortCandidates = {
  a: 'He kept one hand on the doorframe and listened for her answer.',
  b: 'He stayed beside the door, counting the seconds until she moved.',
  c: 'He waited through one more breath before he answered, and the doorway held the pause in place.',
};

const longCandidates = {
  a: 'Rosa steadied the crate against the fountain and let the ache settle while she watched the last awning fold shut.',
  b: 'She braced the crate on the stone rim, counting the shortfall again as the square emptied around her.',
  c: 'Rosa rested both hands on the cold fountain and made herself breathe before she looked at the coins once more.',
};

// ---------------------------------------------------------------------------
// Accept / persist fixture (in-memory Supabase double). Mirrors the proven
// pre-live shadow fixture so the REAL Final Review runtime applies, persists,
// and exports without hitting production.
// ---------------------------------------------------------------------------

const acceptSourceText =
  'Alpha original sentence. Untouched middle paragraph. Untouched final paragraph.';
const acceptReplacement =
  'Alpha revised sentence with a grounded, author-approved improvement.';

const acceptOpportunity = {
  id: 'opp-shadow-1',
  cardType: 'copy_paste_rewrite',
  trustedPathStatus: 'eligible',
  quoteHighlight: 'Alpha original sentence.',
  quoteRest: '',
  anchor: 'Opening paragraph',
  sourceUedHash: 'ued-shadow-1',
  sourceOpportunityId: 'source-opp-1',
  sourceCriterion: 'Opening clarity',
  options: [
    { key: 'A', candidateText: acceptReplacement },
    { key: 'B', candidateText: 'Alternate grounded opening sentence for the author.' },
    { key: 'C', candidateText: 'Second alternate grounded opening sentence for the author.' },
  ],
};

const acceptOpportunityVersion = revisionOpportunityVersion({
  id: acceptOpportunity.id,
  sourceUedHash: acceptOpportunity.sourceUedHash,
  sourceOpportunityId: acceptOpportunity.sourceOpportunityId,
  sourceCriterion: acceptOpportunity.sourceCriterion,
  sourceExcerpt: acceptOpportunity.quoteHighlight,
  sourceLocation: acceptOpportunity.anchor,
  cardType: acceptOpportunity.cardType,
  trustedPathStatus: acceptOpportunity.trustedPathStatus,
  options: acceptOpportunity.options,
});

const acceptCandidateHash = revisionCandidateHash({
  opportunityId: acceptOpportunity.id,
  candidateSlot: 'A',
  candidateText: acceptReplacement,
  sourceUedHash: acceptOpportunity.sourceUedHash,
  sourceOpportunityId: acceptOpportunity.sourceOpportunityId,
  sourceCriterion: acceptOpportunity.sourceCriterion,
});

const acceptDecision = {
  id: 'decision-shadow-1',
  opportunity_id: acceptOpportunity.id,
  opportunity_title: 'Strengthen the opening sentence',
  decision: 'accepted_a',
  selected_option: 'A',
  custom_text: null,
  selected_text: acceptReplacement,
  source_excerpt: 'Alpha original sentence.',
  source_location: 'Opening paragraph',
  metadata: {
    opportunityVersion: acceptOpportunityVersion,
    candidateSlot: 'A',
    candidateHash: acceptCandidateHash,
    sourceUedHash: acceptOpportunity.sourceUedHash,
    sourceOpportunityId: acceptOpportunity.sourceOpportunityId,
    sourceCriterion: acceptOpportunity.sourceCriterion,
    cardType: acceptOpportunity.cardType,
    trustedPathStatus: acceptOpportunity.trustedPathStatus,
  },
  created_at: '2026-07-14T00:00:00.000Z',
};

const rpcCalls: Array<Record<string, unknown>> = [];
const insertedRuns: Array<Record<string, unknown>> = [];

function queryFor(table: string) {
  const query: Record<string, unknown> = {};
  const chain = query as Record<string, Mock>;

  chain.select = jest.fn(() => query);
  chain.eq = jest.fn(() => query);
  chain.order = jest.fn(async () => {
    if (table === 'revision_ledger_decisions') return { data: [acceptDecision], error: null };
    return { data: [], error: null };
  });
  chain.maybeSingle = jest.fn(async () => {
    if (table === 'manuscripts') {
      return { data: { id: 7519, title: 'Shadow Proof Manuscript', user_id: 'user-shadow' }, error: null };
    }
    if (table === 'evaluation_jobs') {
      return {
        data: {
          id: 'job-shadow-1',
          status: 'complete',
          validity_status: 'valid',
          manuscript_id: 7519,
          manuscript_version_id: 'version-source-1',
        },
        error: null,
      };
    }
    if (table === 'manuscript_versions') {
      return { data: { id: 'version-source-1', raw_text: acceptSourceText }, error: null };
    }
    return { data: null, error: null };
  });
  chain.insert = jest.fn(async (payload: Record<string, unknown>) => {
    insertedRuns.push(payload);
    return { data: null, error: null };
  });

  return query;
}

const supabase = {
  from: jest.fn((table: string) => queryFor(table)),
  rpc: jest.fn(async (_name: string, payload: Record<string, unknown>) => {
    rpcCalls.push(payload);
    return {
      data: [{ revised_version_id: 'version-revised-1', reused_existing_version: rpcCalls.length > 1 }],
      error: null,
    };
  }),
};

// ---------------------------------------------------------------------------
// Provider + persistence stubs (no paid call, no production write)
// ---------------------------------------------------------------------------

// The generated candidate set the stubbed provider returns is selected per-call
// from the originalPassage so short and long passages each get grounded output.
function stubCandidatesFor(passage: string) {
  return passage.startsWith('Rosa') ? longCandidates : shortCandidates;
}

jest.mock('openai', () => ({
  __esModule: true,
  default: class StubOpenAI {
    chat = {
      completions: {
        create: async (params: { messages: Array<{ role: string; content: string }> }) => {
          const userPrompt = params.messages.find((m) => m.role === 'user')?.content ?? '';
          const candidates = userPrompt.includes('Rosa') ? longCandidates : shortCandidates;
          return {
            choices: [{ message: { content: JSON.stringify(candidates) } }],
            usage: { prompt_tokens: 128, completion_tokens: 96 },
          };
        },
      },
    };
  },
}));

// Cost tracking is a fire-path side effect; stub it so no cost write is attempted.
jest.mock('@/lib/jobs/cost', () => ({
  trackCompletionCost: jest.fn(() => {}),
}));

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(async () => ({ id: 'user-shadow', email: 'author@example.com' })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => supabase),
}));

jest.mock('@/lib/evaluation/artifactPersistence', () => ({
  upsertEvaluationArtifact: jest.fn(async () => 'completion-artifact-1'),
}));

jest.mock('@/lib/revision/finalReviewSourceText', () => ({
  resolveFinalReviewSourceText: jest.fn(async () => acceptSourceText),
  scrubInternalReportLeakage: jest.fn((value: string) => value),
}));

jest.mock('@/lib/revision/workbenchQueue', () => ({
  getWorkbenchQueue: jest.fn(async () => ({
    ok: true,
    opportunities: [acceptOpportunity],
    needsTargeting: [],
    withheldUnsupported: [{ id: 'withheld-1', reason: 'no_match' }],
    readinessTotals: { ready_for_revise: 1, needs_targeting: 0, withheld_unsupported: 1 },
    synthesis: { admitted: 1, held: 0, suppressed: 1 },
  })),
}));

// Real product authorities under test.
import { runPass4VoiceRewrite, extractVoiceContext } from '@/lib/revision/runPass4VoiceRewrite';
import { runWorkbenchAdmissionGate } from '@/lib/revision/reviseAdmissionGate';
import {
  findHydrationChunkForAnchor,
  resolveReviseContextQuality,
} from '@/lib/revision/opportunityLedger';
import {
  applyFinalReviewDecisions,
  buildFinalReviewExport,
} from '@/lib/revision/finalReviewRuntime';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';

// ---------------------------------------------------------------------------
// Shared evidence artifact for the whole shadow run.
// ---------------------------------------------------------------------------

const evidence = createEvidenceSkeleton({
  mode: 'shadow',
  target_environment: 'jest_shadow',
  manuscript_id: 7519,
  manuscript_label: 'Shadow Proof (controlled fixtures)',
  commit_sha: process.env.GIT_SHA ?? null,
  node_env: process.env.NODE_ENV ?? 'test',
});

async function generateCandidates(passage: string, manuscript: string) {
  return runPass4VoiceRewrite(
    {
      originalPassage: passage,
      editorialInstruction: diagnosticFields.fixDirection,
      symptom: diagnosticFields.symptom,
      cause: diagnosticFields.cause,
      mistakeProofing: 'Preserve author voice; do not introduce new named entities.',
      operation: 'replace',
      voiceContext: extractVoiceContext(manuscript, passage, 200),
      location: 'Chapter 1',
    },
    { jobId: 'job-shadow-1', phase: 'pass4_voice_rewrite_shadow' },
  );
}

describe('C2 pre-live SHADOW proof: full Evaluate→Revise boundary map', () => {
  it('evaluation_job_identity: a certified complete+valid job identity is present', async () => {
    const { data } = await supabase.from('evaluation_jobs').select('*').eq('id', 'job-shadow-1').maybeSingle();
    const certified = data?.status === 'complete' && (data?.validity_status == null || data?.validity_status === 'valid');
    expect(certified).toBe(true);
    recordBoundary(evidence, 'evaluation_job_identity', {
      status: certified ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: certified,
      detail: `job ${data?.id} status=${data?.status} validity=${data?.validity_status} (fixture-backed: evaluation_jobs read from in-memory Supabase double; real job identity is proven by the live harness)`,
      data: { job_id: data?.id, status: data?.status, authority_source: 'fixture' },
    });
  });

  it('opportunity_supply: canonical queue supplies at least one opportunity', async () => {
    const queue = await getWorkbenchQueue({ manuscriptId: '7519', evaluationJobId: 'job-shadow-1' });
    const total =
      queue.opportunities.length + queue.needsTargeting.length + queue.withheldUnsupported.length;
    expect(total).toBeGreaterThan(0);
    recordBoundary(evidence, 'opportunity_supply', {
      status: total > 0 ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: total > 0,
      detail: `total canonical supply=${total} (fixture-backed: getWorkbenchQueue stubbed in shadow; real-authority queue supply is proven by the live harness)`,
      data: { total, ready: queue.readinessTotals?.ready_for_revise, authority_source: 'fixture' },
    });
  });

  it('preflight_disposition: advisory repair_required stays advisory and is not auto-blocked', () => {
    const context = resolveReviseContextQuality({
      quality_report: {
        gate_ready_status: 'repair_required',
        blocking_reasons: [],
        root_cause_warning_count: 2,
        repair_reasons: [
          { key: 'ending_accountability', layer: 'threat', message: 'requires confirmation', evidence_reference: 'ref' },
        ],
      },
    });
    const ok = context.status === 'limited' && context.gate_ready_status === 'repair_required' && context.blocking_reasons.length === 0;
    expect(ok).toBe(true);
    recordBoundary(evidence, 'preflight_disposition', {
      status: ok ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: ok,
      detail: `status=${context.status} gate=${context.gate_ready_status} blocking=${context.blocking_reasons.length}`,
      data: { status: context.status, blocking_reasons: context.blocking_reasons.length, authority_source: 'real_authority' },
    });
  });

  it('hydration_outcome: a real anchor resolves against the manuscript without a model call', () => {
    const hydration = findHydrationChunkForAnchor('He waited by the door', [{ content: shortManuscriptChunk }]);
    const ok = hydration.content === shortManuscriptChunk && hydration.diagnostic.strategy !== 'no_match';
    expect(ok).toBe(true);
    recordBoundary(evidence, 'hydration_outcome', {
      status: ok ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: ok,
      detail: `strategy=${hydration.diagnostic.strategy}`,
      data: { strategy: hydration.diagnostic.strategy, authority_source: 'real_authority' },
    });
  });

  it('candidate_generation: REAL Pass4 runner (stubbed provider) yields distinct grounded A/B/C for short AND long passages', async () => {
    const shortResult = await generateCandidates(shortPassage, shortManuscriptChunk);
    const longResult = await generateCandidates(longPassage, longManuscriptChunk);

    const distinct = (r: { a: string; b: string; c: string }) =>
      r.a && r.b && r.c && new Set([r.a, r.b, r.c]).size === 3;
    const shortOk = distinct(shortResult) && shortResult.a === shortCandidates.a;
    const longOk = distinct(longResult) && longResult.a === longCandidates.a;
    const ok = shortOk && longOk;
    expect(ok).toBe(true);

    recordBoundary(evidence, 'candidate_generation', {
      status: ok ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: ok,
      detail: `short distinct=${distinct(shortResult)} long distinct=${distinct(longResult)} (real runPass4VoiceRewrite, provider stubbed)`,
      data: {
        short: { a_len: shortResult.a.length, distinct: distinct(shortResult), model: shortResult.model },
        long: { a_len: longResult.a.length, distinct: distinct(longResult), model: longResult.model },
        authority_source: 'real_authority',
      },
    });

    // final_admission depends on the generated candidates flowing through the
    // real admission gate.
    const admission = runWorkbenchAdmissionGate({
      id: 'shadow-admission-1',
      readiness: 'ready_for_revise',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      anchor: 'He waited by the door',
      quoteHighlight: 'The hallway was empty.',
      quoteRest: 'She did not answer.',
      revisionOperation: 'replace_selected_passage',
      ...diagnosticFields,
      options: [
        { key: 'A', candidateText: shortResult.a },
        { key: 'B', candidateText: shortResult.b },
        { key: 'C', candidateText: shortResult.c },
      ],
    });
    const admitted = admission.admission_status === 'admission_passed' && admission.passedCandidateCount >= 2;
    expect(admitted).toBe(true);
    recordBoundary(evidence, 'final_admission', {
      status: admitted ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: admitted,
      detail: `admission=${admission.admission_status} passedCandidates=${admission.passedCandidateCount}`,
      data: { admission_status: admission.admission_status, passedCandidateCount: admission.passedCandidateCount, reasons: admission.reasons, authority_source: 'real_authority' },
    });
  });

  it('workbench_visible: admitted opportunity count reconciles with readiness authority', async () => {
    const queue = await getWorkbenchQueue({ manuscriptId: '7519', evaluationJobId: 'job-shadow-1' });
    const ready = queue.readinessTotals?.ready_for_revise ?? queue.opportunities.length;
    const reconciles = queue.opportunities.length === ready && ready > 0;
    expect(reconciles).toBe(true);
    recordBoundary(evidence, 'workbench_visible', {
      status: ready > 0 ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: reconciles,
      detail: `visible=${queue.opportunities.length} ready=${ready} (fixture-backed: getWorkbenchQueue stubbed in shadow; real-authority visibility is proven by the live harness)`,
      data: { visible: queue.opportunities.length, ready, authority_source: 'fixture' },
    });
  });

  it('accept_or_customize + revised_manuscript_persist: applies once, preserves untouched text, idempotent on replay', async () => {
    const first = await applyFinalReviewDecisions({ manuscriptId: 7519, evaluationJobId: 'job-shadow-1' });
    expect(first).toEqual({ ok: true, revisedVersionId: 'version-revised-1', appliedCount: 1, reusedExistingVersion: false });
    expect(rpcCalls).toHaveLength(1);

    const payload = rpcCalls[0];
    const revisedText = String(payload.p_raw_text);
    const persistOk =
      revisedText.includes(acceptReplacement) &&
      !revisedText.includes('Alpha original sentence.') &&
      revisedText.includes('Untouched middle paragraph.') &&
      revisedText.includes('Untouched final paragraph.') &&
      Array.isArray(payload.p_applied_decision_ids) &&
      (payload.p_applied_decision_ids as string[]).length === 1;
    expect(persistOk).toBe(true);

    const acceptOk = first.ok === true && first.appliedCount === 1;
    recordBoundary(evidence, 'accept_or_customize', {
      status: acceptOk ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: acceptOk,
      detail: `appliedCount=${first.appliedCount} reused=${first.reusedExistingVersion}`,
      data: { applied_decision_ids: payload.p_applied_decision_ids, authority_source: 'real_authority' },
    });

    const second = await applyFinalReviewDecisions({ manuscriptId: 7519, evaluationJobId: 'job-shadow-1' });
    const idempotent =
      second.reusedExistingVersion === true &&
      rpcCalls.length === 2 &&
      rpcCalls[1].p_apply_fingerprint === payload.p_apply_fingerprint &&
      rpcCalls[1].p_raw_text === payload.p_raw_text;
    expect(idempotent).toBe(true);

    recordBoundary(evidence, 'revised_manuscript_persist', {
      status: persistOk && idempotent ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: persistOk && idempotent,
      detail: `revised text preserves untouched paragraphs; replay reused stable version (idempotent=${idempotent})`,
      data: { reused_on_replay: second.reusedExistingVersion, fingerprint_stable: rpcCalls[1].p_apply_fingerprint === payload.p_apply_fingerprint, authority_source: 'real_authority' },
    });
  });

  it('revision_history_persist: a clean export reads the persisted decision and records a run', async () => {
    const exported = await buildFinalReviewExport({
      manuscriptId: 7519,
      evaluationJobId: 'job-shadow-1',
      format: 'clean',
      file: 'txt',
    });
    const contentOk =
      exported.content.includes(acceptReplacement) &&
      !exported.content.includes('Alpha original sentence.') &&
      exported.content.includes('Untouched middle paragraph.');
    const runRecorded = insertedRuns.some((run) => run.status === 'exported' && run.mode === 'export_clean');
    const ok = contentOk && runRecorded;
    expect(ok).toBe(true);
    recordBoundary(evidence, 'revision_history_persist', {
      status: ok ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: ok,
      detail: `export content reflects persisted decision; run recorded=${runRecorded}`,
      data: { run_recorded: runRecorded, content_type: exported.contentType, authority_source: 'real_authority' },
    });
  });

  it('negative_control: a fabricated, unsupported anchor is classified no_match and withheld', () => {
    const hydration = findHydrationChunkForAnchor(
      'The glacier split open beneath the burning observatory while Marcus raised a silver compass.',
      [{ content: shortManuscriptChunk }],
    );
    const admission = runWorkbenchAdmissionGate({
      id: 'shadow-negative-1',
      readiness: 'withheld_unsupported',
      groundingStatus: 'unsupported_blocked',
      preflightStatus: 'blocked',
      contextQuality: 'blocked',
      anchor: 'The glacier split open beneath the burning observatory while Marcus raised a silver compass.',
      quoteHighlight: null,
      quoteRest: null,
      revisionOperation: 'replace_selected_passage',
      ...diagnosticFields,
      options: [
        { key: 'A', candidateText: shortCandidates.a },
        { key: 'B', candidateText: shortCandidates.b },
        { key: 'C', candidateText: shortCandidates.c },
      ],
    });
    const ok = hydration.diagnostic.strategy === 'no_match' && admission.admission_status === 'withheld';
    expect(ok).toBe(true);
    recordBoundary(evidence, 'negative_control', {
      status: ok ? STATUS.PASS : STATUS.FAIL,
      executed: true,
      reconciled: ok,
      detail: `hydration=${hydration.diagnostic.strategy} admission=${admission.admission_status}`,
      data: { strategy: hydration.diagnostic.strategy, reasons: admission.reasons, authority_source: 'real_authority' },
    });
  });

  afterAll(() => {
    computeOverall(evidence);
    const outDir = join(process.cwd(), 'proof-artifacts');
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, 'c2-shadow-proof-artifact.json');
    const summary = renderSummary(evidence);
    writeFileSync(jsonPath, JSON.stringify(evidence, null, 2));
    writeFileSync(join(outDir, 'c2-shadow-proof-summary.txt'), summary + '\n');
    // Surface the boundary map in the Jest output for CI evidence.

    console.log('\n' + summary + `\nShadow artifact written: ${jsonPath}`);

    // Fail-closed self-check: a green shadow run MUST earn SHADOW_PASS and MUST
    // NOT masquerade as a live PASS.
    expect(evidence.overall.status).toBe(OVERALL_STATUS.SHADOW_PASS);
    expect(evidence.overall.status).not.toBe(STATUS.PASS);
  });
});
