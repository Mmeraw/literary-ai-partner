import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, FileCheck, TrendingUp, ArrowRight } from 'lucide-react';

export default function SampleAnalyses() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Sample Analyses
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Sample Analyses
                    </h1>
                    <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                        See how RevisionGrade evaluates manuscripts, chapters, and comparative benchmarks
                    </p>
                </div>

                {/* What, Why, Who, When, Where, How */}
                <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-8 space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">What You'll Find Here</h3>
                            <p className="text-slate-700">
                                Two complete sample evaluations demonstrating RevisionGrade's analysis frameworks: 
                                a <strong>Quick Evaluation</strong> of a single chapter (13 Story Criteria) and a 
                                <strong> Novel Comparison</strong> between published works (16 craft criteria).
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Why These Samples Matter</h3>
                            <p className="text-slate-700">
                                These examples show the structure, depth, and tone of RevisionGrade feedback—without exposing 
                                proprietary scoring logic or internal weighting. They demonstrate what "professional evaluation" 
                                looks like in practice.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Who Should Review These</h3>
                            <p className="text-slate-700">
                                Writers preparing manuscripts for submission, authors evaluating editorial services, 
                                professionals considering RevisionGrade for their practice, and anyone wanting to understand 
                                how RevisionGrade analyzes narrative craft.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">When to Use These Examples</h3>
                            <p className="text-slate-700">
                                Before submitting your own work—review these to calibrate expectations. During revision—compare 
                                your feedback to these samples. When evaluating RevisionGrade—see the depth and rigor of analysis 
                                before committing.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Where This Fits in Your Workflow</h3>
                            <p className="text-slate-700">
                                These samples represent the diagnostic phase: understanding what's working, what needs attention, 
                                and why. They precede the revision phase, where you decide which changes to apply.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">How Many Samples Are Available</h3>
                            <p className="text-slate-700">
                                <strong>Two samples</strong> are currently available, with additional genre-specific examples 
                                planned for future release. Each demonstrates a different evaluation mode to show RevisionGrade's 
                                range and depth.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Sample Cards */}
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    {/* Chapter Analysis */}
                    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="bg-gradient-to-br from-emerald-50 to-green-50">
                            <div className="flex items-center gap-3 mb-2">
                                <FileCheck className="w-6 h-6 text-emerald-600" />
                                <CardTitle className="text-xl">Quick Evaluation</CardTitle>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 w-fit">
                                Chapter Analysis
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Sample Work</p>
                                <p className="font-semibold text-slate-900">Chapter 3 — "The Crossing"</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Evaluation Type</p>
                                <p className="font-semibold text-slate-900">13 Story Evaluation Criteria</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">What It Shows</p>
                                <p className="text-sm text-slate-700">
                                    How RevisionGrade evaluates a single chapter against professional story structure criteria—
                                    without the full WAVE framework. This is the "Quick Evaluation" mode available for 
                                    chapters and scenes.
                                </p>
                            </div>
                            <Link to={createPageUrl('SampleChapterAnalysis')}>
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4">
                                    View Chapter Analysis
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    {/* Novel Comparison */}
                    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                        <CardHeader className="bg-gradient-to-br from-purple-50 to-indigo-50">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingUp className="w-6 h-6 text-purple-600" />
                                <CardTitle className="text-xl">Novel Comparison</CardTitle>
                            </div>
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 w-fit">
                                Comparative Benchmarking
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Sample Works</p>
                                <p className="font-semibold text-slate-900">Cartel Babies vs. Cartel Trilogy</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Evaluation Type</p>
                                <p className="font-semibold text-slate-900">16 Craft Criteria Comparison</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">What It Shows</p>
                                <p className="text-sm text-slate-700">
                                    How RevisionGrade benchmarks a contemporary manuscript against established genre standards—
                                    comparing narrative strategies, emotional impact, and market positioning across published work.
                                </p>
                            </div>
                            <Link to={createPageUrl('SampleComparativeAnalysis')}>
                                <Button className="w-full bg-purple-600 hover:bg-purple-700 mt-4">
                                    View Novel Comparison
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                {/* Trust & Transparency Note */}
                <Card className="border-2 border-slate-200 bg-slate-50">
                    <CardContent className="p-6 text-center">
                        <p className="text-sm text-slate-700 italic">
                            <strong>Transparency Note:</strong> These samples are illustrative, not exhaustive. 
                            They demonstrate feedback format and depth without exposing proprietary scoring logic, 
                            weighting formulas, or internal evaluation criteria. What you see here represents the 
                            diagnostic insights you'll receive—clear, actionable, and grounded in professional standards.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}