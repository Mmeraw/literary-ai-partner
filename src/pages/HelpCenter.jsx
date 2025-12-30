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

                {/* Trusted Path - Step by Step Guide */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <Shield className="w-6 h-6 text-purple-600" />
                        <h2 className="text-2xl font-bold text-slate-900">How to Use Trusted Path™</h2>
                    </div>

                    <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">Overview</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Trusted Path™ is for authors who want speed and forward momentum. It is most effective when used in the correct sequence:
                            </p>
                            <ol className="space-y-1 text-slate-700 ml-6">
                                <li>1. Structural readiness check</li>
                                <li>2. Structural repair if needed</li>
                                <li>3. Then high-fidelity local revision at scale</li>
                            </ol>
                        </CardContent>
                    </Card>

                    {/* Steps */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Step 1 — Upload your manuscript</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-slate-700">
                                <p>
                                    Upload your draft to RevisionGrade™. After upload, the system runs CHX13 + Spine + WAVE detection.
                                </p>
                                <p>You'll see an evaluation summary that includes (at minimum):</p>
                                <ul className="list-disc ml-6 space-y-1">
                                    <li>Structural readiness indicators (Spine / CHX13 bands)</li>
                                    <li>Major risk flags (missing beats, causality breaks, unclear stakes)</li>
                                    <li>Density of flagged opportunities (e.g., "1,200 flagged items")</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Step 2 — Decide between Manual Review vs Trusted Path</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-slate-700">
                                <p>You have two main ways to proceed:</p>
                                
                                <div className="mt-3">
                                    <p className="font-semibold text-slate-900">Manual Review (control-first):</p>
                                    <ul className="list-disc ml-6 space-y-1 mt-1">
                                        <li>You review flagged items and choose actions like Keep / Replace / Alternatives.</li>
                                        <li>Best for authors who want maximum intentionality.</li>
                                    </ul>
                                </div>

                                <div className="mt-3">
                                    <p className="font-semibold text-slate-900">Trusted Path (momentum-first):</p>
                                    <ul className="list-disc ml-6 space-y-1 mt-1">
                                        <li>You let the system apply primary best-fit revisions automatically where allowed.</li>
                                        <li>Best for authors who don't want to process hundreds of micro-decisions.</li>
                                    </ul>
                                </div>

                                <p className="text-indigo-900 font-semibold mt-3">
                                    Trusted Path is not "the lazy button." It is the "efficient workflow" button—when structure supports it.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Step 3 — Trusted Path runs the structural readiness gate</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-slate-700">
                                <p>
                                    When you activate Trusted Path, the system checks whether polishing would be honest and useful.
                                </p>

                                <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200">
                                    <p className="font-semibold text-red-900 mb-2">If structure is below threshold</p>
                                    <p className="text-sm mb-2">You will see a gating message similar to:</p>
                                    <ul className="list-disc ml-6 space-y-1 text-sm">
                                        <li>"Your story is not structurally ready for line-level refinement."</li>
                                        <li>"Begin with these spine-level rewrites / missing beats."</li>
                                    </ul>
                                    <p className="font-semibold text-slate-900 mt-3 text-sm">What you should do next:</p>
                                    <ol className="ml-6 space-y-1 text-sm">
                                        <li>1. Open the structural diagnosis summary.</li>
                                        <li>2. Start the "Structural Repair Path."</li>
                                        <li>3. Address missing beats, stakes, causality, and scene purpose first.</li>
                                    </ol>
                                    <p className="text-sm mt-3 italic">
                                        <strong>Why this matters:</strong> If the story spine is broken, perfect sentences can still produce an unreadable book. Structural repair changes outcomes; polish cannot.
                                    </p>
                                </div>

                                <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                                    <p className="font-semibold text-emerald-900">If structure is above threshold</p>
                                    <p className="text-sm">Trusted Path proceeds with high-fidelity local revisions at scale.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                                    Trusted Path™ Threshold Model
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-slate-700">
                                <p className="font-semibold text-slate-900">
                                    Trusted Path™ does not operate on a single on/off switch.
                                </p>
                                <p>
                                    It uses tiered structural thresholds to decide how and how far automated revision can safely proceed. This protects accuracy, prevents false confidence, and preserves authorial control.
                                </p>

                                <div className="space-y-4 mt-4">
                                    {/* Zone 1 */}
                                    <div className="p-4 rounded-lg bg-red-50 border-2 border-red-200">
                                        <h4 className="font-bold text-red-900 mb-2">0.0–5.9: Structural Failure Zone</h4>
                                        <p className="text-sm mb-2"><strong>Status:</strong> Diagnostic only</p>
                                        <p className="text-sm font-semibold mb-2">Trusted Path behavior:</p>
                                        <ul className="list-disc ml-6 space-y-1 text-sm">
                                            <li>Structural analysis only</li>
                                            <li>No line-level or stylistic rewriting</li>
                                            <li>Full identification of missing or unstable narrative elements</li>
                                            <li>Output a prioritized "Repair Map" (missing beats, broken causality, unclear stakes, motive gaps) with recommended sequence of work</li>
                                        </ul>
                                        <p className="text-sm mt-3 italic text-red-900">
                                            <strong>What this means:</strong> The manuscript lacks sufficient structural integrity for safe revision. Applying polish here would hide core problems rather than fix them.
                                        </p>
                                    </div>

                                    {/* Zone 2 */}
                                    <div className="p-4 rounded-lg bg-amber-50 border-2 border-amber-200">
                                        <h4 className="font-bold text-amber-900 mb-2">6.0–7.9: Conditional Readiness Zone</h4>
                                        <p className="text-sm mb-2"><strong>Status:</strong> Guided rebuild with limited local edits</p>
                                        <p className="text-sm font-semibold mb-2">Trusted Path behavior:</p>
                                        <ul className="list-disc ml-6 space-y-1 text-sm">
                                            <li>Diagnose structural weaknesses and gaps</li>
                                            <li>Propose scaffolded fixes (missing scenes, bridges, beats) as options</li>
                                            <li>Allow localized line-level edits only in segments that meet internal stability criteria</li>
                                            <li>Keep full-manuscript polish locked or clearly marked as "not recommended yet"</li>
                                            <li>Label any local edits as "safe-zone edits" and explain why they were eligible (e.g., stable scene purpose + clear causality in that segment)</li>
                                        </ul>
                                        <p className="text-sm mt-3 italic text-amber-900">
                                            <strong>What this means:</strong> The story has emerging structure but is not consistently stable. Trusted Path focuses on rebuilding architecture first and only polishes where it is safe to do so.
                                        </p>
                                    </div>

                                    {/* Zone 3 */}
                                    <div className="p-4 rounded-lg bg-emerald-50 border-2 border-emerald-200">
                                        <h4 className="font-bold text-emerald-900 mb-2">8.0–10.0: Full Trusted Path Zone</h4>
                                        <p className="text-sm mb-2"><strong>Status:</strong> Full automated revision enabled</p>
                                        <p className="text-sm font-semibold mb-2">Trusted Path behavior:</p>
                                        <ul className="list-disc ml-6 space-y-1 text-sm">
                                            <li>Apply vetted line-level and stylistic revisions across the manuscript where structure supports them</li>
                                            <li>Maintain authorial intent, without inventing new plotlines, themes, or characters</li>
                                            <li>Surface remaining structural risks transparently while still allowing global polish</li>
                                            <li>Preserve the "no ghostwriting" contract: revisions refine execution; they do not manufacture story architecture</li>
                                        </ul>
                                        <p className="text-sm mt-3 italic text-emerald-900">
                                            <strong>What this means:</strong> Core narrative integrity is present. Trusted Path can safely refine execution—clarity, coherence, pacing—without pretending to fix a broken story.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 p-4 rounded-lg bg-slate-100 border border-slate-300">
                                    <p className="text-sm text-slate-700 italic font-semibold">
                                        "Trusted Path adjusts its behavior based on structural readiness: it diagnoses in failure, guides rebuild in borderline cases, and only applies full automated polish once your story's architecture is strong enough to support it."
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Step 4 — Review the Trusted Path outputs</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-slate-700">
                                <p>After Trusted Path runs (structure-ready path), you should receive:</p>
                                
                                <div className="space-y-3 mt-3">
                                    <div>
                                        <p className="font-semibold text-slate-900">1. Revised Manuscript Output</p>
                                        <p className="text-sm">A revised draft where eligible items have been improved.</p>
                                    </div>
                                    
                                    <div>
                                        <p className="font-semibold text-slate-900">2. Revision Summary</p>
                                        <p className="text-sm">A readable explanation of what types of issues were addressed:</p>
                                        <ul className="list-disc ml-6 space-y-1 text-sm">
                                            <li>clarity improvements</li>
                                            <li>redundancy reduction</li>
                                            <li>pacing tighten-ups</li>
                                            <li>consistency fixes</li>
                                            <li>local logic reinforcement</li>
                                        </ul>
                                    </div>
                                    
                                    <div>
                                        <p className="font-semibold text-slate-900">3. Remaining Risk Map (if any)</p>
                                        <p className="text-sm">Some issues should remain flagged if they are not safe to auto-apply or require author choice (e.g., major voice decisions, ambiguous intent).</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Step 5 — Do the "Author Pass" (recommended)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-slate-700">
                                <p>
                                    Even with excellent automation, a human pass is where a manuscript becomes personal and intentional again.
                                </p>
                                <p className="font-semibold text-slate-900">Recommended author pass checklist:</p>
                                <ul className="list-disc ml-6 space-y-1">
                                    <li>Restore signature rhythm where you want it</li>
                                    <li>Confirm voice remains consistent across POV shifts</li>
                                    <li>Verify character choices still feel true</li>
                                    <li>Ensure stakes read the way you intended</li>
                                    <li>Confirm any "tightening" didn't remove necessary breath or emphasis</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Step 6 — Re-run Trusted Path selectively (optional)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-slate-700">
                                <p>After you complete structural repairs or an author pass, you can re-run Trusted Path to:</p>
                                <ul className="list-disc ml-6 space-y-1">
                                    <li>Clean up newly rewritten scenes</li>
                                    <li>Apply consistent tightening across revised sections</li>
                                    <li>Reduce repetitive patterns after major rebuilds</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Common Questions */}
                    <div className="mt-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Common Questions</h3>
                        <div className="space-y-4">
                            <Card>
                                <CardContent className="p-4">
                                    <p className="font-semibold text-slate-900 mb-2">"Why did Trusted Path refuse to run polish?"</p>
                                    <p className="text-sm text-slate-700">Because the system detected that structural deficits would make polish misleading.</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <p className="font-semibold text-slate-900 mb-2">"Can Trusted Path add missing scenes?"</p>
                                    <p className="text-sm text-slate-700">Trusted Path may propose missing scenes or beats as optional scaffolds, but it will not silently "write a new book" and call it yours.</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <p className="font-semibold text-slate-900 mb-2">"Is Trusted Path safe for early drafts?"</p>
                                    <p className="text-sm text-slate-700">Yes, but expect more gating. Early drafts often need structure before polish.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
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