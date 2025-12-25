import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Award, BookOpen } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function ScoreCard({ title, score, icon: Icon, description, color = "indigo" }) {
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

    const getScoreLabel = (score) => {
        if (score >= 90) return "Exceptional";
        if (score >= 80) return "Strong";
        if (score >= 70) return "Good";
        if (score >= 60) return "Developing";
        return "Needs Work";
    };

    return (
        <Card className="border-0 shadow-md bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2.5 rounded-xl",
                            color === "indigo" && "bg-indigo-100",
                            color === "purple" && "bg-purple-100",
                            color === "emerald" && "bg-emerald-100"
                        )}>
                            <Icon className={cn(
                                "w-5 h-5",
                                color === "indigo" && "text-indigo-600",
                                color === "purple" && "text-purple-600",
                                color === "emerald" && "text-emerald-600"
                            )} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">{title}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={cn("text-3xl font-bold", getScoreColor(score))}>{score}</span>
                        <span className="text-slate-400 text-sm">/100</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Progress 
                        value={score} 
                        className="h-2 bg-slate-100"
                        indicatorClassName={getProgressColor(score)}
                    />
                    <div className="flex justify-between items-center">
                        <span className={cn("text-xs font-medium", getScoreColor(score))}>
                            {getScoreLabel(score)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                            <TrendingUp className="w-3 h-3" />
                            Industry Standard: 75+
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}