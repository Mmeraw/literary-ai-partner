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
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-transparent to-transparent opacity-60" />
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
                <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000" />
                
                <div className="relative max-w-6xl mx-auto px-6 py-24 sm:py-32">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center"
                    >
                        <Badge className="mb-6 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200 text-sm font-medium">
                            <Sparkles className="w-4 h-4 mr-2" />
                            AI-Powered Manuscript Grading
                        </Badge>
                        
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
                            Transform Your Manuscript
                            <span className="block mt-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-relaxed overflow-visible py-2">
                                to Publishing Quality™
                            </span>
                        </h1>

                        <p className="mt-10 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            Get your draft graded against the same 12 criteria literary agents use, plus 60+ checks from the WAVE Revision System. 
                            Two AI engines score your pages, then surface focused changes so you can keep, replace, or delete every line with confidence.
                        </p>

                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link to={createPageUrl('UploadManuscript')}>
                                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25">
                                    <BookOpen className="w-5 h-5 mr-2" />
                                    Upload Full Manuscript
                                </Button>
                            </Link>
                            <Link to={createPageUrl('Evaluate')}>
                                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-slate-300">
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Quick Eval (2k words)
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Features Section */}
            <div className="max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
                    <p className="mt-3 text-slate-600">Grade first, then revise—three simple steps</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: BookOpen,
                            title: "Submit Your Draft",
                            description: "Paste a paragraph, scene, or full chapter. RevisionGrade™ handles any length.",
                            color: "from-indigo-500 to-blue-600"
                        },
                        {
                            icon: Brain,
                            title: "Grade First, Then Diagnose",
                            description: "Dual AI systems score your pages against 12 agent-level criteria and 60+ WAVE checks, highlighting exactly where the manuscript falls short.",
                            color: "from-purple-500 to-pink-600"
                        },
                        {
                            icon: CheckCircle2,
                            title: "Review & Decide",
                            description: "For each flagged issue, you get keep / replace / delete options. You control every change while systematically elevating the draft toward submission-ready.",
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
                                Your manuscript is scored on the exact criteria literary agents use 
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
                                sentence-level craft to chapter-wide structure—ensuring no detail 
                                escapes notice.
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

            {/* CTA Section */}
            <div className="max-w-4xl mx-auto px-6 py-20 text-center">
                <div className="p-10 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                    <Zap className="w-12 h-12 mx-auto mb-6 text-indigo-600" />
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Ready to Elevate Your Manuscript?
                    </h2>
                    <p className="text-slate-600 mb-8 max-w-xl mx-auto">
                        Submit your first draft and see how dual AI analysis can transform your writing.
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