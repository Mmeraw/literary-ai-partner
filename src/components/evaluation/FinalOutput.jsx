import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Copy, CheckCircle2, FileText, RotateCcw, Save, Edit } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function FinalOutput({ title, originalText, evaluationResult, submission, onReset }) {
    const [revisedText, setRevisedText] = React.useState(originalText);
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await base44.entities.Submission.update(submission.id, {
                revised_text: revisedText,
                status: 'finalized'
            });
            toast.success('Saved successfully');
        } catch (error) {
            toast.error('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(revisedText);
        toast.success('Copied to clipboard');
    };

    const handleDownload = () => {
        const blob = new Blob([revisedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_')}_revised.txt`;
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
                            <Edit className="w-5 h-5 text-white" />
                        </div>
                        Edit & Finalize
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-700">
                        Score: {evaluationResult?.overall_score}/10
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">
                    Edit your manuscript based on the evaluation feedback, then save or export the final version.
                </p>

                <Textarea
                    value={revisedText}
                    onChange={(e) => setRevisedText(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Edit your revised manuscript here..."
                />

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isSaving ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Revision
                            </>
                        )}
                    </Button>
                    <Button 
                        onClick={handleCopy}
                        variant="outline"
                        className="flex-1"
                    >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                    </Button>
                    <Button 
                        onClick={handleDownload}
                        variant="outline"
                        className="flex-1"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                    </Button>
                </div>

                <Button 
                    onClick={onReset}
                    variant="ghost"
                    className="w-full"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start New Submission
                </Button>
            </CardContent>
        </Card>
    );
}