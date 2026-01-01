import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function RevisionViewer({ 
    originalText, 
    revisedText, 
    segments = [], 
    onApprove,
    outputType = "document",
    showApproval = true 
}) {
    const [approved, setApproved] = useState(false);

    const handleApprove = async () => {
        if (onApprove) {
            await onApprove();
        }
        setApproved(true);
        toast.success('Revision approved as new baseline');
    };

    const downloadClean = () => {
        const blob = new Blob([revisedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${outputType}_clean.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Clean output downloaded');
    };

    const downloadSideBySide = () => {
        let content = `SIDE-BY-SIDE COMPARISON\n${'='.repeat(60)}\n\n`;
        content += `ORIGINAL\n${'-'.repeat(60)}\n${originalText}\n\n`;
        content += `REVISED\n${'-'.repeat(60)}\n${revisedText}\n`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${outputType}_side_by_side.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Side-by-side report downloaded');
    };

    const downloadChangesOnly = () => {
        let content = `CHANGES ONLY\n${'='.repeat(60)}\n\n`;
        segments.forEach((seg, idx) => {
            content += `Change ${idx + 1}\n`;
            content += `Original: ${seg.original_text}\n`;
            content += `Revised:  ${seg.revised_text}\n\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${outputType}_changes_only.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Changes-only report downloaded');
    };

    const downloadDiagnostic = () => {
        let content = `DIAGNOSTIC REPORT\n${'='.repeat(60)}\n\n`;
        segments.forEach((seg, idx) => {
            content += `Change ${idx + 1}\n`;
            content += `Original: ${seg.original_text}\n`;
            content += `Revised:  ${seg.revised_text}\n`;
            content += `Reason:   ${seg.rationale || 'Improved clarity and precision'}\n`;
            if (seg.criteria_tag) {
                content += `Category: ${seg.criteria_tag}\n`;
            }
            content += `\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${outputType}_diagnostic.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Diagnostic report downloaded');
    };

    const highlightChanges = (text, original) => {
        if (!segments || segments.length === 0) return text;
        
        let result = text;
        segments.forEach(seg => {
            if (seg.revised_text && seg.revised_text !== seg.original_text) {
                result = result.replace(
                    seg.revised_text,
                    `<strong class="text-indigo-600 font-semibold">${seg.revised_text}</strong>`
                );
            }
        });
        return result;
    };

    return (
        <Card className="border-0 shadow-lg">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Revision Review</CardTitle>
                        {approved && (
                            <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                                <Check className="w-3 h-3 mr-1" />
                                Approved
                            </Badge>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={downloadClean}>
                            <Download className="w-4 h-4 mr-2" />
                            Clean Output
                        </Button>
                        <Button variant="outline" size="sm" onClick={downloadSideBySide}>
                            <FileText className="w-4 h-4 mr-2" />
                            Side-by-Side
                        </Button>
                        <Button variant="outline" size="sm" onClick={downloadChangesOnly}>
                            <FileText className="w-4 h-4 mr-2" />
                            Changes Only
                        </Button>
                        <Button variant="outline" size="sm" onClick={downloadDiagnostic}>
                            <FileText className="w-4 h-4 mr-2" />
                            Diagnostic
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="side-by-side" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="side-by-side">Side-by-Side</TabsTrigger>
                        <TabsTrigger value="changes">Changes Only</TabsTrigger>
                        <TabsTrigger value="rationale">Rationale</TabsTrigger>
                    </TabsList>

                    <TabsContent value="side-by-side" className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">
                            <strong>Bold text</strong> indicates what changed in this revision.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold text-slate-900 mb-2">Original</h4>
                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-[500px] overflow-y-auto">
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{originalText}</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-900 mb-2">Revised</h4>
                                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200 max-h-[500px] overflow-y-auto">
                                    <div 
                                        className="text-sm text-slate-700 whitespace-pre-wrap"
                                        dangerouslySetInnerHTML={{ __html: highlightChanges(revisedText, originalText) }}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="changes" className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">
                            Shows only the text that changed—nothing else.
                        </p>
                        <div className="space-y-3">
                            {segments.length === 0 ? (
                                <p className="text-slate-500 italic">No changes detected or segments not provided.</p>
                            ) : (
                                segments.map((seg, idx) => (
                                    <div key={idx} className="p-4 rounded-lg bg-white border border-slate-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline">Change {idx + 1}</Badge>
                                            {seg.criteria_tag && (
                                                <Badge className="bg-purple-100 text-purple-700">{seg.criteria_tag}</Badge>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-xs text-slate-500">Original:</span>
                                                <p className="text-sm text-slate-700">{seg.original_text}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-slate-500">Revised:</span>
                                                <p className="text-sm text-slate-900">
                                                    <strong className="text-indigo-600">{seg.revised_text}</strong>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="rationale" className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">
                            Understand why each change was made.
                        </p>
                        <div className="space-y-3">
                            {segments.length === 0 ? (
                                <p className="text-slate-500 italic">No rationale data available.</p>
                            ) : (
                                segments.map((seg, idx) => (
                                    <div key={idx} className="p-4 rounded-lg bg-white border border-slate-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Badge variant="outline">Change {idx + 1}</Badge>
                                            {seg.criteria_tag && (
                                                <Badge className="bg-emerald-100 text-emerald-700">{seg.criteria_tag}</Badge>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-600">Original:</span>
                                                <p className="text-sm text-slate-700 mt-1">{seg.original_text}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-semibold text-slate-600">Revised:</span>
                                                <p className="text-sm text-slate-900 mt-1">
                                                    <strong className="text-indigo-600">{seg.revised_text}</strong>
                                                </p>
                                            </div>
                                            <div className="pt-2 border-t border-slate-200">
                                                <span className="text-xs font-semibold text-slate-600">Reason:</span>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {seg.rationale || 'Improved clarity and precision'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {showApproval && !approved && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-slate-900">Approve This Revision</h4>
                                <p className="text-sm text-slate-600">This version will become your new baseline.</p>
                            </div>
                            <Button 
                                onClick={handleApprove}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Approve Revision
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}