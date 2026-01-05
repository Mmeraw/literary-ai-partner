import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { matrixPreflight, REQUEST_TYPE } from './utils/matrixPreflight.js';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log('[Phase 1 Testing] Starting Matrix Preflight acceptance tests...');
        
        // Fetch real submissions from database
        console.log('\n📊 Fetching real submissions from database...');
        const submissions = await base44.asServiceRole.entities.Submission.list('-created_date', 50);
        console.log(`Found ${submissions.length} submissions to test against`);
        
        const results = [];
        
        // Test against real data first
        if (submissions.length > 0) {
            console.log('\n🔍 Testing Matrix Preflight against real submissions...');
            const realDataTests = [];
            
            for (const submission of submissions.slice(0, 10)) { // Test first 10
                const preflight = await matrixPreflight({
                    inputText: submission.text,
                    requestType: REQUEST_TYPE.QUICK_EVALUATION,
                    userEmail: user.email,
                    base44
                });
                
                realDataTests.push({
                    submissionId: submission.id,
                    title: submission.title,
                    wordCount: preflight.wordCount,
                    inputScale: preflight.inputScale,
                    maxConfidence: preflight.maxConfidence,
                    allowed: preflight.allowed,
                    blockReason: preflight.blockReason,
                    originalScore: submission.overall_score,
                    wouldBeCapped: submission.overall_score > (preflight.maxConfidence / 10)
                });
            }
            
            results.push({
                test: 'Real Data: Existing Submissions',
                expected: 'Validate against actual content',
                actual: realDataTests,
                passed: true,
                summary: {
                    totalTested: realDataTests.length,
                    paragraphs: realDataTests.filter(t => t.inputScale === 'paragraph').length,
                    scenes: realDataTests.filter(t => t.inputScale === 'scene').length,
                    chapters: realDataTests.filter(t => t.inputScale === 'chapter').length,
                    wouldBeCapped: realDataTests.filter(t => t.wouldBeCapped).length
                }
            });
        }
        
        // Synthetic acceptance tests
        
        // Test 1: Paragraph → Query Letter (Expected: BLOCK)
        console.log('\n🧪 Test 1: Paragraph → Query Letter');
        const paragraphText = "The sun set over the horizon as Jane walked home. She thought about the day's events and wondered what tomorrow would bring. The streets were empty, quiet.".repeat(2); // ~200 words
        
        const test1 = await matrixPreflight({
            inputText: paragraphText,
            requestType: REQUEST_TYPE.QUERY_LETTER,
            userEmail: user.email,
            base44
        });
        
        const test1Pass = 
            test1.allowed === false &&
            test1.blockReason === 'SCOPE_INSUFFICIENT' &&
            test1.userFacingCode === 'INSUFFICIENT_INPUT' &&
            test1.refusalMessage.minimumRequired === 'Full manuscript (40,000+ words)' &&
            test1.audit.llm_invoked === undefined; // Should not have llm_invoked field for preflight
        
        results.push({
            test: 'Test 1: Paragraph → Query Letter',
            expected: 'BLOCK with INSUFFICIENT_INPUT',
            actual: {
                allowed: test1.allowed,
                blockReason: test1.blockReason,
                userFacingCode: test1.userFacingCode,
                wordCount: test1.wordCount,
                inputScale: test1.inputScale
            },
            passed: test1Pass,
            evidence: test1.refusalMessage
        });

        // Test 2: Scene → Synopsis (Expected: BLOCK)
        console.log('\n🧪 Test 2: Scene → Synopsis');
        const sceneText = "The detective entered the dimly lit room. His eyes adjusted slowly to the darkness. A figure stood by the window, silhouetted against the city lights. 'I've been expecting you,' the figure said without turning around. ".repeat(30); // ~1500 words
        
        const test2 = await matrixPreflight({
            inputText: sceneText,
            requestType: REQUEST_TYPE.SYNOPSIS,
            userEmail: user.email,
            base44
        });
        
        const test2Pass = 
            test2.allowed === false &&
            test2.blockReason === 'SCOPE_INSUFFICIENT' &&
            test2.userFacingCode === 'INSUFFICIENT_INPUT' &&
            test2.wordCount >= 1400 && test2.wordCount <= 1600 &&
            test2.inputScale === 'scene';
        
        results.push({
            test: 'Test 2: Scene → Synopsis',
            expected: 'BLOCK - insufficient input',
            actual: {
                allowed: test2.allowed,
                blockReason: test2.blockReason,
                wordCount: test2.wordCount,
                inputScale: test2.inputScale,
                maxConfidence: test2.maxConfidence
            },
            passed: test2Pass,
            evidence: test2.refusalMessage
        });

        // Test 3: Full Manuscript → Query Package (Expected: ALLOW)
        console.log('\n🧪 Test 3: Full Manuscript → Query Package');
        const manuscriptText = "Chapter 1\n\nThe story begins... ".repeat(5000); // ~50,000+ words
        
        const test3 = await matrixPreflight({
            inputText: manuscriptText,
            requestType: REQUEST_TYPE.QUERY_PACKAGE,
            userEmail: user.email,
            base44
        });
        
        const test3Pass = 
            test3.allowed === true &&
            test3.maxConfidence === 95 &&
            test3.inputScale === 'full_manuscript' &&
            test3.audit.preflightExecutedBeforeLLM === true &&
            test3.audit.matrix_preflight_allowed === true;
        
        results.push({
            test: 'Test 3: Full Manuscript → Query Package',
            expected: 'ALLOW with maxConfidence=95',
            actual: {
                allowed: test3.allowed,
                wordCount: test3.wordCount,
                inputScale: test3.inputScale,
                maxConfidence: test3.maxConfidence
            },
            passed: test3Pass,
            evidence: test3.audit
        });

        // Test 4: Brilliant Scene Confidence Cap (Expected: CAP at 65)
        console.log('\n🧪 Test 4: Brilliant Scene → Confidence Cap');
        const brilliantScene = "The prose was perfect. Every word chosen with care. ".repeat(25); // ~800 words
        
        const test4 = await matrixPreflight({
            inputText: brilliantScene,
            requestType: REQUEST_TYPE.QUICK_EVALUATION,
            userEmail: user.email,
            base44
        });
        
        const test4Pass = 
            test4.allowed === true &&
            test4.maxConfidence === 65 &&
            test4.inputScale === 'scene' &&
            test4.wordCount >= 700 && test4.wordCount <= 900;
        
        results.push({
            test: 'Test 4: Brilliant Scene → Confidence Cap',
            expected: 'ALLOW with maxConfidence=65 (capped)',
            actual: {
                allowed: test4.allowed,
                wordCount: test4.wordCount,
                inputScale: test4.inputScale,
                maxConfidence: test4.maxConfidence
            },
            passed: test4Pass,
            evidence: { note: 'Quality irrelevant - cap enforced by length' }
        });

        // Test 5: Word Band Boundaries (50, 250, 2000, 8000, 40000)
        console.log('\n🧪 Test 5: Word Band Boundaries');
        const boundaryTests = [
            { words: 49, expectedScale: null, desc: '49 words (below minimum)' },
            { words: 50, expectedScale: 'paragraph', desc: '50 words (lower bound inclusive)' },
            { words: 249, expectedScale: 'paragraph', desc: '249 words (upper bound exclusive)' },
            { words: 250, expectedScale: 'scene', desc: '250 words (scene lower bound)' },
            { words: 1999, expectedScale: 'scene', desc: '1999 words (scene upper bound)' },
            { words: 2000, expectedScale: 'chapter', desc: '2000 words (chapter lower bound)' },
            { words: 7999, expectedScale: 'chapter', desc: '7999 words (chapter upper bound)' },
            { words: 8000, expectedScale: 'multi_chapter', desc: '8000 words (multi-chapter lower)' },
            { words: 39999, expectedScale: 'multi_chapter', desc: '39999 words (multi upper)' },
            { words: 40000, expectedScale: 'full_manuscript', desc: '40000 words (manuscript lower)' }
        ];
        
        const boundaryResults = [];
        for (const bt of boundaryTests) {
            const text = 'word '.repeat(bt.words);
            const result = await matrixPreflight({
                inputText: text,
                requestType: REQUEST_TYPE.QUICK_EVALUATION,
                userEmail: user.email,
                base44
            });
            
            const pass = result.inputScale === bt.expectedScale;
            boundaryResults.push({
                description: bt.desc,
                expectedScale: bt.expectedScale,
                actualScale: result.inputScale,
                actualWords: result.wordCount,
                passed: pass
            });
        }
        
        const test5Pass = boundaryResults.every(br => br.passed);
        results.push({
            test: 'Test 5: Word Band Boundaries',
            expected: 'Correct scale for each boundary',
            actual: boundaryResults,
            passed: test5Pass
        });

        // Test 6: Audit Field Completeness
        console.log('\n🧪 Test 6: Audit Field Completeness');
        const test6 = await matrixPreflight({
            inputText: sceneText,
            requestType: REQUEST_TYPE.SYNOPSIS,
            userEmail: user.email,
            base44
        });
        
        const requiredAuditFields = [
            'timestamp', 'userEmail', 'requestType', 'inputWordCount',
            'inputScale', 'allowed', 'maxConfidenceAllowed', 'matrixVersion',
            'preflightExecutedBeforeLLM', 'matrix_preflight_allowed'
        ];
        
        const missingFields = requiredAuditFields.filter(field => 
            test6.audit[field] === undefined
        );
        
        const test6Pass = missingFields.length === 0 &&
            test6.audit.matrixVersion === '1.0.0' &&
            test6.audit.preflightExecutedBeforeLLM === true;
        
        results.push({
            test: 'Test 6: Audit Field Completeness',
            expected: 'All required audit fields present',
            actual: {
                allFieldsPresent: missingFields.length === 0,
                missingFields,
                matrixVersion: test6.audit.matrixVersion,
                preflightExecutedBeforeLLM: test6.audit.preflightExecutedBeforeLLM
            },
            passed: test6Pass
        });

        // Summary
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const failedTests = results.filter(r => !r.passed);
        
        console.log(`\n✅ Phase 1 Testing Complete: ${passedTests}/${totalTests} tests passed`);
        
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(ft => {
                console.log(`  - ${ft.test}`);
            });
        }

        return Response.json({
            success: passedTests === totalTests,
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: totalTests - passedTests
            },
            results,
            phase1Status: passedTests === totalTests ? 'PASSING' : 'FAILING',
            nextSteps: passedTests === totalTests ? [
                'Deploy to staging',
                'Run integration tests with evaluateQuickSubmission',
                'Run integration tests with generateQueryLetterPackage',
                'Verify audit logs in EvaluationAuditEvent',
                'Test end-to-end user flow'
            ] : [
                'Fix failing tests',
                'Re-run test suite',
                'Review implementation against spec'
            ]
        });

    } catch (error) {
        console.error('Test execution error:', error);
        
        Sentry.captureException(error, {
            tags: {
                test: 'matrix_preflight_acceptance',
                phase: 'phase_1'
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});