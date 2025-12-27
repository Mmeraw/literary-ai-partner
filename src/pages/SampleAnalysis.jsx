import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, AlertCircle } from 'lucide-react';

export default function SampleAnalysis() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Disclaimer Banner */}
                <div className="mb-8 p-4 rounded-lg bg-amber-50 border-2 border-amber-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-900">
                            <strong>Educational Purpose:</strong> This analysis is provided for educational and illustrative purposes only. 
                            Cover images and referenced works are used for comparative commentary under fair use. 
                            No affiliation or endorsement is implied.
                        </p>
                    </div>
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Comparative Craft Example
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Illustrative Comparative Craft Analysis
                    </h1>
                    <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                        Demonstrating how RevisionGrade™ evaluates manuscripts against established genre benchmarks
                    </p>
                    <p className="text-sm text-indigo-700 font-medium mt-3 max-w-3xl mx-auto">
                        This sample demonstrates the structure and depth of analysis available through RevisionGrade's comparative framework.
                    </p>
                </div>

                {/* Important Note */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Important Note (Scope + Intent)</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-700 space-y-3">
                        <p>
                            This document is a subjective, craft-based benchmarking study intended for educational and 
                            positioning purposes. It uses a consistent internal rubric to show how a manuscript can be 
                            mapped against recognizable genre patterns and one influential model of the form. It does not 
                            imply endorsement, affiliation, collaboration, or objective superiority.
                        </p>
                    </CardContent>
                </Card>

                {/* Why This Comparison Matters */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Why This Comparison Matters</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-700 space-y-3">
                        <p>
                            Don Winslow's <em>Cartel Trilogy</em> is widely considered the gold standard of cartel fiction, blending 
                            geopolitical scope, procedural detail, and decades of research. Agents, editors, and readers often use 
                            Winslow as the benchmark for evaluating narcoculture thrillers. <em>Cartel Babies</em> enters the same 
                            territory—but from a radically different angle: intimate, psychological, emotionally devastating, and 
                            driven by lived sensory realism. This report situates <em>Cartel Babies</em> within that landscape and 
                            demonstrates how it measures against one of the genre's most acclaimed bodies of work.
                        </p>
                    </CardContent>
                </Card>

                {/* Synopsis Section */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Cartel Babies Synopsis */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-xl">Synopsis – Cartel Babies</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-center">
                                <img 
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/cartel-babies-cover-thumb.jpg" 
                                    alt="Cartel Babies cover reference"
                                    className="w-40 h-auto rounded-lg shadow-md"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className="text-sm text-slate-700 space-y-3">
                                <p>
                                    All of Meraw's fiction unfolds within the interconnected <strong>EvØ-Myth Universe™</strong>. 
                                    His latest novel, <em>Cartel Babies</em>, is a 124,000-word, literary–commercial psychological thriller 
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
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/winslow-trilogy-thumb.jpg" 
                                    alt="Winslow trilogy cover reference"
                                    className="w-40 h-auto rounded-lg shadow-md"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className="text-sm text-slate-700 space-y-3">
                                <p>
                                    Winslow's acclaimed trilogy—<em>The Power of the Dog</em>, <em>The Cartel</em>, and <em>The Border</em>—follows 
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
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Methodology</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-700">
                        <p>
                            Scores (1–10) reflect a personal craft rubric used for internal benchmarking. They are not judgments 
                            of literary merit but tools for comparing narrative strategies, emotional effect, and structural execution 
                            across works.
                        </p>
                    </CardContent>
                </Card>

                {/* Comparative Analysis Table */}
                <Card className="mb-8 border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Comparative Craft Analysis</CardTitle>
                        <p className="text-sm text-slate-600 mt-2">
                            Below is a craft-based comparison across sixteen criteria commonly used by agents when evaluating 
                            high-stakes thrillers.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-indigo-600">
                                        <th className="border border-slate-300 p-3 text-left font-semibold text-white">Criteria</th>
                                        <th className="border border-slate-300 p-3 text-left font-semibold text-white">Don Winslow's Cartel Trilogy</th>
                                        <th className="border border-slate-300 p-3 text-left font-semibold text-white">Michael Meraw's Cartel Babies</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-700">
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">1. Hook (Opening)</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Begins with violence, setting, and drug-war stakes. Immediate stakes, professional propulsion, cinematic.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Opens with psychological immediacy, violence, captivity, trauma, and voice. Agents feel thrown into the story—with an intimacy Winslow does not use.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies (intimacy)</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">2. Voice</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Controlled, procedural, masculine, commercial. Not deep interior.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Lyrical, mythic, violent, intimate, emotional. A signature voice—rare in submissions—combining literary depth with relentless tension.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">3. Character Depth</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Large cast, archetypal clarity, well-defined, but sometimes emotionally distant.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Fewer characters, but deeper psychological excavation. Benjamin, Mike, Raúl, Oso, the boy—the interiority is more intimate, more human, more devastating.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">4. Conflict & Tension</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Master at macro-level conflict: governments, cartels, armies, operations.</p>
                                            <p className="text-slate-600 font-semibold mt-2">Edge: Tie (different strengths: scale vs. intimacy)</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Matches that intensity but in a compressed, claustrophobic, personal scale. Every scene is survival. Every choice is identity. The tension never drops—rare for debuts.</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">5. Thematic Resonance</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Corruption, war, power, policy, history. Strong but external.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Captivity, loyalty, moral corrosion, love under pressure, survival, identity, complicity. Themes strike the reader emotionally, not just intellectually.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">6. Pacing & Structure</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Cinematic pacing, occasionally sprawling due to trilogy scale.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Tight, relentless, clean. The 60+ WAVE Revision craft pass significantly tightened pacing and reduced bloat. Structure is elegant and agent-friendly.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">7. Dialogue & Subtext</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Functional, masculine, plot-driven. Subtext sometimes thin.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Subtext heavy. Dialogue leans on fear, silence, posture, implication. Tags removed, interiority sharpened, power dynamics layered.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">8. Worldbuilding & Immersion</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Large-scale geopolitical worldbuilding—armies, cartels, landscapes. Documentary-grade realism.</p>
                                            <p className="text-slate-600 font-semibold mt-2">Edge: Tie (Winslow = macro, Cartel Babies = micro)</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Micro-worldbuilding with surgical precision—ridge, compound, lab, pit, night lessons. Every sensory detail is immersive and lived.</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">9. Emotional Stakes</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 8/10</p>
                                            <p>Often external: wars, missions, betrayals. Less interior vulnerability.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Unmatched emotional interiority. Readers feel Benjamin and Mike's humanity breaking—and surviving.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">10. Line-Level Polish</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Clean, confident, commercial prose.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Meticulously polished: cliché elimination, worldbuilding discipline, pattern reduction, dialogue refinement, body-beat control, atmospheric variation, interiority consistency.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">11. Marketability</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Established commercial author with a large audience. Clear readership lane; strong demand history for macro-cartel epics.</p>
                                            <p className="text-slate-600 font-semibold mt-2">Edge: Cartel Trilogy (historical validation); Cartel Babies has strong upside with differentiated positioning.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Strong lane: captivity thriller + cartel realism + survival narrative + psychological intimacy.</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">12. "Would an Agent Keep Reading?"</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 9/10</p>
                                            <p>Yes, especially for <em>The Power of the Dog</em> as a debut—but it begins wide and procedural, not intimate.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>First 50 pages are immersive, terrifying, tender, original, clean, and propulsive. Agents will read past their stop time.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">13. Cinematic Adaptability</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Trilogy is built for film/TV and already adapted for series.</p>
                                            <p className="text-slate-600 font-semibold mt-2">Edge: Tie</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Clean three-act spine, set-piece scenes, tight cast, emotional arcs, and sensory immersion. Screen-adaptable and high-budget potential.</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">14. Franchise & Brand Expansion</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Demonstrated cross-media reach: major publisher support, international readership, and a television adaptation confirm strong franchise potential in practice.</p>
                                            <p className="text-slate-600 font-semibold mt-2">Edge: Tie (Winslow represents proven expansion; Cartel Babies represents designed expansion. They illustrate two different models of building a franchise.)</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Ecosystem of novel + transmedia + encyclopedia + companion hub + universe + screenplay pipeline positions the IP as franchise-capable, not just a single book. Engineered for expansion: shared universe design, companion ecosystem, and an explicit screenplay pipeline create multiple future story and format paths (conditional on consistent execution).</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-white">
                                        <td className="border border-slate-300 p-3 font-semibold">15. Authenticity / Realism</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Deep research; widely known for accuracy.</p>
                                            <p className="text-slate-600 font-semibold mt-2">Edge: Tie</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Field experience plus journalistic detail and lived sensory realism, framed ethically.</p>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="border border-slate-300 p-3 font-semibold">16. Emotional Aftershock</td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 8/10</p>
                                            <p>Readers admire the work but may not always ache.</p>
                                        </td>
                                        <td className="border border-slate-300 p-3">
                                            <p className="font-semibold mb-2">Score: 10/10</p>
                                            <p>Book leaves emotional residue; key scenes follow readers for days.</p>
                                            <p className="text-indigo-700 font-semibold mt-2">Edge: Cartel Babies</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Call to Action */}
                <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-purple-600 to-indigo-600">
                    <CardContent className="p-6 text-center text-white">
                        <p className="text-lg font-semibold mb-2">
                            Want to see how your manuscript compares?
                        </p>
                        <p className="text-purple-100">
                            Run your own analysis.
                        </p>
                    </CardContent>
                </Card>

                {/* Framing Statement */}
                <Card className="mb-8 border-0 shadow-md bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-6 text-slate-700">
                        <p className="text-center italic">
                            This comparison demonstrates how a contemporary manuscript can be evaluated against established 
                            genre benchmarks using a consistent craft framework. Scores reflect narrative structure, stylistic 
                            execution, and design intent—not commercial success or author reputation.
                        </p>
                    </CardContent>
                </Card>

                {/* Bottom Fair Use Disclaimer */}
                <div className="mt-12 pt-8 border-t border-slate-200">
                    <p className="text-xs text-slate-500 text-center">
                        <strong>Fair Use Notice:</strong> This analysis is provided for educational and illustrative purposes only. 
                        Cover images and referenced works are used for comparative commentary under fair use principles (17 U.S.C. § 107). 
                        No affiliation, endorsement, or collaboration with Don Winslow or his publishers is claimed or implied. 
                        All trademarks and copyrights belong to their respective owners. This page exists to demonstrate how 
                        RevisionGrade™ evaluates manuscripts using consistent craft criteria, not to promote or compete with 
                        the referenced author.
                    </p>
                </div>
            </div>
        </div>
    );
}