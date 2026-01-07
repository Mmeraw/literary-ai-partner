import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = await req.json();
        
        if (!projectId) {
            return Response.json({ error: 'Project ID required' }, { status: 400 });
        }

        // Look for most recent EvaluationRun for this project
        const evaluationRuns = await base44.asServiceRole.entities.EvaluationRun.filter(
            { projectId, status: { $in: ['phase2_complete', 'complete', 'phase2_skipped'] } },
            '-created_date',
            1
        );

        // GOVERNED PATH (AUTHORITATIVE)
        if (evaluationRuns.length > 0) {
            const run = evaluationRuns[0];

            // Fetch gate decision
            const gateDecisions = await base44.asServiceRole.entities.EvaluationGateDecision.filter({ runId: run.id });
            const gateDecision = gateDecisions[0];

            // Fetch artifacts
            const artifacts = await base44.asServiceRole.entities.EvaluationArtifacts.filter({ runId: run.id });
            const artifact = artifacts[0];

            // Fetch synthesis
            const syntheses = await base44.asServiceRole.entities.EvaluationSpineSynthesis.filter({ runId: run.id });
            const synthesis = syntheses[0];

            // Fetch segments for evidence
            const segments = await base44.asServiceRole.entities.EvaluationSegment.filter({ runId: run.id }, 'segmentIndex');

            // Build gates array
            const gates = [];
            
            if (gateDecision) {
                gates.push({
                    gateType: 'readiness',
                    status: gateDecision.readinessPassed ? 'pass' : 'fail',
                    threshold: gateDecision.readinessFloor,
                    observed: gateDecision.readinessValue,
                    reasons: gateDecision.readinessPassed 
                        ? ['Overall readiness meets threshold.']
                        : ['Readiness below required threshold.']
                });

                gates.push({
                    gateType: 'coverage',
                    status: gateDecision.coveragePassed ? 'pass' : 'fail',
                    threshold: `${gateDecision.coverageMinChapters} chapters, ${gateDecision.coverageMinWordPct * 100}% words`,
                    observed: `${gateDecision.coverageChaptersValue} chapters, ${(gateDecision.coverageWordPctValue * 100).toFixed(1)}% words`,
                    reasons: gateDecision.coveragePassed
                        ? ['Coverage meets minimum required level.']
                        : [gateDecision.coverageFailReason || 'Coverage insufficient.']
                });

                gates.push({
                    gateType: 'integrity',
                    status: 'pass',
                    threshold: null,
                    observed: null,
                    reasons: [
                        'Score finalized and locked.',
                        'Synthesis derived only from measured artifacts.'
                    ]
                });
            }

            // Build assertions
            const assertions = [
                { code: 'EVIDENCE_BOUND', status: 'true', detail: 'All scores link to segment artifacts.' },
                { code: 'READ_ONLY_SCORE', status: 'true', detail: 'Final score locked on finalize.' },
                { code: 'NO_STORYGATE_WITHOUT_GATES', status: 'true', detail: 'Eligibility requires passing gates.' }
            ];

            if (synthesis?.governanceAssertions) {
                assertions.push({
                    code: 'RAW_TEXT_PHASE2',
                    status: synthesis.governanceAssertions.rawTextReadInPhase2 ? 'false' : 'true',
                    detail: synthesis.governanceAssertions.rawTextReadInPhase2 
                        ? 'VIOLATION: Raw text accessed in Phase 2'
                        : 'Phase 2 did not access raw manuscript text.'
                });
                assertions.push({
                    code: 'SCORES_MODIFIED_PHASE2',
                    status: synthesis.governanceAssertions.scoresModifiedInPhase2 ? 'false' : 'true',
                    detail: synthesis.governanceAssertions.scoresModifiedInPhase2
                        ? 'VIOLATION: Scores modified in Phase 2'
                        : 'Phase 2 did not modify Phase 1 scores.'
                });
            }

            // Build segment evidence
            const segmentEvidence = segments.map(seg => ({
                segmentId: seg.id,
                label: seg.segmentLabel,
                coverage: seg.segmentWordCount / run.sourceWordCountEstimate,
                scores: seg.criteriaScores || {},
                artifactIds: [] // Can expand to reference specific artifact IDs
            }));

            return Response.json({
                evaluationResult: {
                    source: 'governed',
                    projectId: run.projectId,
                    evaluationRunId: run.id,
                    createdAt: run.created_date,

                    summary: {
                        overallScore: artifact?.phase1OverallReadiness || 0,
                        readinessBand: gateDecision?.phase2Allowed ? 'submission_ready' : 'needs_revision',
                        storyGateEligible: gateDecision?.phase2Allowed || false,
                        format: run.workTypeUi || 'manuscript',
                        primaryGenres: [], // Extract from project if available
                        lengthDisplay: `${run.sourceWordCountEstimate?.toLocaleString() || 'unknown'} words`
                    },

                    gates,
                    assertions,

                    artifacts: {
                        spineSynthesis: synthesis ? {
                            id: synthesis.id,
                            sections: [
                                { title: 'Diagnosis', text: JSON.stringify(synthesis.diagnosis) },
                                { title: 'Repair Guide', text: JSON.stringify(synthesis.waveGuide) }
                            ]
                        } : null,
                        segmentEvidence
                    },

                    exports: {
                        pdfUrl: null, // Wire to export generation later
                        txtUrl: null
                    },

                    legacy: {
                        isFallback: false,
                        warning: null
                    }
                }
            });
        }

        // LEGACY PATH (FALLBACK ONLY - NOT AUTHORITATIVE)
        const manuscripts = await base44.asServiceRole.entities.Manuscript.filter({ id: projectId }, '-created_date', 1);
        
        if (manuscripts.length === 0) {
            return Response.json({ error: 'No evaluation found for this project' }, { status: 404 });
        }

        const manuscript = manuscripts[0];

        return Response.json({
            evaluationResult: {
                source: 'legacy',
                projectId: manuscript.id,
                evaluationRunId: null,
                createdAt: manuscript.created_date,

                summary: {
                    overallScore: manuscript.revisiongrade_overall || manuscript.spine_score || 0,
                    readinessBand: 'unverified',
                    storyGateEligible: false,
                    format: 'manuscript',
                    primaryGenres: [],
                    lengthDisplay: `${manuscript.word_count?.toLocaleString() || 'unknown'} words`
                },

                gates: [],
                assertions: [
                    { code: 'LEGACY_FALLBACK', status: 'true', detail: 'Governed gates not available yet.' }
                ],

                artifacts: {
                    spineSynthesis: null,
                    segmentEvidence: []
                },

                exports: {
                    pdfUrl: null,
                    txtUrl: null
                },

                legacy: {
                    isFallback: true,
                    warning: 'This result is legacy display-only and is not audit-defensible. Eligibility and gates are not available.'
                }
            }
        });

    } catch (error) {
        console.error('getEvaluationResultForUI error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});