import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Upload, Sparkles, Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useRevisionFlow } from '@/components/useRevisionFlow';
import RevisionViewer from '@/components/RevisionViewer';
import RevisionControls from '@/components/RevisionControls';
import { exportTxt } from '@/components/utils/exportTxt';

export default function Biography() {
    const [inputText, setInputText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [bios, setBios] = useState({
        query: '',
        long: ''
    });
    
    const fileInputRef = useRef(null);
    const queryRevision = useRevisionFlow('biography');
    const longRevision = useRevisionFlow('biography');

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        try {
            // Upload file
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            // Extract text from file
            const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url,
                json_schema: {
                    type: "object",
                    properties: {
                        text: { type: "string" }
                    }
                }
            });

            if (extracted.status === 'success') {
                setInputText(extracted.output.text || '');
                toast.success('File uploaded and processed');
            } else {
                toast.error('Failed to extract text from file');
            }
        } catch (error) {
            console.error('File upload error:', error);
            toast.error('Failed to upload file');
        } finally {
            setUploadingFile(false);
        }
    };

    const generateBio = async () => {
        if (!inputText.trim()) {
            toast.error('Please provide some information about yourself');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a professional bio writer specializing in query letters for literary agents.

Given the following information about an author, generate two versions of their biography:

1. QUERY BIO (50-100 words): Concise, professional, query-letter ready. Focus on relevant credentials, publications, awards, or unique qualifications that make the author credible for THIS specific manuscript.

2. LONG BIO (200-250 words): Expanded version with more background, writing journey, influences, and personal details that build connection while maintaining professionalism.

RULES:
- Third person only
- Lead with strongest credentials
- Omit irrelevant details
- Focus on what makes the author qualified to write THIS story
- If no publications: highlight expertise, education, or unique perspective
- Professional tone, no fluff

AUTHOR INFORMATION:
${inputText}

Generate both bios now.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        query_bio: { type: "string", description: "50-100 word query-ready bio" },
                        long_bio: { type: "string", description: "200-250 word expanded bio" }
                    },
                    required: ["query_bio", "long_bio"]
                }
            });

            setBios({
                query: response.query_bio,
                long: response.long_bio
            });
            
            // Create baseline OutputVersions
            await queryRevision.createBaseline(response.query_bio, `bio_query_${Date.now()}`);
            await longRevision.createBaseline(response.long_bio, `bio_long_${Date.now()}`);
            
            toast.success('Biographies generated!');
        } catch (error) {
            console.error('Bio generation error:', error);
            toast.error('Failed to generate biography');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    const downloadBio = (text, filename) => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded!');
    };

    const handleRequestRevision = async (type) => {
        const revision = type === 'query' ? queryRevision : longRevision;
        const currentContent = bios[type];
        
        toast.info('Requesting AI revision...');
        const revisedContent = currentContent + '\n\n[AI-generated revision would appear here]';
        
        await revision.requestRevision(currentContent, revisedContent);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <User className="w-4 h-4 mr-2" />
                        Author Biography Builder
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Generate Your Author Bio
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Create query-ready and long-form author biographies. Essential for query letters, agent submissions, and book marketing.
                    </p>
                </div>

                {/* Input Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Your Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">
                                Tell us about yourself
                            </label>
                            <Textarea
                                placeholder="Include: education, writing credentials, publications, awards, relevant work experience, unique expertise, or life experiences that inform your writing..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                className="min-h-[200px]"
                            />
                        </div>

                        <div className="border-t pt-4">
                            <label className="text-sm font-medium text-slate-700 mb-2 block">
                                Or upload resume/CV (PDF, DOCX, TXT)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <Button 
                                    variant="outline" 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingFile}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {uploadingFile ? 'Uploading...' : 'Upload File'}
                                </Button>
                                <span className="text-xs text-slate-500">We'll extract relevant information automatically</span>
                            </div>
                        </div>

                        <Button 
                            onClick={generateBio}
                            disabled={generating || !inputText.trim()}
                            className="w-full"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating Biographies...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Author Bios
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Generated Bios */}
                {(bios.query || bios.long) && (
                    <Tabs defaultValue="query" className="space-y-6">
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="query">Query Bio (50-100 words)</TabsTrigger>
                            <TabsTrigger value="long">Long Bio (200-250 words)</TabsTrigger>
                        </TabsList>

                        <TabsContent value="query">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Query-Ready Biography</CardTitle>
                                    <p className="text-sm text-slate-600">Perfect for query letters and agent submissions</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {queryRevision.showViewer && queryRevision.revisionEventId ? (
                                        <RevisionViewer
                                            revisionEventId={queryRevision.revisionEventId}
                                            onApprove={queryRevision.approveRevision}
                                        />
                                    ) : (
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed">{bios.query}</p>
                                            <div className="mt-3 text-xs text-slate-500">
                                                {bios.query.split(' ').length} words
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2 flex-wrap">
                                        <Button variant="outline" onClick={() => copyToClipboard(bios.query)}>
                                            <Copy className="w-4 h-4 mr-2" />
                                            Copy
                                        </Button>
                                        <Button variant="outline" onClick={() => exportTxt(bios.query, 'query-bio.txt')}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </Button>
                                        <RevisionControls
                                            hasBaseline={!!queryRevision.baselineVersionId}
                                            hasRevision={queryRevision.hasRevision}
                                            showingViewer={queryRevision.showViewer}
                                            processing={queryRevision.processing}
                                            onRequestRevision={() => handleRequestRevision('query')}
                                            onShowViewer={() => queryRevision.setShowViewer(true)}
                                            onApprove={queryRevision.approveRevision}
                                            onClose={queryRevision.closeViewer}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="long">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Long Biography</CardTitle>
                                    <p className="text-sm text-slate-600">For author websites, book marketing, and media kits</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {longRevision.showViewer && longRevision.revisionEventId ? (
                                        <RevisionViewer
                                            revisionEventId={longRevision.revisionEventId}
                                            onApprove={longRevision.approveRevision}
                                        />
                                    ) : (
                                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-slate-800 leading-relaxed">{bios.long}</p>
                                            <div className="mt-3 text-xs text-slate-500">
                                                {bios.long.split(' ').length} words
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2 flex-wrap">
                                        <Button variant="outline" onClick={() => copyToClipboard(bios.long)}>
                                            <Copy className="w-4 h-4 mr-2" />
                                            Copy
                                        </Button>
                                        <Button variant="outline" onClick={() => exportTxt(bios.long, 'long-bio.txt')}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </Button>
                                        <RevisionControls
                                            hasBaseline={!!longRevision.baselineVersionId}
                                            hasRevision={longRevision.hasRevision}
                                            showingViewer={longRevision.showViewer}
                                            processing={longRevision.processing}
                                            onRequestRevision={() => handleRequestRevision('long')}
                                            onShowViewer={() => longRevision.setShowViewer(true)}
                                            onApprove={longRevision.approveRevision}
                                            onClose={longRevision.closeViewer}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}

                {/* Tips */}
                <Card className="mt-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle>Biography Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Always write in third person ("Jane Smith is a..." not "I am a...")</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Lead with strongest credentials (publications, awards, education)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Include only credentials relevant to your manuscript's genre/topic</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>If no publications: highlight unique expertise, life experience, or research</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Keep query bio under 100 words—agents want brevity</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Avoid generic statements like "lifelong reader" or "passionate about writing"</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Integration Note */}
                <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 text-center">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Auto-Insert Into Query Letter
                    </h3>
                    <p className="text-sm text-slate-600">
                        Your generated bio will automatically populate in the Query Letter builder, 
                        completing your agent submission package alongside pitches, synopsis, and comparables.
                    </p>
                </div>
            </div>
        </div>
    );
}