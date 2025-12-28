import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles, Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function Synopsis() {
    const [manuscriptInfo, setManuscriptInfo] = useState('');
    const [generating, setGenerating] = useState(false);
    const [synopses, setSynopses] = useState({
        short: '',
        long: ''
    });

    const generateSynopsis = async (type) => {
        if (!manuscriptInfo.trim()) {
            toast.error('Please provide information about your manuscript');
            return;
        }

        setGenerating(true);
        try {
            const wordTarget = type === 'short' ? '250-500' : '500-750';
            const pageTarget = type === 'short' ? '1 page' : '1-2 pages';

            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a professional synopsis writer for literary agents.

Generate a ${type.toUpperCase()} SYNOPSIS (${wordTarget} words, ${pageTarget} single-spaced).

MANUSCRIPT INFORMATION:
${manuscriptInfo}

RULES FOR ${type.toUpperCase()} SYNOPSIS:
- Third person, present tense
- Reveal the ending (agents need to know)
- Focus on main plot and protagonist's arc
${type === 'short' ? '- One page max, ~250-500 words\n- Cover main turning points only' : '- 1-2 pages, ~500-750 words\n- Include major plot points and key subplots'}
- Clear cause-and-effect progression
- Emotional stakes and character motivation
- Professional, neutral tone (no marketing language)

Generate the ${type} synopsis now.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        synopsis: { type: "string" }
                    },
                    required: ["synopsis"]
                }
            });

            setSynopses(prev => ({
                ...prev,
                [type]: response.synopsis
            }));
            toast.success(`${type === 'short' ? 'Short' : 'Long'} synopsis generated!`);
        } catch (error) {
            console.error('Synopsis generation error:', error);
            toast.error('Failed to generate synopsis');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    const downloadSynopsis = (text, filename) => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <FileText className="w-4 h-4 mr-2" />
                        Synopsis Builder
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Generate Professional Synopses
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Create short (1 page) and long (1-2 pages) synopses for agent submissions. 
                        Both versions reveal the ending—agents need to know your full story.
                    </p>
                </div>

                {/* Input Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Tell Us About Your Story</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Describe your complete story including: protagonist, inciting incident, major plot points, character arcs, climax, and resolution. Include the ending—synopses must reveal how the story concludes..."
                            value={manuscriptInfo}
                            onChange={(e) => setManuscriptInfo(e.target.value)}
                            className="min-h-[250px]"
                        />
                    </CardContent>
                </Card>

                {/* Synopsis Types */}
                <Tabs defaultValue="short" className="space-y-6">
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="short">Short Synopsis (1 page)</TabsTrigger>
                        <TabsTrigger value="long">Long Synopsis (1-2 pages)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="short" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Short Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    250-500 words | Single page | Main plot points only
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('short')}
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

                                {synopses.short && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.short}</p>
                                            <div className="mt-3 text-xs text-slate-500">
                                                {synopses.short.split(' ').length} words
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.short)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => downloadSynopsis(synopses.short, 'short-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="long" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Long Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    500-750 words | 1-2 pages | Detailed plot with subplots
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('long')}
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

                                {synopses.long && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.long}</p>
                                            <div className="mt-3 text-xs text-slate-500">
                                                {synopses.long.split(' ').length} words
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.long)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => downloadSynopsis(synopses.long, 'long-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Tips */}
                <Card className="mt-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle>Synopsis Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Always reveal the ending—agents need to know your complete story</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Use third person, present tense ("Sarah discovers..." not "Sarah discovered...")</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Focus on causality—show how events connect and build</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Include character motivation and emotional stakes</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Avoid marketing language—be professional and factual</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Single-space your synopsis when submitting to agents</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Integration Note */}
                <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 text-center">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Ready for Query Letters
                    </h3>
                    <p className="text-sm text-slate-600">
                        Your synopsis will auto-populate in the Query Letter builder, 
                        creating a complete agent submission package.
                    </p>
                </div>
            </div>
        </div>
    );
}