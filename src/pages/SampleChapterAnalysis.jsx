import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function SampleChapterAnalysis() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Back Button */}
                <Link to={createPageUrl('SampleAnalyses')}>
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Sample Analyses
                    </Button>
                </Link>

                {/* Header */}
                <div className="text-center mb-8">
                    <Badge className="mb-4 px-4 py-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Quick Evaluation Sample
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Chapter 3 — "The Crossing"
                    </h1>
                    <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                        Quick Evaluation: 13 Story Evaluation Criteria (without WAVE)
                    </p>
                </div>

                {/* Context Banner */}
                <Card className="mb-8 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
                    <CardContent className="p-6 space-y-3 text-sm text-slate-700">
                        <p>
                            <strong>This sample illustrates how RevisionGrade's Quick Evaluation analyzes a chapter using 13 Story Evaluation Criteria.</strong>
                        </p>
                        <p>
                            The analysis below is <strong>illustrative, not exhaustive</strong>. It demonstrates the type of insight produced 
                            in Quick Evaluation mode—without the full WAVE framework or internal scoring mechanics.
                        </p>
                        <p className="text-slate-600 italic">
                            This example reflects a fictionalized manuscript excerpt and is provided to show the structure and depth 
                            of feedback available in the platform's Quick Evaluation mode.
                        </p>
                    </CardContent>
                </Card>

                {/* Manuscript Info */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardContent className="p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Manuscript</p>
                                <p className="font-semibold text-slate-900">Fiction Sample</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Evaluation Type</p>
                                <p className="font-semibold text-slate-900">Quick Evaluation (13 Criteria)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Executive Summary */}
                <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-green-50">
                    <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            Executive Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-slate-700">
                        <p>
                            This chapter delivers its core promise—a tense, high-stakes crossing under pressure—with strong narrative momentum and clear emotional stakes. The sequence is coherent, readable, and engaging. A small number of refinements would strengthen authority, reduce repetition, and sharpen the impact of key moments.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className="p-4 rounded-lg bg-white border border-emerald-200">
                                <p className="text-sm font-semibold text-slate-900 mb-2">Overall Assessment</p>
                                <p className="text-sm text-slate-700">Submission-ready with targeted refinements</p>
                            </div>
                            <div className="p-4 rounded-lg bg-white border border-emerald-200">
                                <p className="text-sm font-semibold text-slate-900 mb-2">Primary Strengths</p>
                                <p className="text-sm text-slate-700">Point-of-view control, escalating tension</p>
                            </div>
                            <div className="p-4 rounded-lg bg-white border border-amber-200 md:col-span-2">
                                <p className="text-sm font-semibold text-slate-900 mb-2">Primary Opportunities</p>
                                <p className="text-sm text-slate-700">Reducing repetition, tightening select moments of phrasing</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 13 Story Evaluation Criteria */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">13 Story Evaluation Criteria</CardTitle>
                        <p className="text-sm text-slate-600 mt-2">
                            The foundational criteria agents and editors use when reviewing submissions
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { criterion: 'Opening Hook', assessment: '✓ Immediate grounding and forward motion establish urgency without exposition.' },
                                { criterion: 'Character Depth & Introduction', assessment: "✓ The protagonist's fear and resolve read as specific and earned rather than generic." },
                                { criterion: 'Conflict & Escalation', assessment: '✓ Tension rises logically from observation to consequence, maintaining momentum.' },
                                { criterion: 'Structure, Pacing & Flow', assessment: '✓ Scene progression is clean and purposeful, with no structural dead weight.' },
                                { criterion: 'Dialogue & Subtext', assessment: '✓ Exchanges convey stakes and intent without over-explaining.' },
                                { criterion: 'Stakes & Emotional Investment', assessment: '✓ Reader understands both the physical risk and the personal cost.' },
                                { criterion: 'Narrative Voice & Style', assessment: '✓ Consistent close perspective; tone remains controlled throughout.' },
                                { criterion: 'Worldbuilding & Immersion', assessment: '✓ Setting details support realism without slowing pacing.' },
                                { criterion: 'Thematic Resonance', assessment: '⚠ A recurring motif appears several times; trimming one instance would sharpen its impact.' },
                                { criterion: 'Market Readiness', assessment: '✓ Aligns with expectations for commercial thriller pacing and tone.' },
                                { criterion: 'Line-Level Craft & Polish', assessment: '✓ Clean prose with occasional opportunities for tightening.' },
                                { criterion: 'Scene Architecture & Causality', assessment: '✓ Events unfold with clear cause-and-effect logic.' },
                                { criterion: 'Would They Keep Reading?', assessment: '✓ Ending creates a clear pull into the next scene.' }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    {item.assessment.startsWith('✓') ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm mb-1">{item.criterion}</p>
                                        <p className="text-sm text-slate-700">{item.assessment}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recommended Actions */}
                <Card className="mb-8 border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl">Recommended Revision Order</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-2 list-decimal list-inside text-slate-700">
                            <li>Trim redundant sensory phrasing.</li>
                            <li>Replace generalized descriptions with precise physical cues.</li>
                            <li>Recheck one or two lines for immediacy and rhythm.</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* What Happens Next */}
                <Card className="mb-8 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
                    <CardHeader>
                        <CardTitle className="text-xl">What Happens Next</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-slate-700">
                        <p>
                            <strong>You decide which notes to apply.</strong>
                        </p>
                        <p>
                            Once revisions are made, you can re-run the evaluation to confirm improvements and identify 
                            any remaining refinement opportunities.
                        </p>
                    </CardContent>
                </Card>

                {/* Why This Example is Shown */}
                <Card className="border-0 shadow-md bg-slate-50">
                    <CardContent className="p-6 text-center">
                        <p className="text-sm text-slate-700 italic">
                            <strong>Why this example is shown:</strong> This sample demonstrates the format, depth, and tone 
                            of a RevisionGrade Quick Evaluation. It does not expose scoring rules, internal weighting, or 
                            proprietary logic.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}