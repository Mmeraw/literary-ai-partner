import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Canonical screening reason messages
const SCREENING_MESSAGES = {
    score_below_threshold: "Your submission did not meet the minimum readiness threshold (8.0/10) required for Storygate Studio consideration, based on the evaluation you provided.",
    missing_required_fields: "Your submission was incomplete or missing required information and could not be queued for Storygate Studio review.",
    out_of_scope: "Storygate Studio is currently focused on specific formats and categories. Your project does not align with our current scope.",
    missing_film_deck: "Screen/Adaptation submissions require a Film/TV Pitch Deck. Your submission cannot advance without this material."
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { submission_id } = await req.json();

        if (!submission_id) {
            return Response.json({ error: 'submission_id required' }, { status: 400 });
        }

        // Fetch submission
        const submission = await base44.asServiceRole.entities.StorygateSubmission.get(submission_id);

        if (!submission) {
            return Response.json({ error: 'Submission not found' }, { status: 404 });
        }

        const screeningReasons = [];
        let screeningStatus = 'ELIGIBLE';

        // GATE 1: Readiness threshold (≥ 8.0)
        if (submission.evaluationScore < 8.0) {
            screeningStatus = 'AUTO_DECLINED';
            screeningReasons.push('score_below_threshold');
        }

        // GATE 2: Validate track-specific required fields
        if (submission.primaryPath === 'MANUSCRIPT') {
            // Manuscript track: query, synopsis, bio required
            if (!submission.queryLetterText || !submission.synopsisText || !submission.authorBioText) {
                screeningStatus = 'AUTO_DECLINED';
                screeningReasons.push('missing_required_fields');
            }
        } else if (submission.primaryPath === 'SCREEN') {
            // Screen track: logline, adaptation pitch, bio, source work type required
            if (!submission.loglineText || !submission.adaptationPitchText || !submission.authorBioText || !submission.sourceWorkType) {
                screeningStatus = 'AUTO_DECLINED';
                screeningReasons.push('missing_required_fields');
            }

            // GATE 3: Film deck enforcement (Screen track only)
            // No deck = cannot reach RECOMMEND_HUMAN_REVIEW
            if (!submission.filmDeckFileId) {
                if (screeningStatus !== 'AUTO_DECLINED') {
                    // Cap at ELIGIBLE, never RECOMMEND
                    screeningStatus = 'ELIGIBLE';
                    screeningReasons.push('missing_film_deck');
                }
            }
        }

        // GATE 4: Score-based recommendation (if passed gates 1-3)
        if (screeningStatus === 'ELIGIBLE' && submission.evaluationScore >= 8.5 && submission.filmDeckFileId) {
            screeningStatus = 'RECOMMEND_HUMAN_REVIEW';
        }

        // Update submission with screening results
        await base44.asServiceRole.entities.StorygateSubmission.update(submission_id, {
            screeningStatus,
            screeningReasons
        });

        // Map reasons to user-friendly messages
        const feedbackMessages = screeningReasons.map(code => SCREENING_MESSAGES[code] || code);

        return Response.json({
            success: true,
            screeningStatus,
            screeningReasons,
            feedbackMessages,
            disclaimer: screeningStatus === 'AUTO_DECLINED' 
                ? "This determination reflects eligibility criteria only and does not represent a judgment of creative potential."
                : null
        });

    } catch (error) {
        console.error('Screening error:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});