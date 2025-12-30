import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    BookOpen, Shield, CheckCircle2, X, Target
} from 'lucide-react';

export default function Criteria() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Professional Revision Framework
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                        What is WAVE?
                    </h1>
                    <p className="text-xl text-slate-600">
                        RevisionGrade's professional revision framework: scores of focused checks that help you turn a working draft into a submission-ready manuscript—without flattening voice.
                    </p>
                </div>

                {/* Introduction */}
                <div className="prose prose-lg prose-slate max-w-none mb-12">
                    <Card className="border-0 shadow-md bg-white">
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-3">What is WAVE?</h2>
                                <p className="text-slate-700 leading-relaxed">
                                    WAVE is a late-stage revision system for manuscripts that already work at the story level but still need disciplined editing to read as professional and submission-ready. It is diagnostic and multi-pass: each evaluation isolates a failure pattern, explains why it weakens the manuscript, and gives a concrete way to fix it.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3">How Base44 applies WAVE</h3>
                                <p className="text-slate-700 leading-relaxed">
                                    Base44—powered by multiple AI systems including ChatGPT and Perplexity—executes the WAVE framework on your manuscript, applying the proprietary standards consistently across every chapter. It surfaces where the draft succeeds and where it undermines itself, explains the "why" behind each flag, and leaves every creative decision to you.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* WAVE Order Card */}
                <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">WAVE runs in the right order (structure → momentum → polish)</h2>
                        <div className="space-y-4">
                            <div>
                                <Badge className="bg-blue-100 text-blue-700 mb-2">Early Waves</Badge>
                                <p className="text-slate-700 leading-relaxed">
                                    Focus on foundational narrative integrity and scene-level logic: does the story actually hold together on its own?
                                </p>
                            </div>
                            <div>
                                <Badge className="bg-amber-100 text-amber-700 mb-2">Mid Waves</Badge>
                                <p className="text-slate-700 leading-relaxed">
                                    Focus on momentum, cohesion, and what the manuscript earns on the page: is anything dragging, redundant, or unfocused?
                                </p>
                            </div>
                            <div>
                                <Badge className="bg-purple-100 text-purple-700 mb-2">Late Waves</Badge>
                                <p className="text-slate-700 leading-relaxed">
                                    Focus on authority-level clarity and voice-safe refinement: does the work read confident and professional to agents and editors?
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* What WAVE is Not */}
                <Card className="mb-8 border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                    <CardContent className="p-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">What WAVE is not</h2>
                        <p className="text-slate-700 leading-relaxed">
                            WAVE is not a first-draft tool, a style guide, a voice-flattening system, or a replacement for judgment. It doesn't tell you what to write—it shows you where the draft is undercutting you, so you can remove weakness on purpose.
                        </p>
                        <p className="text-slate-600 text-sm mt-4 italic">
                            Full Wave definitions are proprietary and are presented in-app in context, alongside your manuscript pages.
                        </p>
                    </CardContent>
                </Card>

                {/* What We Evaluate */}
                <Card className="mb-8 border-0 shadow-lg">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">What We Evaluate</h2>
                        <p className="text-slate-700 mb-6 leading-relaxed">
                            RevisionGrade uses a two-layer evaluation framework powered by the WAVE Revision System (proprietary revision framework) designed to mirror professional editorial assessment. Each manuscript is reviewed across:
                        </p>
                        <div className="space-y-6 mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-3">13 Story Evaluation Criteria</h3>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {[
                                        'Opening Hook',
                                        'Narrative Voice & Style',
                                        'Character Depth & Introduction',
                                        'Conflict & Tension Escalation',
                                        'Thematic Resonance',
                                        'Structure, Pacing & Flow',
                                        'Scene Architecture & Causality',
                                        'Dialogue & Subtext',
                                        'Worldbuilding & Immersion',
                                        'Stakes & Emotional Investment',
                                        'Line-Level Craft & Polish',
                                        'Marketability & Genre Position',
                                        'Would They Keep Reading?'
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-slate-700">
                                            <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-slate-600 italic mt-4">
                                    The structural and thematic foundation that agents and editors use to assess manuscript readiness.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-3">WAVE runs in the right order (structure → momentum → polish):</h3>
                                <div className="space-y-2 mb-3">
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-blue-100 text-blue-700 flex-shrink-0">Early</Badge>
                                        <span className="text-sm text-slate-700">Foundational narrative integrity and scene-level logic</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-amber-100 text-amber-700 flex-shrink-0">Mid</Badge>
                                        <span className="text-sm text-slate-700">Momentum, cohesion, and what the manuscript earns on the page</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-purple-100 text-purple-700 flex-shrink-0">Late</Badge>
                                        <span className="text-sm text-slate-700">Authority-level clarity and voice-safe refinement</span>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 italic">
                                    Identifies patterns that can quietly reduce clarity, authority, and submission readiness—then explains what triggered and why.
                                </p>
                            </div>
                        </div>
                        <p className="text-slate-600 italic">
                            These criteria and waves focus on how a story functions on the page—not on genre trends, personal taste, or formulaic rules.
                        </p>
                    </CardContent>
                </Card>

                {/* What You Receive */}
                <Card className="mb-8 border-0 shadow-lg">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">What You Receive</h2>
                        <p className="text-slate-700 mb-4 leading-relaxed">
                            For each criterion, you'll see:
                        </p>
                        <div className="space-y-3 mb-6">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                                <p className="text-slate-700">A score (1–10) indicating overall effectiveness</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                                <p className="text-slate-700">A concise explanation of what's working and what isn't</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                                <p className="text-slate-700">Actionable guidance on how to strengthen the material</p>
                            </div>
                        </div>
                        <p className="text-slate-600 italic">
                            This feedback is designed to be practical, readable, and immediately useful during revision.
                        </p>
                    </CardContent>
                </Card>

                {/* What This Is — and Isn't */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-lg font-bold text-slate-900">This Is:</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-600">•</span>
                                    <span>A structured evaluation grounded in real editorial practice</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-600">•</span>
                                    <span>A way to understand how your work reads to a professional audience</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-600">•</span>
                                    <span>A diagnostic tool to guide revision and decision-making</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <X className="w-5 h-5 text-slate-600" />
                                <h3 className="text-lg font-bold text-slate-900">This Is Not:</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-400">×</span>
                                    <span>A replacement for human editors or agents</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-400">×</span>
                                    <span>A submission decision or guarantee of representation</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-400">×</span>
                                    <span>A generative writing system</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-slate-400">×</span>
                                    <span>A formula that dictates creative choices</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center mb-8">
                    <p className="text-xl font-semibold text-slate-900">
                        The goal is clarity, not conformity.
                    </p>
                </div>

                {/* How the System Works */}
                <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-8">
                        <div className="flex items-start gap-3 mb-4">
                            <Shield className="w-6 h-6 text-indigo-600 mt-1 flex-shrink-0" />
                            <h2 className="text-2xl font-bold text-slate-900">How the System Works Behind the Scenes</h2>
                        </div>
                        <div className="space-y-4 text-slate-700">
                            <p className="leading-relaxed">
                                The evaluation uses a professional framework informed by how manuscripts are actually assessed in publishing and screen development.
                            </p>
                            <p className="leading-relaxed">
                                Some analytical layers operate behind the scenes to maintain consistency and prevent gaming of the system. These internal checks help ensure that feedback reflects genuine craft issues rather than surface-level patterns.
                            </p>
                            <p className="leading-relaxed font-medium text-indigo-900">
                                What you see is the meaningful result: clear guidance without exposing proprietary mechanics.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Who This Is For */}
                <Card className="mb-8 border-0 shadow-lg">
                    <CardContent className="p-8">
                        <div className="flex items-start gap-3 mb-4">
                            <Target className="w-6 h-6 text-slate-700 mt-1 flex-shrink-0" />
                            <h2 className="text-2xl font-bold text-slate-900">Who This Is For</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                            {[
                                'Writers seeking professional-level feedback',
                                'Authors preparing for querying or submission',
                                'Creators who want an objective view of strengths and weaknesses',
                                'Professionals looking for a clearer diagnostic before revision'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-slate-700">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600 mt-1 flex-shrink-0" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                        <p className="mt-6 text-slate-700 leading-relaxed">
                            Whether you're revising a novel, screenplay, or long-form narrative, the goal is the same: 
                            help you understand how your work is landing — and how to make it stronger.
                        </p>
                    </CardContent>
                </Card>

                {/* In Short */}
                <Card className="border-2 border-slate-900 bg-slate-900">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-white mb-4">In Short</h2>
                        <p className="text-xl text-slate-200 leading-relaxed mb-4">
                            This system doesn't tell you what to write.
                            It helps you understand how your work is reading — so you can make informed creative decisions.
                        </p>
                        <p className="text-slate-400 italic">
                            That's it. No hype. No black box. Just clarity.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}