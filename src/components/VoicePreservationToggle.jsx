import React from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const voiceModes = [
    {
        value: 'maximum',
        label: 'Maximum Preservation',
        description: 'Minimal changes. Only structural or critical clarity issues flagged. Voice, rhythm, and idiomatic language stay intact.',
        color: 'text-green-700'
    },
    {
        value: 'balanced',
        label: 'Balanced',
        description: 'Standard editorial approach. Voice is preserved, but clarity and pacing improvements are suggested where they strengthen narrative function.',
        color: 'text-indigo-700'
    },
    {
        value: 'polish',
        label: 'Polish-Focused',
        description: 'More aggressive refinement for submission readiness. Voice is still respected, but stylistic tightening is prioritized.',
        color: 'text-purple-700'
    }
];

export default function VoicePreservationToggle({ value = 'balanced', onChange, className = '' }) {
    const selectedMode = voiceModes.find(m => m.value === value) || voiceModes[1];

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <Label htmlFor="voice-preservation" className="text-sm font-medium text-slate-700">
                    Voice Preservation Level
                </Label>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button type="button" className="text-slate-400 hover:text-slate-600">
                                <Info className="w-4 h-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p className="text-xs">
                                Voice is treated as intentional craft. Dialogue is preserved. 
                                Choose how aggressively you want clarity and polish suggestions.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id="voice-preservation" className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {voiceModes.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                            <div className="flex flex-col gap-1 py-1">
                                <span className={`font-medium ${mode.color}`}>{mode.label}</span>
                                <span className="text-xs text-slate-600 leading-tight">{mode.description}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-600 leading-relaxed">
                    <strong className={selectedMode.color}>{selectedMode.label}:</strong> {selectedMode.description}
                </p>
            </div>
        </div>
    );
}