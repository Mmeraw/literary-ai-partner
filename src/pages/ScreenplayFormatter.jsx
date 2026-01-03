import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Loader2, Download, Sparkles, ArrowRight, Copy, ChevronDown } from 'lucide-react';
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TransgressiveModeSelector from '@/components/evaluation/TransgressiveModeSelector';
import VoicePreservationToggle from '@/components/VoicePreservationToggle';
import RichTextEditor from '@/components/RichTextEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ScreenplayFormatter() {
    const [inputText, setInputText] = useState(sessionStorage.getItem('uploadedText') || '');
    const [formattedText, setFormattedText] = useState('');
    const [evaluationMode, setEvaluationMode] = useState('standard');
    const [voicePreservation, setVoicePreservation] = useState('balanced');
    const [isFormatting, setIsFormatting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Clear sessionStorage after loading
    React.useEffect(() => {
        if (sessionStorage.getItem('uploadedText')) {
            sessionStorage.removeItem('uploadedText');
        }
    }, []);

    const handleFormat = async () => {
        if (!inputText.trim()) {
            toast.error('Please paste text to format');
            return;
        }

        setIsFormatting(true);

        try {
            const { data } = await base44.functions.invoke('formatScreenplay', {
                text: inputText,
                mode: null, // Always auto-detect
                voicePreservation: voicePreservation
            });

            setFormattedText(data.formatted_text);
            
            // Show what was detected
            const detectionMsg = data.detected_format 
                ? `Detected ${data.detected_format} — converted to screenplay format`
                : 'Converted to screenplay format';
            toast.success(detectionMsg);
            
            // Show confidence note if low
            if (data.confidence && data.confidence < 0.95) {
                toast.info('Format inferred automatically — review recommended', { duration: 5000 });
            }
        } catch (error) {
            console.error('Format error:', error);
            toast.error('Failed to format. Please try again.');
        } finally {
            setIsFormatting(false);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([formattedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'formatted_screenplay.txt';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Screenplay downloaded');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedText);
        toast.success('Copied to clipboard');
    };

    const handleSendToEvaluation = () => {
        sessionStorage.setItem('screenplay_text', formattedText);
        sessionStorage.setItem('screenplay_mode', evaluationMode);
        window.location.href = createPageUrl('Evaluate');
    };

    // Strip HTML tags for word count
    const plainText = inputText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    const wordCount = plainText.split(/\s+/).filter(w => w).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
                        <Film className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Screenplay Formatter</h1>
                    <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
                        Convert any narrative text into industry-standard screenplay format. No setup required.
                    </p>
                    <Badge className="mt-3 bg-purple-100 text-purple-700 border-purple-200">
                        WriterDuet Industry Standards
                    </Badge>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Input */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Input Text</span>
                                <span className="text-sm text-slate-500">{wordCount} words</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RichTextEditor
                                value={inputText}
                                onChange={setInputText}
                                placeholder="Paste any narrative text — novel chapters, scenes, or rough screenplay drafts.&#10;We'll detect the format and convert it automatically."
                                minHeight="500px"
                            />
                            
                            {/* Advanced Options (Collapsed) */}
                            <div className="mt-4">
                                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" className="w-full justify-between text-sm text-slate-600">
                                            Advanced options
                                            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-3 space-y-4">
                                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                                            <TransgressiveModeSelector 
                                                value={evaluationMode}
                                                onChange={setEvaluationMode}
                                            />
                                        </div>
                                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                                            <VoicePreservationToggle 
                                                value={voicePreservation}
                                                onChange={setVoicePreservation}
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>

                            <div className="mt-4">
                                <Button
                                    onClick={handleFormat}
                                    disabled={isFormatting || !inputText.trim()}
                                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                >
                                    {isFormatting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Converting...
                                        </>
                                    ) : (
                                        <>
                                            <Film className="w-5 h-5 mr-2" />
                                            Convert to Scenes or Screenplay
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Output */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle>Formatted Screenplay</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {formattedText ? (
                                <>
                                    <Textarea
                                        value={formattedText}
                                        readOnly
                                        className="min-h-[500px] font-mono text-sm bg-slate-50"
                                    />
                                    <div className="mt-4 space-y-3">
                                        <div className="flex gap-3">
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
                                                Download .txt
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={handleSendToEvaluation}
                                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            Send to Evaluation
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="min-h-[500px] flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                                    <div className="text-center">
                                        <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Your formatted screenplay will appear here</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Info Card */}
                <div className="max-w-4xl mx-auto mt-8">
                    <Card className="border-l-4 border-l-purple-500">
                        <CardHeader>
                            <CardTitle className="text-lg">What Happens Automatically</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600 space-y-2">
                            <p>• System detects whether you've pasted prose, rough screenplay, or formatted script</p>
                            <p>• Converts prose narrative to visual action lines and proper screenplay format</p>
                            <p>• Cleans up rough drafts: fixes sluglines (INT./EXT.), dialogue formatting, character names</p>
                            <p>• Removes internal thoughts, prose labels, and unfilmable descriptions</p>
                            <p>• Applies WriterDuet industry standards across all conversions</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}