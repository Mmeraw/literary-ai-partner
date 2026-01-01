import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Download, Loader2, Target, Film, MessageSquare, Upload, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useRevisionFlow } from '@/components/useRevisionFlow';
import RevisionViewer from '@/components/RevisionViewer';
import RevisionControls from '@/components/RevisionControls';
import { exportTxt } from '@/components/utils/exportTxt';

export default function PitchGenerator() {
    const [manuscriptInfo, setManuscriptInfo] = useState({
        title: '',
        genre: '',
        wordCount: '',
        logline: '',
        keyThemes: '',
        protagonist: '',
        stakes: '',
        setting: '',
        uniqueHook: ''
    });

    const [uploadingFile, setUploadingFile] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: manuscripts = [] } = useQuery({
        queryKey: ['user-manuscripts'],
        queryFn: async () => {
            const user = await base44.auth.me();
            return await base44.entities.Manuscript.filter({ created_by: user.email });
        }
    });

    const filteredManuscripts = manuscripts.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadFromManuscript = async (manuscript) => {
        setUploadingFile(true);
        try {
            toast.loading('Extracting fields from manuscript...', { id: 'load' });
            
            const textSample = manuscript.full_text.substring(0, 50000);
            const response = await base44.functions.invoke('extractPitchFields', { 
                file_url: 'data:text/plain;base64,' + btoa(textSample)
            });
            
            if (response.success) {
                setManuscriptInfo(response.fields);
                toast.success('Fields loaded from manuscript!', { id: 'load' });
            }
        } catch (error) {
            console.error('Load error:', error);
            toast.error('Failed to load manuscript', { id: 'load' });
        } finally {
            setUploadingFile(false);
        }
    };

    const [generating, setGenerating] = useState(false);
    const [pitches, setPitches] = useState({
        oneSentenceSpecific: '',
        oneSentenceGeneral: '',
        elevator: '',
        conversational: '',
        hollywood: '',
        paragraph: '',
        queryLetter: ''
    });
    
    const specificRevision = useRevisionFlow('pitch');
    const generalRevision = useRevisionFlow('pitch');
    const elevatorRevision = useRevisionFlow('pitch');

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
        setUploadingFile(true);
        
        try {
            toast.loading('Uploading manuscript...', { id: 'upload' });
            console.log('📤 Calling base44.integrations.Core.UploadFile...');
            
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            console.log('📦 UploadFile returned:', uploadResult);
            
            const file_url = uploadResult?.file_url;
            console.log('🔗 Extracted file_url:', file_url);
            
            if (!file_url) {
                throw new Error('No file_url in upload response');
            }
            
            toast.loading('Analyzing manuscript and extracting fields...', { id: 'upload' });
            console.log('🔍 Calling extractPitchFields function...');
            
            const response = await base44.functions.invoke('extractPitchFields', { file_url });
            console.log('📊 extractPitchFields response:', response);
            console.log('📊 Response data:', response.data);
            console.log('📊 Response keys:', Object.keys(response || {}));
            
            // base44.functions.invoke returns {data: {success, fields}}
            const result = response.data || response;
            
            if (result.success && result.fields) {
                console.log('✅ Success! Fields:', result.fields);
                setManuscriptInfo(result.fields);
                toast.success(
                    <div>
                        <div className="font-semibold">✓ Fields extracted!</div>
                        <div className="text-xs mt-1">Title: {result.fields.title}</div>
                        <div className="text-xs">
                            <button 
                                onClick={() => handleSaveAsManuscript(result.fields, file_url)}
                                className="underline mt-1"
                            >
                                Save as Manuscript →
                            </button>
                        </div>
                    </div>,
                    { id: 'upload', duration: 6000 }
                );
            } else {
                console.error('❌ Extraction returned failure:', result);
                const errorMsg = result.error || result.details || 'Failed to extract fields';
                toast.error(
                    <div>
                        <div className="font-semibold">Extraction failed</div>
                        <div className="text-xs mt-1">{errorMsg}</div>
                    </div>,
                    { id: 'upload', duration: 5000 }
                );
            }
        } catch (error) {
            console.error('💥 CAUGHT ERROR:', error);
            console.error('💥 Error name:', error.name);
            console.error('💥 Error message:', error.message);
            console.error('💥 Error stack:', error.stack);
            const errorDetails = error.response?.data?.details || error.message;
            toast.error(
                <div>
                    <div className="font-semibold">Upload failed</div>
                    <div className="text-xs mt-1">{errorDetails}</div>
                </div>,
                { id: 'upload', duration: 5000 }
            );
        } finally {
            console.log('🏁 Upload flow complete');
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleSaveAsManuscript = async (fields, file_url) => {
        try {
            toast.loading('Saving as manuscript...', { id: 'save' });
            
            // Fetch full text
            const fileResponse = await fetch(file_url);
            const fileBuffer = await fileResponse.arrayBuffer();
            const full_text = new TextDecoder().decode(fileBuffer);
            const word_count = full_text.split(/\s+/).filter(w => w).length;
            
            const manuscript = await base44.entities.Manuscript.create({
                title: fields.title,
                full_text,
                word_count,
                status: 'uploaded'
            });
            
            toast.success(`Saved as manuscript: ${fields.title}`, { id: 'save' });
        } catch (error) {
            console.error('Save manuscript error:', error);
            toast.error('Failed to save manuscript', { id: 'save' });
        }
    };

    const generatePitches = async () => {
        if (!manuscriptInfo.title || !manuscriptInfo.logline) {
            toast.error('Please provide at least a title and logline');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateQueryPitches', {
                manuscriptInfo
            });

            if (response.data.success) {
                setPitches(response.data.pitches);
                
                // Create baseline OutputVersions
                await specificRevision.createBaseline(response.data.pitches.oneSentenceSpecific, `pitch_specific_${Date.now()}`);
                await generalRevision.createBaseline(response.data.pitches.oneSentenceGeneral, `pitch_general_${Date.now()}`);
                await elevatorRevision.createBaseline(response.data.pitches.elevator, `pitch_elevator_${Date.now()}`);
                
                toast.success('Pitch variations generated!');
            } else {
                toast.error(response.data.error || 'Failed to generate pitches');
            }
        } catch (error) {
            console.error('Pitch generation error:', error);
            toast.error('Failed to generate pitches');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const handleRequestRevision = async (type) => {
        const revision = type === 'specific' ? specificRevision : type === 'general' ? generalRevision : elevatorRevision;
        const currentContent = type === 'specific' ? pitches.oneSentenceSpecific : 
                              type === 'general' ? pitches.oneSentenceGeneral : pitches.elevator;
        
        toast.info('Requesting AI revision...');
        const revisedContent = currentContent + '\n[AI-revised version]';
        await revision.requestRevision(currentContent, revisedContent);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Query & Pitch Generator
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Professional Pitch Variations
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Generate multiple pitch variations calibrated against successful query patterns from 22+ examples
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Manuscript Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* File Upload Section */}
                                <div className="p-4 rounded-lg bg-indigo-50 border-2 border-dashed border-indigo-300">
                                    <div className="text-center">
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
                                        <p className="text-sm font-medium text-indigo-900 mb-1">
                                            Auto-Fill from Manuscript
                                        </p>
                                        <p className="text-xs text-indigo-700 mb-3">
                                            Upload your full manuscript/screenplay to populate all fields automatically
                                        </p>
                                        <Button
                                            variant="outline"
                                            disabled={uploadingFile}
                                            onClick={() => document.getElementById('manuscript-upload-input')?.click()}
                                        >
                                            {uploadingFile ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    Analyzing...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Choose File
                                                </>
                                            )}
                                        </Button>
                                        <input
                                            type="file"
                                            accept=".txt,.pdf,.doc,.docx"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="manuscript-upload-input"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            PDF, DOC, DOCX, or TXT • Max 25MB
                                        </p>
                                    </div>
                                </div>

                                <div className="text-center text-xs text-slate-500 font-medium">
                                    OR LOAD FROM PREVIOUS WORK
                                </div>

                                {/* Previous Works Section */}
                                {manuscripts.length > 0 && (
                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileText className="w-4 h-4 text-slate-600" />
                                            <span className="text-sm font-medium text-slate-700">
                                                Your Previous Works ({manuscripts.length})
                                            </span>
                                        </div>
                                        <div className="relative mb-2">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input
                                                placeholder="Search by title..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-9 bg-white"
                                            />
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {filteredManuscripts.map((manuscript) => (
                                                <button
                                                    key={manuscript.id}
                                                    onClick={() => loadFromManuscript(manuscript)}
                                                    disabled={uploadingFile}
                                                    className="w-full p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300 transition-all text-left disabled:opacity-50"
                                                >
                                                    <div className="font-medium text-sm text-slate-900">{manuscript.title}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {manuscript.word_count?.toLocaleString()} words
                                                        {manuscript.revisiongrade_overall && (
                                                            <span className="ml-2">• Score: {manuscript.revisiongrade_overall}/10</span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="text-center text-xs text-slate-500 font-medium">
                                    OR FILL IN MANUALLY
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Title *
                                    </label>
                                    <Input
                                        value={manuscriptInfo.title}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, title: e.target.value})}
                                        placeholder="The Lost World of Mythoamphibia"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Genre
                                    </label>
                                    <Input
                                        value={manuscriptInfo.genre}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, genre: e.target.value})}
                                        placeholder="Eco-horror, Dark Fantasy"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Word Count
                                    </label>
                                    <Input
                                        value={manuscriptInfo.wordCount}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, wordCount: e.target.value})}
                                        placeholder="95,000"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Current Logline/Pitch *
                                    </label>
                                    <Textarea
                                        value={manuscriptInfo.logline}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, logline: e.target.value})}
                                        placeholder="When an amphibian empire faces extinction..."
                                        className="h-24"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Key Themes
                                    </label>
                                    <Input
                                        value={manuscriptInfo.keyThemes}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, keyThemes: e.target.value})}
                                        placeholder="Environmental collapse, transformation, rebellion"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Protagonist
                                    </label>
                                    <Input
                                        value={manuscriptInfo.protagonist}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, protagonist: e.target.value})}
                                        placeholder="Crown Hyla, matriarch of the amphibian empire"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Stakes
                                    </label>
                                    <Textarea
                                        value={manuscriptInfo.stakes}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, stakes: e.target.value})}
                                        placeholder="Species extinction, war between humans and amphibians"
                                        className="h-20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Setting
                                    </label>
                                    <Input
                                        value={manuscriptInfo.setting}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, setting: e.target.value})}
                                        placeholder="Kingdom Lake, British Columbia, Cascade Mountains"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Unique Hook
                                    </label>
                                    <Textarea
                                        value={manuscriptInfo.uniqueHook}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, uniqueHook: e.target.value})}
                                        placeholder="What makes your story different from everything else in the genre?"
                                        className="h-24"
                                    />
                                </div>

                                <Button
                                    onClick={generatePitches}
                                    disabled={generating || !manuscriptInfo.title || !manuscriptInfo.logline}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating Pitches...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate All Pitch Variations
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Output Section */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Generated Pitch Variations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="specific" className="space-y-4">
                                    <TabsList className="grid grid-cols-3 w-full">
                                        <TabsTrigger value="specific">One-Sentence</TabsTrigger>
                                        <TabsTrigger value="elevator">Elevator</TabsTrigger>
                                        <TabsTrigger value="hollywood">Hollywood</TabsTrigger>
                                    </TabsList>

                                    {/* One-Sentence Specific */}
                                    <TabsContent value="specific" className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">Specific (Agent Submissions)</Badge>
                                                {pitches.oneSentenceSpecific && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(pitches.oneSentenceSpecific, 'Specific pitch')}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => exportTxt(pitches.oneSentenceSpecific, 'pitch-specific.txt')}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {specificRevision.showViewer && specificRevision.revisionEventId ? (
                                                <RevisionViewer
                                                    revisionEventId={specificRevision.revisionEventId}
                                                    onApprove={specificRevision.approveRevision}
                                                />
                                            ) : (
                                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 min-h-[100px]">
                                                    {pitches.oneSentenceSpecific ? (
                                                        <p className="text-slate-800 leading-relaxed">{pitches.oneSentenceSpecific}</p>
                                                    ) : (
                                                        <p className="text-slate-400 italic">Specific pitch will appear here...</p>
                                                    )}
                                                </div>
                                            )}
                                            {pitches.oneSentenceSpecific && (
                                                <RevisionControls
                                                    hasBaseline={!!specificRevision.baselineVersionId}
                                                    hasRevision={specificRevision.hasRevision}
                                                    showingViewer={specificRevision.showViewer}
                                                    processing={specificRevision.processing}
                                                    onRequestRevision={() => handleRequestRevision('specific')}
                                                    onShowViewer={() => specificRevision.setShowViewer(true)}
                                                    onApprove={specificRevision.approveRevision}
                                                    onClose={specificRevision.closeViewer}
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">General (Networking Events)</Badge>
                                                {pitches.oneSentenceGeneral && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(pitches.oneSentenceGeneral, 'General pitch')}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => exportTxt(pitches.oneSentenceGeneral, 'pitch-general.txt')}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {generalRevision.showViewer && generalRevision.revisionEventId ? (
                                                <RevisionViewer
                                                    revisionEventId={generalRevision.revisionEventId}
                                                    onApprove={generalRevision.approveRevision}
                                                />
                                            ) : (
                                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 min-h-[100px]">
                                                    {pitches.oneSentenceGeneral ? (
                                                        <p className="text-slate-800 leading-relaxed">{pitches.oneSentenceGeneral}</p>
                                                    ) : (
                                                        <p className="text-slate-400 italic">General pitch will appear here...</p>
                                                    )}
                                                </div>
                                            )}
                                            {pitches.oneSentenceGeneral && (
                                                <RevisionControls
                                                    hasBaseline={!!generalRevision.baselineVersionId}
                                                    hasRevision={generalRevision.hasRevision}
                                                    showingViewer={generalRevision.showViewer}
                                                    processing={generalRevision.processing}
                                                    onRequestRevision={() => handleRequestRevision('general')}
                                                    onShowViewer={() => generalRevision.setShowViewer(true)}
                                                    onApprove={generalRevision.approveRevision}
                                                    onClose={generalRevision.closeViewer}
                                                />
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* Elevator Pitch */}
                                    <TabsContent value="elevator" className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">
                                                    <MessageSquare className="w-3 h-3 mr-1" />
                                                    Conversational (2-3 sentences, &lt;45 seconds)
                                                </Badge>
                                                {pitches.conversational && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(pitches.conversational, 'Conversational pitch')}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 min-h-[120px]">
                                                {pitches.conversational ? (
                                                    <p className="text-slate-800 leading-relaxed">{pitches.conversational}</p>
                                                ) : (
                                                    <p className="text-slate-400 italic">Conversational pitch will appear here...</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">
                                                    <Target className="w-3 h-3 mr-1" />
                                                    Elevator (Structured, 60 seconds)
                                                </Badge>
                                                {pitches.elevator && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(pitches.elevator, 'Elevator pitch')}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {elevatorRevision.showViewer && elevatorRevision.revisionEventId ? (
                                                <RevisionViewer
                                                    revisionEventId={elevatorRevision.revisionEventId}
                                                    onApprove={elevatorRevision.approveRevision}
                                                />
                                            ) : (
                                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 min-h-[120px]">
                                                    {pitches.elevator ? (
                                                        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{pitches.elevator}</p>
                                                    ) : (
                                                        <p className="text-slate-400 italic">Elevator pitch will appear here...</p>
                                                    )}
                                                </div>
                                            )}
                                            {pitches.elevator && (
                                                <RevisionControls
                                                    hasBaseline={!!elevatorRevision.baselineVersionId}
                                                    hasRevision={elevatorRevision.hasRevision}
                                                    showingViewer={elevatorRevision.showViewer}
                                                    processing={elevatorRevision.processing}
                                                    onRequestRevision={() => handleRequestRevision('elevator')}
                                                    onShowViewer={() => elevatorRevision.setShowViewer(true)}
                                                    onApprove={elevatorRevision.approveRevision}
                                                    onClose={elevatorRevision.closeViewer}
                                                />
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* Hollywood Logline */}
                                    <TabsContent value="hollywood" className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">
                                                    <Film className="w-3 h-3 mr-1" />
                                                    Hollywood Logline
                                                </Badge>
                                                {pitches.hollywood && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(pitches.hollywood, 'Hollywood logline')}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 min-h-[100px]">
                                                {pitches.hollywood ? (
                                                    <p className="text-slate-800 leading-relaxed">{pitches.hollywood}</p>
                                                ) : (
                                                    <p className="text-slate-400 italic">Hollywood logline will appear here...</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">Paragraph (Query Letters)</Badge>
                                                {pitches.paragraph && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(pitches.paragraph, 'Paragraph pitch')}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 min-h-[150px]">
                                                {pitches.paragraph ? (
                                                    <p className="text-slate-800 leading-relaxed">{pitches.paragraph}</p>
                                                ) : (
                                                    <p className="text-slate-400 italic">Paragraph pitch will appear here...</p>
                                                )}
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        {/* Tips */}
                        <Card className="border-indigo-100">
                            <CardHeader>
                                <CardTitle className="text-base">When to Use Each Version</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div>
                                    <span className="font-semibold text-slate-800">One-Sentence Specific:</span>
                                    <p className="text-slate-600">Query letters, agent submissions—shows unique hook immediately</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-800">One-Sentence General:</span>
                                    <p className="text-slate-600">Networking events, broad pitches, testing interest without details</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-800">Conversational:</span>
                                    <p className="text-slate-600">In-person meetings, conferences, casual conversations (&lt;45 sec)</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-800">Hollywood Logline:</span>
                                    <p className="text-slate-600">Film pitches, screenwriting contexts, high-concept summaries</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}