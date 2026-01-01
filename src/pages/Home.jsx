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
            {/* Hero Section - Clean & Focused */}
            <div className="bg-white">
                <div className="max-w-5xl mx-auto px-6 pt-8 pb-8 sm:pt-10 sm:pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center"
                    >
                        <h1 className="text-4xl sm:text-5xl font-bold text-indigo-600 tracking-tight leading-tight mb-3">
                            RevisionGrade™ — The Authoritative Revision Framework
                        </h1>

                        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-3">
                            Built to meet the standards gatekeepers expect.
                        </p>

                        <p className="text-xl text-slate-700 max-w-3xl mx-auto leading-relaxed">
                            Revision Framework-AI. 13 Story Evaluation Criteria. WAVE Diagnostics.<br />
                            From manuscript / screenplay to query-ready—one system.
                        </p>

                        <div className="mt-10">
                            <Link to={createPageUrl('UploadManuscript')}>
                                <Button size="lg" className="h-16 px-12 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg">
                                    Upload Your Writing
                                </Button>
                            </Link>
                        </div>

                        <p className="mt-6 text-sm text-slate-500">
                            Free evaluation—see proof in Resources
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* WAVE IP Callout */}
            <div className="max-w-4xl mx-auto px-6 py-6">
                <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 border-2 border-indigo-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-indigo-600">
                            <Waves className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">The WAVE Revision System (Core IP)</h2>
                    </div>
                    <div className="space-y-4 text-slate-700">
                        <p className="leading-relaxed">
                            WAVE is a late-stage revision system for manuscripts and screenplays that already have a working story spine but still need disciplined editing to read as professional and submission-ready.
                        </p>
                        <p className="leading-relaxed">
                            It is diagnostic and multi-pass: each evaluation isolates a specific failure pattern, explains why it weakens the story, and shows how to fix it.
                        </p>
                        <p className="leading-relaxed">
                            RevisionGrade applies WAVE across your work automatically, tracking issues along the story spine—not just chapter by chapter—so you can see the standards and stay in control of every change.
                        </p>
                        <p className="leading-relaxed font-semibold text-indigo-900">
                            Revision Framework-AI executes the analysis. WAVE defines the standard.
                        </p>
                        <p className="leading-relaxed font-semibold text-indigo-900">
                            The intellectual property—the standard itself—is human-crafted.
                        </p>
                        <p className="text-sm text-slate-600 italic mt-4 pt-4 border-t border-indigo-200">
                            The WAVE framework, thresholds, and scoring logic remain proprietary and are implemented in software; writers see the decisions and explanations, not the underlying code.
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
                            You may have a brilliant story, but if the pages trip over the 13 Story Evaluation Criteria that professionals use—and the scores of structural and line-level checks in the WAVE Guide—it will be rejected long before anyone sees the ending. Agents and readers evaluate in seconds what took you years to build.
                        </p>
                        <div className="p-6 rounded-xl bg-indigo-900/50 border border-indigo-700">
                            <p className="leading-relaxed text-white">
                                <strong>Elevate Your Game™</strong> by running your work through the RevisionGrade framework: a PhD-calibrated scoring engine built on the 13 Story Evaluation Criteria and the proprietary WAVE Revision System. There is no other technology that combines those standards into one coherent, repeatable diagnostic pass—so you know exactly where your manuscript stands.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="max-w-6xl mx-auto px-6 py-14">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900">End-to-End IP Standards Engine</h2>
                    <p className="mt-3 text-slate-600">What once required months of back-and-forth, multiple tools, and subjective review is now unified into a single, standards-driven system.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: BookOpen,
                            title: "Literary Agent Package",
                            description: "Queries + Synopses auto-generated. One-sentence pitch, elevator pitch, and short/medium/long synopses calibrated against professional standards.",
                            color: "from-indigo-500 to-blue-600"
                        },
                        {
                            icon: Brain,
                            title: "12-Slide Producer Pitch Deck",
                            description: "PPTX export, production-ready. Screen viability score (0-100). 5-Part mythic structure validation. Del Toro-level tone enforcement.",
                            color: "from-purple-500 to-pink-600"
                        },
                        {
                            icon: CheckCircle2,
                            title: "Complete Submission Package",
                            description: "Author bio, 5-10 market comps, targeted agent list, draft query letter. Everything agents expect to see in your submission.",
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

            {/* Dual-Layer Evaluation Engine */}
            <div className="max-w-6xl mx-auto px-6 py-14">
                <div className="text-center mb-12">
                    <Badge className="mb-4 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Shield className="w-4 h-4 mr-2" />
                        Dual-Layer Evaluation Engine
                    </Badge>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Agent Ready™ + WAVE Canon
                    </h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Base44 doesn't write stories. It translates them to market reality.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-8 rounded-xl bg-white border-2 border-indigo-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Agent Ready™ (13 Story Evaluation Criteria)</h3>
                        <div className="space-y-2">
                            {[
                                'Logline strength',
                                'Character arcs',
                                'Market positioning',
                                'Comp alignment',
                                'Voice authority',
                                'Thematic coherence',
                                '+ 7 more...'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                    <span className="text-sm text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-8 rounded-xl bg-white border-2 border-purple-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">WAVE (Proprietary Framework)</h3>
                        <div className="space-y-2">
                            {[
                                'Adaptive Narrative Structure Analysis',
                                'Visual translation',
                                'Tone enforcement',
                                'Structural risks',
                                'Producer viability',
                                'Canon compliance',
                                '+ scores more...'
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid md:grid-cols-4 gap-4">
                    {[
                        'No Hallucinations',
                        'Locked Specifications',
                        'Dual Pipeline Authority',
                        'Studio-Grade Outputs'
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-slate-700">{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works - Workflow Diagram */}
            <div className="bg-slate-50 py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex justify-center mb-16">
                        <img 
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/81ce1b007_image.png"
                            alt="RevisionGrade End-to-End Author Workflow"
                            className="w-full max-w-4xl h-auto"
                        />
                    </div>

                    {/* How WAVE Adapts */}
                    <div className="max-w-4xl mx-auto">
                        <div className="p-8 rounded-xl bg-white border border-slate-200">
                            <h3 className="text-2xl font-bold text-slate-900 mb-4">
                                How WAVE Adapts to Your Story
                            </h3>
                            <p className="text-slate-700 mb-6">
                                Our Narrative Structure Analysis works across all genres:
                            </p>
                            <div className="space-y-3 mb-6">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <strong className="text-slate-900">Mythic & archetypal narratives</strong>
                                        <span className="text-slate-600"> (epic, fantasy, quest-driven)</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <strong className="text-slate-900">Contemporary realism</strong>
                                        <span className="text-slate-600"> (character-driven, introspective)</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <strong className="text-slate-900">Experimental structures</strong>
                                        <span className="text-slate-600"> (non-linear, fragmented, meta)</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-700 leading-relaxed">
                                The system identifies the structural patterns unique to YOUR story, 
                                then evaluates against agent and producer standards.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Criteria Preview */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-900 py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <Badge className="mb-4 bg-white/10 text-white border-white/20">
                                <BookOpen className="w-4 h-4 mr-2" />
                                13 Story Evaluation Criteria
                            </Badge>
                            <h2 className="text-3xl font-bold text-white mb-6">
                                Evaluated Like a Professional
                            </h2>
                            <p className="text-slate-300 leading-relaxed mb-8">
                                Your work is scored on the same 13 criteria agents, editors, and script readers use 
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
                                Proprietary Revision Framework
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
                        Drawing on systems-based quality disciplines used in large-scale aerospace and defense programs, he operationalized RevisionGrade's 13 Story Evaluation Criteria framework and the proprietary WAVE Revision System into the platform's evaluation framework. 
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

            {/* Final CTA Section */}
            <div className="bg-white py-20">
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold text-slate-900 mb-4">
                        Ready to Transform Your Writing?
                    </h2>
                    <p className="text-lg text-slate-600 mb-8">
                        30-Day Money Back Guarantee • No Credit Card Required
                    </p>
                    <Link to={createPageUrl('UploadManuscript')}>
                        <Button size="lg" className="h-16 px-12 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg">
                            Upload Your Writing
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}