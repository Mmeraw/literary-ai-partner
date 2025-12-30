import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const languageVariants = [
    { value: 'en-US', label: 'US English', description: 'American spelling and conventions' },
    { value: 'en-UK', label: 'UK English', description: 'British spelling and conventions' },
    { value: 'en-CA', label: 'Canadian English', description: 'Canadian spelling (mix of US/UK)' },
    { value: 'en-AU', label: 'Australian English', description: 'Australian spelling and conventions' },
];

export default function LanguageVariantSelector({ value, onChange }) {
    const selectedVariant = languageVariants.find(v => v.value === value);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Label htmlFor="language-variant" className="text-sm font-medium text-slate-700">
                    English Variant
                </Label>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="w-4 h-4 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                                Choose your target English variant. The system will enforce consistency 
                                and only flag inconsistencies within your chosen variant (e.g., "color" 
                                vs "colour" in US English).
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id="language-variant" className="w-full">
                    <SelectValue placeholder="Select English variant" />
                </SelectTrigger>
                <SelectContent>
                    {languageVariants.map((variant) => (
                        <SelectItem key={variant.value} value={variant.value}>
                            <div className="flex flex-col items-start">
                                <span className="font-medium">{variant.label}</span>
                                <span className="text-xs text-slate-500">{variant.description}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedVariant && (
                <p className="text-xs text-slate-600">
                    <strong>Selected:</strong> {selectedVariant.label} — {selectedVariant.description}
                </p>
            )}
        </div>
    );
}