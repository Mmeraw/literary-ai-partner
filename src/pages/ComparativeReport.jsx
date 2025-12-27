import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, AlertCircle, Download, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ComparativeReport() {
    const searchParams = new URLSearchParams(window.location.search);
    const reportId = searchParams.get('id');

    const { data: report, isLoading } = useQuery({
        queryKey: ['comparativeReport', reportId],
        queryFn: async () => {
            const reports = await base44.entities.ComparativeReport.filter({ id: reportId });
            return reports?.[0];
        },
        enabled: !!reportId
    });

    const handleDownloadPDF = () => {
        const reportText = generateReportText();
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.manuscript_title}_Benchmark_Report.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };

    const generateReportText = () => {
        if (!report) return '';
        const data = report.comparison_data;
        const genreLabel = report.subgenre || report.genre;
        
        let text = `COMPARATIVE BENCHMARK REPORT\n`;
        text += `${report.manuscript_title}\n`;
        text += `Genre: ${genreLabel}\n`;
        text += `Generated: ${new Date(report.created_date).toLocaleDateString()}\n\n`;
        
        text += `SUMMARY\n${'-'.repeat(60)}\n`;
        data.summary_bullets?.forEach(bullet => {
            text += `• ${bullet}\n`;
        });
        
        text += `\n\nCRITERIA COMPARISON\n${'-'.repeat(60)}\n`;
        data.criteria?.forEach(criterion => {
            text += `\n${criterion.name}\n`;
            text += `  Genre Benchmark: ${criterion.benchmark_score}/10\n`;
            text += `  Your Manuscript: ${criterion.user_score}/10\n`;
            if (criterion.advantage !== 'tie') {
                text += `  Observed advantage: ${criterion.advantage_note}\n`;
            }
        });
        
        return text;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-600">Loading comparison report...</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="py-12 text-center">
                        <p className="text-slate-600">Report not found</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const data = report.comparison_data;
    const genreLabel = report.subgenre || report.genre;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Back Button */}
                <Link to={createPageUrl(`ManuscriptDashboard?id=${report.manuscript_id}`)}>
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Manuscript
                    </Button>
                </Link>

                {/* Disclaimer Banner */}
                <div className="mb-8 p-4 rounded-lg bg-amber-50 border-2 border-amber-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-900">
                            <strong>Educational Purpose:</strong> This analysis is provided for educational and illustrative purposes only. 
                            Comparisons evaluate craft patterns against typical genre standards, not author reputation or commercial success. 
                            No endorsement or affiliation is implied.
                        </p>
                    </div>
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Comparative Benchmark Report
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        {report.manuscript_title}
                    </h1>
                    <p className="text-lg text-slate-600">
                        Benchmarked against {genreLabel} genre standards
                    </p>
                    <div className="mt-4 flex justify-center gap-3">
                        <Button onClick={handleDownloadPDF} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Download Report
                        </Button>
                    </div>
                </div>

                {/* Important Note */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Important Note (Scope + Intent)</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-700 space-y-3">
                        <p>
                            This document is a subjective, craft-based benchmarking study intended for educational and 
                            positioning purposes. It uses a consistent internal rubric to show how your manuscript maps 
                            against recognizable genre patterns. It does not imply objective superiority or commercial success.
                        </p>
                    </CardContent>
                </Card>

                {/* Summary Bullets */}
                {data.summary_bullets && data.summary_bullets.length > 0 && (
                    <Card className="mb-8 border-0 shadow-md bg-gradient-to-br from-indigo-50 to-purple-50">
                        <CardHeader>
                            <CardTitle className="text-xl">Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {data.summary_bullets.map((bullet, idx) => (
                                    <li key={idx} className="text-slate-700 flex items-start gap-2">
                                        <span className="text-indigo-600 font-bold">•</span>
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* Synopsis Section */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Your Manuscript */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-xl">Your Manuscript</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {data.user_synopsis}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Genre Benchmark */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-xl">{genreLabel} Genre Standards</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {data.genre_description}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Methodology */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Methodology</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-700">
                        <p>
                            Scores (1–10) reflect a craft rubric used for internal benchmarking. They are not judgments 
                            of literary merit but tools for comparing narrative strategies, emotional effect, and structural 
                            execution against typical genre patterns.
                        </p>
                    </CardContent>
                </Card>

                {/* Comparative Analysis Table */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Comparative Craft Analysis</CardTitle>
                        <p className="text-sm text-slate-600 mt-2">
                            Below is a craft-based comparison across sixteen criteria commonly used when evaluating manuscripts.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
                                        <th className="border border-indigo-400 p-4 text-left font-semibold text-white">Criteria</th>
                                        <th className="border border-indigo-400 p-4 text-left font-semibold text-white">Genre Benchmark: {genreLabel}</th>
                                        <th className="border border-indigo-400 p-4 text-left font-semibold text-white">{report.manuscript_title}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.criteria?.map((criterion, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-slate-50 hover:bg-slate-100" : "bg-white hover:bg-slate-50"}>
                                            <td className="border border-slate-200 p-4 font-semibold bg-slate-100 text-black">
                                                {idx + 1}. {criterion.name}
                                            </td>
                                            <td className="border border-slate-200 p-4 text-black">
                                                <p className="font-semibold mb-2">Score: {criterion.benchmark_score}/10</p>
                                                <p>{criterion.benchmark_description}</p>
                                            </td>
                                            <td className="border border-slate-200 p-4 text-black">
                                                <p className="font-semibold mb-2">Score: {criterion.user_score}/10</p>
                                                <p>{criterion.user_description}</p>
                                                {criterion.advantage !== 'tie' && (
                                                    <p className="text-purple-600 font-bold mt-2">
                                                        Observed advantage: {criterion.advantage_note}
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Bottom Disclaimer */}
                <div className="mt-12 pt-8 border-t border-slate-200">
                    <p className="text-xs text-slate-500 text-center">
                        <strong>Fair Use Notice:</strong> This analysis is provided for educational and illustrative purposes only. 
                        Comparisons reflect internal craft rubrics and genre pattern analysis, not literary merit or commercial success. 
                        All judgments are subjective and intended to support the writer's development. 
                        This page exists to demonstrate how RevisionGrade™ evaluates manuscripts using consistent craft criteria.
                    </p>
                </div>
            </div>
        </div>
    );
}