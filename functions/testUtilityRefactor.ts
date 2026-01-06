/**
 * Test utility refactor - verify service function invocations work
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const testResults = [];

        // Test 1: governanceVersion service
        console.log('🧪 Test 1: governanceVersion service...');
        try {
            const versionResponse = await base44.asServiceRole.functions.invoke('governanceVersion', {
                action: 'getVersion'
            });
            testResults.push({
                test: 'governanceVersion.getVersion',
                status: versionResponse.data?.governanceVersion === '1.0.0' ? 'PASS' : 'FAIL',
                result: versionResponse.data
            });
        } catch (error) {
            testResults.push({
                test: 'governanceVersion.getVersion',
                status: 'FAIL',
                error: error.message
            });
        }

        // Test 2: governanceVersion - buildAuditBase
        console.log('🧪 Test 2: governanceVersion.buildAuditBase...');
        try {
            const auditResponse = await base44.asServiceRole.functions.invoke('governanceVersion', {
                action: 'buildAuditBase',
                eventName: 'TEST_EVENT',
                functionId: 'testUtilityRefactor',
                canonHash: 'TEST_CANON_v1',
                userEmail: user.email,
                requestId: 'test_123'
            });
            const hasRequiredFields = auditResponse.data?.event_id && 
                                     auditResponse.data?.timestamp_utc && 
                                     auditResponse.data?.governance_version === '1.0.0';
            testResults.push({
                test: 'governanceVersion.buildAuditBase',
                status: hasRequiredFields ? 'PASS' : 'FAIL',
                result: auditResponse.data
            });
        } catch (error) {
            testResults.push({
                test: 'governanceVersion.buildAuditBase',
                status: 'FAIL',
                error: error.message
            });
        }

        // Test 3: governanceVersion - buildRefusalResponse
        console.log('🧪 Test 3: governanceVersion.buildRefusalResponse...');
        try {
            const refusalResponse = await base44.asServiceRole.functions.invoke('governanceVersion', {
                action: 'buildRefusalResponse',
                status: 'blocked',
                code: 'TEST_BLOCK',
                userMessage: 'Test message',
                refusalReason: 'TEST_REASON',
                nextAction: 'retry'
            });
            const hasRequiredFields = refusalResponse.data?.status === 'blocked' && 
                                     refusalResponse.data?.code === 'TEST_BLOCK';
            testResults.push({
                test: 'governanceVersion.buildRefusalResponse',
                status: hasRequiredFields ? 'PASS' : 'FAIL',
                result: refusalResponse.data
            });
        } catch (error) {
            testResults.push({
                test: 'governanceVersion.buildRefusalResponse',
                status: 'FAIL',
                error: error.message
            });
        }

        // Test 4: matrixPreflight - insufficient input
        console.log('🧪 Test 4: matrixPreflight (should block short text)...');
        try {
            const preflightResponse = await base44.asServiceRole.functions.invoke('matrixPreflight', {
                inputText: 'Too short',
                requestType: 'quick_evaluation',
                userEmail: user.email
            });
            testResults.push({
                test: 'matrixPreflight.blockShortInput',
                status: preflightResponse.data?.allowed === false ? 'PASS' : 'FAIL',
                result: {
                    allowed: preflightResponse.data?.allowed,
                    blockReason: preflightResponse.data?.blockReason,
                    wordCount: preflightResponse.data?.wordCount
                }
            });
        } catch (error) {
            testResults.push({
                test: 'matrixPreflight.blockShortInput',
                status: 'FAIL',
                error: error.message
            });
        }

        // Test 5: matrixPreflight - sufficient input
        console.log('🧪 Test 5: matrixPreflight (should allow valid text)...');
        try {
            const validText = 'This is a longer text with sufficient words to pass the minimum threshold. '.repeat(5);
            const preflightResponse = await base44.asServiceRole.functions.invoke('matrixPreflight', {
                inputText: validText,
                requestType: 'quick_evaluation',
                userEmail: user.email
            });
            testResults.push({
                test: 'matrixPreflight.allowValidInput',
                status: preflightResponse.data?.allowed === true ? 'PASS' : 'FAIL',
                result: {
                    allowed: preflightResponse.data?.allowed,
                    wordCount: preflightResponse.data?.wordCount,
                    inputScale: preflightResponse.data?.inputScale,
                    maxConfidence: preflightResponse.data?.maxConfidence
                }
            });
        } catch (error) {
            testResults.push({
                test: 'matrixPreflight.allowValidInput',
                status: 'FAIL',
                error: error.message
            });
        }

        // Test 6: matrixPreflight - query package requires full manuscript
        console.log('🧪 Test 6: matrixPreflight (query package should require full manuscript)...');
        try {
            const shortText = 'Short text. '.repeat(100); // ~200 words (scene level)
            const preflightResponse = await base44.asServiceRole.functions.invoke('matrixPreflight', {
                inputText: shortText,
                requestType: 'query_package',
                userEmail: user.email
            });
            testResults.push({
                test: 'matrixPreflight.blockQueryPackage',
                status: preflightResponse.data?.allowed === false ? 'PASS' : 'FAIL',
                result: {
                    allowed: preflightResponse.data?.allowed,
                    blockReason: preflightResponse.data?.blockReason,
                    inputScale: preflightResponse.data?.inputScale,
                    refusalMessage: preflightResponse.data?.refusalMessage
                }
            });
        } catch (error) {
            testResults.push({
                test: 'matrixPreflight.blockQueryPackage',
                status: 'FAIL',
                error: error.message
            });
        }

        // Summary
        const passCount = testResults.filter(t => t.status === 'PASS').length;
        const failCount = testResults.filter(t => t.status === 'FAIL').length;
        const totalCount = testResults.length;

        console.log(`\n✅ Tests complete: ${passCount}/${totalCount} passed`);

        return Response.json({
            success: passCount === totalCount,
            summary: {
                total: totalCount,
                passed: passCount,
                failed: failCount
            },
            tests: testResults,
            message: passCount === totalCount 
                ? '✅ All utility refactor tests passed! Service functions working correctly.' 
                : `⚠️ ${failCount} test(s) failed. Review details above.`
        });

    } catch (error) {
        console.error('Test suite error:', error);
        return Response.json({ 
            error: 'Test suite failed',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});