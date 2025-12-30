import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STYLE_MODES = [
    {
        value: "neutral",
        label: "Neutral / Industry Standard",
        description: "Baseline agent expectations—mainstream commercial fiction"
    },
    {
        value: "staccato",
        label: "Staccato / Compressed",
        description: "Short lines, fragments, rupture—rhythm and pressure prioritized"
    },
    {
        value: "lyrical",
        label: "Lyrical / Expansive",
        description: "Longer sentences, metaphor-rich—clarity at paragraph/scene level"
    },
    {
        value: "documentary",
        label: "Documentary / Procedural",
        description: "Precision-first, low metaphor—strong clarity enforcement"
    },
    {
        value: "hybrid",
        label: "Hybrid (Advanced)",
        description: "Dominant mode + controlled drift for mixed registers"
    },
    {
        value: "transgressive",
        label: "Transgressive (Authorial Intent)",
        description: "Dark realism, grotesque, extremity—evaluates precision & control, not politeness. No sanitization."
    },
    {
        value: "trauma_memoir",
        label: "Trauma Memoir / Testimony",
        description: "Survivor narrative—respects psychological accuracy & embodied truth"
    }
];

export default function StyleModeSelector({ value, onChange }) {
    const selectedMode = STYLE_MODES.find(m => m.value === value);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Style Mode</label>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="w-4 h-4 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                                Style Mode adjusts how strictly RevisionGrade enforces rhythm, fragmentation, 
                                and sentence shape. The standards stay the same; the acceptable expression 
                                of them changes by style.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select style mode" />
                </SelectTrigger>
                <SelectContent>
                    {STYLE_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                            <div className="flex flex-col">
                                <span className="font-medium">{mode.label}</span>
                                <span className="text-xs text-slate-500">{mode.description}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedMode && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                    <p className="text-xs text-indigo-800">
                        <strong>{selectedMode.label}:</strong> {selectedMode.description}
                    </p>
                </div>
            )}
        </div>
    );
}