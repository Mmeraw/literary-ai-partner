import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// TEST 3: Deterministic Run Selection
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Create test manuscript
        const testMs = await base44.asServiceRole.entities.Manuscript.create({
            title: `[TEST] Run Selection ${Date.now()}`,
            full_text: 'Test manuscript. '.repeat(10000),
            word_count: 50000
        });

        // Create Run A - phase2_complete (older)
        const runA = await base44.asServiceRole.entities.EvaluationRun.create({
            projectId: testMs.id,
            workTypeUi: 'manuscript',
            sourceFileId: testMs.id,
            sourceFilename: testMs.title,
            sourceWordCountEstimate: 50000,
            inputFingerprintHash: 'hash_a',
            governanceVersion: 'EVAL_METHOD_v1.0.0',
            status: 'phase2_complete'
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Create Run B - gated (newer, less advanced)
        const runB = await base44.asServiceRole.entities.EvaluationRun.create({
            projectId: testMs.id,
            workTypeUi: 'manuscript',
            sourceFileId: testMs.id,
            sourceFilename: testMs.title,
            sourceWordCountEstimate: 50000,
            inputFingerprintHash: 'hash_b',
            governanceVersion: 'EVAL_METHOD_v1.0.0',
            status: 'gated'
        });

        // Call getEvaluationResultForUI
        const response = await base44.asServiceRole.functions.invoke('getEvaluationResultForUI', {
            projectId: testMs.id
        });

        const result = response.data.evaluationResult;

        // EXPECTED: Should select Run A (phase2_complete beats gated)
        const selectedCorrectRun = result.evaluationRunId === runA.id;
        const hasSelectionMeta = result.meta?.runCount === 2 && result.meta?.selectedStatus && result.meta?.selectedPriority !== undefined;

        // Cleanup
        await base44.asServiceRole.entities.EvaluationRun.delete(runA.id);
        await base44.asServiceRole.entities.EvaluationRun.delete(runB.id);
        await base44.asServiceRole.entities.Manuscript.delete(testMs.id);

        return Response.json({
            testName: 'Deterministic Run Selection',
            passed: selectedCorrectRun && hasSelectionMeta,
            timestamp: new Date().toISOString(),
            evidence: {
                runAId: runA.id,
                runAStatus: 'phase2_complete',
                runBId: runB.id,
                runBStatus: 'gated',
                selectedRunId: result.evaluationRunId,
                selectedCorrectRun,
                hasSelectionMeta,
                meta: result.meta
            }
        });

    } catch (error) {
        console.error('Test execution error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});