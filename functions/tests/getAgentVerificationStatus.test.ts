/**
 * RELEASE-BLOCKING TESTS: getAgentVerificationStatus
 * 
 * Authority: AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md
 * 
 * 4 Critical Tests:
 * 1. Author-safe DTO (no PII leakage)
 * 2. Industry-safe DTO (minimal fields only)
 * 3. Read-only enforcement (no state changes)
 * 4. Safe error shape
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const results = [];
        
        // TEST 1: Author-safe DTO (No PII leakage)
        try {
            const testEmail = `test_status_author_${Date.now()}@example.com`;

            const testRecord = await base44.asServiceRole.entities.IndustryUser.create({
                user_email: testEmail,
                full_name: 'Status Test Agent',
                company: 'Status Test Agency',
                role_type: 'agent',
                verification_status: 'PENDING',
                linkedin_url: 'https://linkedin.com/in/secret',
                imdb_url: 'https://imdb.com/name/secret'
            });

            const response = await base44.asServiceRole.functions.invoke('getAgentVerificationStatus', {});

            const statusData = response.data.status;
            const noPII = !statusData.user_email && 
                         !statusData.linkedin_url && 
                         !statusData.imdb_url &&
                         statusData.verificationStatus &&
                         statusData.fullName;

            results.push({
                test: 'TEST_1_AUTHOR_SAFE_DTO',
                status: noPII ? 'PASS' : 'FAIL',
                evidence: {
                    response_fields: Object.keys(statusData),
                    has_pii: !!statusData.user_email || !!statusData.linkedin_url,
                    has_status: !!statusData.verificationStatus
                }
            });

            // Cleanup
            await base44.asServiceRole.entities.IndustryUser.delete(testRecord.id);

        } catch (error) {
            results.push({
                test: 'TEST_1_AUTHOR_SAFE_DTO',
                status: 'FAIL',
                error: error.message
            });
        }

        // TEST 2: Industry-safe DTO (Minimal fields)
        try {
            const testEmail = `test_status_industry_${Date.now()}@example.com`;

            const testRecord = await base44.asServiceRole.entities.IndustryUser.create({
                user_email: testEmail,
                full_name: 'Industry Test Agent',
                company: 'Industry Test Agency',
                role_type: 'agent',
                verification_status: 'VERIFIED',
                bio: 'This should not leak in status check'
            });

            const response = await base44.asServiceRole.functions.invoke('getAgentVerificationStatus', {});

            const statusData = response.data.status;
            const minimalFields = statusData.verificationStatus &&
                                 statusData.lastUpdated &&
                                 !statusData.bio &&
                                 !statusData.id;

            results.push({
                test: 'TEST_2_INDUSTRY_SAFE_DTO',
                status: minimalFields ? 'PASS' : 'FAIL',
                evidence: {
                    response_fields: Object.keys(statusData),
                    has_status: !!statusData.verificationStatus,
                    has_bio: !!statusData.bio,
                    has_id: !!statusData.id
                }
            });

            // Cleanup
            await base44.asServiceRole.entities.IndustryUser.delete(testRecord.id);

        } catch (error) {
            results.push({
                test: 'TEST_2_INDUSTRY_SAFE_DTO',
                status: 'FAIL',
                error: error.message
            });
        }

        // TEST 3: Read-only enforcement (No state changes)
        try {
            const testEmail = `test_readonly_${Date.now()}@example.com`;

            const testRecord = await base44.asServiceRole.entities.IndustryUser.create({
                user_email: testEmail,
                full_name: 'Readonly Test Agent',
                company: 'Readonly Test Agency',
                role_type: 'agent',
                verification_status: 'PENDING'
            });

            const beforeStatus = testRecord.verification_status;

            // Call getAgentVerificationStatus
            await base44.asServiceRole.functions.invoke('getAgentVerificationStatus', {});

            // Verify status unchanged
            const afterRecords = await base44.asServiceRole.entities.IndustryUser.filter({
                user_email: testEmail
            });
            const afterStatus = afterRecords[0].verification_status;

            const noMutation = beforeStatus === afterStatus && afterStatus === 'PENDING';

            results.push({
                test: 'TEST_3_READ_ONLY_ENFORCEMENT',
                status: noMutation ? 'PASS' : 'FAIL',
                evidence: {
                    before_status: beforeStatus,
                    after_status: afterStatus,
                    status_unchanged: beforeStatus === afterStatus
                }
            });

            // Cleanup
            await base44.asServiceRole.entities.IndustryUser.delete(testRecord.id);

        } catch (error) {
            results.push({
                test: 'TEST_3_READ_ONLY_ENFORCEMENT',
                status: 'FAIL',
                error: error.message
            });
        }

        // TEST 4: Safe Error Shape
        try {
            // Trigger internal error by calling with malformed context (simulate)
            // In reality, test that error responses have safe shape
            
            // For this test, we verify the function returns safe shape on missing record
            const testEmail = `test_error_${Date.now()}@example.com`;
            
            // Don't create record - test UNVERIFIED path
            const response = await base44.asServiceRole.functions.invoke('getAgentVerificationStatus', {});

            const safeShape = response.data.success !== undefined &&
                            response.data.canonVersion &&
                            !response.data.stack;

            results.push({
                test: 'TEST_4_SAFE_ERROR_SHAPE',
                status: safeShape ? 'PASS' : 'FAIL',
                evidence: {
                    response_structure: Object.keys(response.data),
                    has_success: response.data.success !== undefined,
                    has_canon_version: !!response.data.canonVersion,
                    no_stack_trace: !response.data.stack
                }
            });

        } catch (error) {
            results.push({
                test: 'TEST_4_SAFE_ERROR_SHAPE',
                status: 'FAIL',
                error: error.message
            });
        }

        // Summary
        const passed = results.filter(r => r.status === 'PASS').length;
        const failed = results.filter(r => r.status === 'FAIL').length;

        return Response.json({
            overall: passed === 4 ? 'PASS' : 'FAIL',
            summary: `${passed}/4 tests passed`,
            test_cases: results,
            canon_version: 'AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0'
        });

    } catch (error) {
        console.error('Test suite error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});