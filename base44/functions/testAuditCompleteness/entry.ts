import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// TEST 5: Audit Completeness
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const requiredAuditFields = [
            'endpoint',
            'policyVersion',
            'governanceStatus',
            'matrixCompliance',
            'llmInvoked',
            'confidence'
        ];

        const endpoints = [
            { name: 'generateSynopsis', validPayload: { manuscriptText: 'Valid text. '.repeat(10000), title: 'Test', genre: 'fiction' } },
            { name: 'generateQueryPitches', validPayload: { manuscriptText: 'Valid text. '.repeat(10000), logline: 'A story about testing', title: 'Test' } },
            { name: 'generateComparables', validPayload: { manuscriptText: 'Valid text. '.repeat(10000), genre: 'fiction', title: 'Test' } }
        ];

        const results = [];

        for (const endpoint of endpoints) {
            try {
                const response = await base44.asServiceRole.functions.invoke(endpoint.name, endpoint.validPayload);
                
                const audit = response.data.audit || {};
                const missingFields = requiredAuditFields.filter(field => !(field in audit));
                const hasAllFields = missingFields.length === 0;

                results.push({
                    endpoint: endpoint.name,
                    passed: hasAllFields,
                    evidence: {
                        auditPresent: !!response.data.audit,
                        missingFields,
                        presentFields: Object.keys(audit),
                        audit
                    }
                });
            } catch (error) {
                results.push({
                    endpoint: endpoint.name,
                    passed: false,
                    error: error.message
                });
            }
        }

        const allPassed = results.every(r => r.passed);

        return Response.json({
            testName: 'Audit Completeness',
            passed: allPassed,
            timestamp: new Date().toISOString(),
            requiredFields: requiredAuditFields,
            results,
            summary: {
                total: endpoints.length,
                passed: results.filter(r => r.passed).length,
                failed: results.filter(r => !r.passed).length
            }
        });

    } catch (error) {
        console.error('Test execution error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});