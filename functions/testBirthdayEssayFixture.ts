import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

// Birthday Essay Acceptance Fixture
const FIXTURE_BIRTHDAY_ESSAY = {
    title: "60th Birthday Reflection",
    text: `It was my 30th birthday last week. I spent it alone in my apartment, eating takeout and watching old movies. The silence felt heavier than usual—not oppressive, just noticeable. My mother called to ask if I had plans. I lied and said I did. Later that night, I thought about what it means to mark time this way, to celebrate survival without celebration. The candles I didn't light. The wishes I didn't make. Maybe that's what getting older is: learning to be okay with the quiet.`,
    expected_work_type: "personalEssayReflection",
    na_criteria: ["dialogue", "conflict"],
    required_criteria: ["hook", "voice", "theme", "linePolish", "technical"]
};

function checkNAEnforcement(output, fixture) {
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };
    
    // Check 1: No scores for NA criteria
    if (output.criteria) {
        for (const criterion of output.criteria) {
            const criterionIdMatch = criterion.criterion_id?.toLowerCase() || 
                                   criterion.name?.toLowerCase().match(/\b(dialogue|conflict|character|worldbuilding|stakes|pacing)\b/)?.[0];
            
            if (criterionIdMatch && fixture.na_criteria.includes(criterionIdMatch)) {
                results.failed.push(`❌ FAIL: Found score for NA criterion: ${criterion.name} (score: ${criterion.score})`);
            } else if (fixture.na_criteria.some(na => criterion.name?.toLowerCase().includes(na))) {
                results.failed.push(`❌ FAIL: Found criterion matching NA: ${criterion.name}`);
            }
        }
        
        // Verify we still have scores for required criteria
        const scoredCriteriaIds = output.criteria
            .map(c => c.criterion_id?.toLowerCase() || c.name?.toLowerCase().match(/\b(hook|voice|theme|polish|technical)\b/)?.[0])
            .filter(Boolean);
        
        const missingScoredRequired = fixture.required_criteria.filter(req => 
            !scoredCriteriaIds.includes(req.toLowerCase())
        );
        
        if (missingScoredRequired.length > 0) {
            results.warnings.push(`⚠️ WARNING: Missing scores for required criteria: ${missingScoredRequired.join(', ')}`);
        } else {
            results.passed.push(`✅ PASS: Required criteria (${fixture.required_criteria.join(', ')}) are scored`);
        }
    }
    
    // Check 2: No revision directives for NA criteria
    if (output.revisionRequests) {
        for (const req of output.revisionRequests) {
            const instruction = req.instruction.toLowerCase();
            for (const naCriterion of fixture.na_criteria) {
                if (instruction.includes(naCriterion)) {
                    results.failed.push(`❌ FAIL: Revision request references NA criterion (${naCriterion}): "${req.instruction}"`);
                }
            }
            
            // Check for indirect references
            const naTerms = {
                dialogue: ['add dialogue', 'conversation', 'speech', 'talking', 'said'],
                conflict: ['increase conflict', 'add tension', 'escalate', 'confrontation', 'stakes']
            };
            
            for (const [naCriterion, terms] of Object.entries(naTerms)) {
                if (fixture.na_criteria.includes(naCriterion)) {
                    for (const term of terms) {
                        if (instruction.includes(term)) {
                            results.failed.push(`❌ FAIL: Revision request contains NA-related term (${term}): "${req.instruction}"`);
                        }
                    }
                }
            }
        }
    }
    
    // Check 3: No WAVE items for NA criteria
    if (output.waveHits) {
        for (const hit of output.waveHits) {
            const waveItem = hit.wave_item?.toLowerCase() || '';
            const fix = hit.fix?.toLowerCase() || '';
            
            for (const naCriterion of fixture.na_criteria) {
                if (waveItem.includes(naCriterion) || fix.includes(naCriterion)) {
                    results.failed.push(`❌ FAIL: WAVE hit references NA criterion (${naCriterion}): ${hit.wave_item}`);
                }
            }
            
            // Check for dialogue-specific WAVE items
            if (fixture.na_criteria.includes('dialogue')) {
                if (waveItem.includes('dialogue tag') || waveItem.includes('said')) {
                    results.failed.push(`❌ FAIL: WAVE hit is dialogue-related: ${hit.wave_item}`);
                }
            }
        }
    }
    
    // Check 4: Work Type routing
    if (output.work_type_routing) {
        if (output.work_type_routing.final_work_type_used !== fixture.expected_work_type) {
            results.failed.push(`❌ FAIL: Work Type mismatch. Expected: ${fixture.expected_work_type}, Got: ${output.work_type_routing.final_work_type_used}`);
        } else {
            results.passed.push(`✅ PASS: Work Type correctly set to ${fixture.expected_work_type}`);
        }
        
        const naCriteriaInRouting = output.work_type_routing.na_criteria || [];
        const missingNA = fixture.na_criteria.filter(na => !naCriteriaInRouting.includes(na));
        if (missingNA.length > 0) {
            results.failed.push(`❌ FAIL: NA criteria not declared in routing: ${missingNA.join(', ')}`);
        } else {
            results.passed.push(`✅ PASS: NA criteria declared in routing: ${fixture.na_criteria.join(', ')}`);
        }
    }
    
    return results;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }
        
        console.log('[Fixture Test] Running Birthday Essay acceptance test...');
        
        // Step 1: Detect Work Type
        console.log('[Fixture Test] Step 1: Detecting Work Type...');
        const detectionResult = await base44.functions.invoke('detectWorkType', {
            text: FIXTURE_BIRTHDAY_ESSAY.text,
            title: FIXTURE_BIRTHDAY_ESSAY.title
        });
        
        console.log('[Fixture Test] Detection result:', {
            detected: detectionResult.data.detected_work_type,
            confidence: detectionResult.data.detection_confidence,
            expected: FIXTURE_BIRTHDAY_ESSAY.expected_work_type
        });
        
        // Step 2: Run evaluation with confirmed Work Type
        console.log('[Fixture Test] Step 2: Running evaluation...');
        const evaluationResult = await base44.functions.invoke('evaluateQuickSubmission', {
            title: FIXTURE_BIRTHDAY_ESSAY.title,
            text: FIXTURE_BIRTHDAY_ESSAY.text,
            styleMode: 'neutral',
            final_work_type_used: FIXTURE_BIRTHDAY_ESSAY.expected_work_type,
            detected_work_type: detectionResult.data.detected_work_type,
            detection_confidence: detectionResult.data.detection_confidence,
            user_action: 'confirm'
        });
        
        if (!evaluationResult.data.success) {
            throw new Error('Evaluation failed: ' + JSON.stringify(evaluationResult.data));
        }
        
        const output = evaluationResult.data.evaluation;
        
        console.log('[Fixture Test] Step 3: Checking NA enforcement...');
        const checks = checkNAEnforcement(output, FIXTURE_BIRTHDAY_ESSAY);
        
        // Calculate pass rate
        const totalChecks = checks.passed.length + checks.failed.length;
        const passRate = totalChecks > 0 ? (checks.passed.length / totalChecks * 100).toFixed(1) : 0;
        
        const fixturePassedAllTests = checks.failed.length === 0;
        
        // Build evidence report
        const evidence = {
            fixture: FIXTURE_BIRTHDAY_ESSAY.title,
            endpoint: 'evaluateQuickSubmission',
            routing: {
                final_work_type_used: output.work_type_routing?.final_work_type_used,
                work_type_label: output.work_type_routing?.work_type_label,
                matrix_version: output.work_type_routing?.matrix_version,
                na_criteria: output.work_type_routing?.na_criteria,
                required_criteria: output.work_type_routing?.required_criteria
            },
            na_enforcement: {
                criteria_count: output.criteria?.length || 0,
                criteria_with_na_leakage: checks.failed.filter(f => f.includes('criterion')).length,
                revision_requests_count: output.revisionRequests?.length || 0,
                revision_requests_with_na_leakage: checks.failed.filter(f => f.includes('Revision request')).length,
                wave_hits_count: output.waveHits?.length || 0,
                wave_hits_with_na_leakage: checks.failed.filter(f => f.includes('WAVE hit')).length
            },
            test_results: {
                passed: checks.passed,
                failed: checks.failed,
                warnings: checks.warnings,
                pass_rate: passRate + '%',
                fixture_passed: fixturePassedAllTests
            }
        };
        
        // Log summary
        console.log('\n========================================');
        console.log('BIRTHDAY ESSAY FIXTURE TEST SUMMARY');
        console.log('========================================');
        console.log('Fixture:', FIXTURE_BIRTHDAY_ESSAY.title);
        console.log('Work Type:', output.work_type_routing?.final_work_type_used);
        console.log('NA Criteria:', fixture.na_criteria.join(', '));
        console.log('Pass Rate:', passRate + '%');
        console.log('Overall:', fixturePassedAllTests ? '✅ PASSED' : '❌ FAILED');
        console.log('\nPassed Checks:', checks.passed.length);
        checks.passed.forEach(p => console.log('  ' + p));
        console.log('\nFailed Checks:', checks.failed.length);
        checks.failed.forEach(f => console.log('  ' + f));
        if (checks.warnings.length > 0) {
            console.log('\nWarnings:', checks.warnings.length);
            checks.warnings.forEach(w => console.log('  ' + w));
        }
        console.log('========================================\n');
        
        return Response.json({
            success: true,
            fixture_passed: fixturePassedAllTests,
            evidence,
            evaluation_output: output
        });
        
    } catch (error) {
        console.error('[Fixture Test] Error:', error);
        
        Sentry.captureException(error, {
            tags: {
                function: 'testBirthdayEssayFixture',
                feature: 'na_enforcement_acceptance'
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});