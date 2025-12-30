import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    BookOpen, 
    CheckCircle2,
    Sparkles, 
    HelpCircle,
    Shield,
    AlertCircle,
    Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function HelpCenter() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-3">
                        RevisionGrade™ Help Center
                    </h1>
                    <p className="text-xl text-slate-600 italic">
                        Guidance, not guesswork. Clarity before craft.
                    </p>
                </div>

                {/* Welcome */}
                <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">
                            Welcome to the RevisionGrade Help Center.
                        </h2>
                        <p className="text-slate-700 leading-relaxed mb-4">
                            This space exists to help you understand how the system works, what to expect, and how to use it effectively—without jargon or technical overhead.
                        </p>
                        <p className="text-slate-700 leading-relaxed font-semibold">
                            RevisionGrade is designed for writers who want clarity, not shortcuts. Everything here is built to support thoughtful revision, not replace creative judgment.
                        </p>
                    </CardContent>
                </Card>

                {/* Getting Started */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-900">Getting Started</h2>
                    </div>

                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>What Is RevisionGrade?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-slate-700">
                            <p>
                                RevisionGrade is a manuscript analysis and revision system designed to help writers understand what their work needs—and what it doesn't.
                            </p>
                            <p>
                                It evaluates structure, clarity, and narrative logic so you can make informed decisions about revision.
                            </p>
                            <p className="font-semibold text-indigo-900">
                                👉 It does not write your book for you.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>How RevisionGrade Works</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-2 text-slate-700">
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-indigo-600">1.</span>
                                    <span>You upload your manuscript</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-indigo-600">2.</span>
                                    <span>The system analyzes structure, coherence, and narrative health</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-indigo-600">3.</span>
                                    <span>You receive clear diagnostics and revision guidance</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-indigo-600">4.</span>
                                    <span>You decide how to proceed</span>
                                </li>
                            </ol>
                            <p className="text-slate-700 mt-4 font-semibold">
                                RevisionGrade helps you see what matters before you spend time rewriting.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Trusted Path */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <Shield className="w-6 h-6 text-purple-600" />
                        <h2 className="text-2xl font-bold text-slate-900">Trusted Path™</h2>
                    </div>

                    <Card className="mb-6 border-2 border-purple-200">
                        <CardHeader>
                            <CardTitle>What Is Trusted Path?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-slate-700">
                            <p>
                                Trusted Path is an optional mode that applies recommended revisions automatically when your manuscript is structurally ready.
                            </p>
                            <p>
                                It is designed for writers who want forward momentum without manually approving every micro-edit.
                            </p>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    What Trusted Path Does
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600">•</span>
                                        <span>Applies high-confidence revisions where structure supports them</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600">•</span>
                                        <span>Prioritizes clarity, cohesion, and readability</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600">•</span>
                                        <span>Avoids surface polish when deeper issues are present</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                    What Trusted Path Does Not Do
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">•</span>
                                        <span>It does not rewrite your book</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">•</span>
                                        <span>It does not invent plot or character</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">•</span>
                                        <span>It does not guarantee publication</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">•</span>
                                        <span>It does not replace your creative judgment</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="p-6">
                            <p className="text-slate-700 font-semibold">
                                Trusted Path works with your intent—not instead of it.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>When Trusted Path Is Limited</CardTitle>
                        </CardHeader>
                        <CardContent className="text-slate-700">
                            <p>
                                If your manuscript has major structural issues (missing beats, unclear stakes, broken causality), Trusted Path will pause line-level editing and guide you toward structural repair instead.
                            </p>
                            <p className="mt-3 font-semibold text-indigo-900">
                                This prevents wasted effort and protects the integrity of your work.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Using RevisionGrade Effectively */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-900">Using RevisionGrade Effectively</h2>
                    </div>

                    <Card>
                        <CardContent className="p-6">
                            <div className="space-y-4 text-slate-700">
                                <div>
                                    <p className="font-semibold text-slate-900 mb-1">Step 1 — Upload Your Manuscript</p>
                                    <p className="text-sm">RevisionGrade scans your work for structure, clarity, and narrative health.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 mb-1">Step 2 — Review the Diagnosis</p>
                                    <p className="text-sm">You'll see where your manuscript is strong and where it needs attention.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 mb-1">Step 3 — Choose Your Path</p>
                                    <p className="text-sm"><strong>Manual Review:</strong> You review and apply suggestions yourself.</p>
                                    <p className="text-sm"><strong>Trusted Path:</strong> The system applies safe, structural improvements automatically.</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 mb-1">Step 4 — Refine and Iterate</p>
                                    <p className="text-sm">Use feedback to strengthen your manuscript. Re-run analysis as needed.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* What RevisionGrade Is (and Isn't) */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">What RevisionGrade Is (and Isn't)</h2>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-2 border-emerald-200">
                            <CardHeader>
                                <CardTitle className="text-emerald-900">RevisionGrade IS:</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                                        <span>A diagnostic and guidance system</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                                        <span>A professional-level structural evaluator</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                                        <span>A tool for serious writers who want clarity</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-red-200">
                            <CardHeader>
                                <CardTitle className="text-red-900">RevisionGrade is NOT:</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                        <span>A ghostwriter</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                        <span>A shortcut to publication</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                                        <span>A replacement for creative judgment</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* FAQs */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <HelpCircle className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Will RevisionGrade rewrite my book?</CardTitle>
                            </CardHeader>
                            <CardContent className="text-slate-700">
                                <p>No. It highlights issues and suggests improvements. You remain the author.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Can it make my book publishable?</CardTitle>
                            </CardHeader>
                            <CardContent className="text-slate-700">
                                <p>It can help you understand what stands between your draft and professional quality—but it cannot guarantee publication.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Why does it sometimes block editing?</CardTitle>
                            </CardHeader>
                            <CardContent className="text-slate-700">
                                <p>Because polishing broken structure wastes time. The system protects you from that.</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-6 text-center">
                        <Link to={createPageUrl('FAQ')}>
                            <button className="px-6 py-3 bg-white border-2 border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-lg font-medium transition-colors">
                                View All FAQs
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Need More Help */}
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardContent className="p-8 text-center">
                        <Mail className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">
                            Need More Help?
                        </h2>
                        <p className="text-slate-700 mb-6 max-w-xl mx-auto">
                            If you're unsure how to interpret results or want guidance on next steps, consult the contextual explanations inside the tool or visit our detailed documentation.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link to={createPageUrl('Contact')}>
                                <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                                    Contact Support
                                </button>
                            </Link>
                            <Link to={createPageUrl('FAQ')}>
                                <button className="px-6 py-3 bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-colors">
                                    Browse FAQs
                                </button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Statement */}
                <div className="mt-12 p-6 rounded-xl bg-slate-100 border-2 border-slate-300">
                    <p className="text-center text-slate-700 italic">
                        RevisionGrade helps you see your manuscript clearly—so you can revise with purpose, not guesswork.
                    </p>
                </div>
            </div>
        </div>
    );
}