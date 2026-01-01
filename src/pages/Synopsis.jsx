import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, Sparkles, Copy, Download, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useRevisionFlow } from '@/components/useRevisionFlow';
import RevisionViewer from '@/components/RevisionViewer';
import RevisionControls from '@/components/RevisionControls';
import { exportTxt } from '@/components/utils/exportTxt';

export default function Synopsis() {
    const [manuscriptInfo, setManuscriptInfo] = useState('');
    const [generating, setGenerating] = useState(false);
    const [synopses, setSynopses] = useState({
        query: '',
        standard: '',
        extended: ''
    });
    const [validation, setValidation] = useState({});
    const [activeTab, setActiveTab] = useState('standard');
    
    // Revision flows for each synopsis type
    const queryRevision = useRevisionFlow('synopsis');
    const standardRevision = useRevisionFlow('synopsis');
    const extendedRevision = useRevisionFlow('synopsis');
    
    const { data: manuscripts = [] } = useQuery({
        queryKey: ['user-manuscripts'],
        queryFn: async () => {
            const user = await base44.auth.me();
            return await base44.entities.Manuscript.filter({ created_by: user.email });
        }
    });

    const handleFileUpload = async (e) => {
        console.log('🚀 handleFileUpload TRIGGERED at', new Date().toISOString());
        const file = e.target.files?.[0];
        console.log('📁 File object:', { name: file?.name, size: file?.size, type: file?.type });
        
        if (!file) {
            console.warn('❌ No file selected');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            console.error('❌ File too large:', file.size);
            toast.error('File must be under 25MB');
            return;
        }

        console.log('✅ Starting upload flow...');
        setGenerating(true);
        
        try {
            toast.loading('Uploading manuscript...', { id: 'upload' });
            console.log('📤 Calling base44.integrations.Core.UploadFile...');
            
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            console.log('📦 UploadFile returned:', uploadResult);
            
            const file_url = uploadResult?.file_url;
            if (!file_url) throw new Error('No file_url in upload response');
            
            toast.loading('Extracting manuscript text...', { id: 'upload' });
            const fileResponse = await fetch(file_url);
            const fileBuffer = await fileResponse.arrayBuffer();
            const text = new TextDecoder().decode(fileBuffer);
            
            setManuscriptInfo(text);
            toast.success('Manuscript loaded! You can now generate synopses.', { id: 'upload' });
        } catch (error) {
            console.error('💥 Upload error:', error);
            toast.error(
                <div>
                    <div className="font-semibold">Upload failed</div>
                    <div className="text-xs mt-1">{error.message}</div>
                </div>,
                { id: 'upload', duration: 5000 }
            );
        } finally {
            setGenerating(false);
            e.target.value = '';
        }
    };

    const loadFromManuscript = (manuscript) => {
        setManuscriptInfo(manuscript.full_text);
        toast.success(`Loaded: ${manuscript.title}`);
    };

    const generateSynopsis = async (type) => {
        console.log('🚀 Generate synopsis triggered:', type);
        if (!manuscriptInfo.trim()) {
            toast.error('Please provide information about your manuscript');
            return;
        }

        setGenerating(true);
        try {
            console.log('📤 Calling generateSynopsis...');
            const response = await base44.functions.invoke('generateSynopsis', {
                manuscriptInfo,
                synopsisType: type
            });
            
            console.log('📦 Response:', response);
            const result = response.data || response;

            if (result.success) {
                setSynopses(prev => ({
                    ...prev,
                    [type]: result.synopsis
                }));
                setValidation(prev => ({
                    ...prev,
                    [type]: result.validation
                }));
                
                // Create baseline OutputVersion
                const revision = type === 'query' ? queryRevision : type === 'standard' ? standardRevision : extendedRevision;
                await revision.createBaseline(result.synopsis, `synopsis_${type}_${Date.now()}`);
                
                const versionName = type === 'query' ? 'Query' : type === 'standard' ? 'Standard' : 'Extended';
                toast.success(`${versionName} synopsis generated! (${result.word_count} words)`);
            } else {
                toast.error(
                    <div>
                        <div className="font-semibold">Generation failed</div>
                        <div className="text-xs mt-1">{result.error || result.details || 'Unknown error'}</div>
                    </div>,
                    { duration: 5000 }
                );
            }
        } catch (error) {
            console.error('💥 Synopsis generation error:', error);
            toast.error(
                <div>
                    <div className="font-semibold">Generation failed</div>
                    <div className="text-xs mt-1">{error.message}</div>
                </div>,
                { duration: 5000 }
            );
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

    const handleRequestRevision = async (type) => {
        const revision = type === 'query' ? queryRevision : type === 'standard' ? standardRevision : extendedRevision;
        const currentContent = synopses[type];
        
        // For demo: simulate a revised version (in production, call backend revision service)
        toast.info('Requesting AI revision...');
        // TODO: Replace with actual revision generation call
        const revisedContent = currentContent + '\n\n[AI-generated revision would appear here]';
        
        await revision.requestRevision(currentContent, revisedContent);
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
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="Describe your complete story including: protagonist, inciting incident, major plot points, character arcs, climax, and resolution. Include the ending—synopses must reveal how the story concludes..."
                            value={manuscriptInfo}
                            onChange={(e) => setManuscriptInfo(e.target.value)}
                            className="min-h-[250px]"
                        />
                        
                        <div className="flex items-center gap-4 mb-2">
                            <div className="flex-1 border-t border-slate-300"></div>
                            <span className="text-xs text-slate-500">OR UPLOAD FILE</span>
                            <div className="flex-1 border-t border-slate-300"></div>
                        </div>
                        
                        <input
                            type="file"
                            accept=".txt,.pdf,.doc,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="manuscript-upload-synopsis"
                            disabled={generating}
                        />
                        <label htmlFor="manuscript-upload-synopsis" className="cursor-pointer block">
                            <Button type="button" variant="outline" className="w-full" disabled={generating}>
                                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                Upload Manuscript
                            </Button>
                        </label>
                        
                        {manuscripts.length > 0 && (
                            <>
                                <div className="flex items-center gap-4 my-3">
                                    <div className="flex-1 border-t border-slate-300"></div>
                                    <span className="text-xs text-slate-500">OR LOAD FROM PREVIOUS WORKS</span>
                                    <div className="flex-1 border-t border-slate-300"></div>
                                </div>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {manuscripts.map((ms) => (
                                        <button
                                            key={ms.id}
                                            onClick={() => loadFromManuscript(ms)}
                                            className="w-full p-2 rounded border border-slate-200 hover:bg-slate-50 text-left text-sm"
                                        >
                                            <div className="font-medium">{ms.title}</div>
                                            <div className="text-xs text-slate-500">{ms.word_count?.toLocaleString()} words</div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
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
                                        {queryRevision.showViewer && queryRevision.revisionEventId ? (
                                            <RevisionViewer
                                                revisionEventId={queryRevision.revisionEventId}
                                                onApprove={queryRevision.approveRevision}
                                            />
                                        ) : (
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
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.query)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => exportTxt(synopses.query, 'query-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                            <RevisionControls
                                                hasBaseline={!!queryRevision.baselineVersionId}
                                                hasRevision={queryRevision.hasRevision}
                                                showingViewer={queryRevision.showViewer}
                                                processing={queryRevision.processing}
                                                onRequestRevision={() => handleRequestRevision('query')}
                                                onShowViewer={() => queryRevision.closeViewer() || (queryRevision.showViewer = true)}
                                                onApprove={queryRevision.approveRevision}
                                                onClose={queryRevision.closeViewer}
                                            />
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
                                        {standardRevision.showViewer && standardRevision.revisionEventId ? (
                                            <RevisionViewer
                                                revisionEventId={standardRevision.revisionEventId}
                                                onApprove={standardRevision.approveRevision}
                                            />
                                        ) : (
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
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.standard)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => exportTxt(synopses.standard, 'standard-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                            <RevisionControls
                                                hasBaseline={!!standardRevision.baselineVersionId}
                                                hasRevision={standardRevision.hasRevision}
                                                showingViewer={standardRevision.showViewer}
                                                processing={standardRevision.processing}
                                                onRequestRevision={() => handleRequestRevision('standard')}
                                                onShowViewer={() => standardRevision.setShowViewer(true)}
                                                onApprove={standardRevision.approveRevision}
                                                onClose={standardRevision.closeViewer}
                                            />
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
                                        {extendedRevision.showViewer && extendedRevision.revisionEventId ? (
                                            <RevisionViewer
                                                revisionEventId={extendedRevision.revisionEventId}
                                                onApprove={extendedRevision.approveRevision}
                                            />
                                        ) : (
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
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.extended)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => exportTxt(synopses.extended, 'extended-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                            <RevisionControls
                                                hasBaseline={!!extendedRevision.baselineVersionId}
                                                hasRevision={extendedRevision.hasRevision}
                                                showingViewer={extendedRevision.showViewer}
                                                processing={extendedRevision.processing}
                                                onRequestRevision={() => handleRequestRevision('extended')}
                                                onShowViewer={() => extendedRevision.setShowViewer(true)}
                                                onApprove={extendedRevision.approveRevision}
                                                onClose={extendedRevision.closeViewer}
                                            />
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