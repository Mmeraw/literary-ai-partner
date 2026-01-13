import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
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

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { revision_event_id } = await req.json();

        if (!revision_event_id) {
            return Response.json({ error: 'Missing revision_event_id' }, { status: 400 });
        }

        // Fetch revision event
        const revisionEvents = await base44.entities.RevisionEvent.filter({ id: revision_event_id });
        
        if (!revisionEvents.length) {
            return Response.json({ error: 'Revision event not found' }, { status: 404 });
        }

        const revisionEvent = revisionEvents[0];

        // Ensure the user owns this revision
        if (revisionEvent.created_by !== user.email) {
            return Response.json({ error: 'Not authorized to approve this revision' }, { status: 403 });
        }

        // Mark revision as approved
        await base44.entities.RevisionEvent.update(revision_event_id, {
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: user.email
        });

        // Fetch both versions
        const baseVersions = await base44.entities.OutputVersion.filter({ id: revisionEvent.base_version_id });
        const newVersions = await base44.entities.OutputVersion.filter({ id: revisionEvent.new_version_id });

        if (!baseVersions.length || !newVersions.length) {
            return Response.json({ error: 'Version not found' }, { status: 404 });
        }

        const baseVersion = baseVersions[0];
        const newVersion = newVersions[0];

        // Demote old baseline
        await base44.entities.OutputVersion.update(baseVersion.id, {
            is_baseline: false
        });

        // Promote new version to baseline
        await base44.entities.OutputVersion.update(newVersion.id, {
            is_baseline: true
        });

        return Response.json({
            success: true,
            message: 'Revision approved and promoted to baseline',
            revision_event_id,
            new_baseline_id: newVersion.id
        });

    } catch (error) {
        console.error('Revision approval error:', error);
        
        // Capture to Sentry with context
        Sentry.captureException(error, {
            extra: {
                function: 'approveRevision',
                operation: 'revision_approval',
                revision_event_id,
                user_email: user?.email,
                error_message: error.message,
                timestamp: new Date().toISOString()
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ 
            error: 'Failed to approve revision',
            details: error.message 
        }, { status: 500 });
    }
});