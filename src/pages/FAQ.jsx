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
                                                Professional manuscript evaluations typically cost <strong>$2,000–$14,000</strong> for a single pass. 
                                                RevisionGrade™ provides unlimited evaluations for <strong>$50/month</strong> (Pro plan).
                                            </p>
                                            <p>
                                                A traditional editorial path might include:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Developmental edit: $6,000–$10,000</li>
                                                <li>Follow-up structural pass: $3,000–$5,000</li>
                                                <li>Agent-style read: $2,000–$4,000</li>
                                                <li>Re-evaluation after revisions: $2,000–$3,000</li>
                                            </ul>
                                            <p className="font-semibold text-slate-900">
                                                Total traditional cost: $13,000–$22,000+ over 12–24 months
                                            </p>
                                            <p>
                                                RevisionGrade™ at $50/month for 24 months = <strong>$1,200 total</strong>, with unlimited runs, 
                                                revision tracking, progress analytics, and learning from every evaluation.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="what-you-get">
                                    <AccordionTrigger>
                                        What do I actually get for $50/month?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Pro Plan includes:</strong></p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>Unlimited evaluation runs</strong> (capped at 500,000 words/month)</li>
                                                <li><strong>Full manuscript & screenplay evaluation</strong> against 12 literary-agent criteria</li>
                                                <li><strong>60+ WAVE Revision checks</strong> (sentence craft, dialogue, pacing, structure)</li>
                                                <li><strong>Progress dashboard</strong> tracking improvement over time</li>
                                                <li><strong>Revision effectiveness analysis</strong> (before/after scoring)</li>
                                                <li><strong>Recurring pattern detection</strong> (what you keep getting wrong)</li>
                                                <li><strong>Clean download options</strong> (submission-ready, revision history, editorial commentary)</li>
                                                <li><strong>Priority processing</strong></li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="free-trial">
                                    <AccordionTrigger>
                                        Is there a free trial?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Yes. The <strong>Basic plan ($20/month)</strong> includes up to 50 evaluations per month 
                                            and 100,000 words/month. You can start with quick scene/chapter evaluations to test the system 
                                            before committing to full manuscript analysis.
                                        </p>
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
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade's scoring system was calibrated using detailed editorial evaluations created by 
                                                <strong> PhD-level editors and literary professionals</strong>.
                                            </p>
                                            <p>
                                                Their diagnostic patterns, criteria, and revision standards were encoded into the platform—together 
                                                with the proprietary WAVE Revision framework—so the AI can apply the same evaluative logic 
                                                consistently across manuscripts, at scale.
                                            </p>
                                            <p className="text-sm italic text-slate-600">
                                                "Calibrated" means the system was trained using real editorial frameworks. 
                                                No human editor reviews individual submissions unless explicitly stated.
                                            </p>
                                        </div>
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