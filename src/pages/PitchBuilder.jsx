import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Target, Sparkles, Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PitchBuilder() {
    const [manuscriptInfo, setManuscriptInfo] = useState('');
    const [generating, setGenerating] = useState(false);
    const [pitches, setPitches] = useState({
        oneSentence: '',
        elevator: '',
        shortSynopsis: '',
        longSynopsis: ''
    });

    const generatePitch = async (type) => {
        if (!manuscriptInfo.trim()) {
            toast.error('Please provide some information about your manuscript');
            return;
        }

        setGenerating(true);
        try {
            // Placeholder for future backend integration
            toast.info('Pitch generation coming soon!');
            // const response = await base44.functions.invoke('generatePitch', {
            //     manuscriptInfo,
            //     pitchType: type
            // });
        } catch (error) {
            toast.error('Failed to generate pitch');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Target className="w-4 h-4 mr-2" />
                        AI Pitch Builder
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Build Your Pitch Package
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Generate professional pitches optimized for agents, editors, and industry professionals.
                    </p>
                </div>

                {/* Input Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Tell Us About Your Manuscript</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Describe your story, main characters, conflict, and themes. The more detail you provide, the better your pitches will be..."
                            value={manuscriptInfo}
                            onChange={(e) => setManuscriptInfo(e.target.value)}
                            className="min-h-[200px]"
                        />
                    </CardContent>
                </Card>

                {/* Pitch Types */}
                <Tabs defaultValue="one-sentence" className="space-y-6">
                    <TabsList className="grid grid-cols-4 w-full">
                        <TabsTrigger value="one-sentence">One-Sentence</TabsTrigger>
                        <TabsTrigger value="elevator">Elevator (90s)</TabsTrigger>
                        <TabsTrigger value="short">Short Synopsis</TabsTrigger>
                        <TabsTrigger value="long">Long Synopsis</TabsTrigger>
                    </TabsList>

                    <TabsContent value="one-sentence" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>One-Sentence Pitch</CardTitle>
                                <p className="text-sm text-slate-600">
                                    Perfect for query letters, Twitter pitches, and quick introductions.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generatePitch('one-sentence')}
                                    disabled={generating || !manuscriptInfo.trim()}
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate One-Sentence Pitch
                                        </>
                                    )}
                                </Button>

                                {pitches.oneSentence && (
                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                        <p className="text-slate-800">{pitches.oneSentence}</p>
                                        <div className="flex gap-2 mt-4">
                                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(pitches.oneSentence)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="elevator" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Elevator Pitch (90 seconds)</CardTitle>
                                <p className="text-sm text-slate-600">
                                    For in-person pitches, conference meetings, and networking events.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generatePitch('elevator')}
                                    disabled={generating || !manuscriptInfo.trim()}
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Elevator Pitch
                                        </>
                                    )}
                                </Button>
                                <div className="text-sm text-slate-500">
                                    ~75-100 words | ~90 seconds speaking time
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="short" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Short Synopsis (1 page)</CardTitle>
                                <p className="text-sm text-slate-600">
                                    Standard query letter synopsis covering main plot points.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generatePitch('short-synopsis')}
                                    disabled={generating || !manuscriptInfo.trim()}
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Short Synopsis
                                        </>
                                    )}
                                </Button>
                                <div className="text-sm text-slate-500">
                                    ~250-500 words | Single-spaced page
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="long" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Long Synopsis (1-2 pages)</CardTitle>
                                <p className="text-sm text-slate-600">
                                    Detailed synopsis with ending revealed, for agent submissions.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generatePitch('long-synopsis')}
                                    disabled={generating || !manuscriptInfo.trim()}
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Long Synopsis
                                        </>
                                    )}
                                </Button>
                                <div className="text-sm text-slate-500">
                                    ~500-750 words | 1-2 single-spaced pages
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Feature Note */}
                <div className="mt-8 p-6 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 text-center">
                        <strong>Coming in Q1:</strong> Full pitch generation across all formats with industry-standard templates.
                    </p>
                </div>
            </div>
        </div>
    );
}