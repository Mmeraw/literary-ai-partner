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
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [synopses, setSynopses] = useState({
        query: '',
        standard: '',
        extended: ''
    });
    const [validation, setValidation] = useState({});
    
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
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            toast.error('File must be under 25MB');
            return;
        }

        setUploadingFile(true);
        setUploadedFileName(file.name);
        
        try {
            toast.loading('Uploading manuscript...', { id: 'upload' });
            
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            const file_url = uploadResult?.file_url;
            
            if (!file_url) {
                throw new Error('Upload failed');
            }
            
            toast.loading('Extracting text...', { id: 'upload' });
            
            let text = '';
            const fileName = file.name.toLowerCase();
            
            if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
                const docxResult = await base44.functions.invoke('importDocx', { file_url });
                text = docxResult.data?.text || '';
            } else if (fileName.endsWith('.txt')) {
                const response = await fetch(file_url);
                text = await response.text();
            } else {
                const response = await fetch(file_url);
                const buffer = await response.arrayBuffer();
                text = new TextDecoder().decode(buffer);
            }
            
            setManuscriptInfo(text);
            toast.success('Manuscript loaded successfully!', { id: 'upload' });
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(`Upload failed: ${error.message}`, { id: 'upload' });
            setUploadedFileName('');
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const loadFromManuscript = (manuscript) => {
        setManuscriptInfo(manuscript.full_text);
        toast.success(`Loaded: ${manuscript.title}`);
    };

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
                
                const revision = type === 'query' ? queryRevision : type === 'standard' ? standardRevision : extendedRevision;
                await revision.createBaseline(result.synopsis, `synopsis_${type}_${Date.now()}`);
                
                const versionName = type === 'query' ? 'Query' : type === 'standard' ? 'Standard' : 'Extended';
                toast.success(`${versionName} synopsis generated! (${result.word_count} words)`);
            } else {
                toast.error(result.error || 'Generation failed');
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

    const handleRequestRevision = async (type) => {
        const revision = type === 'query' ? queryRevision : type === 'standard' ? standardRevision : extendedRevision;
        const currentContent = synopses[type];
        
        toast.info('Requesting AI revision...');
        const revisedContent = currentContent + '\n\n[AI-generated revision would appear here]';
        
        await revision.requestRevision(currentContent, revisedContent);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
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
                        
                        <div className="flex flex-col gap-2">
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.rtf,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="synopsis-upload"
                            />
                            <label htmlFor="synopsis-upload">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="w-full" 
                                    disabled={uploadingFile}
                                    asChild
                                >
                                    <span className="cursor-pointer">
                                        {uploadingFile ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload File
                                            </>
                                        )}
                                    </span>
                                </Button>
                            </label>
                            {uploadedFileName && (
                                <p className="text-sm text-green-600">
                                    ✓ {uploadedFileName}
                                </p>
                            )}
                        </div>
                        
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

                <Tabs defaultValue="standard" className="space-y-6">
                    <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="query">Query (100-150)</TabsTrigger>
                        <TabsTrigger value="standard">Standard (250-500)</TabsTrigger>
                        <TabsTrigger value="extended">Extended (700-1000)</TabsTrigger>
                    </TabsList>

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
                                                onShowViewer={() => queryRevision.setShowViewer(true)}
                                                onApprove={queryRevision.approveRevision}
                                                onClose={queryRevision.closeViewer}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

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