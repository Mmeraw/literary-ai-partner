import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Waves, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

const LITERARY_AGENT_CRITERIA = [
    { name: "Voice & Style", description: "Unique authorial voice and consistent writing style" },
    { name: "Opening Hook", description: "Compelling first lines that grab attention" },
    { name: "Character Development", description: "Well-rounded, believable characters with clear motivations" },
    { name: "Dialogue", description: "Natural, distinct dialogue that reveals character" },
    { name: "Pacing", description: "Appropriate rhythm and momentum throughout" },
    { name: "World Building", description: "Immersive, coherent setting details" },
    { name: "Conflict & Tension", description: "Compelling stakes and narrative tension" },
    { name: "Show Don't Tell", description: "Active demonstration vs passive explanation" },
    { name: "Emotional Resonance", description: "Ability to evoke genuine reader emotion" },
    { name: "Prose Quality", description: "Clean, polished sentence construction" },
    { name: "Originality", description: "Fresh perspective or unique angle" },
    { name: "Market Readiness", description: "Polish level suitable for submission" }
];

export default function CriteriaPanel({ scores, category = "all" }) {
    const getScoreColor = (score) => {
        if (score >= 80) return "text-emerald-600";
        if (score >= 60) return "text-amber-600";
        return "text-rose-600";
    };

    const getProgressColor = (score) => {
        if (score >= 80) return "bg-emerald-500";
        if (score >= 60) return "bg-amber-500";
        return "bg-rose-500";
    };

    const getStatusIcon = (score) => {
        if (score >= 70) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
    };

    const renderCriteriaList = (criteria, scoreData) => (
        <div className="space-y-3">
            {criteria.map((criterion, idx) => {
                const score = scoreData?.[criterion.name.toLowerCase().replace(/\s+/g, '_')] || 0;
                return (
                    <div 
                        key={idx}
                        className="p-4 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-all"
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {getStatusIcon(score)}
                                <span className="font-medium text-slate-800">{criterion.name}</span>
                            </div>
                            <span className={cn("font-bold", getScoreColor(score))}>{score}</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{criterion.description}</p>
                        <Progress 
                            value={score} 
                            className="h-1.5 bg-slate-100"
                            indicatorClassName={getProgressColor(score)}
                        />
                    </div>
                );
            })}
        </div>
    );

    return (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-medium text-slate-800">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                        <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    Evaluation Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="literary" className="w-full">
                    <TabsList className="w-full bg-slate-100 p-1">
                        <TabsTrigger value="literary" className="flex-1">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Literary Agent (12)
                        </TabsTrigger>
                        <TabsTrigger value="wave" className="flex-1">
                            <Waves className="w-4 h-4 mr-2" />
                            Wave Revision (60+)
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="literary" className="mt-4">
                        <ScrollArea className="h-[400px] pr-4">
                            {renderCriteriaList(LITERARY_AGENT_CRITERIA, scores?.literary_agent_scores)}
                        </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="wave" className="mt-4">
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="text-center py-8 text-slate-500">
                                <Waves className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-sm">Wave Revision Guide criteria will be applied during evaluation</p>
                                <p className="text-xs mt-2">60+ items covering craft, technique, and polish</p>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}