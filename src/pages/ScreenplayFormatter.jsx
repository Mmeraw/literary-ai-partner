import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Loader2, Download, Sparkles, ArrowRight, Copy } from 'lucide-react';
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ScreenplayFormatter() {
    const [inputText, setInputText] = useState('');
    const [formattedText, setFormattedText] = useState('');
    const [isFormatting, setIsFormatting] = useState(false);
    const [mode, setMode] = useState('auto');

    const handleFormat = async () => {
        if (!inputText.trim()) {
            toast.error('Please paste text to format');
            return;
        }

        setIsFormatting(true);

        try {
            const { data } = await base44.functions.invoke('formatScreenplay', {
                text: inputText,
                mode: mode === 'auto' ? null : mode
            });

            setFormattedText(data.formatted_text);
            toast.success(`Formatted as ${data.mode === 'convert' ? 'screenplay from prose' : 'cleaned screenplay'}`);
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
        window.location.href = createPageUrl('Evaluate');
    };

    const wordCount = inputText.split(/\s+/).filter(w => w).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
                        <Film className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Screenplay Formatter</h1>
                    <p className="mt-2 text-slate-600 max-w-xl mx-auto">
                        Convert novel scenes to screenplay format OR clean up crude screenplay drafts
                    </p>
                    <Badge className="mt-3 bg-purple-100 text-purple-700 border-purple-200">
                        WriterDuet Industry Standards
                    </Badge>
                </div>

                {/* Mode Selector */}
                <div className="max-w-2xl mx-auto mb-6">
                    <Tabs value={mode} onValueChange={setMode} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="auto">Auto-Detect</TabsTrigger>
                            <TabsTrigger value="convert">Novel → Screenplay</TabsTrigger>
                            <TabsTrigger value="cleanup">Clean Up Draft</TabsTrigger>
                        </TabsList>
                    </Tabs>
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
                            <Textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={mode === 'convert' 
                                    ? "Paste novel prose here...\n\nExample:\nThe store smells like rotted sawdust. Brutus steps inside. The man behind the counter grins through gold teeth..."
                                    : "Paste crude screenplay here...\n\nExample:\nLocation: Store\nBrutus steps inside.\nThe man grins.\n\"Welcome,\" he says..."
                                }
                                className="min-h-[500px] font-mono text-sm"
                            />
                            <div className="mt-4 flex gap-3">
                                <Button
                                    onClick={handleFormat}
                                    disabled={isFormatting || !inputText.trim()}
                                    className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                >
                                    {isFormatting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Formatting...
                                        </>
                                    ) : (
                                        <>
                                            <Film className="w-5 h-5 mr-2" />
                                            Format to Screenplay
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
                                        <p>Formatted screenplay will appear here</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Info Cards */}
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <Card className="border-l-4 border-l-purple-500">
                        <CardHeader>
                            <CardTitle className="text-lg">Novel → Screenplay</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600 space-y-2">
                            <p>• Converts prose narrative to visual action lines</p>
                            <p>• Removes internal thoughts and unfilmable descriptions</p>
                            <p>• Creates proper sluglines and dialogue formatting</p>
                            <p>• Applies WriterDuet industry standards</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-pink-500">
                        <CardHeader>
                            <CardTitle className="text-lg">Clean Up Draft</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600 space-y-2">
                            <p>• Fixes slugline formatting (INT./EXT.)</p>
                            <p>• Removes prose labels and section headers</p>
                            <p>• Corrects dialogue indentation and character names</p>
                            <p>• Eliminates philosophical statements</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}