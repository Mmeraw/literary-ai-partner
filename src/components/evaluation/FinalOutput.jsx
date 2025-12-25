import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Copy, CheckCircle2, FileText, RotateCcw } from 'lucide-react';
import { toast } from "sonner";

export default function FinalOutput({ originalText, suggestions, onReset }) {
    const buildFinalText = () => {
        // Simple reconstruction - in production would be more sophisticated
        let finalText = originalText;
        
        const acceptedSuggestions = suggestions
            .filter(s => s.status === 'accepted')
            .sort((a, b) => (b.segment_index || 0) - (a.segment_index || 0));

        acceptedSuggestions.forEach(suggestion => {
            if (suggestion.action === 'delete') {
                finalText = finalText.replace(suggestion.original_segment, '');
            } else if (suggestion.action === 'replace' && suggestion.replacement_text) {
                finalText = finalText.replace(suggestion.original_segment, suggestion.replacement_text);
            }
        });

        // Clean up extra whitespace
        finalText = finalText.replace(/\s+/g, ' ').trim();
        return finalText;
    };

    const finalText = buildFinalText();
    const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
    const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(finalText);
        toast.success('Copied to clipboard');
    };

    const handleDownload = () => {
        const blob = new Blob([finalText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'revised-manuscript.txt';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded successfully');
    };

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-lg font-medium text-slate-800">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                        Finalized Manuscript
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700">
                            {acceptedCount} Accepted
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-600">
                            {rejectedCount} Rejected
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-6 rounded-xl bg-white border border-emerald-100 shadow-inner">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {finalText}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                        onClick={handleCopy}
                        variant="outline"
                        className="flex-1"
                    >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                    </Button>
                    <Button 
                        onClick={handleDownload}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download as Text
                    </Button>
                    <Button 
                        onClick={onReset}
                        variant="outline"
                        className="flex-1"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        New Submission
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}