import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { format = 'json', dateFrom, dateTo, manuscriptId, waveTierFilter } = await req.json();

        // Fetch all revision sessions with feedback
        const sessions = await base44.asServiceRole.entities.RevisionSession.list();

        // Build aggregated analytics
        const waveItemStats = new Map();
        const severityStats = new Map();
        const registerStats = new Map();
        const rejectedSuggestions = [];
        const dailyRejections = new Map();

        for (const session of sessions) {
            if (!session.suggestions) continue;

            // Apply filters
            const sessionDate = new Date(session.created_date);
            if (dateFrom && sessionDate < new Date(dateFrom)) continue;
            if (dateTo && sessionDate > new Date(dateTo)) continue;
            if (manuscriptId && session.manuscript_id !== manuscriptId) continue;

            for (const suggestion of session.suggestions) {
                if (!suggestion.feedback) continue;

                const { helpful, rating, comment } = suggestion.feedback;
                
                // Extract wave metadata from suggestion
                const waveItem = suggestion.wave_item || 'unknown';
                const severity = suggestion.severity || 'unknown';
                const register = suggestion.register || 'unknown';
                const waveNumber = extractWaveNumber(waveItem);

                // Apply wave tier filter
                if (waveTierFilter) {
                    const tier = getWaveTier(waveNumber);
                    if (tier !== waveTierFilter) continue;
                }

                const isRejected = helpful === false || rating === 'not_helpful' || rating === 'confusing';

                // Aggregate by wave item
                if (!waveItemStats.has(waveItem)) {
                    waveItemStats.set(waveItem, { total: 0, rejected: 0, waveNumber });
                }
                const waveStats = waveItemStats.get(waveItem);
                waveStats.total++;
                if (isRejected) waveStats.rejected++;

                // Aggregate by severity
                if (!severityStats.has(severity)) {
                    severityStats.set(severity, { total: 0, rejected: 0 });
                }
                const sevStats = severityStats.get(severity);
                sevStats.total++;
                if (isRejected) sevStats.rejected++;

                // Aggregate by register
                if (!registerStats.has(register)) {
                    registerStats.set(register, { total: 0, rejected: 0 });
                }
                const regStats = registerStats.get(register);
                regStats.total++;
                if (isRejected) regStats.rejected++;

                // Collect rejected suggestions for export
                if (isRejected) {
                    rejectedSuggestions.push({
                        id: suggestion.id,
                        excerpt: suggestion.original_text?.substring(0, 150) || '',
                        wave_item: waveItem,
                        wave_number: waveNumber,
                        severity,
                        register,
                        suggested_fix: suggestion.suggested_text?.substring(0, 150) || '',
                        why_flagged: suggestion.why_flagged || '',
                        feedback_comment: comment || '',
                        feedback_rating: rating || 'thumbs_down',
                        session_id: session.id,
                        manuscript_title: session.title,
                        created_date: session.created_date
                    });

                    // Track daily rejections
                    const date = new Date(session.created_date).toISOString().split('T')[0];
                    dailyRejections.set(date, (dailyRejections.get(date) || 0) + 1);
                }
            }
        }

        // Convert Maps to arrays and calculate rejection rates
        const waveItemAnalytics = Array.from(waveItemStats.entries())
            .map(([item, stats]) => ({
                wave_item: item,
                wave_number: stats.waveNumber,
                total_suggestions: stats.total,
                rejected_count: stats.rejected,
                rejection_rate: (stats.rejected / stats.total * 100).toFixed(1)
            }))
            .sort((a, b) => b.rejection_rate - a.rejection_rate);

        const severityAnalytics = Array.from(severityStats.entries())
            .map(([severity, stats]) => ({
                severity,
                total_suggestions: stats.total,
                rejected_count: stats.rejected,
                rejection_rate: (stats.rejected / stats.total * 100).toFixed(1)
            }))
            .sort((a, b) => b.rejection_rate - a.rejection_rate);

        const registerAnalytics = Array.from(registerStats.entries())
            .map(([register, stats]) => ({
                register,
                total_suggestions: stats.total,
                rejected_count: stats.rejected,
                rejection_rate: (stats.rejected / stats.total * 100).toFixed(1)
            }))
            .sort((a, b) => b.rejection_rate - a.rejection_rate);

        const dailyRejectionTrend = Array.from(dailyRejections.entries())
            .map(([date, count]) => ({ date, rejections: count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const result = {
            summary: {
                total_feedback_items: sessions.reduce((sum, s) => 
                    sum + (s.suggestions?.filter(sg => sg.feedback).length || 0), 0),
                total_rejected: rejectedSuggestions.length,
                overall_rejection_rate: rejectedSuggestions.length > 0 
                    ? (rejectedSuggestions.length / sessions.reduce((sum, s) => 
                        sum + (s.suggestions?.filter(sg => sg.feedback).length || 0), 0) * 100).toFixed(1)
                    : '0.0'
            },
            by_wave_item: waveItemAnalytics,
            by_severity: severityAnalytics,
            by_register: registerAnalytics,
            daily_trend: dailyRejectionTrend,
            rejected_suggestions: rejectedSuggestions.sort((a, b) => 
                new Date(b.created_date) - new Date(a.created_date))
        };

        // Handle CSV export
        if (format === 'csv') {
            const csv = generateCSV(rejectedSuggestions);
            return new Response(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename=feedback_rejected_suggestions.csv'
                }
            });
        }

        return Response.json(result);

    } catch (error) {
        console.error('Feedback analysis error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function extractWaveNumber(waveItem) {
    const match = waveItem.match(/W(\d+)/i);
    return match ? parseInt(match[1]) : 0;
}

function getWaveTier(waveNumber) {
    if (waveNumber <= 17) return 'early';
    if (waveNumber <= 49) return 'mid';
    return 'late';
}

function generateCSV(suggestions) {
    const headers = [
        'Wave Number',
        'Wave Item',
        'Severity',
        'Register',
        'Excerpt',
        'Suggested Fix',
        'Why Flagged',
        'User Comment',
        'Feedback Rating',
        'Manuscript Title',
        'Date'
    ];

    const rows = suggestions.map(s => [
        s.wave_number,
        s.wave_item,
        s.severity,
        s.register,
        `"${(s.excerpt || '').replace(/"/g, '""')}"`,
        `"${(s.suggested_fix || '').replace(/"/g, '""')}"`,
        `"${(s.why_flagged || '').replace(/"/g, '""')}"`,
        `"${(s.feedback_comment || '').replace(/"/g, '""')}"`,
        s.feedback_rating,
        `"${(s.manuscript_title || '').replace(/"/g, '""')}"`,
        s.created_date
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}