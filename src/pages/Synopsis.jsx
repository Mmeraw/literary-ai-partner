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
    
    const { data: manuscripts = [] } = useQuery({
        queryKey: ['user-manuscripts'],
        queryFn: async () => {
            const user = await base44.auth.me();
            return await base44.entities.Manuscript.filter({ created_by: user.email });
        }
    });
    const [synopses, setSynopses] = useState({
        query: '',
        standard: '',
        extended: ''
    });
    const [validation, setValidation] = useState({});

    const generateSynopsis = async (type) => {
        if (!manuscriptInfo.trim()) {
            toast.error('Please provide information about your manuscript');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateSynopsis', {
                manuscriptInfo,
                synopsisType: type
            });

            if (response.data.success) {
                setSynopses(prev => ({
                    ...prev,
                    [type]: response.data.synopsis
                }));
                setValidation(prev => ({
                    ...prev,
                    [type]: response.data.validation
                }));
                
                const versionName = type === 'query' ? 'Query' : type === 'standard' ? 'Standard' : 'Extended';
                toast.success(`${versionName} synopsis generated! (${response.data.word_count} words)`);
            } else {
                toast.error(response.data.error || 'Failed to generate synopsis');
            }
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
                <Tabs defaultValue="standard" className="space-y-6">
                    <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="query">Query (100-150)</TabsTrigger>
                        <TabsTrigger value="standard">Standard (250-500)</TabsTrigger>
                        <TabsTrigger value="extended">Extended (700-1000)</TabsTrigger>
                    </TabsList>

                    {/* Query Synopsis */}
                    <TabsContent value="query" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Query Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    100-150 words | Query letters, online forms | Core hook only
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('query')}
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
                                            Generate Query Synopsis
                                        </>
                                    )}
                                </Button>

                                {synopses.query && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.query}</p>
                                            <div className="mt-3 flex items-center justify-between text-xs">
                                                <span className="text-slate-500">{synopses.query.split(' ').length} words</span>
                                                {validation.query && validation.query.pitfalls_detected?.length > 0 && (
                                                    <Badge variant="outline" className="text-amber-600">
                                                        {validation.query.pitfalls_detected.length} issues detected
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.query)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => downloadSynopsis(synopses.query, 'query-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Standard Synopsis */}
                    <TabsContent value="standard" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Standard Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    250-500 words | Agency submissions | Full 9-header structure
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('standard')}
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
                                            Generate Standard Synopsis
                                        </>
                                    )}
                                </Button>

                                {synopses.standard && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.standard}</p>
                                            <div className="mt-3 flex items-center justify-between text-xs">
                                                <span className="text-slate-500">{synopses.standard.split(' ').length} words</span>
                                                {validation.standard && validation.standard.pitfalls_detected?.length > 0 && (
                                                    <Badge variant="outline" className="text-amber-600">
                                                        {validation.standard.pitfalls_detected.length} issues detected
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.standard)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => downloadSynopsis(synopses.standard, 'standard-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Extended Synopsis */}
                    <TabsContent value="extended" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Extended Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    700-1000 words | Grants, press kits | Detailed with subplots
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('extended')}
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
                                            Generate Extended Synopsis
                                        </>
                                    )}
                                </Button>

                                {synopses.extended && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.extended}</p>
                                            <div className="mt-3 flex items-center justify-between text-xs">
                                                <span className="text-slate-500">{synopses.extended.split(' ').length} words</span>
                                                {validation.extended && validation.extended.pitfalls_detected?.length > 0 && (
                                                    <Badge variant="outline" className="text-amber-600">
                                                        {validation.extended.pitfalls_detected.length} issues detected
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.extended)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => downloadSynopsis(synopses.extended, 'extended-synopsis.txt')}>
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
                                <span><strong>9-Header Structure:</strong> Professional synopses use metadata, premise, plot points, climax, resolution, themes, style, market positioning, and closing note</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Reveal Ending:</strong> Agents need to know your complete story—no teasers or cliffhangers</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Present Tense, Third Person:</strong> "Sarah discovers..." not "Sarah discovered..."</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Max 5-7 Named Characters:</strong> Use roles for secondary cast</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Strong Verbs, Precise Nouns:</strong> Avoid blurb-speak and adjective padding</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Story Before Theme:</strong> Lead with plot; themes come at the end</span>
                            </li>
                        </ul>
                        <div className="mt-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                            <p className="text-xs text-indigo-800">
                                <strong>Dr. Patricia Anderson Standards:</strong> Our synopsis engine is calibrated against PhD-level editorial frameworks used by professional literary consultants.
                            </p>
                        </div>
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