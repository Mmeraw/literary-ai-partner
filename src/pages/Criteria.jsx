import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
    BookOpen, Waves, Search, CheckCircle2, 
    Mic, Zap, Users, MessageSquare, Timer, 
    Globe, Swords, Eye, Heart, Feather, 
    Lightbulb, TrendingUp
} from 'lucide-react';
import { motion } from "framer-motion";

const LITERARY_AGENT_CRITERIA = [
    { 
        name: "Voice & Style", 
        icon: Mic,
        description: "The unique, distinctive way you tell your story. Agents look for authors who have found their authentic voice—one that's memorable and consistent throughout.",
        lookingFor: ["Distinctive narrative personality", "Consistent tone", "Original turns of phrase", "Authentic author presence"],
        redFlags: ["Generic or imitative style", "Inconsistent voice", "Overwriting or purple prose"]
    },
    { 
        name: "Opening Hook", 
        icon: Zap,
        description: "The ability to grab attention from the first line. Literary agents often decide within the first page whether to keep reading.",
        lookingFor: ["Immediate intrigue or tension", "Clear story promise", "Character introduction with stakes", "Active, engaging prose"],
        redFlags: ["Slow, meandering openings", "Info-dumps", "Passive descriptions", "Clichéd beginnings"]
    },
    { 
        name: "Character Development", 
        icon: Users,
        description: "Creating believable, multi-dimensional characters with clear motivations, flaws, and growth arcs that readers will care about.",
        lookingFor: ["Complex, flawed characters", "Clear motivations", "Authentic reactions", "Growth throughout story"],
        redFlags: ["Flat or stereotypical characters", "Inconsistent behavior", "Unclear motivations"]
    },
    { 
        name: "Dialogue", 
        icon: MessageSquare,
        description: "Natural, character-revealing conversation that advances the plot and reveals personality without exposition dumps.",
        lookingFor: ["Distinct character voices", "Subtext and tension", "Natural rhythm", "Plot/character advancement"],
        redFlags: ["On-the-nose dialogue", "All characters sound the same", "Unrealistic speech patterns"]
    },
    { 
        name: "Pacing", 
        icon: Timer,
        description: "The rhythm and momentum of your story—knowing when to speed up, slow down, and how to keep readers turning pages.",
        lookingFor: ["Appropriate scene lengths", "Tension escalation", "Breathing room between intensity", "Page-turner quality"],
        redFlags: ["Sagging middle", "Rushed climax", "Scenes that drag", "Unearned resolutions"]
    },
    { 
        name: "World Building", 
        icon: Globe,
        description: "Creating an immersive, coherent setting that feels lived-in and supports your story without overwhelming it.",
        lookingFor: ["Sensory immersion", "Internal logic", "Details woven naturally", "Setting as character"],
        redFlags: ["Info-dumps about setting", "Inconsistent rules", "Under or over-described worlds"]
    },
    { 
        name: "Conflict & Tension", 
        icon: Swords,
        description: "The engine of your story—compelling stakes, obstacles, and opposition that keep readers invested.",
        lookingFor: ["Clear stakes", "Escalating obstacles", "Internal and external conflict", "Meaningful opposition"],
        redFlags: ["Low stakes", "Easily solved problems", "Conflict for conflict's sake"]
    },
    { 
        name: "Show Don't Tell", 
        icon: Eye,
        description: "The craft of revealing character, emotion, and story through action and sensory detail rather than exposition.",
        lookingFor: ["Action reveals character", "Emotion through physicality", "Sensory engagement", "Trust in the reader"],
        redFlags: ["Emotional labeling", "Explaining motivations", "Summarizing instead of dramatizing"]
    },
    { 
        name: "Emotional Resonance", 
        icon: Heart,
        description: "The ability to make readers feel something—to create genuine emotional connection and response.",
        lookingFor: ["Earned emotional moments", "Universal themes", "Character vulnerability", "Authentic feeling"],
        redFlags: ["Melodrama", "Unearned emotions", "Emotional manipulation"]
    },
    { 
        name: "Prose Quality", 
        icon: Feather,
        description: "Clean, polished writing at the sentence level—precise word choice, varied structure, and professional craft.",
        lookingFor: ["Precise vocabulary", "Varied sentence structure", "Clean grammar", "Intentional style choices"],
        redFlags: ["Grammatical errors", "Repetitive structure", "Weak verbs", "Cluttered prose"]
    },
    { 
        name: "Originality", 
        icon: Lightbulb,
        description: "A fresh perspective, unique angle, or new take on familiar elements that sets your work apart.",
        lookingFor: ["Fresh premise or angle", "Unique voice", "Subverted expectations", "Personal perspective"],
        redFlags: ["Derivative plots", "Predictable twists", "Following trends too closely"]
    },
    { 
        name: "Market Readiness", 
        icon: TrendingUp,
        description: "The overall polish and professional quality that indicates a manuscript is ready for submission.",
        lookingFor: ["Professional formatting", "Genre awareness", "Appropriate length", "Submission-ready polish"],
        redFlags: ["Obvious first draft issues", "Genre confusion", "Unprofessional presentation"]
    }
];

const WAVE_REVISION_ITEMS = [
    { category: "Sentence Craft", items: ["Sentence variety", "Word economy", "Active voice", "Strong verbs", "Adverb reduction", "Precise nouns", "Rhythm and flow", "Opening sentences", "Closing sentences"] },
    { category: "Sensory & Detail", items: ["Visual details", "Auditory elements", "Tactile sensations", "Smell and taste", "Selective specificity", "Grounding details", "Environmental mood"] },
    { category: "Dialogue Craft", items: ["Character voice distinction", "Subtext presence", "Beat placement", "Tag variety", "Action integration", "Exposition avoidance", "Tension in conversation"] },
    { category: "Scene Structure", items: ["Scene goals", "Conflict presence", "Scene turns", "Entry point", "Exit timing", "Sequel balance", "Emotional arc"] },
    { category: "Character Work", items: ["Internal monologue", "Physical tells", "Consistent voice", "Motivation clarity", "Vulnerability moments", "Growth indicators", "Relationship dynamics"] },
    { category: "Pacing Elements", items: ["Scene length variety", "Tension escalation", "Breathing room", "Chapter hooks", "Mid-chapter momentum", "Transition smoothness"] },
    { category: "Technical Polish", items: ["POV consistency", "Tense consistency", "Filtering removal", "Crutch word elimination", "Punctuation precision", "Paragraph structure"] }
];

export default function Criteria() {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLiterary = LITERARY_AGENT_CRITERIA.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredWave = WAVE_REVISION_ITEMS.map(cat => ({
        ...cat,
        items: cat.items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
    })).filter(cat => cat.items.length > 0 || cat.category.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-purple-100 text-purple-700 border-purple-200">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Evaluation Framework
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                        Our Evaluation Criteria
                    </h1>
                    <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
                        Your manuscript is evaluated against these industry-standard criteria used by literary agents 
                        and our proprietary Wave Revision Guide
                    </p>
                </div>

                {/* Search */}
                <div className="max-w-md mx-auto mb-10">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Search criteria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-12 bg-white border-slate-200"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="literary" className="w-full">
                    <TabsList className="w-full max-w-md mx-auto bg-slate-100 p-1 mb-10">
                        <TabsTrigger value="literary" className="flex-1 data-[state=active]:bg-white">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Literary Agent (12)
                        </TabsTrigger>
                        <TabsTrigger value="wave" className="flex-1 data-[state=active]:bg-white">
                            <Waves className="w-4 h-4 mr-2" />
                            Wave Revision (60+)
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="literary">
                        <div className="grid md:grid-cols-2 gap-6">
                            {filteredLiterary.map((criterion, idx) => (
                                <motion.div
                                    key={criterion.name}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Card className="h-full border-0 shadow-md hover:shadow-lg transition-shadow bg-white/90">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0">
                                                    <criterion.icon className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg text-slate-800">{criterion.name}</CardTitle>
                                                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                                        {criterion.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
                                                        What Agents Look For
                                                    </span>
                                                    <ul className="mt-2 space-y-1">
                                                        {criterion.lookingFor.map((item, i) => (
                                                            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                                {item}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-medium text-rose-600 uppercase tracking-wide">
                                                        Red Flags
                                                    </span>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {criterion.redFlags.map((flag, i) => (
                                                            <Badge key={i} variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200">
                                                                {flag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="wave">
                        <div className="space-y-8">
                            {filteredWave.map((category, idx) => (
                                <motion.div
                                    key={category.category}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                >
                                    <Card className="border-0 shadow-md bg-white/90">
                                        <CardHeader>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                                                    <Waves className="w-4 h-4 text-white" />
                                                </div>
                                                <CardTitle className="text-lg text-slate-800">{category.category}</CardTitle>
                                                <Badge variant="outline" className="ml-auto">
                                                    {category.items.length} items
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-2">
                                                {category.items.map((item, i) => (
                                                    <Badge 
                                                        key={i} 
                                                        className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 transition-colors cursor-default"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3 mr-1.5 text-purple-500" />
                                                        {item}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}