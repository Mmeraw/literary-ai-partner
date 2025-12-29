import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, Info, Check, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ThoughtTagCard({ suggestion, onApply }) {
    const [expanded, setExpanded] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [previewText, setPreviewText] = useState(null);

    const handleSelectOption = (option) => {
        setSelectedOption(option);
        
        // Set preview text
        if (option === 'delete') {
            setPreviewText(suggestion.original.replace(suggestion.detected, '').trim());
        } else if (option === 'freeIndirect') {
            setPreviewText(suggestion.freeIndirect);
        } else if (option === 'externalize') {
            setPreviewText(suggestion.externalize.text);
        }
    };

    const handleApply = () => {
        if (onApply && selectedOption) {
            onApply({
                original: suggestion.original,
                replacement: previewText,
                option: selectedOption
            });
        }
    };

    return (
        <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500 text-white">WAVE 1: Interior Attribution</Badge>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button className="text-amber-600 hover:text-amber-700">
                                        <Info className="w-4 h-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p className="text-sm">{suggestion.rationale}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-slate-500 hover:text-slate-700"
                    >
                        <ChevronDown className={cn(
                            "w-5 h-5 transition-transform",
                            expanded && "rotate-180"
                        )} />
                    </button>
                </div>

                {/* Original text */}
                <div className="mb-3">
                    <span className="text-xs font-medium text-slate-600">Original:</span>
                    <p className="text-sm text-slate-700 italic mt-1">
                        "{suggestion.original}"
                    </p>
                    <span className="text-xs text-amber-600 font-medium">
                        Detected: <code className="bg-amber-100 px-1 rounded">{suggestion.detected}</code>
                    </span>
                </div>

                {expanded && (
                    <div className="space-y-3 mt-4">
                        {/* Option 1: Delete */}
                        {suggestion.canDelete && (
                            <button
                                onClick={() => handleSelectOption('delete')}
                                className={cn(
                                    "w-full p-3 rounded-lg border-2 text-left transition-all",
                                    selectedOption === 'delete'
                                        ? "border-emerald-500 bg-emerald-50"
                                        : "border-slate-200 bg-white hover:border-emerald-300"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <span className="font-medium text-slate-900">Delete</span>
                                        <p className="text-xs text-slate-600 mt-1">POV is clear without the tag</p>
                                    </div>
                                    {selectedOption === 'delete' && (
                                        <Check className="w-5 h-5 text-emerald-600" />
                                    )}
                                </div>
                            </button>
                        )}

                        {/* Option 2: Free Indirect */}
                        <button
                            onClick={() => handleSelectOption('freeIndirect')}
                            className={cn(
                                "w-full p-3 rounded-lg border-2 text-left transition-all",
                                selectedOption === 'freeIndirect'
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-slate-200 bg-white hover:border-indigo-300"
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <span className="font-medium text-slate-900">Free Indirect</span>
                                    <p className="text-xs text-slate-600 mt-1">Rewrite using free indirect discourse</p>
                                    {selectedOption === 'freeIndirect' && (
                                        <p className="text-sm text-slate-700 mt-2 italic">
                                            "{suggestion.freeIndirect}"
                                        </p>
                                    )}
                                </div>
                                {selectedOption === 'freeIndirect' && (
                                    <Check className="w-5 h-5 text-indigo-600" />
                                )}
                            </div>
                        </button>

                        {/* Option 3: Externalize */}
                        <button
                            onClick={() => handleSelectOption('externalize')}
                            className={cn(
                                "w-full p-3 rounded-lg border-2 text-left transition-all",
                                selectedOption === 'externalize'
                                    ? "border-purple-500 bg-purple-50"
                                    : "border-slate-200 bg-white hover:border-purple-300"
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <span className="font-medium text-slate-900">
                                        Externalize ({suggestion.externalize.type})
                                    </span>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Show through {suggestion.externalize.type}
                                    </p>
                                    {selectedOption === 'externalize' && (
                                        <p className="text-sm text-slate-700 mt-2 italic">
                                            "{suggestion.externalize.text}"
                                        </p>
                                    )}
                                </div>
                                {selectedOption === 'externalize' && (
                                    <Check className="w-5 h-5 text-purple-600" />
                                )}
                            </div>
                        </button>

                        {/* Action Buttons */}
                        {selectedOption && (
                            <div className="flex gap-2 pt-3">
                                <Button
                                    onClick={handleApply}
                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Apply This Change
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedOption(null);
                                        setPreviewText(null);
                                        setExpanded(false);
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {!expanded && (
                    <p className="text-xs text-slate-500 mt-2">
                        Click to view {suggestion.canDelete ? '3' : '2'} revision options
                    </p>
                )}
            </CardContent>
        </Card>
    );
}