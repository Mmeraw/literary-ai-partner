import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// TEST 2: Gate Enforcement Integrity
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Create test manuscripts with different readiness levels
        const testCases = [];

        // Case 1: Low readiness (should block Phase 2)
        const lowReadinessMs = await base44.asServiceRole.entities.Manuscript.create({
            title: `[TEST] Low Readiness ${Date.now()}`,
            full_text: 'Test manuscript with low readiness score. '.repeat(5000),
            word_count: 50000,
            spine_score: 5.5
        });

        // Create chapters for test manuscript
        for (let i = 1; i <= 6; i++) {
            await base44.asServiceRole.entities.Chapter.create({
                manuscript_id: lowReadinessMs.id,
                order: i,
                title: `Chapter ${i}`,
                text: 'Chapter text. '.repeat(1000),
                word_count: 2000,
                status: 'evaluated',
                evaluation_score: 5.5
            });
        }

        // Trigger evaluation
        await base44.asServiceRole.functions.invoke('evaluateFullManuscript', { 
            manuscript_id: lowReadinessMs.id 
        });

        // Wait for completion (poll)
        let attempts = 0;
        let manuscript = lowReadinessMs;
        while (attempts < 30 && !['ready', 'ready_with_errors', 'failed'].includes(manuscript.status)) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            [manuscript] = await base44.asServiceRole.entities.Manuscript.filter({ id: lowReadinessMs.id });
            attempts++;
        }

        // Fetch gate decision
        const runs = await base44.asServiceRole.entities.EvaluationRun.filter({ projectId: lowReadinessMs.id });
        const run = runs[0];
        const gates = await base44.asServiceRole.entities.EvaluationGateDecision.filter({ runId: run?.id });
        const gate = gates[0];

        const case1Passed = gate && gate.phase2Allowed === false && gate.phase2BlockReason;

        testCases.push({
            case: 'Low Readiness',
            passed: case1Passed,
            evidence: {
                manuscriptId: lowReadinessMs.id,
                runId: run?.id,
                readinessValue: gate?.readinessValue,
                readinessPassed: gate?.readinessPassed,
                phase2Allowed: gate?.phase2Allowed,
                phase2BlockReason: gate?.phase2BlockReason,
                status: run?.status
            }
        });

        // Cleanup
        await base44.asServiceRole.entities.Manuscript.delete(lowReadinessMs.id);

        return Response.json({
            testName: 'Gate Enforcement Integrity',
            passed: testCases.every(t => t.passed),
            timestamp: new Date().toISOString(),
            testCases,
            summary: {
                total: testCases.length,
                passed: testCases.filter(t => t.passed).length,
                failed: testCases.filter(t => !t.passed).length
            }
        });

    } catch (error) {
        console.error('Test execution error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});