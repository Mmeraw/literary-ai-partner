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
        name: "The Hook (First Page & First 5 Pages)", 
        icon: Zap,
        description: "Does the opening line pull the reader in immediately? Is there an immediate sense of intrigue, tension, or unique voice? Does it promise a compelling story worth following?",
        lookingFor: ["Immediate intrigue or tension", "Clear 'why should I keep reading' factor", "Compelling story promise", "Strong opening that hooks hard"],
        redFlags: ["Weak first 5 pages", "Slow openings", "No immediate hook", "Generic beginnings"]
    },
    { 
        name: "Voice & Narrative Style", 
        icon: Mic,
        description: "Is the voice distinct and engaging? Does it match the tone of the story? Does the prose feel fresh, vivid, and intentional?",
        lookingFor: ["Distinct, engaging voice", "Tone matches story", "Fresh, vivid, intentional prose", "Balance of poetic intensity and clarity"],
        redFlags: ["Generic phrasing", "Inconsistent voice", "Unclear or muddled tone"]
    },
    { 
        name: "Characters & Their Introductions", 
        icon: Users,
        description: "Does the reader get a visceral feel for characters early on? Do actions, dialogue, and thoughts show personalities and motivations? Are relationships charged with subtext?",
        lookingFor: ["Visceral character feel within 50 pages", "Actions/dialogue showing personality", "Charged relationships with power dynamics", "Real characters, not just plot roles"],
        redFlags: ["No reader connection early on", "Flat character intros", "Too much exposition vs. showing"]
    },
    { 
        name: "Conflict & Tension", 
        icon: Swords,
        description: "Is there strong driving tension in every scene? Do conflicts escalate forcing difficult choices? Is pacing balanced with organic tension?",
        lookingFor: ["Driving tension in every scene", "Escalating conflicts", "Difficult character choices", "Organic tension"],
        redFlags: ["Tension dips", "Forced conflict", "Sagging pacing", "Easy resolutions"]
    },
    { 
        name: "Thematic Resonance", 
        icon: Lightbulb,
        description: "Does the story explore deep, layered themes without being preachy? Do themes naturally weave into character actions?",
        lookingFor: ["Deep, layered themes", "Themes woven into actions", "Seamless integration", "Compelling undercurrents"],
        redFlags: ["Preachy themes", "Heavy-handed messaging", "Themes stated vs. shown"]
    },
    { 
        name: "Pacing & Structural Flow", 
        icon: Timer,
        description: "Does every chapter end with momentum? Are scenes tight and purposeful? Is there a good mix of fast high-stakes scenes and slower immersive moments?",
        lookingFor: ["Chapter endings with momentum", "Tight, purposeful scenes", "Good pace variety", "Page-turning quality"],
        redFlags: ["Meandering scenes", "Info dumps", "Pacing lags early", "No reason to turn page"]
    },
    { 
        name: "Dialogue & Subtext", 
        icon: MessageSquare,
        description: "Does dialogue sound authentic with distinct rhythms per character? Does it reveal more than it states? Are exchanges charged with unspoken meaning?",
        lookingFor: ["Authentic dialogue", "Distinct character rhythms", "Subtext-heavy exchanges", "Charged with unspoken meaning"],
        redFlags: ["Flat dialogue", "On-the-nose exposition", "Characters sound alike", "No subtext"]
    },
    { 
        name: "Worldbuilding & Immersion", 
        icon: Globe,
        description: "Is the world revealed organically? Do sensory details pull the reader in? Are unique elements established without overwhelming?",
        lookingFor: ["Organic world reveal", "Sensory immersion (all 5 senses)", "Lived-in atmosphere", "Layered details"],
        redFlags: ["Info dumps", "Overwhelming detail", "Told vs. shown world", "Set dressing only"]
    },
    { 
        name: "Stakes & Emotional Investment", 
        icon: Heart,
        description: "Is it clear what's at stake? Do we feel urgency in choices? Does the reader feel emotionally invested in character fate?",
        lookingFor: ["Clear stakes", "Urgency in choices", "Emotional investment", "Reader connection to fate"],
        redFlags: ["Unclear stakes", "No urgency", "No emotional connection", "Low investment"]
    },
    { 
        name: "Line-Level Polish (Micro-Edits)", 
        icon: Feather,
        description: "Is the prose tight, evocative, and polished? Is there unnecessary repetition? Does sentence rhythm match scene intensity?",
        lookingFor: ["Tight, evocative prose", "No redundancy", "Rhythm matches intensity", "Clean grammar and formatting"],
        redFlags: ["Bloated writing", "Repetition", "Grammar issues", "Messy prose"]
    },
    { 
        name: "Marketability & Genre Fit", 
        icon: TrendingUp,
        description: "Does the novel fit its genre while feeling fresh and original? Would an agent see clear comparative titles?",
        lookingFor: ["Genre fit", "Fresh and original", "Clear comp titles", "Marketable concept"],
        redFlags: ["Too niche", "Genre confusion", "Unmarketable", "No clear comps"]
    },
    { 
        name: "Overall 'Would an Agent Keep Reading?' Test", 
        icon: CheckCircle2,
        description: "At page 50, do we end on high tension or intrigue? Would an agent request more? Is there clear forward momentum?",
        lookingFor: ["High tension at page 50", "Compelling to request more", "Clear forward momentum", "All elements working together"],
        redFlags: ["No compulsion to continue", "Elements competing", "Momentum loss", "Not desperate to read more"]
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
                        Powered by the WAVE Revision System
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                        Evaluation Criteria
                    </h1>
                    <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
                        Understanding the standards that guide your Revision Grade
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