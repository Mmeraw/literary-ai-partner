/**
 * BACKFILL MIGRATION: Add policy_routing to legacy evaluations
 * 
 * Authority: Optional Fix B - Phase 3B Track 3 cleanup
 * Purpose: Make legacy evaluation data self-describing
 * 
 * Run once after policy routing deployment to populate missing fields
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WORK_TYPE_TO_POLICY = {
    'Flash Fiction / Micro': 'MICRO_POLICY',
    'Poetry': 'MICRO_POLICY',
    'Vignette': 'MICRO_POLICY',
    'Micro-Fiction': 'MICRO_POLICY',
    
    'Novel': 'MANUSCRIPT_POLICY',
    'Novella': 'MANUSCRIPT_POLICY',
    'Full-Length Manuscript': 'MANUSCRIPT_POLICY',
    'Manuscript': 'MANUSCRIPT_POLICY',
    
    'Screenplay': 'SCREENPLAY_POLICY',
    'TV Script': 'SCREENPLAY_POLICY',
    'Feature Film': 'SCREENPLAY_POLICY',
    'Script': 'SCREENPLAY_POLICY',
    
    'Unclassified': 'NEUTRAL_POLICY',
    'Experimental': 'NEUTRAL_POLICY'
};

const POLICY_ROUTING_SPECS = {
    'MICRO_POLICY': {
        scoreLabel: 'Craft Score',
        scoreRange: '/10',
        readinessFloorEnabled: false,
        forbiddenPhrases: ['Agent-Reality Grade', 'submission-ready', 'professional routing']
    },
    'MANUSCRIPT_POLICY': {
        scoreLabel: 'Agent-Reality Grade',
        scoreRange: '/100',
        readinessFloorEnabled: true,
        readinessFloorValue: 8.0
    },
    'SCREENPLAY_POLICY': {
        scoreLabel: 'Reader Grade',
        scoreRange: '/100',
        readinessFloorEnabled: true,
        readinessFloorValue: 6.5
    },
    'NEUTRAL_POLICY': {
        scoreLabel: 'Craft Analysis',
        scoreRange: '/10',
        readinessFloorEnabled: false
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Admin-only operation
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                error: 'Admin access required',
                status: 'forbidden'
            }, { status: 403 });
        }
        
        const { dryRun = true, limit = 100 } = await req.json().catch(() => ({}));
        
        // Fetch submissions without policy_routing
        const submissions = await base44.asServiceRole.entities.Submission.filter({}, '-created_date', limit);
        
        const results = {
            total: submissions.length,
            updated: 0,
            skipped: 0,
            errors: [],
            dryRun: dryRun
        };
        
        for (const submission of submissions) {
            try {
                const resultJson = submission.result_json || {};
                
                // Skip if already has policy_routing
                if (resultJson.work_type_routing?.policy_routing) {
                    results.skipped++;
                    continue;
                }
                
                // Determine work type
                const workTypeLabel = resultJson.work_type_routing?.work_type_label;
                
                if (!workTypeLabel) {
                    results.skipped++;
                    continue;
                }
                
                // Resolve policy family
                const policyFamily = WORK_TYPE_TO_POLICY[workTypeLabel] || 'NEUTRAL_POLICY';
                const routingSpec = POLICY_ROUTING_SPECS[policyFamily];
                
                // Build updated work_type_routing
                const updatedWorkTypeRouting = {
                    ...(resultJson.work_type_routing || {}),
                    policy_routing: {
                        ...routingSpec,
                        policyFamily: policyFamily,
                        routing_version: 'v1.0.0',
                        resolved_at: new Date().toISOString(),
                        backfill_migration: true
                    }
                };
                
                if (!dryRun) {
                    // Update the submission
                    await base44.asServiceRole.entities.Submission.update(submission.id, {
                        result_json: {
                            ...resultJson,
                            work_type_routing: updatedWorkTypeRouting
                        }
                    });
                }
                
                results.updated++;
                
            } catch (error) {
                results.errors.push({
                    submission_id: submission.id,
                    error: error.message
                });
            }
        }
        
        return Response.json({
            success: true,
            ...results,
            message: dryRun 
                ? `DRY RUN: Would update ${results.updated} of ${results.total} submissions`
                : `Updated ${results.updated} of ${results.total} submissions`
        });
        
    } catch (error) {
        console.error('Backfill error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});