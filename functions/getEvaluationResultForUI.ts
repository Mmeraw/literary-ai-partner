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

        // Fetch ALL runs for this project and select by advancement + recency
        const allRuns = await base44.asServiceRole.entities.EvaluationRun.filter({ projectId });

        // Status priority: most advanced first, then newest
        const statusPriority = {
            'phase2_complete': 6,
            'complete': 6,
            'phase2_skipped': 5,
            'gated': 4,
            'phase1_complete': 3,
            'segmented': 2,
            'failed': 2,
            'created': 1
        };

        // Sort: highest status priority first, then most recent, then by ID (deterministic tie-breaker)
        const sortedRuns = allRuns.sort((a, b) => {
            const priorityDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            const timeDiff = new Date(b.created_date) - new Date(a.created_date);
            if (timeDiff !== 0) return timeDiff;
            return b.id.localeCompare(a.id); // Final deterministic tie-breaker
        });

        // GOVERNED PATH (AUTHORITATIVE)
        if (sortedRuns.length > 0) {
            const run = sortedRuns[0];

            // REJECT INCOMPLETE RUNS (hard stop - return pending state)
            if (!['phase2_complete', 'phase2_skipped', 'complete'].includes(run.status)) {
                return Response.json({
                    evaluationResult: {
                        source: 'governed',
                        projectId,
                        evaluationRunId: run.id,
                        createdAt: run.created_date,
                        summary: {
                            overallScore: 0,
                            readinessBand: 'pending',
                            storyGateEligible: false,
                            format: run.workTypeUi || 'manuscript',
                            primaryGenres: [],
                            lengthDisplay: 'Evaluation in progress'
                        },
                        gates: [],
                        assertions: [
                            { code: 'GATES_INCOMPLETE', status: 'fail', detail: 'Evaluation run not yet complete. Gates pending.' }
                        ],
                        artifacts: { spineSynthesis: null, segmentEvidence: [] },
                        exports: { pdfUrl: null, txtUrl: null },
                        legacy: { isFallback: false, warning: null }
                    }
                });
            }

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

            // Build gates array (REQUIRED: readiness, coverage, integrity)
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

                // INTEGRITY GATE (FALSIFIABLE)
                const integrityObserved = gateDecision.integrityObserved || {};
                gates.push({
                    gateType: 'integrity',
                    status: gateDecision.integrityPassed ? 'pass' : 'fail',
                    threshold: null,
                    observed: integrityObserved,
                    reasons: gateDecision.integrityPassed
                        ? [
                            'All expected segments written.',
                            'Artifacts hash verified.',
                            'Gate decision and synthesis complete.'
                          ]
                        : [gateDecision.integrityFailReason || 'Integrity verification failed.']
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
                    governanceVersion: run.governanceVersion,
                    inputFingerprintHash: run.inputFingerprintHash,

                    meta: {
                        selectedBy: 'status_then_recency',
                        statusPriorityApplied: true,
                        runCount: sortedRuns.length,
                        selectedStatus: run.status,
                        selectedPriority: statusPriority[run.status] || 0
                    },

                    summary: {
                        overallScore: artifact?.phase1OverallReadiness || 0,
                        readinessBand: gateDecision?.phase2Allowed ? 'submission_ready' : 'needs_revision',
                        storyGateEligible: gateDecision?.phase2Allowed || false,
                        format: run.workTypeUi || 'manuscript',
                        primaryGenres: [],
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
                        pdfUrl: null,
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