import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

// FIXTURE A: Personal Essay (Birthday Essay Example)
const FIXTURE_A_ESSAY = `On my thirtieth birthday, I sat alone in a coffee shop and asked myself: What have I become?

The question wasn't rhetorical. It demanded an answer. I pulled out my journal and began to write, not knowing where the words would lead, only that they needed to come.

I had spent my twenties chasing achievements—degrees, promotions, accolades—believing each milestone would deliver the sense of arrival I craved. But arrival never came. Instead, each success revealed a new horizon, a new gap between who I was and who I thought I should be.

What I failed to understand then, sitting in that coffee shop, was that the gap was the point. The tension between becoming and being is not a problem to solve but a condition to inhabit. We are always both: incomplete and whole, striving and sufficient.

As I look back now, I see that my thirtieth birthday wasn't a crisis. It was a turning point—the moment I stopped asking "What have I become?" and started asking "What am I becoming?"

The answer, I realized, is simpler than I thought: I am becoming someone who asks better questions.`;

// FIXTURE B: Script Scene (Film/TV)
const FIXTURE_B_SCRIPT = `INT. COFFEE SHOP - MORNING

SARAH (30s, tired eyes, corporate attire) sits alone at a corner table. Her laptop is open but untouched. A BARISTA approaches.

BARISTA
Can I get you anything else?

SARAH
(without looking up)
Just... quiet.

The Barista retreats. Sarah pulls out her phone. Scrolls. Stops on a text from MOM: "Happy birthday, sweetheart. Call me?"

She doesn't call.

EXT. COFFEE SHOP - CONTINUOUS

Through the window, we see Sarah close her laptop. She sits perfectly still.

FADE OUT.`;

// Run full validation suite
async function runAcceptanceTests(base44) {
    const results = {
        fixture_a_essay: {},
        fixture_b_script: {},
        global_tests: {},
        validation_summary: {
            passed: 0,
            failed: 0,
            errors: []
        }
    };
    
    try {
        // GLOBAL TEST G1: Validate master data first
        console.log('🔍 TEST G1: Master data validation...');
        const validationResult = await base44.functions.invoke('validateWorkTypeMatrix', { action: 'validate' });
        
        results.global_tests.g1_master_data_valid = validationResult.data.valid;
        if (!validationResult.data.valid) {
            results.validation_summary.errors.push('CRITICAL: Master data validation failed');
            results.validation_summary.failed++;
            return results;
        }
        results.validation_summary.passed++;
        
        // FIXTURE A: Personal Essay
        console.log('🔍 FIXTURE A: Personal Essay...');
        const detectionA = await base44.functions.invoke('detectWorkType', { 
            text: FIXTURE_A_ESSAY,
            title: 'Birthday Reflection'
        });
        
        results.fixture_a_essay.detected_work_type = detectionA.data.detected_work_type;
        results.fixture_a_essay.detection_confidence = detectionA.data.detection_confidence;
        
        // Build criteria plan
        const planA = await base44.functions.invoke('validateWorkTypeMatrix', {
            action: 'buildPlan',
            workTypeId: detectionA.data.detected_work_type
        });
        
        results.fixture_a_essay.criteria_plan = planA.data.criteriaPlan;
        
        // TEST A1: NA criteria checks
        const dialogueStatus = planA.data.criteriaPlan.criteria.dialogue?.status;
        const conflictStatus = planA.data.criteriaPlan.criteria.conflict?.status;
        const linePolishStatus = planA.data.criteriaPlan.criteria.linePolish?.status;
        const hookStatus = planA.data.criteriaPlan.criteria.hook?.status;
        
        results.fixture_a_essay.test_a1_dialogue_is_na = dialogueStatus === 'NA';
        results.fixture_a_essay.test_a1_conflict_is_na = conflictStatus === 'NA';
        results.fixture_a_essay.test_a1_linepolish_is_required = linePolishStatus === 'R';
        results.fixture_a_essay.test_a1_hook_is_required = hookStatus === 'R';
        
        // Verify NA cannot penalize
        results.fixture_a_essay.test_a1_dialogue_cannot_score = !planA.data.criteriaPlan.criteria.dialogue?.scoreEnabled;
        results.fixture_a_essay.test_a1_dialogue_cannot_block = !planA.data.criteriaPlan.criteria.dialogue?.blockingEnabled;
        results.fixture_a_essay.test_a1_dialogue_cannot_flag_missing = !planA.data.criteriaPlan.criteria.dialogue?.canFlagMissing;
        
        // TEST A2: Positive signal (at least one R fires)
        const requiredCriteria = Object.entries(planA.data.criteriaPlan.criteria)
            .filter(([_, c]) => c.status === 'R');
        
        results.fixture_a_essay.test_a2_has_required_criteria = requiredCriteria.length > 0;
        results.fixture_a_essay.test_a2_required_count = requiredCriteria.length;
        
        const testsA = [
            results.fixture_a_essay.test_a1_dialogue_is_na,
            results.fixture_a_essay.test_a1_conflict_is_na,
            results.fixture_a_essay.test_a1_linepolish_is_required,
            results.fixture_a_essay.test_a1_hook_is_required,
            results.fixture_a_essay.test_a1_dialogue_cannot_score,
            results.fixture_a_essay.test_a1_dialogue_cannot_block,
            results.fixture_a_essay.test_a1_dialogue_cannot_flag_missing,
            results.fixture_a_essay.test_a2_has_required_criteria
        ];
        
        const passedA = testsA.filter(t => t === true).length;
        results.fixture_a_essay.passed = passedA;
        results.fixture_a_essay.failed = testsA.length - passedA;
        results.validation_summary.passed += passedA;
        results.validation_summary.failed += testsA.length - passedA;
        
        // FIXTURE B: Script Scene
        console.log('🔍 FIXTURE B: Script Scene...');
        const detectionB = await base44.functions.invoke('detectWorkType', {
            text: FIXTURE_B_SCRIPT,
            title: 'Coffee Shop Scene'
        });
        
        results.fixture_b_script.detected_work_type = detectionB.data.detected_work_type;
        results.fixture_b_script.detection_confidence = detectionB.data.detection_confidence;
        
        const planB = await base44.functions.invoke('validateWorkTypeMatrix', {
            action: 'buildPlan',
            workTypeId: detectionB.data.detected_work_type
        });
        
        results.fixture_b_script.criteria_plan = planB.data.criteriaPlan;
        
        // TEST B1: Script-specific checks
        const linePolishStatusB = planB.data.criteriaPlan.criteria.linePolish?.status;
        const dialogueStatusB = planB.data.criteriaPlan.criteria.dialogue?.status;
        const technicalStatusB = planB.data.criteriaPlan.criteria.technical?.status;
        const pacingStatusB = planB.data.criteriaPlan.criteria.pacing?.status;
        
        results.fixture_b_script.test_b1_linepolish_is_na = linePolishStatusB === 'NA';
        results.fixture_b_script.test_b1_dialogue_is_required = dialogueStatusB === 'R';
        results.fixture_b_script.test_b1_technical_is_required = technicalStatusB === 'R';
        results.fixture_b_script.test_b1_pacing_is_required = pacingStatusB === 'R';
        
        // Verify NA prohibition
        results.fixture_b_script.test_b1_linepolish_cannot_score = !planB.data.criteriaPlan.criteria.linePolish?.scoreEnabled;
        results.fixture_b_script.test_b1_linepolish_cannot_penalize = !planB.data.criteriaPlan.criteria.linePolish?.canPenalize;
        
        // TEST B2: Positive signal
        const requiredCriteriaB = Object.entries(planB.data.criteriaPlan.criteria)
            .filter(([_, c]) => c.status === 'R');
        
        results.fixture_b_script.test_b2_has_required_criteria = requiredCriteriaB.length > 0;
        results.fixture_b_script.test_b2_required_count = requiredCriteriaB.length;
        results.fixture_b_script.test_b2_dialogue_fires = planB.data.criteriaPlan.criteria.dialogue?.scoreEnabled === true;
        results.fixture_b_script.test_b2_technical_fires = planB.data.criteriaPlan.criteria.technical?.scoreEnabled === true;
        
        const testsB = [
            results.fixture_b_script.test_b1_linepolish_is_na,
            results.fixture_b_script.test_b1_dialogue_is_required,
            results.fixture_b_script.test_b1_technical_is_required,
            results.fixture_b_script.test_b1_linepolish_cannot_score,
            results.fixture_b_script.test_b1_linepolish_cannot_penalize,
            results.fixture_b_script.test_b2_has_required_criteria,
            results.fixture_b_script.test_b2_dialogue_fires,
            results.fixture_b_script.test_b2_technical_fires
        ];
        
        const passedB = testsB.filter(t => t === true).length;
        results.fixture_b_script.passed = passedB;
        results.fixture_b_script.failed = testsB.length - passedB;
        results.validation_summary.passed += passedB;
        results.validation_summary.failed += testsB.length - passedB;
        
        // GLOBAL TEST G2: NA hard prohibition check
        console.log('🔍 TEST G2: NA hard prohibition...');
        const naProhibitionTests = [
            results.fixture_a_essay.test_a1_dialogue_cannot_score === true,
            results.fixture_a_essay.test_a1_dialogue_cannot_block === true,
            results.fixture_a_essay.test_a1_dialogue_cannot_flag_missing === true,
            results.fixture_b_script.test_b1_linepolish_cannot_score === true,
            results.fixture_b_script.test_b1_linepolish_cannot_penalize === true
        ];
        
        const naTestsPassed = naProhibitionTests.filter(t => t === true).length;
        results.global_tests.g2_na_hard_prohibition_passed = naTestsPassed;
        results.global_tests.g2_na_hard_prohibition_total = naProhibitionTests.length;
        results.global_tests.g2_na_hard_prohibition_success = naTestsPassed === naProhibitionTests.length;
        
        // GLOBAL TEST G3: Positive signal assertion
        console.log('🔍 TEST G3: Positive signal assertion...');
        results.global_tests.g3_fixture_a_has_required = results.fixture_a_essay.test_a2_has_required_criteria;
        results.global_tests.g3_fixture_b_has_required = results.fixture_b_script.test_b2_has_required_criteria;
        results.global_tests.g3_positive_signal_success = 
            results.global_tests.g3_fixture_a_has_required && 
            results.global_tests.g3_fixture_b_has_required;
        
        // Overall summary
        const totalTests = results.validation_summary.passed + results.validation_summary.failed;
        const passRate = totalTests > 0 ? (results.validation_summary.passed / totalTests * 100).toFixed(1) : 0;
        
        results.validation_summary.total_tests = totalTests;
        results.validation_summary.pass_rate = `${passRate}%`;
        results.validation_summary.all_tests_passed = results.validation_summary.failed === 0;
        
        console.log(`✅ Acceptance Tests Complete: ${results.validation_summary.passed}/${totalTests} passed (${passRate}%)`);
        
        return Response.json({
            success: true,
            results,
            evidence: {
                mdm_canon_version: 'v1',
                test_run_timestamp: new Date().toISOString(),
                all_tests_passed: results.validation_summary.all_tests_passed,
                summary: `${results.validation_summary.passed}/${totalTests} tests passed`
            }
        });
        
    } catch (error) {
        console.error('Acceptance test error:', error);
        
        Sentry.captureException(error, {
            tags: {
                function: 'testWorkTypeRouting',
                feature: 'acceptance_tests'
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});