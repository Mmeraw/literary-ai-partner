import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, AlertTriangle, Shield, AlertCircle, TrendingUp, FileCheck } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

export default function SampleAnalysis() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <style>{`
                .content-text p, .content-text li {
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    hyphens: auto;
                }
            `}</style>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Sample Evaluations & Analyses
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Sample Analyses
                    </h1>
                    <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                        Representative examples showing how RevisionGrade analyzes manuscripts, chapters, and comparative benchmarks
                    </p>
                </div>

                {/* Context Banner */}
                <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-6 space-y-3 text-sm text-slate-700 content-text">
                        <p>
                            <strong>These samples illustrate how RevisionGrade evaluates manuscripts using its proprietary frameworks.</strong>
                        </p>
                        <p>
                            The analyses below are <strong>illustrative, not exhaustive</strong>. They demonstrate the type of insight and feedback produced—without exposing internal scoring logic, weighting, or full evaluation criteria.
                        </p>
                        <p className="text-slate-600 italic">
                            Examples reflect fictionalized excerpts and comparative studies, provided to show structure, tone, and depth of feedback available inside the platform.
                        </p>
                    </CardContent>
                </Card>

                {/* Tabs for different analysis types */}
                <Tabs defaultValue="chapter" className="mb-8">
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="chapter" className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4" />
                            Quick Evaluation (Chapter)
                        </TabsTrigger>
                        <TabsTrigger value="comparative" className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Novel Comparison
                        </TabsTrigger>
                    </TabsList>

                    {/* Chapter 3 Analysis Tab */}
                    <TabsContent value="chapter">
                        <div className="space-y-8">
                            <div className="text-center">
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                                    Chapter 3 — "The Crossing"
                                </h2>
                                <p className="text-slate-600">
                                    Quick Evaluation: 13 Story Evaluation Criteria (without WAVE)
                                </p>
                            </div>

                            {/* Manuscript Info */}
                            <Card className="border-0 shadow-md">
                                <CardContent className="p-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Manuscript</p>
                                            <p className="font-semibold text-slate-900">Fiction Sample</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Evaluation Type</p>
                                            <p className="font-semibold text-slate-900">Quick Evaluation (13 Criteria)</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Executive Summary */}
                            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-green-50">
                                <CardHeader>
                                    <CardTitle className="text-2xl flex items-center gap-2">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                        Executive Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-slate-700 content-text">
                                    <p>
                                        This chapter delivers its core promise—a tense, high-stakes crossing under pressure—with strong narrative momentum and clear emotional stakes. The sequence is coherent, readable, and engaging. A small number of refinements would strengthen authority, reduce repetition, and sharpen the impact of key moments.
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                                        <div className="p-4 rounded-lg bg-white border border-emerald-200">
                                            <p className="text-sm font-semibold text-slate-900 mb-2">Overall Assessment</p>
                                            <p className="text-sm text-slate-700">Submission-ready with targeted refinements</p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-white border border-emerald-200">
                                            <p className="text-sm font-semibold text-slate-900 mb-2">Primary Strengths</p>
                                            <p className="text-sm text-slate-700">Point-of-view control, escalating tension</p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-white border border-amber-200 md:col-span-2">
                                            <p className="text-sm font-semibold text-slate-900 mb-2">Primary Opportunities</p>
                                            <p className="text-sm text-slate-700">Reducing repetition, tightening select moments of phrasing</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Story Structure Criteria */}
                            <Card className="border-0 shadow-md">
                                <CardHeader>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-indigo-600" />
                                        13 Story Evaluation Criteria
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {[
                                            { criterion: 'Opening Hook', assessment: '✓ Immediate grounding and forward motion establish urgency without exposition.' },
                                            { criterion: 'Character Depth & Introduction', assessment: "✓ The protagonist's fear and resolve read as specific and earned rather than generic." },
                                            { criterion: 'Conflict & Escalation', assessment: '✓ Tension rises logically from observation to consequence, maintaining momentum.' },
                                            { criterion: 'Structure, Pacing & Flow', assessment: '✓ Scene progression is clean and purposeful, with no structural dead weight.' },
                                            { criterion: 'Dialogue & Subtext', assessment: '✓ Exchanges convey stakes and intent without over-explaining.' },
                                            { criterion: 'Stakes & Emotional Investment', assessment: '✓ Reader understands both the physical risk and the personal cost.' },
                                            { criterion: 'Narrative Voice & Style', assessment: '✓ Consistent close perspective; tone remains controlled throughout.' },
                                            { criterion: 'Worldbuilding & Immersion', assessment: '✓ Setting details support realism without slowing pacing.' },
                                            { criterion: 'Thematic Resonance', assessment: '⚠ A recurring motif appears several times; trimming one instance would sharpen its impact.' },
                                            { criterion: 'Market Readiness', assessment: '✓ Aligns with expectations for commercial thriller pacing and tone.' },
                                            { criterion: 'Line-Level Craft & Polish', assessment: '✓ Clean prose with occasional opportunities for tightening.' },
                                            { criterion: 'Scene Architecture & Causality', assessment: '✓ Events unfold with clear cause-and-effect logic.' },
                                            { criterion: 'Would They Keep Reading?', assessment: '✓ Ending creates a clear pull into the next scene.' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                                {item.assessment.startsWith('✓') ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                ) : (
                                                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                )}
                                                <div>
                                                    <p className="font-semibold text-slate-900 text-sm">{item.criterion}</p>
                                                    <p className="text-sm text-slate-700 mt-1">{item.assessment}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recommended Actions */}
                            <Card className="border-0 shadow-lg">
                                <CardHeader>
                                    <CardTitle className="text-xl">Recommended Revision Order</CardTitle>
                                </CardHeader>
                                <CardContent className="content-text">
                                    <ol className="space-y-2 list-decimal list-inside text-slate-700">
                                        <li>Trim redundant sensory phrasing.</li>
                                        <li>Replace generalized descriptions with precise physical cues.</li>
                                        <li>Recheck one or two lines for immediacy and rhythm.</li>
                                    </ol>
                                </CardContent>
                            </Card>

                            {/* What Happens Next */}
                            <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
                                <CardHeader>
                                    <CardTitle className="text-xl">What Happens Next</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-slate-700 content-text">
                                    <p>
                                        <strong>You decide which notes to apply.</strong>
                                    </p>
                                    <p>
                                        Once revisions are made, you can re-run the evaluation to confirm improvements and identify any remaining refinement opportunities.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Comparative Analysis Tab (Cartel Babies vs Cartel Trilogy) */}
                    <TabsContent value="comparative">
                        <div className="space-y-8">
                            <div className="text-center">
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                                    Novel Comparison: Cartel Babies vs. Cartel Trilogy
                                </h2>
                                <p className="text-slate-600">
                                    Comparative craft analysis across 16 professional criteria
                                </p>
                            </div>

                            {/* Disclaimer Banner */}
                            <div className="p-4 rounded-lg bg-amber-50 border-2 border-amber-200">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-900 content-text">
                                        <strong>Educational Purpose:</strong> This analysis is provided for educational and illustrative purposes only. 
                                        Cover images and referenced works are used for comparative commentary under fair use. 
                                        No affiliation or endorsement is implied.
                                    </p>
                                </div>
                            </div>

                            {/* Important Note */}
                            <Card className="border-0 shadow-md">
                                <CardHeader>
                                    <CardTitle className="text-xl">Important Note (Scope + Intent)</CardTitle>
                                </CardHeader>
                                <CardContent className="text-slate-700 space-y-3 content-text">
                                    <p>
                                        This document is a subjective, craft-based benchmarking study intended for educational and 
                                        positioning purposes. It uses a consistent internal rubric to show how a manuscript can be 
                                        mapped against recognizable genre patterns and one influential model of the form. It does not 
                                        imply endorsement, affiliation, collaboration, or objective superiority.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Why This Comparison Matters */}
                            <Card className="border-0 shadow-md">
                                <CardHeader>
                                    <CardTitle className="text-xl">Why This Comparison Matters</CardTitle>
                                </CardHeader>
                                <CardContent className="text-slate-700 space-y-3 content-text">
                                    <p>
                                        Don Winslow's <em className="italic">Cartel Trilogy</em> is widely considered the gold standard of cartel fiction, blending 
                                        geopolitical scope, procedural detail, and decades of research. Agents, editors, and readers often use 
                                        Winslow as the benchmark for evaluating narcoculture thrillers. <em className="italic">Cartel Babies</em> enters the same 
                                        territory—but from a radically different angle: intimate, psychological, emotionally devastating, and 
                                        driven by lived sensory realism. This report situates <em className="italic">Cartel Babies</em> within that landscape and 
                                        demonstrates how it measures against one of the genre's most acclaimed bodies of work.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Synopsis Section */}
                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Cartel Babies Synopsis */}
                                <Card className="border-0 shadow-md">
                                    <CardHeader>
                                        <CardTitle className="text-xl">Synopsis – Cartel Babies</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-center">
                                            <img 
                                                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/28634ea99_image.png" 
                                                alt="Cartel Babies visual"
                                                className="w-full h-auto rounded-lg shadow-md"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <div className="text-sm text-slate-700 space-y-3 content-text">
                                            <p>
                                                All of Meraw's fiction unfolds within the interconnected <a href="https://michaeljmeraw.com" target="_blank" rel="noopener noreferrer"><strong className="text-red-600 font-bold hover:text-red-700 underline">EvØ-Myth Universe™</strong></a>. 
                                                His latest novel, <a href="https://michaeljmeraw.com/cartel-babies-2026/" target="_blank" rel="noopener noreferrer"><em className="italic hover:text-indigo-700 underline">Cartel Babies</em></a>, is a 124,000-word, literary–commercial psychological thriller 
                                                set in present-day Sinaloa, México.
                                            </p>
                                            <p>
                                                When a retired Canadian with a long military and aerospace background is abducted on the highway 
                                                between Culiacán and Mazatlán and forced into a remote mountain cartel camp, he becomes part of 
                                                the hidden labor engine that feeds northwest México's synthetic-drug economy and an unwilling 
                                                witness to a system where violence is inherited, not chosen. As he learns the camp's rhythms, 
                                                hierarchies, and the quiet rules that keep some boys alive and erase others, his fight to stay 
                                                alive collides with a harder question: what happens to those born inside a war they never chose?
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Winslow's Trilogy Synopsis */}
                                <Card className="border-0 shadow-md">
                                    <CardHeader>
                                        <CardTitle className="text-xl">Synopsis – Don Winslow's Cartel Trilogy</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-center">
                                            <img 
                                                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/15d5866fb_image.png" 
                                                alt="Winslow trilogy covers"
                                                className="w-full h-auto rounded-lg shadow-md"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <div className="text-sm text-slate-700 space-y-3 content-text">
                                            <p>
                                                Winslow's acclaimed trilogy—<em className="italic">The Power of the Dog</em>, <em className="italic">The Cartel</em>, and <em className="italic">The Border</em>—follows 
                                                DEA agent Art Keller across decades of conflict with a powerful Sinaloa cartel.
                                            </p>
                                            <p>
                                                The books span governments, wars, operations, betrayals, and geopolitical shifts. Praised for their 
                                                scope, research, and documentary realism, the trilogy has earned international awards, major critical 
                                                acclaim, and a television adaptation deal with FX Networks. Winslow's work set the modern template 
                                                for large-scale cartel fiction.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Methodology */}
                            <Card className="border-0 shadow-md">
                                <CardHeader>
                                    <CardTitle className="text-xl">Methodology</CardTitle>
                                </CardHeader>
                                <CardContent className="text-slate-700 content-text">
                                    <p>
                                        Scores (1–10) reflect a personal craft rubric used for internal benchmarking. They are not judgments 
                                        of literary merit but tools for comparing narrative strategies, emotional effect, and structural execution 
                                        across works.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Comparative Analysis Table */}
                            <Card className="border-0 shadow-md overflow-hidden">
                                <CardHeader className="px-2 sm:px-6">
                                    <CardTitle className="text-xl">Comparative Craft Analysis</CardTitle>
                                    <p className="text-sm text-slate-600 mt-2 content-text">
                                        Below is a craft-based comparison across sixteen criteria commonly used by agents when evaluating 
                                        high-stakes thrillers.
                                    </p>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-6">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-[10px] sm:text-sm">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
                                                    <th className="border border-indigo-400 p-1 sm:p-4 text-left font-semibold text-white w-12 sm:w-auto text-[10px] sm:text-sm">Criteria</th>
                                                    <th className="border border-indigo-400 p-1 sm:p-4 text-left font-semibold text-white text-[10px] sm:text-sm">Don Winslow's <em className="italic">Cartel Trilogy</em></th>
                                                    <th className="border border-indigo-400 p-1 sm:p-4 text-left font-semibold text-white text-[10px] sm:text-sm">Michael Meraw's <em className="italic">Cartel Babies</em></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    {
                                                        criterion: "1. Hook",
                                                        winslow: { score: "9/10", text: "Begins with violence, setting, and drug-war stakes (The Power of the Dog opening). Immediate stakes, professional propulsion, cinematic." },
                                                        meraw: { score: "10/10", text: "Opens with psychological immediacy, violence, captivity, trauma, and voice. Agents feel thrown into the story—with an intimacy Winslow does not use.", edge: "Edge: Cartel Babies (intimacy)" }
                                                    },
                                                    {
                                                        criterion: "2. Voice",
                                                        winslow: { score: "9/10", text: "Controlled, procedural, masculine, commercial. Not deep interior." },
                                                        meraw: { score: "10/10", text: "Lyrical, mythic, violent, intimate, emotional. A signature voice—rare in submissions—combining literary depth with relentless tension.", edge: "Edge: Cartel Babies" }
                                                    },
                                                    {
                                                        criterion: "3. Character",
                                                        winslow: { score: "9/10", text: "Large cast, archetypal clarity, well-defined, but sometimes emotionally distant." },
                                                        meraw: { score: "10/10", text: "Fewer characters, but deeper psychological excavation. Benjamin, Mike, Raúl, Oso, the boy—the interiority is more intimate, more human, more devastating.", edge: "Edge: Cartel Babies" }
                                                    },
                                                    {
                                                        criterion: "4. Conflict",
                                                        winslow: { score: "10/10", text: "Master at macro-level conflict: governments, cartels, armies, operations.", edge: "Edge: Tie (different strengths: scale vs. intimacy)" },
                                                        meraw: { score: "10/10", text: "Matches that intensity but in a compressed, claustrophobic, personal scale. Every scene is survival. Every choice is identity. The tension never drops—rare for debuts." }
                                                    },
                                                    {
                                                        criterion: "5. Theme",
                                                        winslow: { score: "9/10", text: "Corruption, war, power, policy, history. Strong but external." },
                                                        meraw: { score: "10/10", text: "Captivity, loyalty, moral corrosion, love under pressure, survival, identity, complicity. Themes strike the reader emotionally, not just intellectually.", edge: "Edge: Cartel Babies" }
                                                    },
                                                    {
                                                        criterion: "6. Pacing",
                                                        winslow: { score: "9/10", text: "Cinematic pacing, occasionally sprawling due to trilogy scale." },
                                                        meraw: { score: "10/10", text: "Tight, relentless, clean. Structure is elegant and agent-friendly.", edge: "Edge: Cartel Babies" }
                                                    },
                                                    {
                                                        criterion: "7. Dialogue",
                                                        winslow: { score: "9/10", text: "Functional, masculine, plot-driven. Subtext sometimes thin." },
                                                        meraw: { score: "10/10", text: "Subtext heavy. Dialogue leans on fear, silence, posture, implication. Tags removed, interiority sharpened, power dynamics layered.", edge: "Edge: Cartel Babies" }
                                                    },
                                                    {
                                                        criterion: "8. World",
                                                        winslow: { score: "10/10", text: "Large-scale geopolitical worldbuilding—armies, cartels, landscapes. Documentary-grade realism.", edge: "Edge: Tie (Winslow = macro, Cartel Babies = micro)" },
                                                        meraw: { score: "10/10", text: "Micro-worldbuilding with surgical precision—ridge, compound, lab, pit, night lessons. Every sensory detail is immersive and lived." }
                                                    },
                                                    {
                                                        criterion: "9. Stakes",
                                                        winslow: { score: "8/10", text: "Often external: wars, missions, betrayals. Less interior vulnerability." },
                                                        meraw: { score: "10/10", text: "Unmatched emotional interiority. Readers feel Benjamin and Mike's humanity breaking—and surviving.", edge: "Edge: Cartel Babies" }
                                                    },
                                                    {
                                                        criterion: "10. Polish",
                                                        winslow: { score: "9/10", text: "Clean, confident, commercial prose." },
                                                        meraw: { score: "10/10", text: "Meticulously polished: cliché elimination, worldbuilding discipline, pattern reduction, dialogue refinement, body-beat control, atmospheric variation, interiority consistency.", edge: "Edge: Cartel Babies" }
                                                    }
                                                ].map((row, idx) => (
                                                    <tr key={idx} className={idx % 2 === 0 ? "bg-slate-50 hover:bg-slate-100" : "bg-white hover:bg-slate-50"}>
                                                        <td className="border border-slate-200 p-1 sm:p-4 font-semibold bg-slate-100 text-black text-[10px] sm:text-sm">{row.criterion}</td>
                                                        <td className="border border-slate-200 p-1 sm:p-4 text-black text-[10px] sm:text-sm">
                                                            <p className="font-semibold mb-2">Score: {row.winslow.score}</p>
                                                            <p>{row.winslow.text}</p>
                                                            {row.winslow.edge && <p className="text-purple-600 font-bold mt-2">{row.winslow.edge}</p>}
                                                        </td>
                                                        <td className="border border-slate-200 p-1 sm:p-4 text-black text-[10px] sm:text-sm">
                                                            <p className="font-semibold mb-2">Score: {row.meraw.score}</p>
                                                            <p>{row.meraw.text}</p>
                                                            {row.meraw.edge && <p className="text-purple-600 font-bold mt-2">{row.meraw.edge}</p>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Framing Statement */}
                            <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-50 to-purple-50">
                                <CardContent className="p-6 text-slate-700 content-text">
                                    <p className="text-center italic">
                                        This comparison demonstrates how a contemporary manuscript can be evaluated against established 
                                        genre benchmarks using a consistent craft framework. Scores reflect narrative structure, stylistic 
                                        execution, and design intent—not commercial success or author reputation.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Bottom Fair Use Disclaimer */}
                            <div className="mt-8 pt-8 border-t border-slate-200">
                                <p className="text-xs text-slate-500 text-center content-text">
                                    <strong>Fair Use Notice:</strong> This analysis is provided for educational and illustrative purposes only. 
                                    Cover images and referenced works are used for comparative commentary under fair use principles (17 U.S.C. § 107). 
                                    No affiliation, endorsement, or collaboration with Don Winslow or his publishers is claimed or implied. 
                                    All trademarks and copyrights belong to their respective owners. This page exists to demonstrate how 
                                    RevisionGrade™ evaluates manuscripts using consistent craft criteria, not to promote or compete with 
                                    the referenced author.
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Why These Examples Are Shown */}
                <Card className="mt-12 border-0 shadow-md bg-slate-50">
                    <CardContent className="p-6 text-center content-text">
                        <p className="text-sm text-slate-700 italic">
                            <strong>Why these examples are shown:</strong> These samples demonstrate the format, depth, and tone of RevisionGrade analyses. They do not expose scoring rules, internal weighting, or proprietary logic.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}