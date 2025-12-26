import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, GitBranch, TrendingUp } from 'lucide-react';

export default function ProjectOverview({ submissions, manuscripts, revisionSessions }) {
    const totalEvaluations = submissions.length + manuscripts.length;
    const completedSessions = revisionSessions.filter(s => s.status === 'completed').length;
    const avgScore = submissions.length > 0 
        ? (submissions.reduce((sum, s) => sum + (s.overall_score || 0), 0) / submissions.length * 10).toFixed(1)
        : 0;

    const inProgressSessions = revisionSessions.filter(s => s.status === 'in_progress').length;

    const stats = [
        {
            icon: FileText,
            label: 'Total Evaluations',
            value: totalEvaluations,
            color: 'from-indigo-500 to-blue-600'
        },
        {
            icon: BookOpen,
            label: 'Full Manuscripts',
            value: manuscripts.length,
            color: 'from-purple-500 to-pink-600'
        },
        {
            icon: GitBranch,
            label: 'Revision Sessions',
            value: `${completedSessions}/${revisionSessions.length}`,
            color: 'from-emerald-500 to-teal-600'
        },
        {
            icon: TrendingUp,
            label: 'Average Score',
            value: `${avgScore}/100`,
            color: 'from-amber-500 to-orange-600'
        }
    ];

    return (
        <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Project Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="border-0 shadow-md">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                                    <stat.icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-slate-900 mb-1">
                                {stat.value}
                            </div>
                            <div className="text-sm text-slate-600">
                                {stat.label}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {inProgressSessions > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                    <p className="text-sm text-indigo-900">
                        You have <strong>{inProgressSessions}</strong> revision session{inProgressSessions > 1 ? 's' : ''} in progress
                    </p>
                </div>
            )}
        </div>
    );
}