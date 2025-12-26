import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, BookOpen, Eye, Calendar, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function EvaluationsList({ submissions, manuscripts }) {
    const getScoreColor = (score) => {
        if (score >= 8) return "text-emerald-600";
        if (score >= 6) return "text-amber-600";
        return "text-rose-600";
    };

    const getStatusConfig = (status) => {
        const configs = {
            draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
            evaluating: { label: 'Evaluating', color: 'bg-blue-100 text-blue-700' },
            reviewed: { label: 'Reviewed', color: 'bg-emerald-100 text-emerald-700' },
            uploaded: { label: 'Uploaded', color: 'bg-slate-100 text-slate-700' },
            splitting: { label: 'Processing', color: 'bg-amber-100 text-amber-700' },
            ready: { label: 'Ready', color: 'bg-emerald-100 text-emerald-700' }
        };
        return configs[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
    };

    return (
        <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Evaluations</h2>
            <Tabs defaultValue="quick" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="quick">Quick Evaluations</TabsTrigger>
                    <TabsTrigger value="manuscripts">Full Manuscripts</TabsTrigger>
                </TabsList>

                <TabsContent value="quick" className="mt-6">
                    {submissions.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                <p className="text-slate-600 mb-4">No quick evaluations yet</p>
                                <Link to={createPageUrl('Evaluate')}>
                                    <Button>Start First Evaluation</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {submissions.map((submission) => (
                                <Card key={submission.id} className="hover:shadow-lg transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                                                    {submission.title}
                                                </h3>
                                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {format(new Date(submission.created_date), 'MMM d, yyyy')}
                                                    </div>
                                                    {submission.text && (
                                                        <div>
                                                            {submission.text.split(/\s+/).length} words
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {submission.overall_score && (
                                                    <div className="text-right">
                                                        <div className={`text-2xl font-bold ${getScoreColor(submission.overall_score)}`}>
                                                            {Math.round(submission.overall_score * 10)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">score</div>
                                                    </div>
                                                )}
                                                <Badge className={getStatusConfig(submission.status).color}>
                                                    {getStatusConfig(submission.status).label}
                                                </Badge>
                                            </div>
                                        </div>
                                        {submission.status === 'reviewed' && (
                                            <Link to={createPageUrl(`ViewReport?submissionId=${submission.id}`)}>
                                                <Button variant="outline" size="sm" className="w-full">
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    View Report
                                                </Button>
                                            </Link>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="manuscripts" className="mt-6">
                    {manuscripts.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                <p className="text-slate-600 mb-4">No full manuscripts yet</p>
                                <Link to={createPageUrl('UploadManuscript')}>
                                    <Button>Upload Manuscript</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {manuscripts.map((manuscript) => (
                                <Card key={manuscript.id} className="hover:shadow-lg transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg text-slate-900 mb-2">
                                                    {manuscript.title}
                                                </h3>
                                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {format(new Date(manuscript.created_date), 'MMM d, yyyy')}
                                                    </div>
                                                    <div>
                                                        {manuscript.word_count?.toLocaleString()} words
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {manuscript.spine_score && (
                                                    <div className="text-right">
                                                        <div className={`text-2xl font-bold ${getScoreColor(manuscript.spine_score)}`}>
                                                            {Math.round(manuscript.spine_score * 10)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">spine</div>
                                                    </div>
                                                )}
                                                <Badge className={getStatusConfig(manuscript.status).color}>
                                                    {getStatusConfig(manuscript.status).label}
                                                </Badge>
                                            </div>
                                        </div>
                                        {manuscript.status === 'ready' && (
                                            <Link to={createPageUrl(`ManuscriptDashboard?id=${manuscript.id}`)}>
                                                <Button variant="outline" size="sm" className="w-full">
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    View Dashboard
                                                </Button>
                                            </Link>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}