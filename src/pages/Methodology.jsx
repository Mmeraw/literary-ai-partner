import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, Target, Award, Waves } from 'lucide-react';

export default function Methodology() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Brain className="w-4 h-4 mr-2" />
                        Evaluation Methodology
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        How RevisionGrade Works
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Our dual-layer evaluation system combines story structure analysis with line-level craft diagnostics.
                    </p>
                </div>

                {/* Overview */}
                <Card className="mb-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            Two-Layer Analysis System
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                            <h3 className="font-semibold text-indigo-900 mb-2">Layer 1: Story Structure (12 Criteria)</h3>
                            <p className="text-sm text-slate-700">
                                Evaluates hook, voice, character development, pacing, dialogue, stakes, and marketability—
                                the same criteria agents and editors use when reviewing submissions.
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                            <h3 className="font-semibold text-purple-900 mb-2">Layer 2: Proprietary Revision Framework</h3>
                            <p className="text-sm text-slate-700">
                                Base44 applies its proprietary revision framework to evaluate manuscripts across structure, momentum, and clarity—surfacing where a draft succeeds and where it quietly undermines itself.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* PhD Calibration */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-indigo-600" />
                            PhD-Calibrated Scoring
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-slate-700">
                            RevisionGrade's scoring engine was calibrated using detailed editorial evaluations created by 
                            PhD-level editors and literary professionals. Their criteria, diagnostic patterns, and revision 
                            standards were encoded into the system—together with the proprietary WAVE Revision framework—
                            so the AI can apply the same evaluative logic consistently across manuscripts, at scale.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-2">Editorial Analysis</h4>
                                <p className="text-sm text-slate-600">
                                    MFA Creative Writing + PhD English Literature specialists evaluated complete works, 
                                    identifying structural issues, pacing problems, and thematic clarity.
                                </p>
                            </div>
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <h4 className="font-semibold text-slate-900 mb-2">Cross-Format Expertise</h4>
                                <p className="text-sm text-slate-600">
                                    PhD editors specializing in fiction, screenwriting, and genre-specific markets provided 
                                    format-aware feedback on marketability and agent/producer expectations.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* WAVE IP */}
                <Card className="mb-8 border-2 border-purple-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Waves className="w-5 h-5 text-purple-600" />
                            The WAVE Revision System (Core IP)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-slate-700">
                           WAVE is a late-stage revision system for writing that already works at the story level but still needs disciplined editing to read as professional and submission-ready. It is diagnostic and multi-pass: each evaluation isolates a failure pattern, explains why it weakens the writing, and gives a concrete way to fix it. Base44 surfaces the relevant insights, explains the "why," and leaves every change up to you.
                        </p>
                        <p className="text-slate-700">
                            Base44 applies the WAVE framework to every chapter automatically, then reports which areas need attention and why—so you see the standards and stay in control of every change.
                        </p>
                        <p className="text-slate-700">
                            The online tool does not "discover" these rules; it <strong>executes them</strong>.
                        </p>
                        <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                            <p className="text-sm text-purple-900 font-semibold">
                                The app is AI-powered, but the standards are human-crafted WAVE IP.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Evaluation Process */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-600" />
                            The Evaluation Process
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                    1
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Structural Analysis</h4>
                                    <p className="text-sm text-slate-600">
                                        AI systems evaluate your work against 12 professional criteria, scoring each 1-10 
                                        and identifying strengths and weaknesses in story structure.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                    2
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">WAVE Diagnostics</h4>
                                    <p className="text-sm text-slate-600">
                                        Line-by-line analysis flags craft issues based on scores of proprietary WAVE checks, 
                                        with severity ratings and specific fix suggestions.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                    3
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Composite Scoring</h4>
                                    <p className="text-sm text-slate-600">
                                        Results are combined into a Base44 Calibrated Score (0-100) that reflects how your 
                                        manuscript measures against professional editorial standards.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                                    4
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Actionable Feedback</h4>
                                    <p className="text-sm text-slate-600">
                                        Receive prioritized revision requests, agent decision snapshots, and specific guidance 
                                        on what to fix first for maximum impact.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Disclaimer */}
                <div className="mt-8 p-6 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 text-center">
                        <strong>Important:</strong> RevisionGrade provides AI-generated analysis calibrated against 
                        professional editorial standards. It does not replace human editorial judgment—final decisions 
                        remain with the author.
                    </p>
                </div>
            </div>
        </div>
    );
}