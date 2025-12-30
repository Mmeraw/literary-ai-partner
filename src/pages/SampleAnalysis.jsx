import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export default function SampleAnalysis() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Sample Chapter Evaluation (Illustrative)
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Sample Evaluation: Chapter 3 — "The Crossing"
                    </h1>
                    <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                        A representative example of how RevisionGrade analyzes a manuscript chapter
                    </p>
                </div>

                {/* Context Banner */}
                <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-6 space-y-3 text-sm text-slate-700">
                        <p>
                            <strong>This sample illustrates how RevisionGrade evaluates a single chapter using its proprietary revision framework.</strong>
                        </p>
                        <p>
                            The analysis below is <strong>illustrative, not exhaustive</strong>. It demonstrates the type of insight and feedback produced—without exposing internal scoring logic, weighting, or full evaluation criteria.
                        </p>
                        <p className="text-slate-600 italic">
                            The example below reflects a fictionalized manuscript excerpt and is provided to show the structure, tone, and depth of feedback users receive inside the platform.
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
                                <p className="font-semibold text-slate-900">Chapter Analysis (Illustrative)</p>
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

                {/* Detailed Analysis */}
                <Accordion type="single" collapsible className="space-y-4">
                    {/* Layer 1: Story Structure */}
                    <AccordionItem value="layer1" className="border-0 shadow-md rounded-lg overflow-hidden">
                        <AccordionTrigger className="bg-white px-6 py-4 hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-indigo-600" />
                                <span className="font-semibold text-lg">Layer 1: Story Structure</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-white px-6 py-4">
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
                                    { criterion: 'Reader Momentum ("Would they keep reading?")', assessment: '✓ Ending creates a clear pull into the next scene.' }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                        {item.assessment.startsWith('✓') ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">{item.criterion}</p>
                                            <p className="text-sm text-slate-700 mt-1">{item.assessment}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Layer 2: Craft Diagnostics */}
                    <AccordionItem value="layer2" className="border-0 shadow-md rounded-lg overflow-hidden">
                        <AccordionTrigger className="bg-white px-6 py-4 hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-purple-600" />
                                <span className="font-semibold text-lg">Layer 2: Craft Diagnostics (Outcome-Focused)</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-white px-6 py-4">
                            <div className="space-y-6">
                                <div>
                                    <Badge className="bg-blue-100 text-blue-700 mb-3">Foundational Integrity</Badge>
                                    <div className="space-y-2 ml-4">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-1" />
                                            <p className="text-sm text-slate-700">Perspective remains stable; sensory input stays anchored to the viewpoint character.</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Badge className="bg-amber-100 text-amber-700 mb-3">Momentum & Meaning</Badge>
                                    <div className="space-y-2 ml-4">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-1" />
                                            <p className="text-sm text-slate-700">A repeated image slightly blunts tension—retain the strongest instance, cut the rest.</p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-1" />
                                            <p className="text-sm text-slate-700">One summary phrase could be replaced with a concrete action for sharper immediacy.</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Badge className="bg-purple-100 text-purple-700 mb-3">Authority & Polish</Badge>
                                    <div className="space-y-2 ml-4">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-1" />
                                            <p className="text-sm text-slate-700">A few lines filter experience through abstraction rather than direct perception.</p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-1" />
                                            <p className="text-sm text-slate-700">Overall voice remains confident and controlled.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Sensitivity Review */}
                    <AccordionItem value="sensitivity" className="border-0 shadow-md rounded-lg overflow-hidden">
                        <AccordionTrigger className="bg-white px-6 py-4 hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-lg">Sensitivity & Representation Review</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-white px-6 py-4">
                            <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-slate-700">No slurs or dehumanizing language detected.</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-slate-700">Character portrayal avoids stereotype and relies on situational context.</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-slate-700">Cultural and environmental elements are handled with restraint and specificity.</p>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {/* Recommended Revision Order */}
                <Card className="mt-8 border-0 shadow-lg">
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
                <Card className="mt-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
                    <CardHeader>
                        <CardTitle className="text-xl">What Happens Next</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-slate-700">
                        <p>
                            <strong>You decide which notes to apply.</strong>
                        </p>
                        <p>
                            Once revisions are made, you can re-run the evaluation to confirm improvements and identify any remaining refinement opportunities.
                        </p>
                    </CardContent>
                </Card>

                {/* Why This Example is Shown */}
                <Card className="mt-8 border-0 shadow-md bg-slate-50">
                    <CardContent className="p-6 text-center">
                        <p className="text-sm text-slate-700 italic">
                            <strong>Why this example is shown:</strong> This sample demonstrates the format, depth, and tone of a RevisionGrade analysis. It does not expose scoring rules, internal weighting, or proprietary logic.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}