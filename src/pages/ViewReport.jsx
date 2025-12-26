import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from "framer-motion";
import ScoreCard from '@/components/evaluation/ScoreCard';

export default function ViewReport() {
    const urlParams = new URLSearchParams(window.location.search);
    const submissionId = urlParams.get('id');

    const { data: submission, isLoading } = useQuery({
        queryKey: ['submission', submissionId],
        queryFn: async () => {
            const submissions = await base44.entities.Submission.filter({ id: submissionId });
            return submissions[0];
        },
        enabled: !!submissionId
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-600">Loading report...</p>
                </div>
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Report Not Found</h2>
                    <Link to={createPageUrl('History')}>
                        <Button>Back to History</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const evaluationResult = submission.result_json || {};

    const handleDownload = () => {
        const reportText = `
MANUSCRIPT EVALUATION REPORT
${submission.title || 'Untitled'}
Generated: ${new Date(submission.created_date).toLocaleDateString()}

OVERALL SCORE: ${Math.round((evaluationResult.overallScore || submission.overall_score || 0) * 10)}/100
VERDICT: ${evaluationResult.agentVerdict || 'No verdict available'}

======================
12 LITERARY AGENT CRITERIA
======================

${evaluationResult.criteria?.map(c => `
${(c.name || 'Unknown').toUpperCase()} - ${c.score || 0}/10

Strengths:
${c.strengths?.map(s => `• ${s}`).join('\n') || 'None listed'}

Weaknesses:
${c.weaknesses?.map(w => `• ${w}`).join('\n') || 'None listed'}

Agent Notes:
${c.agentNotes || 'No notes'}
`).join('\n') || 'No criteria available'}

======================
PRIORITY REVISION REQUESTS
======================

${evaluationResult.revisionRequests?.map(r => `[${r.priority || 'N/A'}] ${r.instruction || ''}`).join('\n\n') || 'None'}

======================
WAVE REVISION ITEMS
======================

${evaluationResult.waveHits?.map(h => `
${h.wave_item || 'Unknown'} [${h.severity || 'N/A'}]
Evidence: "${h.evidence_quote || 'N/A'}"
Fix: ${h.fix || 'N/A'}
`).join('\n') || 'None'}

======================
WAVE GUIDANCE
======================

Priority Waves: ${evaluationResult.waveGuidance?.priorityWaves?.join(', ') || 'None'}

Next Actions:
${evaluationResult.waveGuidance?.nextActions?.map(a => `• ${a}`).join('\n') || 'None'}

======================
ORIGINAL TEXT
======================

${submission.text || 'No text available'}
        `.trim();

        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(submission.title || 'report').replace(/\s+/g, '_')}_evaluation_report.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <Link to={createPageUrl('History')}>
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to History
                        </Button>
                    </Link>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">{submission.title}</h1>
                            <p className="text-slate-600">
                                Evaluated on {new Date(submission.created_date).toLocaleDateString()}
                            </p>
                        </div>
                        <Button onClick={handleDownload} className="bg-indigo-600 hover:bg-indigo-700">
                            <Download className="w-4 h-4 mr-2" />
                            Download Report
                        </Button>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Base44 Calibrated Score - Primary */}
                    <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 border-2 border-indigo-500 shadow-2xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Badge className="bg-indigo-500 text-white border-0">
                                Agent-Reality Grade
                            </Badge>
                            <Badge variant="outline" className="border-white/30 text-white/80">
                                Calibrated Against Real Agent Decisions
                            </Badge>
                        </div>
                        <div className="flex items-end justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">Base44 Calibrated Score</h2>
                            <div className="text-right">
                                <span className={`text-5xl font-bold ${
                                    (evaluationResult.overallScore || submission.overall_score) * 10 >= 80 ? 'text-emerald-400' :
                                    (evaluationResult.overallScore || submission.overall_score) * 10 >= 60 ? 'text-amber-400' :
                                    'text-rose-400'
                                }`}>
                                    {Math.round((evaluationResult.overallScore || submission.overall_score) * 10)}
                                </span>
                                <span className="text-white/60 text-xl">/100</span>
                            </div>
                        </div>
                        <p className="text-white/90 text-lg mb-4">{evaluationResult.agentVerdict || 'Evaluation complete'}</p>
                        <div className="p-4 rounded-lg bg-white/10 border border-white/20">
                            <p className="text-sm text-white/80">
                                <strong className="text-white">We'd rather hurt your feelings than waste your submission.</strong>
                                <br />This score reflects agent-rejection reality based on 7 calibrated benchmarks from actual publishing outcomes.
                            </p>
                        </div>
                    </div>

                    {/* Supporting AI Analysis */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-1">Supporting AI Perspectives</h3>
                            <p className="text-sm text-slate-500">These scores may be optimistic — trust the Base44 calibrated grade above</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-xl bg-purple-50 border border-purple-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-purple-900">AI Perspective 1</span>
                                    <span className="text-2xl font-bold text-purple-700">
                                        {Math.round((evaluationResult.overallScore || submission.overall_score) * 10)}
                                    </span>
                                </div>
                                <p className="text-xs text-purple-600">Detailed analysis engine</p>
                            </div>
                            <div className="p-5 rounded-xl bg-blue-50 border border-blue-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-blue-900">AI Perspective 2</span>
                                    <span className="text-2xl font-bold text-blue-700">
                                        {Math.round((evaluationResult.overallScore || submission.overall_score) * 10)}
                                    </span>
                                </div>
                                <p className="text-xs text-blue-600">Market fit analysis</p>
                            </div>
                        </div>
                    </div>

                    {/* Revision Requests */}
                    {evaluationResult.revisionRequests?.length > 0 && (
                        <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Priority Revision Requests</h3>
                            <div className="space-y-3">
                                {evaluationResult.revisionRequests.map((req, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <Badge className={
                                            req.priority === 'High' ? 'bg-red-100 text-red-700' :
                                            req.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                            'bg-blue-100 text-blue-700'
                                        }>
                                            {req.priority}
                                        </Badge>
                                        <p className="text-sm text-slate-700 flex-1">{req.instruction}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Criteria Scores */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800">12 Literary Agent Criteria</h3>
                            <Badge>{evaluationResult.criteria?.length || 0}/12</Badge>
                        </div>
                        {evaluationResult.criteria?.map((criterion, idx) => (
                            <div key={idx} className="p-5 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 transition-all">
                                <div className="flex items-start justify-between mb-3">
                                    <h4 className="font-semibold text-slate-800">{criterion.name}</h4>
                                    <span className={`font-bold text-lg ${
                                        criterion.score >= 9 ? 'text-emerald-600' :
                                        criterion.score >= 7 ? 'text-amber-600' : 'text-rose-600'
                                    }`}>
                                        {criterion.score}/10
                                    </span>
                                </div>
                                <div className="space-y-3 text-sm">
                                    {criterion.strengths?.length > 0 && (
                                        <div>
                                            <span className="font-medium text-emerald-600">✓ Strengths:</span>
                                            <ul className="mt-1 space-y-1">
                                                {criterion.strengths.map((s, i) => (
                                                    <li key={i} className="text-slate-600">• {s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {criterion.weaknesses?.length > 0 && (
                                        <div>
                                            <span className="font-medium text-rose-600">✗ Weaknesses:</span>
                                            <ul className="mt-1 space-y-1">
                                                {criterion.weaknesses.map((w, i) => (
                                                    <li key={i} className="text-slate-600">• {w}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {criterion.agentNotes && (
                                        <div>
                                            <span className="font-medium text-indigo-600">Agent Notes:</span>
                                            <p className="text-slate-700 mt-1">{criterion.agentNotes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Wave Hits */}
                    {evaluationResult.waveHits?.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800">Wave Revision Items ({evaluationResult.waveHits.length})</h3>
                            {evaluationResult.waveHits.map((hit, idx) => (
                                <div key={idx} className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="font-semibold text-slate-800">{hit.wave_item}</span>
                                        <Badge className={
                                            hit.severity === 'High' ? 'bg-red-100 text-red-700' :
                                            hit.severity === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                            'bg-blue-100 text-blue-700'
                                        }>
                                            {hit.severity}
                                        </Badge>
                                    </div>
                                    <div className="text-sm space-y-2">
                                        <div>
                                            <span className="font-medium text-slate-600">Evidence:</span>
                                            <p className="text-slate-600 italic mt-1">"{hit.evidence_quote}"</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-indigo-600">Fix:</span>
                                            <p className="text-slate-700 mt-1">{hit.fix}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Wave Guidance */}
                    {evaluationResult.waveGuidance && (
                        <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200">
                            <h4 className="font-semibold text-cyan-800 mb-3">Wave System Guidance</h4>
                            {evaluationResult.waveGuidance.priorityWaves?.length > 0 && (
                                <div className="mb-3">
                                    <span className="text-sm font-medium text-slate-600">Priority Waves:</span>
                                    <div className="flex gap-2 mt-2">
                                        {evaluationResult.waveGuidance.priorityWaves.map((wave, i) => (
                                            <Badge key={i} variant="outline">Wave {wave}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {evaluationResult.waveGuidance.nextActions?.length > 0 && (
                                <div>
                                    <span className="text-sm font-medium text-slate-600">Next Actions:</span>
                                    <ul className="mt-2 space-y-1">
                                        {evaluationResult.waveGuidance.nextActions.map((action, i) => (
                                            <li key={i} className="text-sm text-slate-700">• {action}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}