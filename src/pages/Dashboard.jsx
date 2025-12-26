import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

import ProjectOverview from '@/components/dashboard/ProjectOverview';
import EvaluationsList from '@/components/dashboard/EvaluationsList';
import RevisionHistory from '@/components/dashboard/RevisionHistory';
import FeedbackPreferences from '@/components/dashboard/FeedbackPreferences';

export default function Dashboard() {
    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: submissions, isLoading: loadingSubmissions } = useQuery({
        queryKey: ['userSubmissions'],
        queryFn: () => base44.entities.Submission.list('-created_date', 100)
    });

    const { data: manuscripts, isLoading: loadingManuscripts } = useQuery({
        queryKey: ['userManuscripts'],
        queryFn: () => base44.entities.Manuscript.list('-created_date', 100)
    });

    const { data: revisionSessions, isLoading: loadingSessions } = useQuery({
        queryKey: ['userRevisionSessions'],
        queryFn: () => base44.entities.RevisionSession.list('-created_date', 100)
    });

    const isLoading = loadingSubmissions || loadingManuscripts || loadingSessions;

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
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="mt-2 text-slate-600">
                        Welcome back, {user?.full_name || 'Writer'}
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Project Overview */}
                    <ProjectOverview 
                        submissions={submissions || []}
                        manuscripts={manuscripts || []}
                        revisionSessions={revisionSessions || []}
                    />

                    {/* Evaluations List */}
                    <EvaluationsList 
                        submissions={submissions || []}
                        manuscripts={manuscripts || []}
                    />

                    {/* Revision History */}
                    <RevisionHistory 
                        revisionSessions={revisionSessions || []}
                    />

                    {/* Feedback Preferences */}
                    <FeedbackPreferences user={user} />
                </div>
            </div>
        </div>
    );
}