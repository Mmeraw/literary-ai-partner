import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Sparkles, ArrowRight, BookOpen, Waves, Brain, 
    CheckCircle2, Zap, Shield 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            {/* Editorial Judgment Banner */}
            <div className="bg-slate-50 border-b border-slate-200 py-3">
                <div className="max-w-7xl mx-auto px-6">
                    <p className="text-center text-slate-700 text-sm md:text-[0.95rem] font-medium tracking-wide">
                        An editorial judgment system that tells you why agents would reject your manuscript—and what to fix first.
                    </p>
                </div>
            </div>

            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-transparent to-transparent opacity-60" />
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
                <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000" />
                
                <div className="relative max-w-6xl mx-auto px-6 py-12 sm:py-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center"
                    >
                        <Badge className="mb-6 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200 text-sm font-medium">
                            <Sparkles className="w-4 h-4 mr-2" />
                            PhD-Calibrated AI Manuscript Evaluation, Powered by the WAVE Revision System
                        </Badge>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
                            Transform Your Writing
                            <span className="block -mt-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-relaxed overflow-visible py-2">
                                to Publishing Quality™
                            </span>
                        </h1>

                        <p className="mt-3 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            Get your <strong className="text-slate-900">manuscript</strong> or <strong className="text-slate-900">screenplay</strong> graded against the same 12 agent-level criteria literary and film/TV professionals use to decide what to request, plus 60+ checks from the proprietary WAVE Revision System. 
                            Three AI perspectives analyze your work—but our PhD-calibrated score tells you the brutal truth.
                        </p>

                        <div className="mt-4 space-y-2 flex flex-col items-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 border border-indigo-200">
                                <Shield className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm font-medium text-indigo-900">Scoring calibrated against professional editorial assessments from PhD editors</span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
                                <span className="text-sm font-medium text-slate-700">We'd rather hurt your feelings than see you miss your opportunities with literary agents</span>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link to={createPageUrl('UploadManuscript')}>
                                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25">
                                    <BookOpen className="w-5 h-5 mr-2" />
                                    Upload Your Writing
                                </Button>
                            </Link>
                            <Link to={createPageUrl('Evaluate')}>
                                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-slate-300">
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Quick Scene/Chapter Eval
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* WAVE IP Callout */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 border-2 border-indigo-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-indigo-600">
                            <Waves className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">The WAVE Revision System (Core IP)</h2>
                    </div>
                    <div className="space-y-4 text-slate-700">
                        <p className="leading-relaxed">
                            WAVE is a <strong>60+-wave craft framework</strong> built from years of revising and evaluating full-length novels, screenplays, and narrative nonfiction. It defines what gets graded: hook, structure, line-level authority, motif hygiene, pacing, and more.
                        </p>
                        <p className="leading-relaxed">
                            The online tool does not "discover" these rules; it <strong>executes them</strong>.
                        </p>
                        <p className="leading-relaxed font-semibold text-indigo-900">
                            The app is AI-powered, but the standards are human-crafted WAVE IP.
                        </p>
                        <p className="text-sm text-slate-600 italic mt-4 pt-4 border-t border-indigo-200">
                            The full 60+ WAVE checks, thresholds, and scoring logic remain proprietary and are implemented in software; writers see the decisions and explanations, not the underlying code.
                        </p>
                    </div>
                </div>
            </div>

            {/* Reality Check Section */}
            <div className="bg-slate-900 py-16">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="space-y-6 text-slate-300">
                        <h2 className="text-2xl font-bold text-white">The Agent Reality Check</h2>
                        <p className="leading-relaxed">
                            Despite the myths, commercial literature is highly patterned. Agents are trained to gauge—fast—whether your pages are likely to sell, not to canonize you as an artist. Their job is to find work that enough readers will buy.
                        </p>
                        <p className="leading-relaxed">
                            In practice, trained and untrained eyes give your manuscript seconds at each gate. Does it intrigue, captivate, and hold attention? If not, you don't get a reply—from agents, editors, publishers, producers, or executives. It's a closed loop: work that doesn't hold attention simply falls out of the system.
                        </p>
                        <p className="leading-relaxed">
                            You may have a brilliant story, but if the pages trip over the 12 criteria agents quietly use—and the 60+ structural and line-level checks in the WAVE Guide—it will be rejected long before anyone sees the ending. Agents evaluate in seconds what took you years to build.
                        </p>
                        <div className="p-6 rounded-xl bg-indigo-900/50 border border-indigo-700">
                            <p className="leading-relaxed text-white">
                                <strong>Elevate Your Game™</strong> by running your work through the RevisionGrade framework: a PhD-calibrated scoring engine built on a proprietary 12-criteria rubric and the 60+-wave WAVE Revision System. There is no other technology that combines those standards into one coherent, repeatable diagnostic pass.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="max-w-6xl mx-auto px-6 py-14">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
                    <p className="mt-3 text-slate-600">Grade first, then revise</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: BookOpen,
                            title: "Submit Your Draft",
                            description: "Paste a scene, chapter, or full manuscript/screenplay. RevisionGrade™ handles any length.",
                            color: "from-indigo-500 to-blue-600"
                        },
                        {
                            icon: Brain,
                            title: "Grade, Then Diagnose",
                            description: "Three AI systems (ChatGPT, Perplexity, Base44) score your pages against 12 agent-level criteria and 60+ WAVE checks, highlighting exactly where the manuscript falls short.",
                            color: "from-purple-500 to-pink-600"
                        },
                        {
                            icon: CheckCircle2,
                            title: "Review and Decide",
                            description: "For each flagged issue, you can keep the original, apply a revision, or choose from multiple writing styles—including 'none fit' with fresh alternatives. You stay in control of every change while RevisionGrade systematically elevates the draft toward submission-ready.",
                            color: "from-emerald-500 to-teal-600"
                        }
                    ].map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="relative group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl transform group-hover:scale-105 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
                            <div className="relative p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300">
                                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-6`}>
                                    <feature.icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Calibration Trust Section */}
            <div className="max-w-6xl mx-auto px-6 py-14">
                <div className="text-center mb-12">
                    <Badge className="mb-4 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Shield className="w-4 h-4 mr-2" />
                        PhD-Calibrated Scoring
                    </Badge>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        PhD-Calibrated Scoring Engine
                    </h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        RevisionGrade's scoring engine was calibrated using detailed editorial evaluations created by PhD-level editors and literary professionals. Their criteria, diagnostic patterns, and revision standards were encoded into the system—together with the proprietary WAVE Revision framework—so the AI can apply the same evaluative logic consistently across manuscripts, at scale.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-xl bg-white border border-slate-200">
                        <h3 className="font-semibold text-slate-900 mb-2">Editorial Analysis</h3>
                        <p className="text-sm text-slate-600 mb-3">
                            MFA Creative Writing + PhD English Literature specialists evaluated full manuscripts and screenplays, identifying structural issues, pacing problems, and thematic clarity—not just grammar fixes.
                        </p>
                        <Badge variant="outline" className="text-xs">Structural Critique</Badge>
                    </div>

                    <div className="p-6 rounded-xl bg-white border border-slate-200">
                        <h3 className="font-semibold text-slate-900 mb-2">Cross-Format Expertise</h3>
                        <p className="text-sm text-slate-600 mb-3">
                            PhD editors specializing in fiction, screenwriting, and genre-specific markets provided format-aware feedback on marketability and agent/producer expectations across prose and screenplay formats.
                        </p>
                        <Badge variant="outline" className="text-xs">Agent-Reality Standards</Badge>
                    </div>
                </div>

                <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                    <p className="text-sm text-amber-900 text-center mb-3">
                        <strong>The result:</strong> Our AI mirrors the brutal honesty of professional editors who charge $2,000-$4,000 per manuscript or screenplay. 
                        Their scoring methodology, diagnostic criteria, and agent/producer rejection reality checks inform every evaluation.
                    </p>
                    <p className="text-xs text-amber-800 text-center italic">
                        "Calibrated" means the system was trained and tuned using real editorial evaluation frameworks. No human editor reviews individual submissions unless explicitly stated.
                    </p>
                </div>
            </div>

            {/* Criteria Preview */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-900 py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <Badge className="mb-4 bg-white/10 text-white border-white/20">
                                <BookOpen className="w-4 h-4 mr-2" />
                                12 Literary Agent Criteria
                            </Badge>
                            <h2 className="text-3xl font-bold text-white mb-6">
                                Evaluated Like a Professional
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-8">
                                Your work is scored on the same criteria literary agents and producers use 
                                when reviewing submissions—from voice and pacing to emotional resonance 
                                and market readiness.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                {['Voice & Style', 'Opening Hook', 'Character Development', 'Dialogue', 'Pacing', 'Show Don\'t Tell'].map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-slate-200">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span className="text-sm">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Badge className="mb-4 bg-white/10 text-white border-white/20">
                                <Waves className="w-4 h-4 mr-2" />
                                Wave Revision Guide
                            </Badge>
                            <h2 className="text-3xl font-bold text-white mb-6">
                                60+ Revision Checkpoints
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-8">
                                Our proprietary Wave Revision System covers everything from 
                                sentence-level craft to chapter-wide structure—a sequential process 
                                ensuring no detail escapes notice.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['Prose Polish', 'Sensory Details', 'Tension Arc', 'Word Economy', 'Scene Beats', 'Transitions'].map((item, idx) => (
                                    <Badge key={idx} className="bg-white/10 text-white border-white/20">
                                        {item}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Creator Attribution */}
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">About RevisionGrade™</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                        Created by <strong>Michael J. Meraw (Major, Retired), CD, SCPM (Stanford), BComm, AGDM, MBA</strong>. 
                        RevisionGrade™ was designed by a former military pilot and corporate aerospace leader with deep expertise in root-cause corrective action, value-stream mapping, metrics-driven continuous improvement, and enterprise information / master-data governance (including authorship of governance policy at a global aerospace firm). 
                        Drawing on systems-based quality disciplines used in large-scale aerospace and defense programs, he operationalized RevisionGrade's 12-criteria framework and the proprietary WAVE Revision System into the platform's evaluation framework. 
                        AI-assisted tools generate analysis and revision suggestions within this framework; final decisions always remain with the writer.{' '}
                        <a 
                            href="https://michaeljmeraw.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700 font-medium underline"
                        >
                            Learn more about the creator →
                        </a>
                    </p>
                </div>
            </div>

            {/* CTA Section */}
            <div className="max-w-4xl mx-auto px-6 py-10 text-center">
                <div className="p-10 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                    <Zap className="w-12 h-12 mx-auto mb-6 text-indigo-600" />
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Ready to Elevate Your Writing?
                    </h2>
                    <p className="text-slate-600 mb-8 max-w-xl mx-auto">
                        Submit your manuscript or screenplay and see how PhD-calibrated AI analysis can transform your work.
                    </p>
                    <Link to={createPageUrl('Evaluate')}>
                        <Button size="lg" className="h-14 px-10 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25">
                            <Sparkles className="w-5 h-5 mr-2" />
                            Start Free Evaluation
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}