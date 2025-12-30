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

                {/* Why We Built It This Way */}
                <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-lg mb-8">
                    <CardHeader>
                        <CardTitle className="text-2xl text-indigo-900">Why We Built It This Way</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-700 space-y-3">
                        <p>
                            <strong>Built to evaluate stories the way agents and editors actually read</strong>—balancing craft, clarity, and real-world market readiness.
                        </p>
                        <p>
                            This evaluation system was designed to reflect how professional agents, editors, and script readers actually assess work—not just craft in isolation, but readiness for the market. The 12 Story Evaluation Criteria measure narrative strength, clarity, and execution, while an internal meta-layer captures the quieter factors that influence real acquisition decisions, such as conceptual clarity, reader load, originality, and professional polish.
                        </p>
                        <p>
                            Together, they allow us to assess not only how well a story is written, but whether it functions as a viable, compelling piece of work in today's publishing and screen markets—without overburdening creators with opaque or subjective judgment.
                        </p>
                    </CardContent>
                </Card>

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
                                                <li><strong>Complete Agent-Ready Pipeline:</strong> Grade → Pitch → Synopsis → Bio → Comps → Agents → Query</li>
                                                <li><strong>Unlimited evaluation runs</strong>, within a 500,000-word/month cap</li>
                                                <li><strong>Full manuscript & screenplay evaluation</strong> against 12 literary-agent criteria</li>
                                                <li><strong>60+ WAVE Revision checks</strong> (sentence craft, dialogue, pacing, structure)</li>
                                                <li><strong>AI-generated submission assets:</strong> pitches, synopses, author bio, comparables</li>
                                                <li><strong>Agent discovery & query letter builder</strong> with auto-embedded pitch/synopsis/bio</li>
                                                <li><strong>Progress dashboard</strong> tracking improvement over time</li>
                                                <li><strong>Revision effectiveness analysis</strong> (before/after scoring)</li>
                                                <li><strong>Recurring pattern detection</strong> (what you keep getting wrong)</li>
                                                <li><strong>Clean downloads</strong> (submission-ready text + editorial reports)</li>
                                                <li><strong>Priority processing & support</strong></li>
                                            </ul>
                                            <p className="mt-3 text-sm text-slate-600">
                                                Compare: At $0.03/word (low-end developmental editing), an 80k-word manuscript costs $2,400 for 
                                                <strong> one pass</strong>. RevisionGrade gives you <strong>unlimited evaluation + complete agent submission pipeline</strong> 
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

                                <AccordionItem value="write-rewrite">
                                    <AccordionTrigger>
                                        Does RevisionGrade write or rewrite my book?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade <strong>does not generate original story content</strong> (new scenes, new plot, or invented dialogue) and it does not act as a co-writer.
                                            </p>
                                            <p>
                                                It <strong>does generate revision options</strong> for your existing text—including line edits and structural rewrites—then lets you decide what to apply: accept, reject, request alternatives, or apply a "Trusted Path" that batches recommended changes.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                You remain in control of what gets changed.
                                            </p>
                                            <p className="text-sm text-slate-600 mt-3 italic">
                                                One-line summary: "RevisionGrade doesn't invent your story — it helps you revise it, with you in control."
                                            </p>
                                            <p className="text-sm text-slate-600 mt-2">
                                                <strong>Trusted Path note:</strong> Trusted Path applies recommended edits automatically. You can review, undo, or export clean text anytime.
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
                                                RevisionGrade™ is <strong>not a grammar checker or generic writing assistant</strong>.
                                            </p>
                                            <p className="font-semibold text-slate-900">It does not:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Generate original story content (new plot, scenes, characters)</li>
                                                <li>Act as a co-writer</li>
                                                <li>Provide margin notes like a human editor</li>
                                            </ul>
                                            <p className="font-semibold text-slate-900 mt-3">It does:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Evaluate your manuscript or screenplay against agent-calibrated criteria</li>
                                                <li>Generate revision options for your existing text (with your approval)</li>
                                                <li>Diagnose structural and craft risks</li>
                                                <li>Surface recurring weaknesses</li>
                                                <li>Measure whether your revisions actually improve the work</li>
                                                <li><strong>Generate complete submission package:</strong> pitches, synopses, bio, comparables, query letters</li>
                                                <li><strong>Connect you to agents</strong> with targeted search and submission tracking</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                In short: RevisionGrade™ takes you from manuscript to agent inbox—complete publishing pipeline in one platform.
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
                                                RevisionGrade™ is not a writing assistant. It's an <strong>editorial evaluation system</strong>{' '}
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

                                <AccordionItem value="few-ai-systems">
                                    <AccordionTrigger>
                                        Why does RevisionGrade use only a few AI systems?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade uses <strong>three specialized AI systems</strong>—each calibrated for a distinct 
                                                editorial function (structure, craft, pattern recognition). Rather than averaging dozens of models, 
                                                we focus on alignment and interpretability.
                                            </p>
                                            <p>
                                                More models create noise. Professional editors don't vote—they judge. RevisionGrade replicates that coherence.
                                            </p>
                                            <p className="text-indigo-900 font-semibold">
                                                Better judgment comes from alignment, not volume.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="comparison-methodology">
                                    <AccordionTrigger>
                                        How does RevisionGrade evaluate my manuscript against published novels if it hasn't read every book?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-slate-900">
                                                The key insight: You don't compare manuscripts by reading every other book word-for-word. You compare them by measuring patterns—not prose.
                                            </p>
                                            <p>
                                                RevisionGrade does not claim to have read every novel ever written. It does something far more precise and defensible: <strong>it evaluates how a manuscript behaves relative to known, measurable narrative patterns extracted from professionally successful fiction</strong>.
                                            </p>
                                            <p className="font-semibold text-slate-900 mt-3">
                                                A novel is judged by structural, rhythmic, and cognitive signals that repeat across successful books:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>How quickly conflict is introduced</li>
                                                <li>How tension rises and releases</li>
                                                <li>How often interiority appears</li>
                                                <li>How scenes turn</li>
                                                <li>How stakes escalate</li>
                                                <li>How dialogue functions under pressure</li>
                                                <li>How exposition is distributed</li>
                                                <li>How POV and psychic distance behave</li>
                                            </ul>
                                            <p className="mt-3">
                                                These patterns can be measured. They don't require the AI to have read every novel ever written—only to understand what successful narrative architecture looks like.
                                            </p>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                "RevisionGrade doesn't compare your manuscript to other books. It compares your manuscript to how effective books are built."
                                            </p>
                                            <p className="text-sm text-slate-600 mt-3 italic">
                                                Editors don't read every novel either—they recognize patterns. Your system is doing the same thing—systematically.
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

                                <AccordionItem value="workflow-speed">
                                    <AccordionTrigger>
                                        Can I speed up the revision process without losing control?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Yes. RevisionGrade™ supports <strong>intentional editorial acceleration</strong> without sacrificing control.
                                            </p>
                                            <p>
                                                You can review each revision in detail—or, when appropriate, apply curated recommendations in bulk. 
                                                High-confidence revisions can be applied at once, always reviewable and reversible.
                                            </p>
                                            <p className="text-indigo-900 font-semibold">
                                                This is workflow control, not autopilot—you maintain full creative authority while accelerating the revision process.
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

                    {/* Authorship & Ethics */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Award className="w-5 h-5 text-indigo-600" />
                                Authorship & Ethics
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="authorship">
                                    <AccordionTrigger>
                                        Who owns the work created using this platform?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>The author retains full ownership of all submitted and generated material.</strong> RevisionGrade™ 
                                                does not claim authorship, co-authorship, or creative rights over user content.
                                            </p>
                                            <p>
                                                You own your work. Period.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="still-mine">
                                    <AccordionTrigger>
                                        If the system revises or improves my work, is it still mine?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>Yes.</strong> Just as with a human editor, ghostwriter, or script consultant, 
                                                the author remains the creator.
                                            </p>
                                            <p>
                                                Our system provides <strong>analytical feedback, structural revision, and stylistic refinement</strong> 
                                                based on the author's original material and direction. It operates as an editorial and analytical assistant—not 
                                                a creative originator.
                                            </p>
                                            <p className="text-indigo-900 font-semibold">
                                                Editorial transformation ≠ Creative origination.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="ai-writing">
                                    <AccordionTrigger>
                                        How is this different from "AI writing my book"?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>Our platform does not generate independent stories or substitute authorial intent.</strong>
                                            </p>
                                            <p>
                                                It operates as an <strong>editorial and analytical assistant</strong>—evaluating, revising, and refining 
                                                material that <strong>the author has already created</strong>.
                                            </p>
                                            <p>
                                                Think of it this way:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>You write the story, characters, and scenes</li>
                                                <li>RevisionGrade™ evaluates against professional standards</li>
                                                <li>You decide which suggestions to accept or reject</li>
                                                <li>The final work reflects <strong>your creative choices</strong></li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                RevisionGrade™ doesn't create—it refines what you've already built.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="vs-human-editor">
                                    <AccordionTrigger>
                                        Is this different from hiring a professional editor or script doctor?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>Functionally, no.</strong> The difference is scale and speed.
                                            </p>
                                            <p>
                                                Professional editors routinely:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Restructure chapters and scenes</li>
                                                <li>Rewrite dialogue and descriptions</li>
                                                <li>Cut, move, and reframe entire sections</li>
                                                <li>Polish sentence-level craft</li>
                                            </ul>
                                            <p className="mt-3">
                                                Yet the author's name goes on the cover—because <strong>editors provide transformation, not origination</strong>.
                                            </p>
                                            <p className="text-indigo-900 font-semibold">
                                                The same ethical standard applies here: the work remains the author's intellectual property.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="claims-ownership">
                                    <AccordionTrigger>
                                        Does the platform claim ownership of my text or ideas?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>No.</strong> All submitted content remains the exclusive property of the author.
                                            </p>
                                            <p>
                                                RevisionGrade™ operates under the same principle as professional editorial services: 
                                                we provide analysis and refinement—<strong>you retain all rights</strong>.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="editorial-precedent">
                                    <AccordionTrigger>
                                        Is there precedent for this in publishing?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>Yes—it's standard practice.</strong>
                                            </p>
                                            <p>
                                                In publishing law and practice:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>Editors do not become co-authors</strong> unless they contribute original creative content</li>
                                                <li><strong>Structural edits, rewrites, line edits, and suggestions do not transfer authorship</strong></li>
                                                <li><strong>Ghostwriters</strong> are often contractually invisible—and our system does less than that</li>
                                            </ul>
                                            <p className="mt-3">
                                                RevisionGrade™ is closer to:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Grammarly (but deeper)</li>
                                                <li>A developmental editor</li>
                                                <li>A screenplay consultant</li>
                                            </ul>
                                            <p className="mt-3 text-indigo-900 font-semibold">
                                                All of which are universally accepted in professional publishing.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Revision Mode */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                Revision Mode™
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="what-is-revision-mode">
                                    <AccordionTrigger>
                                        What is Revision Mode™?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Revision Mode™ is a diagnostic and guidance system designed to evaluate a manuscript's structure, clarity, and narrative function. 
                                                It identifies where a manuscript succeeds, where it fails, and what kind of revision is required to move it closer to professional standards.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                It does not rewrite your book for you. It shows you what must change and why.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="automatic-fix">
                                    <AccordionTrigger>
                                        Does Revision Mode™ "fix" my manuscript automatically?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>No.</strong></p>
                                            <p>
                                                Revision Mode™ does not generate a finished, publishable manuscript from weak or incomplete material. 
                                                It does not replace the author's creative labor, judgment, or voice.
                                            </p>
                                            <p className="font-semibold text-slate-900">Instead, it provides:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Structural diagnosis</li>
                                                <li>Clear identification of narrative weaknesses</li>
                                                <li>Specific guidance on what type of revision is needed</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold">
                                                Think of it as a developmental editor, not a ghostwriter.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="major-problems">
                                    <AccordionTrigger>
                                        What if my manuscript has major problems?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Revision Mode™ will tell you—clearly and honestly.</strong></p>
                                            <p>If your manuscript suffers from:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Weak or missing plot structure</li>
                                                <li>Underdeveloped characters</li>
                                                <li>Incoherent stakes or causality</li>
                                                <li>Conceptual or tonal mismatch</li>
                                            </ul>
                                            <p className="mt-3">…it will not attempt to "polish over" those issues.</p>
                                            <p className="font-semibold text-slate-900">Instead, it will explain:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Why the material fails</li>
                                                <li>Where the failure occurs</li>
                                                <li>What kind of work would be required to fix it</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold">
                                                This transparency is intentional and essential.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="guarantee-publishable">
                                    <AccordionTrigger>
                                        Does Revision Mode™ guarantee a publishable result?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>No.</strong></p>
                                            <p>
                                                Revision Mode™ does not guarantee publication, agent interest, or commercial success.
                                            </p>
                                            <p className="font-semibold text-slate-900">What it guarantees is:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Honest diagnostic feedback</li>
                                                <li>Alignment with professional evaluation standards</li>
                                                <li>A clear understanding of whether a manuscript is structurally viable</li>
                                            </ul>
                                            <p className="mt-3">
                                                Publication still depends on the author's execution, revision choices, and creative judgment.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="why-no-rewrite">
                                    <AccordionTrigger>
                                        Why doesn't Revision Mode™ just "rewrite it better"?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Because rewriting without understanding is deception.</strong></p>
                                            <p>Automatically rewriting weak material can:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Mask foundational flaws</li>
                                                <li>Produce generic or hollow prose</li>
                                                <li>Give false confidence</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                RevisionGrade™ is designed to build stronger writers, not mask problems with artificial polish.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="who-for">
                                    <AccordionTrigger>
                                        Who is Revision Mode™ for?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Revision Mode™ is ideal for:</strong></p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Writers who want professional-level feedback</li>
                                                <li>Authors preparing for agents or publishers</li>
                                                <li>Creators who want to understand why something isn't working</li>
                                                <li>Writers serious about craft improvement</li>
                                            </ul>
                                            <p className="mt-3">
                                                It is not intended for users seeking instant, fully rewritten manuscripts.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="what-to-expect">
                                    <AccordionTrigger>
                                        What should I expect after running Revision Mode™?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-slate-900">You should expect:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>A clear diagnostic of your manuscript's strengths and failures</li>
                                                <li>Explicit identification of structural and narrative issues</li>
                                                <li>Actionable guidance on what to revise and why</li>
                                                <li>A realistic sense of where your work stands in the professional landscape</li>
                                            </ul>
                                            <p className="font-semibold text-slate-900 mt-3">You should not expect:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>A finished book</li>
                                                <li>Automated "fixes" that bypass craft</li>
                                                <li>Guaranteed market success</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="why-better">
                                    <AccordionTrigger>
                                        Why is this approach better?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            <strong>Because honesty scales. Illusions do not.</strong>
                                        </p>
                                        <p className="text-slate-700 mt-3">
                                            RevisionGrade™ treats writing as a craft—not a button to press—and respects both the reader and the author 
                                            by refusing to fake improvement.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="core-philosophy">
                                    <AccordionTrigger>
                                        What is the core philosophy behind Revision Mode™?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                Revision Mode™ does not create talent.
                                            </p>
                                            <p>
                                                It reveals it, challenges it, and helps it grow.
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                That is the contract.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Disclaimers */}
                    <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-2xl text-amber-900">Important Disclaimers</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-2">Public-Facing Disclaimer</h3>
                                <p className="text-slate-700">
                                    <strong>RevisionGrade™ does not write or rewrite your manuscript.</strong>
                                </p>
                                <p className="text-slate-700 mt-2">
                                    It evaluates structure, clarity, and narrative effectiveness using professional editorial criteria. 
                                    Revision Mode™ identifies where a manuscript succeeds, where it fails, and what kind of revision is required. 
                                    It does not guarantee publication, representation, or commercial success.
                                </p>
                                <p className="text-slate-700 mt-2">
                                    The quality of the final work remains dependent on the author's decisions, effort, and creative execution.
                                </p>
                            </div>

                            <div className="border-t border-amber-200 pt-4">
                                <h3 className="font-semibold text-slate-900 mb-2">What Revision Mode™ Is Not</h3>
                                <p className="text-slate-700 mb-2">Revision Mode™ is not:</p>
                                <ul className="list-disc ml-6 space-y-1 text-slate-700">
                                    <li>A ghostwriter</li>
                                    <li>A shortcut to publication</li>
                                    <li>A guarantee of success</li>
                                    <li>A replacement for authorial craft</li>
                                    <li>A tool that "fixes" weak ideas automatically</li>
                                </ul>
                                <p className="text-indigo-900 font-semibold mt-2">
                                    It is a diagnostic and guidance system—not a creative substitute.
                                </p>
                            </div>

                            <div className="border-t border-amber-200 pt-4">
                                <h3 className="font-semibold text-slate-900 mb-2">Legal Statement</h3>
                                <p className="text-slate-700 text-sm">
                                    RevisionGrade™ provides analytical feedback based on narrative structure, industry standards, and comparative 
                                    storytelling models. All feedback is advisory in nature. Use of Revision Mode™ does not guarantee publishability, 
                                    market success, or representation. The user retains full responsibility for creative decisions, revisions, and 
                                    final outcomes. RevisionGrade™ does not claim authorship, ownership, or creative contribution to submitted works. 
                                    All intellectual property remains solely with the user. RevisionGrade™ does not permanently overwrite a user's 
                                    original manuscript; users should retain a copy of their original submission. Any revision suggestions or outputs 
                                    are intended to support the user's own editorial process, not replace it.
                                </p>
                            </div>

                            <div className="border-t border-amber-200 pt-4">
                                <p className="text-lg text-center text-indigo-900 font-semibold italic">
                                    "We don't write your book. We help you understand it—so you can write it better."
                                </p>
                            </div>
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