import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileText, FileEdit, MessageSquare } from 'lucide-react';
import { toast } from "sonner";

export default function DownloadOptions({ session }) {
    const [open, setOpen] = useState(false);

    const generateCleanDownload = () => {
        const blob = new Blob([session.current_text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.title}_clean.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded clean manuscript');
        setOpen(false);
    };

    const generateTrackChangesDownload = () => {
        let output = `${session.title} - Track Changes\n`;
        output += `${'='.repeat(60)}\n\n`;

        const acceptedChanges = session.suggestions.filter(s => s.status === 'accepted');
        const rejectedChanges = session.suggestions.filter(s => s.status === 'rejected');

        output += `Summary:\n`;
        output += `- Accepted Changes: ${acceptedChanges.length}\n`;
        output += `- Rejected Changes: ${rejectedChanges.length}\n`;
        output += `- Total Suggestions: ${session.suggestions.length}\n\n`;
        output += `${'='.repeat(60)}\n\n`;

        session.suggestions.forEach((suggestion, idx) => {
            output += `\n[CHANGE ${idx + 1}] ${suggestion.wave_name}\n`;
            output += `Status: ${suggestion.status.toUpperCase()}\n`;
            output += `${'-'.repeat(60)}\n\n`;

            output += `ORIGINAL:\n`;
            output += `${suggestion.original_text}\n\n`;

            if (suggestion.status === 'accepted') {
                output += `REVISED TO:\n`;
                output += `${suggestion.suggested_text}\n\n`;
            } else {
                output += `SUGGESTED CHANGE (NOT APPLIED):\n`;
                output += `${suggestion.suggested_text}\n\n`;
            }

            output += `WHY FLAGGED:\n`;
            output += `${suggestion.why_flagged}\n\n`;

            output += `WHY THIS FIX:\n`;
            output += `${suggestion.why_this_fix}\n\n`;

            output += `${'='.repeat(60)}\n`;
        });

        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.title}_track_changes.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded with track changes');
        setOpen(false);
    };

    const generateCommentaryDownload = () => {
        let output = `${session.title} - Editorial Commentary\n`;
        output += `${'='.repeat(60)}\n\n`;

        output += `FINAL REVISED TEXT:\n\n`;
        output += `${session.current_text}\n\n`;
        output += `${'='.repeat(60)}\n`;
        output += `${'='.repeat(60)}\n\n`;
        output += `EDITORIAL COMMENTARY\n`;
        output += `Revision notes and explanations for each change\n\n`;
        output += `${'='.repeat(60)}\n\n`;

        session.suggestions.forEach((suggestion, idx) => {
            if (suggestion.status === 'accepted') {
                output += `\n[COMMENT ${idx + 1}] ${suggestion.wave_name}\n`;
                output += `${'-'.repeat(60)}\n`;
                output += `Location: "${suggestion.original_text.substring(0, 60)}..."\n\n`;
                output += `Issue:\n${suggestion.why_flagged}\n\n`;
                output += `Solution:\n${suggestion.why_this_fix}\n\n`;
                output += `Changed From:\n"${suggestion.original_text}"\n\n`;
                output += `Changed To:\n"${suggestion.suggested_text}"\n\n`;
                output += `${'='.repeat(60)}\n`;
            }
        });

        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.title}_with_commentary.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded with editorial commentary');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Options
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Download Options</DialogTitle>
                    <p className="text-sm text-slate-600 mt-2">
                        Clean downloads contain no markup or comments and are submission-ready.
                    </p>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Clean Version - PRIMARY */}
                    <div 
                        className="p-4 rounded-lg border-2 border-indigo-500 bg-indigo-50/70 hover:border-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer shadow-sm"
                        onClick={generateCleanDownload}
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-indigo-600">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                    Clean Revised Document
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white">Recommended</span>
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Submission-ready text with accepted revisions applied. No markup or comments.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Revision History */}
                    <div 
                        className="p-4 rounded-lg border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all cursor-pointer"
                        onClick={generateTrackChangesDownload}
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-amber-100">
                                <FileEdit className="w-6 h-6 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-900 mb-1">
                                    Revision History Report
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Side-by-side comparison showing original and revised text for every change. Designed for review and learning—not for submission.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Editorial Commentary */}
                    <div 
                        className="p-4 rounded-lg border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer"
                        onClick={generateCommentaryDownload}
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-emerald-100">
                                <MessageSquare className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-900 mb-1">
                                    Editorial Commentary
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Final text with detailed notes explaining revision decisions and priorities.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-slate-500 p-4 bg-slate-50 rounded-lg">
                    <p className="mb-2"><strong>Note:</strong> All downloads are in plain text (.txt) format. You can copy/paste into your preferred word processor.</p>
                    <p className="text-slate-400 italic">RevisionGrade evaluates readiness and revision strategy; it does not export Microsoft Word track-changes files.</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}