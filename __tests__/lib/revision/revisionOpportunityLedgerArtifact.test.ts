import {
  buildRevisionOpportunityLedger,
  REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE,
} from '@/lib/revision/revisionOpportunityLedgerArtifact';
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from '@/lib/revision/workbenchQueue';

function makeOpportunity(): WorkbenchOpportunity {
  return {
    id: 'opp-1',
    severity: 'must',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'Pacing',
    leverage: 'Pacing',
    crumb: 'Pacing · passage:1',
    title: 'Abrupt transition',
    issueStatement: 'Abrupt transition',
    meta: 'Pacing · passage:1',
    confidence: '91% confidence',
    anchor: 'passage:1',
    quoteHighlight: 'Mara stopped at the chapel door',
    quoteRest: ' and waited for the hymn to end.',
    symptom: 'The transition skips the connective beat.',
    cause: 'The scene cuts before the reader can track consequence.',
    fixDirection: 'Insert a connective beat before the hard cut.',
    readerEffect: 'Readers retain causal continuity.',
    mistakeProofing: 'Do not add new plot facts.',
    diagnostic: {
      symptom: 'The transition skips the connective beat.',
      cause: 'The scene cuts before the reader can track consequence.',
      fixStrategy: 'Insert a connective beat before the hard cut.',
      readerImpact: 'Readers retain causal continuity.',
      evidence: {
        quotedExcerpt: 'Mara stopped at the chapel door and waited for the hymn to end.',
        locationLabel: 'passage:1',
      },
      operationTargeting: 'Passage · passage:1',
      mistakeProofing: 'Do not add new plot facts.',
    },
    revisionOperation: 'insert_after_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    groundingStatus: 'supported',
    groundingNote: null,
    options: [
      {
        key: 'A',
        mechanism: 'Recommended repair',
        candidateText: 'Mara waited at the chapel door until the hymn thinned, then stepped inside.',
        text: 'Mara waited at the chapel door until the hymn thinned, then stepped inside.',
        rationale: 'Keeps the transition grounded.',
      },
      {
        key: 'B',
        mechanism: 'Rhythm variant',
        candidateText: 'At the chapel door, Mara let the hymn finish before she crossed the threshold.',
        text: 'At the chapel door, Mara let the hymn finish before she crossed the threshold.',
        rationale: 'Softens the transition.',
      },
      {
        key: 'C',
        mechanism: 'Bolder rendering shift',
        candidateText: 'The hymn ended before Mara moved, leaving the doorway to hold her choice a moment longer.',
        text: 'The hymn ended before Mara moved, leaving the doorway to hold her choice a moment longer.',
        rationale: 'Adds pressure to the beat.',
      },
    ],
  };
}

describe('buildRevisionOpportunityLedger', () => {
  it('emits canonical revision_opportunity_ledger_v1 content, not a Workbench UI payload', () => {
    const payload: WorkbenchQueuePayload = {
      ok: true,
      error: null,
      manuscriptId: '6074',
      evaluationJobId: 'job-123',
      manuscriptTitle: 'Sister',
      opportunities: [makeOpportunity()],
      needsTargeting: [],
      readinessTotals: { ready_for_revise: 1, needs_targeting: 0 },
      totals: { must: 1, should: 0, could: 0 },
      scopes: { Line: 0, Passage: 1, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
      criteria: { Pacing: 1 },
      synthesis: { admitted: 1, clustered: 0, held: 0, suppressed: 0 },
    };

    const ledger = buildRevisionOpportunityLedger({
      jobId: 'job-123',
      manuscriptId: '6074',
      payload,
    });

    expect(ledger).toMatchObject({
      job_id: 'job-123',
      evaluation_project_id: null,
      manuscript_id: 6074,
      manuscript_version_hash: 'manuscript_6074_job-123',
      artifact_type: REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE,
      artifact_version: 'v1',
    });
    expect(typeof ledger.artifact_id).toBe('string');
    expect(typeof ledger.source_hash).toBe('string');
    expect(typeof ledger.generated_at).toBe('string');
    expect((ledger as Record<string, unknown>).schema_version).toBeUndefined();
    expect((ledger as Record<string, unknown>).totals).toBeUndefined();
    expect((ledger as Record<string, unknown>).scopes).toBeUndefined();
    expect((ledger as Record<string, unknown>).synthesis).toBeUndefined();

    expect(ledger.opportunities).toEqual([
      expect.objectContaining({
        opportunity_id: 'opp-1',
        criterion: 'Pacing',
        severity: 'must',
        rationale: 'Insert a connective beat before the hard cut.',
        evidence_anchor: 'Mara stopped at the chapel door and waited for the hymn to end.',
        manuscript_coordinates: 'passage:1',
        provenance: 'evaluation',
        confidence: 'high',
        decision_state: 'open',
      }),
    ]);
  });
});
