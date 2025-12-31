import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Loader2, BookOpen, CheckCircle2, Edit3, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: submissions = [], isLoading: loadingSubmissions } = useQuery({
        queryKey: ['userSubmissions'],
        queryFn: () => base44.entities.Submission.list('-created_date', 100)
    });

    const { data: manuscripts = [], isLoading: loadingManuscripts } = useQuery({
        queryKey: ['userManuscripts'],
        queryFn: () => base44.entities.Manuscript.list('-created_date', 100)
    });

    const { data: revisionSessions = [], isLoading: loadingSessions } = useQuery({
        queryKey: ['userRevisionSessions'],
        queryFn: () => base44.entities.RevisionSession.list('-created_date', 100)
    });

    const { data: chapters = [] } = useQuery({
        queryKey: ['userChapters'],
        queryFn: () => base44.entities.Chapter.list('-created_date', 1000),
        enabled: manuscripts.length > 0
    });

    const isLoading = loadingSubmissions || loadingManuscripts || loadingSessions;

    // Compute metrics (CANONICAL SPEC v1.1)
    const metrics = useMemo(() => {
        const totalWorks = submissions.length + manuscripts.length;
        const evaluationsCompleted = submissions.filter(s => s.status === 'reviewed').length + 
                                     manuscripts.filter(m => m.spine_completed_at).length;
        const activeRevisions = revisionSessions.filter(s => ['queued', 'running', 'paused'].includes(s.status)).length;
        const finalVersions = manuscripts.filter(m => m.is_final).length;
        
        return {
            totalWorks,
            evaluationsCompleted,
            activeRevisions,
            finalVersions,
            outputsGenerated: 0 // TODO: track package generation
        };
    }, [submissions, manuscripts, revisionSessions]);

    // Error frequency analytics
    const errorFrequency = useMemo(() => {
        const errorCounts = {};
        
        // Aggregate WAVE errors from chapters
        chapters.forEach(chapter => {
            if (chapter.wave_results_json?.issues) {
                chapter.wave_results_json.issues.forEach(issue => {
                    const category = issue.category || issue.wave_name || 'Other';
                    errorCounts[category] = (errorCounts[category] || 0) + 1;
                });
            }
        });

        return Object.entries(errorCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [chapters]);

    // Pipeline categorization (CANONICAL WORKFLOW - STATE-BASED)
    const pipeline = useMemo(() => {
        const allWorks = [
            ...manuscripts.map(m => {
                // Determine state based on status + is_final flag
                let state = 'upload';
                if (['summarizing', 'spine_evaluating', 'evaluating_chapters'].includes(m.status)) {
                    state = 'evaluate';
                } else if ((['ready', 'ready_with_errors'].includes(m.status) && !m.is_final)) {
                    state = 'revise';
                } else if (m.is_final) {
                    state = 'output';
                }
                
                return { 
                    ...m, 
                    type: 'manuscript',
                    title: m.title,
                    score: m.spine_score ? Math.round(m.spine_score * 10) : null,
                    status: m.status,
                    is_final: m.is_final || false,
                    lastActivity: m.updated_date || m.created_date,
                    state
                };
            }),
            ...submissions.map(s => {
                let state = 'upload';
                if (s.status === 'evaluating') {
                    state = 'evaluate';
                } else if (['ready', 'reviewed'].includes(s.status)) {
                    state = 'revise';
                }
                
                return { 
                    ...s, 
                    type: 'submission',
                    title: s.title,
                    score: s.overall_score ? Math.round(s.overall_score * 10) : null,
                    status: s.status,
                    is_final: false,
                    lastActivity: s.updated_date || s.created_date,
                    state
                };
            })
        ];

        return {
            upload: allWorks.filter(w => w.state === 'upload'),
            evaluate: allWorks.filter(w => w.state === 'evaluate'),
            revise: allWorks.filter(w => w.state === 'revise'),
            output: allWorks.filter(w => w.state === 'output')
        };
    }, [manuscripts, submissions]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="mt-2 text-slate-600">
                        Welcome back, {user?.full_name || 'Writer'}
                    </p>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    <MetricCard 
                        label="Total Works" 
                        value={metrics.totalWorks} 
                        icon={BookOpen}
                        color="from-indigo-500 to-blue-600"
                    />
                    <MetricCard 
                        label="Evaluations Completed" 
                        value={metrics.evaluationsCompleted} 
                        icon={CheckCircle2}
                        color="from-emerald-500 to-teal-600"
                    />
                    <MetricCard 
                        label="Active Revisions" 
                        value={metrics.activeRevisions} 
                        icon={Edit3}
                        color="from-amber-500 to-orange-600"
                    />
                    <MetricCard 
                        label="Final Versions" 
                        value={metrics.finalVersions} 
                        icon={CheckCircle2}
                        color="from-purple-500 to-pink-600"
                    />
                    <MetricCard 
                        label="Outputs Generated" 
                        value={metrics.outputsGenerated} 
                        icon={Package}
                        color="from-slate-500 to-slate-600"
                    />
                </div>

                {/* Pipeline Board - CANONICAL WORKFLOW */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Pipeline Overview</CardTitle>
                        <p className="text-sm text-slate-600 mt-1">Upload → Evaluate → Revise → Output</p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <PipelineColumn title="Upload" works={pipeline.upload} stage="upload" count={pipeline.upload.length} />
                            <PipelineColumn title="Evaluate" works={pipeline.evaluate} stage="evaluate" count={pipeline.evaluate.length} />
                            <PipelineColumn title="Revise" works={pipeline.revise} stage="revise" count={pipeline.revise.length} />
                            <PipelineColumn title="Output" works={pipeline.output} stage="output" count={pipeline.output.length} />
                        </div>
                    </CardContent>
                </Card>

                {/* Activity Modules - CANONICAL SPEC v1.1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Evaluations (Latest per Work) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Evaluations (Latest per Work)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[...manuscripts, ...submissions]
                                    .filter(w => 
                                        (w.spine_completed_at) || 
                                        (w.status === 'reviewed')
                                    )
                                    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                                    .slice(0, 5)
                                    .map(work => (
                                        <WorkRow key={work.id} work={work} />
                                    ))}
                                {manuscripts.filter(m => m.spine_completed_at).length === 0 && 
                                 submissions.filter(s => s.status === 'reviewed').length === 0 && (
                                    <p className="text-sm text-slate-500 text-center py-8">No evaluations yet</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Revisions & Creations (Active) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Revisions & Creations (Active)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {revisionSessions
                                    .filter(s => ['queued', 'running', 'paused'].includes(s.status))
                                    .slice(0, 5)
                                    .map(session => (
                                        <div key={session.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-sm text-slate-900">{session.title}</h4>
                                                <p className="text-xs text-slate-600">Mode: Revision Session</p>
                                            </div>
                                            <Link to={createPageUrl(`Revise?sessionId=${session.id}`)}>
                                                <Button size="sm" variant="outline">Continue</Button>
                                            </Link>
                                        </div>
                                    ))}
                                {revisionSessions.filter(s => ['queued', 'running', 'paused'].includes(s.status)).length === 0 && (
                                    <p className="text-sm text-slate-500 text-center py-8">No active revisions</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Final Versions + Analytics Snapshot */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Final Versions (flagged) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Final Versions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {manuscripts
                                    .filter(m => m.is_final)
                                    .map(m => (
                                        <div key={m.id} className="p-4 rounded-lg border border-green-200 bg-green-50">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-sm text-slate-900">{m.title}</h4>
                                                    <p className="text-xs text-slate-600 mt-1">
                                                        Locked {format(new Date(m.updated_date), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <Badge className="bg-green-100 text-green-700 border-green-300">Final</Badge>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link to={createPageUrl('CompletePackage')}>
                                                    <Button size="sm" variant="outline" className="text-xs">
                                                        Prepare Agent Package
                                                    </Button>
                                                </Link>
                                                <Link to={createPageUrl('FilmAdaptation')}>
                                                    <Button size="sm" variant="outline" className="text-xs">
                                                        Prepare Film
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                {manuscripts.filter(m => m.is_final).length === 0 && (
                                    <p className="text-sm text-slate-500 text-center py-8">No final versions yet</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Analytics Snapshot */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Analytics Snapshot</CardTitle>
                            <p className="text-xs text-slate-600 mt-1">Top Issues + Trends + Status</p>
                        </CardHeader>
                        <CardContent>
                            {errorFrequency.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        {errorFrequency.slice(0, 5).map((error, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50">
                                                <span className="text-sm text-slate-900 truncate flex-1">{error.name}</span>
                                                <Badge variant="secondary" className="ml-2">{error.count}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-3 border-t border-slate-200 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                                            <span className="text-sm font-medium text-emerald-600">Improving</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-8">
                                    No data yet. Complete evaluations to see insights.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, color }) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${color}`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
                <div className="text-xs text-slate-600">{label}</div>
            </CardContent>
        </Card>
    );
}

function PipelineColumn({ title, works, stage }) {
    return (
        <div className="bg-slate-50 rounded-lg p-4 min-h-[200px]">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center justify-between">
                {title}
                <Badge variant="secondary">{works.length}</Badge>
            </h3>
            <div className="space-y-2">
                {works.slice(0, 3).map(work => (
                    <WorkCard key={work.id} work={work} stage={stage} />
                ))}
                {works.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">No items</p>
                )}
            </div>
        </div>
    );
}

function WorkCard({ work, stage }) {
    // CANONICAL MICROCOPY - Next Action Labels
    const getNextAction = () => {
        if (stage === 'upload') return 'Run Evaluation';
        if (stage === 'evaluate') return 'View Progress';
        if (stage === 'revise') return 'Continue Revision';
        return 'Build Output';
    };

    const getLink = () => {
        if (work.type === 'manuscript') {
            return createPageUrl(`ManuscriptDashboard?id=${work.id}`);
        }
        return createPageUrl(`ViewReport?submissionId=${work.id}`);
    };

    // CANONICAL MICROCOPY - Badge Labels
    const getBadge = () => {
        if (work.is_final) return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Locked</Badge>;
        if (stage === 'evaluate') return <Badge variant="outline" className="text-xs">In Progress</Badge>;
        if (stage === 'revise') return <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Needs Revision</Badge>;
        return null;
    };

    // Format last activity
    const formatLastActivity = (date) => {
        if (!date) return 'Just now';
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm text-slate-900 truncate flex-1" title={work.title}>
                        {work.title}
                    </h4>
                    {getBadge()}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>{work.type === 'manuscript' ? 'Novel' : 'Scene'}</span>
                    {work.score && (
                        <span className="font-semibold text-indigo-600">{work.score}/100</span>
                    )}
                </div>
                <div className="text-xs text-slate-500 mb-3">
                    Last activity: {formatLastActivity(work.lastActivity)}
                </div>
                <Link to={getLink()}>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                        {getNextAction()} →
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}

function WorkRow({ work }) {
    const score = work.spine_score 
        ? Math.round(work.spine_score * 10) 
        : work.overall_score 
        ? Math.round(work.overall_score * 10) 
        : null;

    const getScoreColor = (s) => {
        if (s >= 80) return 'text-emerald-600';
        if (s >= 60) return 'text-amber-600';
        return 'text-rose-600';
    };

    return (
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
            <div className="flex-1">
                <h4 className="font-medium text-sm text-slate-900">{work.title}</h4>
                <p className="text-xs text-slate-600">
                    {format(new Date(work.created_date), 'MMM d, yyyy')}
                </p>
            </div>
            {score && (
                <div className={`text-xl font-bold ${getScoreColor(score)}`}>
                    {score}
                </div>
            )}
        </div>
    );
}