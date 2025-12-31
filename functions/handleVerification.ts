import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { request_id, action, reason } = await req.json();

        if (!request_id || !action) {
            return Response.json({ error: 'request_id and action required' }, { status: 400 });
        }

        if (!['approve', 'reject'].includes(action)) {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (action === 'reject' && !reason?.trim()) {
            return Response.json({ error: 'Rejection reason required' }, { status: 400 });
        }

        // Get verification request
        const requests = await base44.asServiceRole.entities.IndustryUser.filter({ 
            id: request_id 
        });
        const request = requests[0];

        if (!request) {
            return Response.json({ error: 'Request not found' }, { status: 404 });
        }

        // Update verification status
        const newStatus = action === 'approve' ? 'verified' : 'rejected';
        const updateData = {
            verification_status: newStatus,
            verification_date: new Date().toISOString(),
            verified_by: user.email
        };

        await base44.asServiceRole.entities.IndustryUser.update(request_id, updateData);

        // Log verification decision
        await base44.asServiceRole.entities.AccessLog.create({
            user_email: user.email,
            user_role: 'admin',
            action_type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
            success: true,
            metadata: {
                request_id,
                industry_user_email: request.user_email,
                reason: reason || null
            }
        });

        // Notify industry user
        try {
            let emailBody = '';
            if (action === 'approve') {
                emailBody = `Your StoryGate industry verification has been approved. You can now access the StoryGate Portal and request access to creator projects.`;
            } else {
                emailBody = `Your StoryGate industry verification request was not approved.\n\nReason: ${reason}\n\nYou may resubmit your verification request with updated information.`;
            }

            await base44.asServiceRole.integrations.Core.SendEmail({
                to: request.user_email,
                subject: `StoryGate: Verification ${action === 'approve' ? 'Approved' : 'Declined'}`,
                body: emailBody
            });
        } catch (error) {
            console.error('Email notification failed:', error);
        }

        return Response.json({ 
            success: true,
            action,
            message: `Verification ${action}d successfully`
        });

    } catch (error) {
        console.error('Handle verification error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});