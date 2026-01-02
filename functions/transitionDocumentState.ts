import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// STATE MACHINE ENFORCEMENT (Server-Side Authority)
// Implements BASE44 Document Governance Spec V1

const LEGAL_TRANSITIONS = {
    'UPLOADED': ['EVALUATED'],
    'EVALUATED': ['REVISION_IN_PROGRESS'],
    'REVISION_IN_PROGRESS': ['REVISED'],
    'REVISED': ['RESCORED', 'REVISION_IN_PROGRESS'],
    'RESCORED': ['LOCKED', 'REVISION_IN_PROGRESS'],
    'LOCKED': [] // No direct transitions - must clone
};

const TRANSITION_RULES = {
    'UPLOADED->EVALUATED': {
        required_data: ['evaluation_score'],
        side_effects: ['create_version', 'set_baseline_score']
    },
    'EVALUATED->REVISION_IN_PROGRESS': {
        required_data: [],
        side_effects: ['create_revision_run']
    },
    'REVISION_IN_PROGRESS->REVISED': {
        required_data: ['revised_content'],
        side_effects: ['create_version', 'save_revised_content']
    },
    'REVISED->RESCORED': {
        required_data: ['rescore_result'],
        side_effects: ['create_version', 'calculate_delta']
    },
    'RESCORED->LOCKED': {
        required_data: [],
        side_effects: ['set_locked_timestamp', 'prevent_edits']
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { document_id, to_state, transition_data } = await req.json();

        if (!document_id || !to_state) {
            return Response.json({
                error: 'Missing required fields',
                required: ['document_id', 'to_state']
            }, { status: 400 });
        }

        // Fetch document
        const documents = await base44.entities.Document.filter({ id: document_id });
        const document = documents[0];

        if (!document) {
            return Response.json({ error: 'Document not found' }, { status: 404 });
        }

        const from_state = document.state;

        // Check if transition is legal
        const allowed_transitions = LEGAL_TRANSITIONS[from_state] || [];
        if (!allowed_transitions.includes(to_state)) {
            return Response.json({
                error: 'ILLEGAL_TRANSITION',
                message: `Cannot transition from ${from_state} to ${to_state}`,
                from_state,
                to_state,
                allowed_transitions,
                blocking_reason: from_state === 'LOCKED' 
                    ? 'Document is locked. Clone it to create an editable version.'
                    : `You must complete the ${from_state} phase before proceeding.`
            }, { status: 403 });
        }

        // Check transition rules
        const transition_key = `${from_state}->${to_state}`;
        const rules = TRANSITION_RULES[transition_key];

        if (rules?.required_data) {
            for (const field of rules.required_data) {
                if (!transition_data?.[field]) {
                    return Response.json({
                        error: 'MISSING_REQUIRED_DATA',
                        message: `Transition requires: ${field}`,
                        required_fields: rules.required_data
                    }, { status: 400 });
                }
            }
        }

        // Execute state transition
        const updates = {
            state: to_state,
            last_activity_at: new Date().toISOString(),
            state_history: [
                ...(document.state_history || []),
                {
                    from_state,
                    to_state,
                    transitioned_at: new Date().toISOString(),
                    transitioned_by: user.email
                }
            ]
        };

        // Apply side effects
        if (rules?.side_effects) {
            for (const effect of rules.side_effects) {
                switch (effect) {
                    case 'set_baseline_score':
                        updates.baseline_score = transition_data.evaluation_score;
                        updates.latest_score = transition_data.evaluation_score;
                        break;
                    case 'calculate_delta':
                        updates.latest_score = transition_data.rescore_result;
                        break;
                    case 'set_locked_timestamp':
                        updates.locked_at = new Date().toISOString();
                        updates.locked_by = user.email;
                        break;
                    case 'create_version':
                        // Create DocumentVersion record
                        await base44.entities.DocumentVersion.create({
                            document_id: document.id,
                            version_number: (document.state_history?.length || 0) + 1,
                            state_at_time: to_state,
                            score_snapshot: transition_data.evaluation_score || transition_data.rescore_result || document.latest_score,
                            evaluation_data: transition_data.evaluation_data || null,
                            created_by: user.email,
                            notes: transition_data.notes || `Transitioned to ${to_state}`
                        });
                        break;
                }
            }
        }

        // Update document
        await base44.entities.Document.update(document_id, updates);

        return Response.json({
            success: true,
            document_id,
            from_state,
            to_state,
            transition_key,
            side_effects_applied: rules?.side_effects || []
        });

    } catch (error) {
        console.error('State transition error:', error);
        return Response.json({
            error: 'TRANSITION_FAILED',
            details: error.message
        }, { status: 500 });
    }
});