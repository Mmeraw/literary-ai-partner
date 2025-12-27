import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    ChevronDown, 
    DollarSign, 
    Clock, 
    Award, 
    Users,
    BookOpen,
    Sparkles
} from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Frequently Asked Questions
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Everything You Need to Know
                    </h1>
                    <p className="text-lg text-slate-600">
                        Common questions about RevisionGrade™ and professional manuscript evaluation
                    </p>
                </div>

                {/* FAQ Sections */}
                <div className="space-y-8">
                    {/* Pricing & Value */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <DollarSign className="w-5 h-5 text-indigo-600" />
                                Pricing & Value
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="price-comparison">
                                    <AccordionTrigger>
                                        How does RevisionGrade compare to hiring a professional editor?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Professional editors charge <strong>$0.03–$0.15 per word</strong> for developmental and line editing. 
                                                For an 80,000-word novel, that's <strong>$2,400–$12,000+ per pass</strong>.
                                            </p>
                                            <p className="font-semibold text-slate-900">Industry-Standard Editorial Costs:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Editorial assessment: $0.01–$0.03/word → $800–$2,400 (80k words)</li>
                                                <li>Developmental edit: $0.03–$0.08/word → $2,400–$6,400</li>
                                                <li>Line edit: $0.04–$0.10/word → $3,200–$8,000</li>
                                                <li>Premium bundled service: $0.08–$0.15+/word → $6,400–$12,000+</li>
                                            </ul>
                                            <p>
                                                Most serious authors pay for <strong>multiple passes</strong>:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Editorial assessment: ~$1,500</li>
                                                <li>Developmental edit: ~$3,500</li>
                                                <li>Follow-up read: ~$1,500</li>
                                                <li>Line edit: ~$3,000</li>
                                            </ul>
                                            <p className="font-semibold text-slate-900">
                                                Total traditional cost: $9,000–$12,000+ (no iteration, no learning system)
                                            </p>
                                            <p className="text-indigo-900 font-semibold mt-4">
                                                RevisionGrade™ Professional at $99/month for 24 months = <strong>$2,376 total</strong>
                                            </p>
                                            <p>
                                                You get: unlimited evaluation runs, revision tracking, progress analytics, pattern detection, 
                                                and learning from every pass—<strong>at a fraction of one traditional editorial pass</strong>.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="what-you-get">
                                    <AccordionTrigger>
                                        What do I actually get for $99/month?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Professional Plan includes:</strong></p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>As many evaluation runs as you need</strong>, within a 500,000-word/month cap</li>
                                                <li><strong>Full manuscript & screenplay evaluation</strong> against 12 literary-agent criteria</li>
                                                <li><strong>60+ WAVE Revision checks</strong> (sentence craft, dialogue, pacing, structure)</li>
                                                <li><strong>Progress dashboard</strong> tracking improvement over time</li>
                                                <li><strong>Revision effectiveness analysis</strong> (before/after scoring)</li>
                                                <li><strong>Recurring pattern detection</strong> (what you keep getting wrong)</li>
                                                <li><strong>Clean downloads</strong> (submission-ready revised text with no markup; revision history and editorial commentary provided as separate reports)</li>
                                                <li><strong>Editorial reports (PDF)</strong></li>
                                                <li><strong>Priority processing</strong></li>
                                                <li><strong>Priority email support</strong></li>
                                            </ul>
                                            <p className="mt-3 text-sm text-slate-600">
                                                Compare: At $0.03/word (low-end developmental editing), an 80k-word manuscript costs $2,400 for 
                                                <strong> one pass</strong>. RevisionGrade gives you <strong>unlimited passes for 24+ months</strong> 
                                                at the same total cost.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="free-trial">
                                    <AccordionTrigger>
                                        Is there a free trial?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Yes. New users receive a <strong>Free Starter Evaluation</strong> (1–2 evaluations, ~2,000 words total) 
                                                to experience the system. Account required after first evaluation.
                                            </p>
                                            <p>
                                                If you need more testing, the <strong>Starter plan ($25/month)</strong> includes quick scene/chapter 
                                                evaluations with 25,000 words/month. You can upgrade to Professional ($99/month) when ready for 
                                                full manuscript or screenplay analysis.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Quality & Accuracy */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Award className="w-5 h-5 text-indigo-600" />
                                Quality & Accuracy
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="phd-calibrated">
                                    <AccordionTrigger>
                                        What does "PhD-calibrated" mean?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            "PhD-calibrated" means the evaluation framework was tuned against professional editorial assessments 
                                            and acquisition outcomes, so scores reflect submission-level standards rather than generic writing feedback. 
                                            No human editor reviews individual submissions unless explicitly stated.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="vs-human">
                                    <AccordionTrigger>
                                        Does RevisionGrade replace human editors?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>No.</strong> RevisionGrade™ evaluates readiness, not creativity. It judges structure, 
                                                clarity, pacing, and craft against professional standards—but <strong>final decisions remain 
                                                with the writer</strong>.
                                            </p>
                                            <p>
                                                Think of it as an editorial judgment system that:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Identifies issues agents and editors would flag</li>
                                                <li>Tracks what you repeatedly get wrong</li>
                                                <li>Measures improvement over time</li>
                                                <li>Provides consistent, unbiased feedback</li>
                                            </ul>
                                            <p>
                                                For final polish, voice refinement, or subjective creative decisions, human editors remain essential.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="what-it-does">
                                    <AccordionTrigger>
                                        What RevisionGrade™ does — and does not — do
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade™ is <strong>not a grammar checker, rewrite engine, or content generator</strong>.
                                            </p>
                                            <p className="font-semibold text-slate-900">It does not:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Rewrite your prose for you</li>
                                                <li>Generate new scenes or dialogue</li>
                                                <li>Act as a co-writer</li>
                                                <li>Provide margin notes like a human editor</li>
                                            </ul>
                                            <p className="font-semibold text-slate-900 mt-3">It does:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Evaluate your manuscript or screenplay against agent-calibrated criteria</li>
                                                <li>Diagnose structural and craft risks</li>
                                                <li>Surface recurring weaknesses</li>
                                                <li>Measure whether your revisions actually improve the work</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                In short: writing tools change sentences; RevisionGrade™ decides whether the manuscript is ready.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="editorial-memory">
                                    <AccordionTrigger>
                                        What is Editorial Growth Tracking? (Why this is a game-changer)
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-slate-900">
                                                Most writing tools ask: "Is this sentence okay?"
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                RevisionGrade™ asks: "Are you becoming a better writer?"
                                            </p>
                                            <p className="mt-3">
                                                RevisionGrade doesn't just evaluate individual drafts—it <strong>tracks your development 
                                                as a writer over time</strong>. Each submission contributes to a growing profile of strengths, 
                                                weaknesses, and recurring patterns.
                                            </p>
                                            <p className="font-semibold text-slate-900 mt-3">What you get:</p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>Persistent Skill Tracking</strong> — See which craft issues recur across drafts and which are improving</li>
                                                <li><strong>Trend-Based Scoring</strong> — Monitor progress across multiple submissions, not just one file</li>
                                                <li><strong>Growth Signals</strong> — Identify patterns in sentence craft, structure, pacing, and dialogue</li>
                                                <li><strong>Revision Effectiveness</strong> — See whether your changes actually strengthened the work</li>
                                            </ul>
                                            <p className="mt-3 text-indigo-900 font-semibold">
                                                RevisionGrade remembers you. Competitors reset to zero on every document.
                                            </p>
                                            <p className="text-sm text-slate-600 mt-2">
                                                This is <strong>editorial memory</strong>, not analytics—the difference between "here's what's wrong 
                                                with this page" and "here's how your writing is evolving."
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="vs-other-ai">
                                    <AccordionTrigger>
                                        How is this different from ChatGPT or other AI writing tools?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade™ is not a writing assistant. It's an <strong>editorial evaluation system</strong> 
                                                built on:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>12 literary-agent criteria</strong> (calibrated against publishing outcomes)</li>
                                                <li><strong>60+ WAVE Revision checks</strong> (proprietary framework for structure and craft)</li>
                                                <li><strong>Longitudinal learning</strong> (tracks your growth, recurring issues, revision effectiveness)</li>
                                                <li><strong>Submission-readiness focus</strong> (not grammar fixes or sentence rewrites)</li>
                                            </ul>
                                            <p>
                                                ChatGPT provides feedback. RevisionGrade™ provides judgment—the kind agents use when 
                                                deciding what to request.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="accuracy">
                                    <AccordionTrigger>
                                        How accurate are the evaluations?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Evaluation accuracy depends on <strong>submission length and completeness</strong>. 
                                                The more text RevisionGrade can analyze, the more accurately it assesses structure, 
                                                pacing, and character development across the 12 criteria.
                                            </p>
                                            <p>
                                                Best results come from:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Complete scenes or chapters (not isolated paragraphs)</li>
                                                <li>Full manuscripts for spine evaluation</li>
                                                <li>Opening chapters for hook/voice assessment</li>
                                            </ul>
                                            <p className="text-sm italic text-slate-600">
                                                Short excerpts are useful for quick feedback, but full scenes or chapters produce 
                                                the most reliable evaluations.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Speed & Process */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Clock className="w-5 h-5 text-indigo-600" />
                                Speed & Process
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="how-long">
                                    <AccordionTrigger>
                                        How long does an evaluation take?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Quick Scene/Chapter Evaluation:</strong> 2–5 minutes</p>
                                            <p><strong>Full Manuscript Analysis:</strong> 5–15 minutes (depending on length)</p>
                                            <p>
                                                Compare this to traditional editors:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Developmental edit: 4–8 weeks</li>
                                                <li>Structural pass: 2–4 weeks</li>
                                                <li>Agent-style read: 2–3 weeks</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="how-it-works">
                                    <AccordionTrigger>
                                        How does the evaluation process work?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>1. Submit Your Work</strong></p>
                                            <p className="ml-4">
                                                Upload a scene, chapter, or full manuscript. RevisionGrade™ automatically detects format 
                                                (manuscript or screenplay).
                                            </p>
                                            
                                            <p><strong>2. Analysis</strong></p>
                                            <p className="ml-4">
                                                Three AI systems evaluate your work against 12 literary-agent criteria and 60+ WAVE checks, 
                                                identifying structural issues, pacing problems, and craft weaknesses.
                                            </p>
                                            
                                            <p><strong>3. Results</strong></p>
                                            <p className="ml-4">
                                                Receive a calibrated score (0–100), detailed breakdown per criterion, priority revision requests, 
                                                and specific WAVE guidance.
                                            </p>
                                            
                                            <p><strong>4. Revision & Progress</strong></p>
                                            <p className="ml-4">
                                                Apply changes, re-evaluate, and track improvement over time. The Progress Dashboard shows 
                                                recurring patterns and revision effectiveness.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="formats">
                                    <AccordionTrigger>
                                        What formats do you support?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            RevisionGrade™ supports <strong>manuscripts (novels, memoirs, narrative nonfiction) and 
                                            screenplays</strong>. Upload as plain text (.txt), Word (.docx), or paste directly into the editor.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Who It's For */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Users className="w-5 h-5 text-indigo-600" />
                                Who It's For
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="target-users">
                                    <AccordionTrigger>
                                        Who should use RevisionGrade?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>RevisionGrade™ is designed for:</strong></p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>Serious fiction writers</strong> preparing manuscripts for agent submission</li>
                                                <li><strong>Screenwriters</strong> evaluating structure and marketability</li>
                                                <li><strong>Self-publishing authors</strong> seeking professional-grade quality standards</li>
                                                <li><strong>Writing groups</strong> using objective criteria for critique</li>
                                                <li><strong>MFA students</strong> tracking editorial growth over time</li>
                                            </ul>
                                            <p>
                                                If you're submitting to agents, producers, contests, or publishers—RevisionGrade™ helps 
                                                you meet the standards they use to decide what to request.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="beginners">
                                    <AccordionTrigger>
                                        Is RevisionGrade suitable for beginners?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Yes, but with a caveat. RevisionGrade™ applies <strong>agent-level standards</strong>—meaning 
                                            scores can be brutally honest. Beginners benefit most when they use it as a learning system, 
                                            not just a grading tool. The Progress Dashboard shows improvement over time, which helps 
                                            beginners see growth rather than just scores.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="genres">
                                    <AccordionTrigger>
                                        Does it work for all genres?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade™ evaluates <strong>narrative structure, craft, and readiness</strong>—which 
                                                applies across genres. The 12 criteria cover:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Hook, voice, character development</li>
                                                <li>Conflict, tension, stakes</li>
                                                <li>Pacing, dialogue, emotional beats</li>
                                                <li>Marketability and genre fit</li>
                                            </ul>
                                            <p>
                                                Works best for: literary fiction, thrillers, romance, sci-fi/fantasy, memoir, screenplays.
                                            </p>
                                            <p>
                                                Less effective for: poetry, experimental prose, nonfiction essays (non-narrative).
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Privacy & Security */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                Privacy & Security
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="ownership">
                                    <AccordionTrigger>
                                        Do I retain ownership of my work?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            <strong>Yes.</strong> You retain full ownership and copyright of your creative work. 
                                            RevisionGrade™ does not claim any rights to manuscripts or screenplays submitted for evaluation.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="privacy">
                                    <AccordionTrigger>
                                        Is my work kept private?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Yes. Your manuscripts are stored securely and are never shared, published, or used for training 
                                            third-party AI models without your explicit consent.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="deletion">
                                    <AccordionTrigger>
                                        Can I delete my submissions?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Yes. You can delete submissions at any time. Deleted items are moved to trash and 
                                            recoverable for 30 days, after which they are permanently deleted from our systems.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}