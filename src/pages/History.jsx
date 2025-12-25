import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    FileText, Calendar, Type, TrendingUp, 
    ChevronRight, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { motion } from "framer-motion";

export default function History() {
    const { data: submissions, isLoading } = useQuery({
        queryKey: ['submissions'],
        queryFn: () => base44.entities.Submission.list('-created_date'),
        initialData: []
    });

    const getStatusConfig = (status) => {
        switch (status) {
            case 'finalized':
                return { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700', label: 'Finalized' };
            case 'reviewing':
                return { icon: AlertCircle, color: 'bg-amber-100 text-amber-700', label: 'In Review' };
            default:
                return { icon: Clock, color: 'bg-slate-100 text-slate-600', label: 'Draft' };
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-rose-600';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-slate-900">Submission History</h1>
                    <p className="mt-2 text-slate-600">View and continue your manuscript evaluations</p>
                </div>

                {/* Submissions List */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="border-0 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <Skeleton className="w-12 h-12 rounded-xl" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-5 w-48" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                        <Skeleton className="h-10 w-24" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : submissions.length === 0 ? (
                    <Card className="border-0 shadow-md bg-white/90">
                        <CardContent className="py-16 text-center">
                            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">No Submissions Yet</h3>
                            <p className="text-slate-500 mb-6">Start by evaluating your first manuscript</p>
                            <Link to={createPageUrl('Evaluate')}>
                                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
                                    Start Evaluation
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {submissions.map((submission, idx) => {
                            const statusConfig = getStatusConfig(submission.status);
                            const StatusIcon = statusConfig.icon;

                            return (
                                <motion.div
                                    key={submission.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Link to={createPageUrl(`ViewReport?id=${submission.id}`)}>
                                        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/90 cursor-pointer">
                                            <CardContent className="p-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 shrink-0">
                                                        <FileText className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <h3 className="font-semibold text-slate-800 truncate">
                                                                    {submission.title || 'Untitled'}
                                                                </h3>
                                                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="w-4 h-4" />
                                                                        {format(new Date(submission.created_date), 'MMM d, yyyy')}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Type className="w-4 h-4" />
                                                                        {submission.word_count?.toLocaleString() || 0} words
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-4">
                                                                {submission.overall_score && (
                                                                    <div className="text-right">
                                                                        <span className="text-xs text-slate-500">Score</span>
                                                                        <p className={`text-2xl font-bold ${getScoreColor(submission.overall_score)}`}>
                                                                            {submission.overall_score}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <Badge className={statusConfig.color}>
                                                                    <StatusIcon className="w-3 h-3 mr-1" />
                                                                    {statusConfig.label}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {submission.original_text && (
                                                            <p className="mt-3 text-sm text-slate-500 line-clamp-2">
                                                                {submission.original_text.substring(0, 200)}...
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}