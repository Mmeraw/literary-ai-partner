import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Check, X, RefreshCw, ChevronDown, ChevronUp, 
    Sparkles, Trash2, Replace, BookmarkCheck,
    Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function SuggestionCard({ 
    suggestion, 
    onAccept, 
    onReject, 
    onRequestAlternatives,
    isLoading 
}) {
    const [expanded, setExpanded] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(false);

    const actionConfig = {
        keep: { 
            icon: BookmarkCheck, 
            color: "bg-emerald-100 text-emerald-700 border-emerald-200",
            label: "Keep As-Is"
        },
        replace: { 
            icon: Replace, 
            color: "bg-amber-100 text-amber-700 border-amber-200",
            label: "Replace"
        },
        delete: { 
            icon: Trash2, 
            color: "bg-rose-100 text-rose-700 border-rose-200",
            label: "Delete"
        }
    };

    const config = actionConfig[suggestion.action];
    const ActionIcon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
        >
            <Card className={cn(
                "border shadow-sm transition-all duration-300",
                suggestion.status === 'accepted' && "border-emerald-200 bg-emerald-50/50",
                suggestion.status === 'rejected' && "border-rose-200 bg-rose-50/50 opacity-60",
                suggestion.status === 'pending' && "border-slate-200 bg-white hover:shadow-md"
            )}>
                <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <Badge className={cn("font-medium", config.color)}>
                                <ActionIcon className="w-3 h-3 mr-1.5" />
                                {config.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-slate-500">
                                {suggestion.ai_source === 'analyst_1' ? 'AI Analyst 1' : 'AI Analyst 2'}
                            </Badge>
                        </div>
                        {suggestion.status === 'pending' && (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onAccept(suggestion)}
                                    className="h-8 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                >
                                    <Check className="w-4 h-4 mr-1" />
                                    Accept
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onReject(suggestion)}
                                    className="h-8 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                    <X className="w-4 h-4 mr-1" />
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onRequestAlternatives(suggestion)}
                                    disabled={isLoading}
                                    className="h-8 px-3 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-1" />
                                            Alternatives
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                        {suggestion.status !== 'pending' && (
                            <Badge 
                                className={cn(
                                    suggestion.status === 'accepted' && "bg-emerald-500",
                                    suggestion.status === 'rejected' && "bg-rose-500"
                                )}
                            >
                                {suggestion.status === 'accepted' ? 'Accepted' : 'Rejected'}
                            </Badge>
                        )}
                    </div>

                    {/* Original Text */}
                    <div className="space-y-3">
                        <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Original</span>
                            <p className={cn(
                                "mt-1 p-3 rounded-lg bg-slate-50 text-slate-700 text-sm leading-relaxed",
                                suggestion.action === 'delete' && "line-through text-slate-400"
                            )}>
                                "{suggestion.original_segment}"
                            </p>
                        </div>

                        {suggestion.action === 'replace' && suggestion.replacement_text && (
                            <div>
                                <span className="text-xs font-medium text-amber-600 uppercase tracking-wide flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Suggested Replacement
                                </span>
                                <p className="mt-1 p-3 rounded-lg bg-amber-50 border border-amber-100 text-slate-700 text-sm leading-relaxed">
                                    "{suggestion.replacement_text}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Reasoning Toggle */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-2 mt-4 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {expanded ? "Hide" : "Show"} reasoning & criteria
                    </button>

                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 p-4 rounded-lg bg-slate-50 space-y-3">
                                    <div>
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Reasoning</span>
                                        <p className="mt-1 text-sm text-slate-600">{suggestion.reasoning}</p>
                                    </div>
                                    {suggestion.criteria_referenced?.length > 0 && (
                                        <div>
                                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Criteria Referenced</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {suggestion.criteria_referenced.map((criterion, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs bg-white">
                                                        {criterion}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Alternatives */}
                    {suggestion.alternatives?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setShowAlternatives(!showAlternatives)}
                                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {suggestion.alternatives.length} Alternative Suggestions
                                {showAlternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <AnimatePresence>
                                {showAlternatives && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-3 space-y-2">
                                            {suggestion.alternatives.map((alt, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                                                    <span className="text-xs font-medium text-indigo-600 mt-0.5">#{idx + 1}</span>
                                                    <p className="text-sm text-slate-700 flex-1">"{alt}"</p>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onAccept({ ...suggestion, replacement_text: alt })}
                                                        className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}