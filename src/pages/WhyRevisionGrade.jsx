import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Shield, CheckCircle2, X, ArrowRight, Sparkles, 
    Target, Layers, BookOpen 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function WhyRevisionGrade() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900 py-20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent" />
                
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-6 px-4 py-2 bg-white/10 text-white border-white/20 text-sm font-medium">
                        <Shield className="w-4 h-4 mr-2" />
                        Why Literary AI Partner™ is Different
                    </Badge>

                    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                        Literary AI Partner™ Isn't a Writing Tool.
                        <span className="block mt-2 text-indigo-300">
                            It's an Editorial Judgment System.
                        </span>
                    </h1>

                    <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
                        Most tools analyze text. Literary AI Partner™ evaluates readiness. Where others count words, flags, and patterns, 
                        Literary AI Partner™ applies professional editorial standards—the same ones agents and acquisition 
                        editors use—to show you <strong className="text-white">why a manuscript would be rejected</strong> and what to fix next.
                    </p>
                </div>
            </div>

            {/* Core Difference Section */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">The Core Difference</h2>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        Other tools ask "What's wrong with this sentence?"<br />
                        Literary AI Partner™ asks "Why would this book be rejected?"
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Typical Tools */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-8 rounded-2xl bg-slate-100 border-2 border-slate-200"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-slate-300">
                                <X className="w-6 h-6 text-slate-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-700">Typical Writing Tools</h3>
                        </div>
                        
                        <ul className="space-y-3">
                            {[
                                'Dozens of disconnected "reports"',
                                'Surface-level metrics (adverbs, sentence length, passive voice)',
                                'No prioritization—everything looks important',
                                'Force writers to guess what actually matters',
                                'Optimized for volume, not publishing reality',
                                'Feature explosion: dozens of tools with no unified framework'
                            ].map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-slate-600">
                                    <X className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* RevisionGrade */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-lg"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-indigo-600">
                                <CheckCircle2 className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-indigo-900">Literary AI Partner™</h3>
                        </div>
                        
                        <ul className="space-y-3">
                            {[
                                'One unified evaluation system',
                                '12 agent-level criteria + 60 WAVE diagnostics',
                                'Designed to mirror how real editors assess manuscripts',
                                'Identifies what will stop your manuscript from advancing',
                                'Tells you what to fix first, why it matters, and what to ignore',
                                'PhD-calibrated scoring against publishing standards'
                            ].map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-indigo-900">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                                    <span className="font-medium">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>
            </div>

            {/* The Strategic Truth */}
            <div className="bg-slate-900 py-16">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <Target className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold text-white mb-4">
                            We Don't Count Words. We Assess Readiness.
                        </h2>
                    </div>

                    <div className="space-y-6 text-slate-300 text-lg">
                        <p className="leading-relaxed">
                            <strong className="text-white">Toolbox platforms</strong> bombard you with adverb counts, pronoun openers, 
                            and sentence-variation reports, leaving you drowning in data with no clear path forward.
                        </p>
                        
                        <p className="leading-relaxed">
                            <strong className="text-white">Literary AI Partner™</strong> delivers one brutal, honest score plus a step-by-step 
                            revision path aligned with real agent decision-making. It evaluates hook, structure, pacing, line authority, 
                            and motif hygiene <em className="text-indigo-300">together</em>—so changes actually move the needle on publishability.
                        </p>

                        <div className="p-6 rounded-xl bg-indigo-900/50 border border-indigo-700 mt-8">
                            <p className="text-white text-xl font-semibold text-center">
                                "We'd rather bruise your ego now than see your manuscript die in an agent's slush pile later."
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Three Pillars */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Three Pillars of Literary AI Partner™
                    </h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Built to think like an agent, not a spellchecker
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: Shield,
                            title: "PhD-Calibrated Standards",
                            description: "Our scoring engine is trained on detailed editorial evaluations created by PhD-level editors and literary professionals. Their criteria, diagnostic patterns, and revision standards are encoded into the system.",
                            color: "from-indigo-500 to-blue-600"
                        },
                        {
                            icon: Layers,
                            title: "WAVE Revision System",
                            description: "Our proprietary 60+ wave framework defines what gets graded: hook, structure, line-level authority, motif hygiene, pacing, and more. The AI doesn't discover these rules—it executes them.",
                            color: "from-purple-500 to-pink-600"
                        },
                        {
                            icon: Target,
                            title: "Agent-Reality Focus",
                            description: "We evaluate manuscripts against the 12 criteria agents and acquisition editors actually use when deciding what to request—focusing on craft and marketability, not just grammar.",
                            color: "from-emerald-500 to-teal-600"
                        }
                    ].map((pillar, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all"
                        >
                            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${pillar.color} mb-4`}>
                                <pillar.icon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-3">{pillar.title}</h3>
                            <p className="text-slate-600 leading-relaxed">{pillar.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Positioning Statement */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 py-16">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center space-y-6">
                        <BookOpen className="w-12 h-12 text-indigo-600 mx-auto" />
                        <h2 className="text-3xl font-bold text-slate-900">
                            Where Manuscripts Go to Find Out If They're Actually Ready
                        </h2>
                        <p className="text-xl text-slate-700 leading-relaxed max-w-2xl mx-auto">
                            Literary AI Partner™ is not another bundle of writing gadgets. It's a publishing-reality diagnostic 
                            that mirrors how professionals read and tells you the same hard truths agents use when 
                            deciding what to request.
                        </p>
                        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link to={createPageUrl('Evaluate')}>
                                <Button size="lg" className="h-14 px-10 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg">
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Run a Quick Evaluation
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </Link>
                            <Link to={createPageUrl('UploadWork')}>
                                <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-slate-300">
                                    <BookOpen className="w-5 h-5 mr-2" />
                                    Start Full Analysis
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Final Comparison */}
            <div className="max-w-4xl mx-auto px-6 py-16">
                <div className="p-8 rounded-2xl bg-white border-2 border-slate-200 shadow-lg">
                    <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">
                        The Bottom Line
                    </h3>
                    <div className="space-y-4 text-slate-700">
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                            <p className="text-lg">
                                <strong>Other platforms</strong> give you dozens of disconnected reports.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                            <p className="text-lg">
                                <strong className="text-indigo-900">Literary AI Partner™</strong> gives you one integrated 
                                Grade → Diagnose → Revise workflow that mirrors how professionals read.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                        <p className="text-sm text-indigo-900 italic text-center">
                            Instead of chasing surface issues in isolation, 
                            WAVE evaluates hook, structure, pacing, line authority, and motif hygiene together, 
                            so each revision step actually improves publishability.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}