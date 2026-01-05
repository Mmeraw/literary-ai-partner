import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

// Load master data
let masterData = null;
let validationCache = null;

async function loadMasterData() {
    if (masterData) return masterData;
    
    try {
        const response = await fetch(new URL('./masterdata/work_type_criteria_applicability.v1.json', import.meta.url));
        masterData = await response.json();
        return masterData;
    } catch (error) {
        throw new Error(`Failed to load master data: ${error.message}`);
    }
}

// MDM RULE M3: Full Coverage Validation (Fail Fast)
function validateMasterData(data) {
    const errors = [];
    
    // Check required top-level fields
    if (!data.matrixVersion) {
        errors.push('Missing matrixVersion');
    }
    
    if (!data.criteriaCatalog || !Array.isArray(data.criteriaCatalog)) {
        errors.push('Missing or invalid criteriaCatalog');
        return { valid: false, errors };
    }
    
    if (!data.workTypes || typeof data.workTypes !== 'object') {
        errors.push('Missing or invalid workTypes');
        return { valid: false, errors };
    }
    
    // Extract canonical criterion IDs
    const canonicalCriteriaIds = data.criteriaCatalog.map(c => c.id).sort();
    
    if (canonicalCriteriaIds.length !== 13) {
        errors.push(`Expected 13 criteria, found ${canonicalCriteriaIds.length}`);
    }
    
    // Validate each Work Type
    const validStatuses = ['R', 'O', 'NA', 'C'];
    
    for (const [workTypeId, workType] of Object.entries(data.workTypes)) {
        // Check required fields
        if (!workType.label) {
            errors.push(`${workTypeId}: missing label`);
        }
        
        if (!workType.family) {
            errors.push(`${workTypeId}: missing family`);
        }
        
        if (!workType.criteria) {
            errors.push(`${workTypeId}: missing criteria`);
            continue;
        }
        
        // CRITICAL: Full coverage check (MDM Rule M1)
        const workTypeCriteriaIds = Object.keys(workType.criteria).sort();
        const missing = canonicalCriteriaIds.filter(id => !workTypeCriteriaIds.includes(id));
        const extra = workTypeCriteriaIds.filter(id => !canonicalCriteriaIds.includes(id));
        
        if (missing.length > 0) {
            errors.push(`${workTypeId}: MISSING criteria: ${missing.join(', ')} (FAIL-FAST: Full coverage required)`);
        }
        
        if (extra.length > 0) {
            errors.push(`${workTypeId}: EXTRA criteria: ${extra.join(', ')}`);
        }
        
        // Validate status codes
        for (const [criterionId, status] of Object.entries(workType.criteria)) {
            if (!validStatuses.includes(status)) {
                errors.push(`${workTypeId}.${criterionId}: invalid status "${status}" (must be R/O/NA/C)`);
            }
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        matrixVersion: data.matrixVersion,
        workTypeCount: Object.keys(data.workTypes).length,
        criteriaCount: canonicalCriteriaIds.length
    };
}

// Build criteria plan for a specific Work Type
function buildCriteriaPlan(workTypeId, data) {
    const workType = data.workTypes[workTypeId];
    
    if (!workType) {
        throw new Error(`Unknown Work Type: ${workTypeId}`);
    }
    
    const plan = {};
    
    for (const [criterionId, status] of Object.entries(workType.criteria)) {
        plan[criterionId] = {
            status,
            scoreEnabled: status === 'R' || status === 'O' || status === 'C',
            blockingEnabled: status === 'R',
            canPenalize: status === 'R' || status === 'O',
            canFlagMissing: status === 'R',
            // MDM RULE M4: NA hard prohibition
            isNA: status === 'NA',
            // MDM RULE M5: C forbids invention
            constrainedNoInvention: status === 'C'
        };
    }
    
    return {
        workTypeId,
        workTypeLabel: workType.label,
        family: workType.family,
        matrixVersion: data.matrixVersion,
        criteria: plan
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { action, workTypeId } = await req.json();
        
        // Load and validate master data
        const data = await loadMasterData();
        
        if (action === 'validate') {
            // Force validation
            const result = validateMasterData(data);
            
            if (!result.valid) {
                // FAIL FAST: Report to Sentry
                const error = new Error('Master data validation failed');
                Sentry.captureException(error, {
                    tags: {
                        validation: 'work_type_matrix',
                        severity: 'critical'
                    },
                    extra: {
                        validation_errors: result.errors,
                        matrix_version: data.matrixVersion,
                        work_type_count: Object.keys(data.workTypes || {}).length
                    }
                });
                await Sentry.flush(2000);
                
                return Response.json({
                    valid: false,
                    errors: result.errors,
                    blocked: true,
                    message: 'Master data validation FAILED - evaluation blocked'
                }, { status: 422 });
            }
            
            return Response.json({
                valid: true,
                matrixVersion: result.matrixVersion,
                workTypeCount: result.workTypeCount,
                criteriaCount: result.criteriaCount,
                message: 'Master data validated successfully'
            });
        }
        
        if (action === 'buildPlan') {
            if (!workTypeId) {
                return Response.json({ error: 'workTypeId required for buildPlan' }, { status: 400 });
            }
            
            // Validate first
            const validation = validateMasterData(data);
            if (!validation.valid) {
                return Response.json({
                    error: 'Cannot build plan - master data invalid',
                    validation_errors: validation.errors
                }, { status: 422 });
            }
            
            const plan = buildCriteriaPlan(workTypeId, data);
            
            return Response.json({
                success: true,
                criteriaPlan: plan
            });
        }
        
        if (action === 'listWorkTypes') {
            const validation = validateMasterData(data);
            if (!validation.valid) {
                return Response.json({
                    error: 'Master data invalid',
                    validation_errors: validation.errors
                }, { status: 422 });
            }
            
            const workTypes = Object.entries(data.workTypes).map(([id, wt]) => ({
                id,
                label: wt.label,
                family: wt.family
            }));
            
            return Response.json({
                workTypes,
                matrixVersion: data.matrixVersion
            });
        }
        
        return Response.json({ error: 'Invalid action' }, { status: 400 });
        
    } catch (error) {
        console.error('Validator error:', error);
        
        Sentry.captureException(error, {
            tags: {
                function: 'validateWorkTypeMatrix',
                feature: 'mdm_validation'
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});