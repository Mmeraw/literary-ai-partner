import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    ChevronDown, 
    DollarSign, 
    Clock, 
    Award, 
    Users,
    BookOpen,
    Sparkles,
    Search,
    X,
    Shield
} from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export default function FAQ() {
    const [searchQuery, setSearchQuery] = useState('');
    const [defaultOpen, setDefaultOpen] = useState('');

    const clearSearch = () => {
        setSearchQuery('');
        setDefaultOpen('');
    };

    // Define all FAQ items with searchable content
    const faqData = useMemo(() => ({
        pricing: [
            { value: 'price-comparison', text: 'How does RevisionGrade compare to hiring a professional editor?' },
            { value: 'what-you-get', text: 'What do I actually get for $99/month?' },
            { value: 'free-trial', text: 'Is there a free trial?' }
        ],
        quality: [
            { value: 'phd-calibrated', text: 'What does PhD-calibrated mean?' },
            { value: 'vs-human', text: 'Does RevisionGrade replace human editors?' },
            { value: 'write-rewrite', text: 'Does RevisionGrade write or rewrite my book?' },
            { value: 'what-it-does', text: 'What RevisionGrade does and does not do' },
            { value: 'editorial-memory', text: 'What is Editorial Growth Tracking?' },
            { value: 'vs-other-ai', text: 'How is this different from ChatGPT or other AI writing tools?' },
            { value: 'few-ai-systems', text: 'Why does RevisionGrade use only a few AI systems?' },
            { value: 'comparison-methodology', text: 'How does RevisionGrade evaluate my manuscript against published novels?' },
            { value: 'accuracy', text: 'How accurate are the evaluations?' }
        ],
        humanAccess: [
            { value: 'automated-system', text: 'Is RevisionGrade fully automated?' },
            { value: 'who-sees-work', text: 'Who sees my work?' },
            { value: 'storygate-exception', text: 'What about Storygate Studio?' }
        ],
        privacy: [
            { value: 'content-privacy', text: 'Can staff access my manuscripts?' },
            { value: 'data-usage', text: 'How is my data used?' },
            { value: 'why-automated', text: 'Why is automation important?' }
        ],
        storygate: [
            { value: 'what-is-storygate', text: 'What is Storygate Studio?' },
            { value: 'manuscript-materials', text: 'What materials are required for manuscript submissions?' },
            { value: 'pitch-in-query', text: 'Why does Storygate treat the pitch as part of the query letter?' },
            { value: 'pitch-synopsis-bio-order', text: 'Why is the order Pitch → Synopsis → Bio → Query important?' },
            { value: 'film-deck-required', text: 'Is a Film / TV Pitch Deck required?' },
            { value: 'source-material-definition', text: 'What is Source Material?' },
            { value: 'declined-feedback', text: 'Will I receive feedback if my submission is declined?' },
            { value: 'payment-to-stay', text: 'Do I need to keep paying to stay in Storygate Studio?' },
            { value: 'guarantee-representation', text: 'Does Storygate guarantee representation or production?' }
        ]
    }), []);

    // Filter FAQ sections based on search query
    const filteredMatches = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const query = searchQuery.toLowerCase();
        const matches = [];
        
        Object.entries(faqData).forEach(([section, items]) => {
            items.forEach(item => {
                if (item.text.toLowerCase().includes(query) || item.value.includes(query)) {
                    matches.push(item.value);
                }
            });
        });
        
        return matches;
    }, [searchQuery, faqData]);

    // Auto-open first match when searching
    React.useEffect(() => {
        if (filteredMatches && filteredMatches.length > 0) {
            setDefaultOpen(filteredMatches[0]);
        } else if (!searchQuery) {
            setDefaultOpen('');
        }
    }, [filteredMatches, searchQuery]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Frequently Asked Questions
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Everything You Need to Know
                    </h1>
                    <p className="text-lg text-slate-600">
                        Common questions about RevisionGrade™ and professional evaluation
                    </p>
                </div>

                {/* Search Bar */}
                <Card className="border-2 border-indigo-200 shadow-lg mb-8">
                    <CardContent className="pt-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search FAQs... (e.g., 'pricing', 'AI usage', 'ownership')"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-10 h-12 text-base"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={clearSearch}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

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
                            This evaluation system was designed to reflect how professional agents, editors, and script readers actually assess work—not just craft in isolation, but readiness for the market. The 13 Story Evaluation Criteria measure narrative strength, clarity, and execution, while an internal meta-layer captures the quieter factors that influence real acquisition decisions, such as conceptual clarity, reader load, originality, and professional polish.
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
                            <Accordion type="single" collapsible className="w-full" value={defaultOpen}>
                                <AccordionItem value="price-comparison" className={filteredMatches && !filteredMatches.includes('price-comparison') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="price-comparison">
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

                                <AccordionItem value="what-you-get" className={filteredMatches && !filteredMatches.includes('what-you-get') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="what-you-get">
                                        What do I actually get for $99/month?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>Professional Plan includes:</strong></p>
                                            <ul className="list-disc ml-6 space-y-2">
                                               <li><strong>Complete Agent-Ready Pipeline:</strong> Grade → Pitch → Synopsis → Bio → Comps → Agents → Query</li>
                                               <li><strong>Unlimited evaluation runs</strong>, within a 500,000-word/month cap</li>
                                               <li><strong>Full writing evaluation</strong> against 13 Story Evaluation Criteria</li>
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

                                <AccordionItem value="free-trial" className={filteredMatches && !filteredMatches.includes('free-trial') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="free-trial">
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
                            <Accordion type="single" collapsible className="w-full" value={defaultOpen}>
                                <AccordionItem value="phd-calibrated" className={filteredMatches && !filteredMatches.includes('phd-calibrated') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="phd-calibrated">
                                        What does "PhD-calibrated" mean?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                "PhD-calibrated" means the evaluation framework was tuned against professional editorial assessments, 
                                                acquisition criteria, and real submission outcomes, so scores reflect submission-level standards rather 
                                                than generic writing feedback.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                All evaluations are generated automatically by RevisionGrade's systems; there is no manual tweaking of individual scores.
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                No human editor reviews, reads, or evaluates individual submissions unless the user explicitly connects 
                                                with industry professionals through Storygate Studio.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="vs-human" className={filteredMatches && !filteredMatches.includes('vs-human') ? 'hidden' : ''}>
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

                                <AccordionItem value="write-rewrite" className={filteredMatches && !filteredMatches.includes('write-rewrite') ? 'hidden' : ''}>
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

                                <AccordionItem value="what-it-does" className={filteredMatches && !filteredMatches.includes('what-it-does') ? 'hidden' : ''}>
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
                                                <li>Evaluate your writing against agent-calibrated criteria</li>
                                                <li>Generate revision options for your existing text (with your approval)</li>
                                                <li>Diagnose structural and craft risks</li>
                                                <li>Surface recurring weaknesses</li>
                                                <li>Measure whether your revisions actually improve the work</li>
                                                <li><strong>Generate complete submission package:</strong> pitches, synopses, bio, comparables, query letters</li>
                                                <li><strong>Connect you to agents</strong> with targeted search and submission tracking</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                In short: RevisionGrade™ takes you from draft to agent inbox—complete publishing pipeline in one platform.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="editorial-memory" className={filteredMatches && !filteredMatches.includes('editorial-memory') ? 'hidden' : ''}>
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

                                <AccordionItem value="vs-other-ai" className={filteredMatches && !filteredMatches.includes('vs-other-ai') ? 'hidden' : ''}>
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
                                               <li><strong>13 Story Evaluation Criteria</strong> (calibrated against publishing outcomes)</li>
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

                                <AccordionItem value="few-ai-systems" className={filteredMatches && !filteredMatches.includes('few-ai-systems') ? 'hidden' : ''}>
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

                                <AccordionItem value="comparison-methodology" className={filteredMatches && !filteredMatches.includes('comparison-methodology') ? 'hidden' : ''}>
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

                                <AccordionItem value="accuracy" className={filteredMatches && !filteredMatches.includes('accuracy') ? 'hidden' : ''}>
                                    <AccordionTrigger>
                                        How accurate are the evaluations?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Evaluation accuracy depends on <strong>submission length and completeness</strong>. 
                                                The more text RevisionGrade can analyze, the more accurately it assesses structure, 
                                                pacing, and character development across the 13 criteria.
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

                    {/* Human Access & Review */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Shield className="w-5 h-5 text-indigo-600" />
                                Human Access & Review
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full" value={defaultOpen}>
                                <AccordionItem value="automated-system" className={filteredMatches && !filteredMatches.includes('automated-system') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="automated-system">
                                        Is RevisionGrade fully automated?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                Yes. RevisionGrade operates as a fully automated system by default.
                                            </p>
                                            <p>
                                                Submissions are processed exclusively by RevisionGrade's servers using calibrated evaluation frameworks.
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                No human editors, manual reviewers, or internal staff read or evaluate your work in the default workflow.
                                            </p>
                                            <p>
                                                Human review only occurs if you intentionally connect with industry professionals via Storygate Studio, 
                                                which is clearly labeled and requires explicit consent.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="who-sees-work" className={filteredMatches && !filteredMatches.includes('who-sees-work') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="who-sees-work">
                                        Who sees my work?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                By default: no one.
                                            </p>
                                            <p>
                                                Your content is analyzed only by automated systems. Staff cannot browse, read, or "peek" at submissions, 
                                                and there is no internal review queue.
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                In short: no one sees your work by default—not editors, not staff, not reviewers—only the system.
                                            </p>
                                            <p className="mt-3">
                                                Human review only occurs if you choose to connect with industry professionals via Storygate Studio, 
                                                which requires your explicit consent and is clearly labeled.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="storygate-exception" className={filteredMatches && !filteredMatches.includes('storygate-exception') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="storygate-exception">
                                        What about Storygate Studio?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Storygate Studio is a separate, opt-in service where you can <strong>choose</strong> to share your 
                                                work with verified industry professionals (agents, producers, executives).
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                This is the only scenario where humans see your work—and only when you explicitly grant access.
                                            </p>
                                            <p>
                                                RevisionGrade's automated evaluation system operates independently from Storygate Studio. They are 
                                                separate workflows with different purposes.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Privacy & Data Visibility */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Shield className="w-5 h-5 text-indigo-600" />
                                Privacy & Data Visibility
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full" value={defaultOpen}>
                                <AccordionItem value="content-privacy" className={filteredMatches && !filteredMatches.includes('content-privacy') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="content-privacy">
                                        Can staff access my manuscripts?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                No. Staff cannot browse, read, or access your submissions.
                                            </p>
                                            <p>
                                                Your content is analyzed only by automated systems. There is no internal review queue, no manual 
                                                screening process, and no human oversight of individual submissions.
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                Your manuscripts and materials are not shared with third parties for training, marketplace exposure, 
                                                or crowdsourced review.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="data-usage" className={filteredMatches && !filteredMatches.includes('data-usage') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="data-usage">
                                        How is my data used?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Your submissions are used exclusively for providing you with automated evaluation and revision services.
                                            </p>
                                            <p className="font-semibold text-slate-900">
                                                Your work is never used to train third-party AI models, shared for marketing purposes, or exposed 
                                                to crowdsourced review systems.
                                            </p>
                                            <p>
                                                RevisionGrade is designed to protect author confidentiality, reduce subjective drift, and provide 
                                                consistent, standards-based analysis at scale.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="why-automated" className={filteredMatches && !filteredMatches.includes('why-automated') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="why-automated">
                                        Why is automation important?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                RevisionGrade is an automated evaluation and transformation system, not a marketplace, crowdsourced 
                                                platform, or default editorial service.
                                            </p>
                                            <p>
                                                The design is meant to:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Protect author confidentiality</li>
                                                <li>Reduce subjective drift and bias</li>
                                                <li>Provide consistent, standards-based analysis at scale</li>
                                                <li>Ensure privacy and data security</li>
                                            </ul>
                                            <p className="mt-3 font-semibold text-slate-900">
                                                One-line summary: RevisionGrade is fully automated by default. Human review only occurs if you choose 
                                                to connect with industry professionals via Storygate Studio.
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
                                                Upload a scene, chapter, or full work. RevisionGrade™ automatically processes your writing.
                                            </p>

                                            <p><strong>2. Analysis</strong></p>
                                            <p className="ml-4">
                                                Three AI systems evaluate your work against 13 Story Evaluation Criteria and 60+ WAVE checks, 
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
                                            RevisionGrade™ supports <strong>novels, memoirs, narrative nonfiction, and screenplays</strong>. Upload as plain text (.txt), Word (.docx), or paste directly into the editor.
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
                                                applies across genres. The 13 criteria cover:
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

                    {/* Trusted Path */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Shield className="w-5 h-5 text-purple-600" />
                                Trusted Path™
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="what-is-trusted-path">
                                    <AccordionTrigger>
                                        What is Trusted Path™?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Trusted Path™ is a guided automation option inside RevisionGrade™ for authors who do not want to review each flagged item one-by-one.
                                            </p>
                                            <p>
                                                It uses your manuscript's CHX13 + Spine signals and WAVE findings to decide what kind of work is appropriate next:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>If the manuscript is structurally ready, Trusted Path can apply high-fidelity local revisions at scale.</li>
                                                <li>If the manuscript is structurally weak or missing key story architecture, Trusted Path gates or deprioritizes cosmetic polishing and routes the author into structural repair first.</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                Trusted Path™ is not a promise that a weak or incomplete book can be transformed into an industry-standard manuscript automatically.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="what-happens-click">
                                    <AccordionTrigger>
                                        What happens when I click Trusted Path?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>Trusted Path runs a readiness check and then follows the appropriate path:</p>
                                            
                                            <div className="mt-3">
                                                <p className="font-semibold text-slate-900">If structure is ready (above threshold):</p>
                                                <ul className="list-disc ml-6 space-y-1 mt-2">
                                                    <li>Applies the primary recommended revision for each eligible flagged issue (sentence/paragraph level) where structure supports a safe edit.</li>
                                                    <li>Produces a revised manuscript output plus a summary of what was changed and why (at a high level).</li>
                                                </ul>
                                            </div>

                                            <div className="mt-3">
                                                <p className="font-semibold text-slate-900">If structure is not ready (below threshold):</p>
                                                <ul className="list-disc ml-6 space-y-1 mt-2">
                                                    <li>Displays a structural gating message (Spine/CHX13 readiness is too low for line-level polish).</li>
                                                    <li>Prioritizes a repair sequence: missing beats, causality, stakes escalation, character motive clarity, scene purpose, and bridge logic.</li>
                                                    <li>May propose structural scaffolds (e.g., missing scenes, transitions, reversals) as options—not replacements for authorial design.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="does-rewrite">
                                    <AccordionTrigger>
                                        Does Trusted Path "rewrite my whole book"?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Trusted Path can apply a large number of local revisions quickly when the structure is stable enough to support those edits.
                                            </p>
                                            <p className="font-semibold text-slate-900">But Trusted Path does not:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Invent plot you did not write,</li>
                                                <li>Create a new story architecture out of thin air,</li>
                                                <li>Replace your authorial design,</li>
                                                <li>Guarantee publication or professional readiness.</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                If a manuscript is underwritten or structurally unsound, Trusted Path must gate polish rather than "mask" the problem with clean prose.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="why-block-polish">
                                    <AccordionTrigger>
                                        Why does Trusted Path sometimes block or deprioritize polishing?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>Because polishing a structurally unstable manuscript is a known trap:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>It wastes time and compute,</li>
                                                <li>It creates false confidence,</li>
                                                <li>It can hide missing beats and broken causality beneath smoother sentences.</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                Trusted Path is designed to prevent "false polish." Structural integrity must come first.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="structure-ready">
                                    <AccordionTrigger>
                                        What does "structure-ready" mean in Trusted Path?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                "Structure-ready" means the manuscript has sufficient core architecture that line-level edits will improve clarity and force without disguising missing story.
                                            </p>
                                            <p className="font-semibold text-slate-900">In practical terms, Trusted Path looks for:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>A coherent spine (what the story is, why now, what changes)</li>
                                                <li>Clear causality (events trigger events)</li>
                                                <li>Stakes that escalate and matter</li>
                                                <li>Character motive that explains choices</li>
                                                <li>Scenes that have a job and advance the story</li>
                                            </ul>
                                            <p className="mt-3">
                                                If those are missing or unstable, Trusted Path routes you to structural repair.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="types-of-edits">
                                    <AccordionTrigger>
                                        What types of edits will Trusted Path apply when structure is ready?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>Trusted Path applies high-fidelity local revisions such as:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Removing redundancy and tightening phrasing</li>
                                                <li>Repairing clarity and logic at sentence/paragraph level</li>
                                                <li>Fixing inconsistent tone or point-of-view slippage (when detectable)</li>
                                                <li>Strengthening cause/effect language and scene intent (when already present)</li>
                                                <li>Improving pacing within scenes that are structurally sound</li>
                                            </ul>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                Trusted Path does not "change what your story is." It improves how clearly and effectively it is expressed.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="change-voice">
                                    <AccordionTrigger>
                                        Will Trusted Path change my voice?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Trusted Path is designed to preserve voice while improving execution, but any automated revision can introduce "distance" from an author's original rhythm if the author relies exclusively on automation.
                                            </p>
                                            <p className="font-semibold text-slate-900">Best practice:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Use Trusted Path to create a cleaner baseline draft.</li>
                                                <li>Then do an author pass to restore micro-rhythm, emphasis, idiosyncrasy, and stylistic fingerprints.</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="can-undo">
                                    <AccordionTrigger>
                                        Can I undo Trusted Path?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Trusted Path should never permanently overwrite the original submission. The product keeps:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>The original manuscript,</li>
                                                <li>The revised manuscript output,</li>
                                                <li>A change summary (and, where possible, per-item traceability).</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="guarantee-success">
                                    <AccordionTrigger>
                                        Does Trusted Path guarantee agent interest, publication, or sales?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p><strong>No.</strong> Trusted Path does not guarantee publishability, representation, or market success.</p>
                                            <p className="font-semibold text-slate-900">It guarantees a more efficient and properly sequenced workflow:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Structure first when necessary,</li>
                                                <li>High-fidelity local revision when appropriate,</li>
                                                <li>Clear next steps either way.</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="one-sentence">
                                    <AccordionTrigger>
                                        In one sentence, what is Trusted Path?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700 font-semibold">
                                            Trusted Path applies scalable revisions where structure supports them and gates polish where structure is weak—so you don't mistake smoother sentences for a stronger story.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Storygate Studio */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Shield className="w-5 h-5 text-red-600" />
                                Storygate Studio™
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full" value={defaultOpen}>
                                <AccordionItem value="what-is-storygate" className={filteredMatches && !filteredMatches.includes('what-is-storygate') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="what-is-storygate">
                                        What is Storygate Studio?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Storygate Studio is a selective professional gateway for narrative projects that have already demonstrated strong readiness.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="manuscript-materials" className={filteredMatches && !filteredMatches.includes('manuscript-materials') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="manuscript-materials">
                                        What materials are required for manuscript submissions?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>Manuscript submissions require:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>A query letter (including a clear pitch / hook paragraph)</li>
                                                <li>A synopsis</li>
                                                <li>An author bio</li>
                                            </ul>
                                            <p className="font-semibold text-indigo-900 mt-2">
                                                The pitch is part of the query letter, not a separate document.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="pitch-in-query" className={filteredMatches && !filteredMatches.includes('pitch-in-query') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="pitch-in-query">
                                        Why does Storygate treat the pitch as part of the query letter?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                In traditional publishing, the pitch is not a separate document. It is the opening hook paragraph inside the query letter—the section that quickly communicates what the book is, why it's compelling, and why it belongs in the market.
                                            </p>
                                            <p>Storygate Studio follows this industry standard.</p>
                                            <p className="font-semibold text-slate-900 mt-3">For manuscript submissions:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>You do not upload a separate pitch document.</li>
                                                <li>Your query letter must include a clear, compelling pitch paragraph.</li>
                                                <li>This is exactly where agents expect to find it.</li>
                                            </ul>
                                            <p className="font-semibold text-slate-900 mt-3">Internally, Storygate may evaluate:</p>
                                            <ol className="list-decimal ml-6 space-y-1">
                                                <li>Pitch (the hook inside the query)</li>
                                                <li>Synopsis</li>
                                                <li>Author bio</li>
                                                <li>The full query letter</li>
                                            </ol>
                                            <p className="mt-3">
                                                But for applicants, this remains a single, standard query letter—formatted and structured according to professional agent norms.
                                            </p>
                                            <p className="text-indigo-900 font-semibold mt-3">
                                                Storygate enforces this approach to keep submissions aligned with real-world publishing expectations and to avoid unnecessary or redundant materials.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="pitch-synopsis-bio-order" className={filteredMatches && !filteredMatches.includes('pitch-synopsis-bio-order') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="pitch-synopsis-bio-order">
                                        Why is the order Pitch → Synopsis → Bio → Query important?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>This reflects how agents assess submissions:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Pitch first (inside the query)</li>
                                                <li>Then story understanding (synopsis)</li>
                                                <li>Then author context (bio)</li>
                                                <li>Then the full professional letter (query)</li>
                                            </ul>
                                            <p className="mt-3">
                                                Storygate enforces this structure to match industry norms. <strong>Pitch refers to the hook paragraph inside the query letter, not a separate upload.</strong>
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="film-deck-required" className={filteredMatches && !filteredMatches.includes('film-deck-required') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="film-deck-required">
                                        Is a Film / TV Pitch Deck required?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            <strong>Yes.</strong> All Screen / Adaptation submissions require a Film / TV Pitch Deck. Projects without a deck cannot advance to human review.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="source-material-definition" className={filteredMatches && !filteredMatches.includes('source-material-definition') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="source-material-definition">
                                        What is "Source Material"?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Source Material is the underlying work being adapted (such as a novel manuscript, series bible, or article). <strong>It does not replace the Film / TV Pitch Deck.</strong>
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="declined-feedback" className={filteredMatches && !filteredMatches.includes('declined-feedback') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="declined-feedback">
                                        Will I receive feedback if my submission is declined?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Auto-declined submissions may receive brief, structured feedback derived from existing evaluation data. We do not provide bespoke critique.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="payment-to-stay" className={filteredMatches && !filteredMatches.includes('payment-to-stay') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="payment-to-stay">
                                        Do I need to keep paying to stay in Storygate Studio?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">No.</p>
                                            <p>
                                                Once your project is submitted to Storygate Studio, it remains eligible for consideration regardless of whether you maintain a paid subscription.
                                            </p>
                                            <p>
                                                Subscriptions apply to evaluation and development tools (such as RevisionGrade, revisions, or Film/TV deck creation). They do not apply to waiting, being considered, or remaining in the Storygate Studio queue.
                                            </p>
                                            <p>
                                                You may downgrade your plan or cancel entirely after submitting. Your Storygate Studio submission will remain on file and may still be reviewed or routed based on the materials already submitted.
                                            </p>
                                            <p className="font-semibold text-slate-900 mt-3">
                                                If you later wish to revise your work, update materials, or submit a new version, those actions require paid tools again.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="guarantee-representation" className={filteredMatches && !filteredMatches.includes('guarantee-representation') ? 'hidden' : ''}>
                                    <AccordionTrigger data-faq-trigger data-faq-value="guarantee-representation">
                                        Does Storygate guarantee representation or production?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            <strong>No.</strong> Storygate Studio does not guarantee representation, publication, or production.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* AI Usage & Transparency */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                AI Usage & Transparency
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="how-ai-used">
                                    <AccordionTrigger>
                                        How does RevisionGrade use AI?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                RevisionGrade uses professional-grade language models to analyze structure, craft, and narrative patterns. 
                                                These models are accessed directly and securely through industry-standard APIs.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                We do not train on your work, and your content is never shared or reused.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="usage-calculated">
                                    <AccordionTrigger>
                                        How is usage calculated?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Each plan includes a monthly allowance of AI processing, measured in tokens (a standard unit 
                                                of text processing used across the industry).
                                            </p>
                                            <p className="font-semibold text-slate-900">This allows us to:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Maintain consistent performance</li>
                                                <li>Prevent abuse or runaway usage</li>
                                                <li>Keep pricing predictable and fair</li>
                                            </ul>
                                            <p className="text-sm text-slate-600 mt-3">
                                                Most writers will never approach their limit under normal use.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="why-limits">
                                    <AccordionTrigger>
                                        Why are there usage limits at all?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                AI computation has real infrastructure costs. Rather than inflating subscription prices 
                                                for everyone, we apply reasonable usage boundaries so that:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Casual users aren't subsidizing heavy workloads</li>
                                                <li>Professional users get predictable performance</li>
                                                <li>The platform remains sustainable long-term</li>
                                            </ul>
                                            <p className="mt-3 font-semibold text-indigo-900">
                                                If you ever need more capacity, upgrading or adding usage is always available.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="markup-costs">
                                    <AccordionTrigger>
                                        Do you mark up AI costs?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                We do not sell raw AI access. We provide a curated analysis system that includes 
                                                orchestration, evaluation logic, and long-term data tracking.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                Our pricing reflects the service, not just raw computation.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* External Research & Privacy Controls */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                External Research & Privacy Controls
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="external-research-meaning">
                                    <AccordionTrigger>
                                        What does "external research" mean in RevisionGrade?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            External research refers to the use of real-world information outside your submitted writing 
                                            to support factual verification and market context (for example: comparable titles with dates 
                                            or performance figures).
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="manuscript-only-mode">
                                    <AccordionTrigger>
                                        What is "manuscript-only mode"?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Manuscript-only mode means RevisionGrade uses only your submitted writing and internal story 
                                            standards. No external lookup is performed.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="research-required">
                                    <AccordionTrigger>
                                        Is external research required for evaluations and revisions?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            <strong>No.</strong> Most evaluations and revisions are fully manuscript-derived. 
                                            External research is only relevant when you ask for outputs that depend on real-world facts.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="works-without-research">
                                    <AccordionTrigger>
                                        What works without external research?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>RevisionGrade can produce high-quality outputs from your submitted writing alone, including:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Story and structural evaluation (pacing, stakes, POV, clarity, arcs)</li>
                                                <li>Revision guidance and rewrite options (voice-preserving)</li>
                                                <li>Scene breakdowns and beat mapping</li>
                                                <li>Synopses (short/medium/long) based on your text</li>
                                                <li>Loglines and taglines derived from the story</li>
                                                <li>Query drafts and author bio drafts using your provided details</li>
                                                <li>Pitch deck narrative sections without market-verified claims</li>
                                                <li>Novel-to-screenplay drafting and formatting (spec-script conventions)</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="when-research-needed">
                                    <AccordionTrigger>
                                        When is external research needed?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>External research may be needed when you request outputs that must be fact-accurate or market-verified, such as:</p>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li>Comparable titles with dates, budgets, box office, sales, awards, or rankings</li>
                                                <li>Current industry positioning claims (studios, streamers, formats, trend assertions)</li>
                                                <li>Agent/producer/company discovery or verification</li>
                                                <li>Any claim that depends on up-to-date public information</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="research-control">
                                    <AccordionTrigger>
                                        Do I control when external research is used?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                <strong>Yes.</strong> Professional plan users can control permission behavior with 
                                                the "Ask Before Research" toggle.
                                            </p>
                                            <p className="font-semibold text-slate-900 mt-3">When enabled:</p>
                                            <p className="ml-4">
                                                RevisionGrade will ask for your confirmation before using external research on tasks 
                                                that may require it.
                                            </p>
                                            <p className="font-semibold text-slate-900 mt-3">When disabled:</p>
                                            <p className="ml-4">
                                                RevisionGrade will complete the request using only your submitted writing and internal 
                                                standards. If a request cannot be answered responsibly without external verification, 
                                                the system will either ask you to enable external research or offer a manuscript-derived alternative.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="research-privacy">
                                    <AccordionTrigger>
                                        Does RevisionGrade share my writing with the outside world?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            <strong>No.</strong> Your writing is analyzed within the platform's private processing environment. 
                                            External research, when enabled, is used to retrieve public information—not to publish or expose 
                                            your manuscript.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="sometimes-research">
                                    <AccordionTrigger>
                                        Can I use external research sometimes and not others?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Yes. You can switch settings per task or per project (depending on your plan).
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Genre, Classification & Evaluation */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                Genre, Classification & Evaluation
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="multiple-genres">
                                    <AccordionTrigger data-faq-trigger data-faq-value="multiple-genres">
                                        Why can't I choose multiple genres?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Because multi-label genre selection reduces scoring reliability. RevisionGrade™ and Storygate Studio™ 
                                            use a single primary genre to anchor evaluation, then applies internal logic to account for hybrid 
                                            or cross-genre qualities.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="doesnt-fit-category">
                                    <AccordionTrigger data-faq-trigger data-faq-value="doesnt-fit-category">
                                        What if my work doesn't fit cleanly into one category?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            That's common. Choose the genre that best reflects how your project would be positioned in the market. 
                                            Hybrid or cross-genre elements can be described elsewhere in your submission and are considered during evaluation.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="full-genre-list">
                                    <AccordionTrigger data-faq-trigger data-faq-value="full-genre-list">
                                        Why can't I see the full list of genre categories?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Because RevisionGrade's and Storygate Studio's internal taxonomy is designed for analytical consistency, 
                                            not public selection. Exposing the full taxonomy would increase confusion without improving assessment accuracy.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="genre-acceptance">
                                    <AccordionTrigger data-faq-trigger data-faq-value="genre-acceptance">
                                        Does genre affect whether my project is accepted?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            No. Acceptance is based on craft, originality, and execution. Genre is used to contextualize evaluation—not 
                                            to determine eligibility.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="genre-viability">
                                    <AccordionTrigger data-faq-trigger data-faq-value="genre-viability">
                                        Is genre used to judge commercial viability?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Indirectly. Genre helps frame expectations and comparative benchmarks, but decisions are driven by quality, 
                                            coherence, and professional readiness—not market trends alone.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>

                    {/* Voice & Dialogue Preservation */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Shield className="w-5 h-5 text-indigo-600" />
                                Voice & Dialogue Preservation
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="voice-philosophy">
                                    <AccordionTrigger data-faq-trigger data-faq-value="voice-philosophy">
                                        How does RevisionGrade handle my voice?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                Voice is treated as intentional craft.
                                            </p>
                                            <p>
                                                RevisionGrade evaluates clarity and consistency—not "correctness." Your voice, dialect, 
                                                and stylistic choices are respected as deliberate creative decisions.
                                            </p>
                                            <p>
                                                This means we don't flatten idiomatic language, regional dialects, or character-specific 
                                                speech patterns into "standard" English. Voice is yours.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="dialogue-preservation">
                                    <AccordionTrigger data-faq-trigger data-faq-value="dialogue-preservation">
                                        Is my dialogue preserved?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                Yes. Dialogue is preserved unless you explicitly request changes.
                                            </p>
                                            <p>
                                                RevisionGrade does not rewrite dialogue to match a "house style" or neutralize regional, 
                                                cultural, or character-specific speech patterns. Dialogue is character voice—we protect it.
                                            </p>
                                            <p>
                                                If you want dialogue revision suggestions, you can request them. Otherwise, dialogue 
                                                remains untouched.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="no-identity-classification">
                                    <AccordionTrigger data-faq-trigger data-faq-value="no-identity-classification">
                                        Does RevisionGrade classify language by identity?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p className="font-semibold text-indigo-900">
                                                No. No identity-based language classification is permitted.
                                            </p>
                                            <p>
                                                RevisionGrade does not label language patterns as "ethnic," "racial," "gendered," or any 
                                                other identity category. We evaluate narrative function, not the speaker's background.
                                            </p>
                                            <p>
                                                Language is assessed for clarity, consistency, and dramatic purpose—not for conformity 
                                                to a prescribed standard.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="house-voice-limits">
                                    <AccordionTrigger data-faq-trigger data-faq-value="house-voice-limits">
                                        What is "House Voice" and what doesn't it touch?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                "House Voice" refers to baseline editorial preferences for clarity, pacing, and structural 
                                                consistency across RevisionGrade's analysis.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                House Voice does not alter dialogue.
                                            </p>
                                            <p>
                                                It applies only to narrative prose—descriptions, transitions, scene-setting, and exposition. 
                                                Character speech, internal monologue with strong voice, and stylized narration remain yours.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="voice-toggle">
                                    <AccordionTrigger data-faq-trigger data-faq-value="voice-toggle">
                                        Can I control how much voice preservation I want?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Yes. Where appropriate, RevisionGrade provides a <strong>Voice Preservation toggle</strong> 
                                                with clear descriptors:
                                            </p>
                                            <ul className="list-disc ml-6 space-y-2">
                                                <li><strong>Maximum Preservation:</strong> Minimal changes; only structural or critical clarity issues flagged. Voice, rhythm, and idiomatic language stay intact.</li>
                                                <li><strong>Balanced:</strong> Standard editorial approach. Voice is preserved, but clarity and pacing improvements are suggested where they strengthen narrative function.</li>
                                                <li><strong>Polish-Focused:</strong> More aggressive refinement for submission readiness. Voice is still respected, but stylistic tightening is prioritized.</li>
                                            </ul>
                                            <p className="mt-3 text-indigo-900 font-semibold">
                                                You decide how much you want the system to suggest—voice remains yours.
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="voice-trust">
                                    <AccordionTrigger data-faq-trigger data-faq-value="voice-trust">
                                        Why does RevisionGrade prioritize voice protection?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-slate-700">
                                            <p>
                                                Because voice is the author's signature. It's what makes your work yours.
                                            </p>
                                            <p>
                                                Many editorial tools flatten language into a generic "professional" standard. That might 
                                                be efficient, but it destroys the texture, rhythm, and cultural authenticity that make 
                                                stories resonant.
                                            </p>
                                            <p className="font-semibold text-indigo-900">
                                                RevisionGrade is built on the principle that clarity and craft can coexist with voice—they 
                                                don't have to compete.
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
                                            RevisionGrade™ does not claim any rights to any work submitted for evaluation.
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="privacy">
                                    <AccordionTrigger>
                                        Is my work kept private?
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-slate-700">
                                            Yes. Your work is stored securely and is never shared, published, or used for training 
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
                </div>
            </div>
        </div>
    );
}