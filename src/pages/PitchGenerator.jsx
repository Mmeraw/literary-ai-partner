import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Download, Loader2, Target, Film, MessageSquare, Upload, Search, FileText, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useRevisionFlow } from '@/components/useRevisionFlow';
import RevisionViewer from '@/components/RevisionViewer';
import RevisionControls from '@/components/RevisionControls';
import { exportTxt } from '@/components/utils/exportTxt';
import DocumentSelector from '@/components/DocumentSelector';

export default function PitchGenerator() {
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
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
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [manualText, setManualText] = useState('');
    const [processingText, setProcessingText] = useState(false);

    const { data: manuscripts = [] } = useQuery({
        queryKey: ['user-manuscripts'],
        queryFn: async () => {
            const user = await base44.auth.me();
            return await base44.entities.Manuscript.filter({ created_by: user.email });
        }
    });

    const handleDocumentSelect = async (docId) => {
        setSelectedDocumentId(docId);
        const doc = await base44.entities.Document.get(docId);
        if (doc.content_reference_id) {
            const manuscript = await base44.entities.Manuscript.get(doc.content_reference_id);
            await loadFromManuscript(manuscript);
        }
    };

    const filteredManuscripts = manuscripts.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadFromManuscript = async (manuscript) => {
        setUploadingFile(true);
        try {
            toast.loading('Extracting fields from manuscript...', { id: 'load' });
            
            const response = await base44.functions.invoke('extractPitchFields', { 
                raw_text: manuscript.full_text,
                voiceIntensity
            });
            
            const result = response.data || response;
            if (result.success && result.fields) {
                setManuscriptInfo(result.fields);
                toast.success('Fields loaded from manuscript!', { id: 'load' });
            } else {
                toast.error(result.error || 'Failed to extract fields', { id: 'load' });
            }
        } catch (error) {
            console.error('Load error:', error);
            toast.error('Failed to load manuscript', { id: 'load' });
        } finally {
            setUploadingFile(false);
        }
    };

    const [generating, setGenerating] = useState(false);
    const [voiceIntensity, setVoiceIntensity] = useState('house');
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
            
            toast.loading('Analyzing manuscript and extracting fields...', { id: 'upload' });
            
            const response = await base44.functions.invoke('extractPitchFields', { 
                file_url,
                voiceIntensity
            });
            const result = response.data || response;
            
            if (result.success && result.fields) {
                setManuscriptInfo(result.fields);
                toast.success('Fields extracted successfully!', { id: 'upload' });
            } else {
                const errorMsg = result.error || result.details || 'Failed to extract fields';
                toast.error(`Extraction failed: ${errorMsg}`, { id: 'upload' });
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(`Upload failed: ${error.message}`, { id: 'upload' });
            setUploadedFileName('');
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleManualTextExtract = async () => {
        if (!manualText || manualText.trim().length < 100) {
            toast.error('Please paste at least 100 characters of text');
            return;
        }

        setProcessingText(true);
        try {
            toast.loading('Extracting fields with thematic substrate (may take 10-15 seconds)...', { id: 'text' });
            
            const response = await base44.functions.invoke('extractPitchFields', {
                raw_text: manualText,
                voiceIntensity
            });
            
            const result = response.data || response;
            
            console.log('Extraction result:', result);
            
            if (result.success && result.fields) {
                setManuscriptInfo(result.fields);
                toast.success('Fields extracted from text!', { id: 'text' });
                setManualText('');
            } else {
                const errorMsg = result.error || 'Failed to extract fields';
                console.error('Extraction failed:', errorMsg, result);
                toast.error(errorMsg, { id: 'text' });
            }
        } catch (error) {
            console.error('Text extraction error:', error);
            const errorMsg = error.message || error.response?.data?.error || 'Failed to analyze text';
            toast.error(errorMsg, { id: 'text' });
        } finally {
            setProcessingText(false);
        }
    };

    const generatePitches = async () => {
        // DIAGNOSTIC LOGGING (no raw text)
        console.log('[PitchGenerator] generateAll clicked', {
            voiceIntensity,
            manuscriptInfoPresent: !!manuscriptInfo,
            manuscriptInfoKeys: manuscriptInfo ? Object.keys(manuscriptInfo) : [],
            titleLen: manuscriptInfo?.title?.length ?? 0,
            loglineLen: manuscriptInfo?.logline?.length ?? 0,
            protagonistLen: manuscriptInfo?.protagonist?.length ?? 0,
            stakesLen: manuscriptInfo?.stakes?.length ?? 0,
            uniqueHookLen: manuscriptInfo?.uniqueHook?.length ?? 0,
            genreLen: manuscriptInfo?.genre?.length ?? 0,
            settingLen: manuscriptInfo?.setting?.length ?? 0,
            keyThemesLen: manuscriptInfo?.keyThemes?.length ?? 0,
            wordCount: manuscriptInfo?.wordCount
        });

        if (!manuscriptInfo.title || !manuscriptInfo.logline) {
            const errorMsg = 'Please provide at least a title and logline';
            console.error('[PitchGenerator] Validation failed:', errorMsg);
            toast.error(errorMsg);
            return;
        }

        setGenerating(true);
        try {
            toast.loading('Generating pitch variations with Voice Gate validation...', { id: 'generate' });
            
            // Log payload shape before sending
            const payload = { manuscriptInfo, voiceIntensity };
            console.log('[PitchGenerator] payload summary', {
                payloadKeys: Object.keys(payload),
                manuscriptInfoKeys: manuscriptInfo ? Object.keys(manuscriptInfo) : [],
                voiceIntensity
            });
            
            const response = await base44.functions.invoke('generateQueryPitches', payload);

            console.log('[PitchGenerator] response received', {
                hasResponse: !!response,
                responseKeys: response ? Object.keys(response) : [],
                hasData: !!(response?.data),
                dataKeys: response?.data ? Object.keys(response.data) : []
            });
            
            const result = response.data || response;
            console.log('[PitchGenerator] parsed result', {
                success: result?.success,
                hasError: !!result?.error,
                error: result?.error,
                hasPitches: !!result?.pitches,
                pitchKeys: result?.pitches ? Object.keys(result.pitches) : []
            });

            if (result.success && result.pitches) {
                console.log('✅ [PitchGenerator] Generation successful');
                setPitches(result.pitches);
                
                if (result.pitches.oneSentenceSpecific) {
                    await specificRevision.createBaseline(result.pitches.oneSentenceSpecific, `pitch_specific_${Date.now()}`);
                }
                if (result.pitches.oneSentenceGeneral) {
                    await generalRevision.createBaseline(result.pitches.oneSentenceGeneral, `pitch_general_${Date.now()}`);
                }
                if (result.pitches.elevator) {
                    await elevatorRevision.createBaseline(result.pitches.elevator, `pitch_elevator_${Date.now()}`);
                }
                
                toast.success('Pitch variations generated!', { id: 'generate' });
            } else {
                const errorMsg = result.error || result.details || 'Failed to generate pitches';
                console.error('❌ [PitchGenerator] Generation failed:', {
                    error: errorMsg,
                    fullResult: result
                });
                toast.error(`Generation failed: ${errorMsg}`, { id: 'generate' });
            }
        } catch (error) {
            console.error('❌ [PitchGenerator] Exception thrown:', {
                name: error?.name,
                message: error?.message,
                status: error?.response?.status,
                statusText: error?.response?.statusText
            });
            console.error('❌ [PitchGenerator] Server error body:', error?.response?.data);
            console.error('❌ [PitchGenerator] Full error object:', error);
            
            const errorMsg = error.message || error.response?.data?.error || 'Failed to generate pitches';
            toast.error(`Error: ${errorMsg}`, { id: 'generate' });
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
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Select Manuscript</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DocumentSelector
                                    value={selectedDocumentId}
                                    onChange={handleDocumentSelect}
                                    filterType="MANUSCRIPT"
                                    title="Choose from Dashboard Library"
                                    description="Automatically extracts all pitch fields from your stored manuscript"
                                />

                                <div className="text-center text-xs text-slate-500 font-medium py-2">
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
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Generated Pitch Variations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {/* Voice Intensity Control */}
                                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap className="w-4 h-4 text-indigo-600" />
                                        <span className="text-sm font-semibold text-indigo-900">Voice Intensity</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setVoiceIntensity('neutral')}
                                            disabled={generating}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                voiceIntensity === 'neutral'
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                                            } disabled:opacity-50`}
                                        >
                                            Neutral
                                        </button>
                                        <button
                                            onClick={() => setVoiceIntensity('house')}
                                            disabled={generating}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                voiceIntensity === 'house'
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                                            } disabled:opacity-50`}
                                        >
                                            House
                                        </button>
                                        <button
                                            onClick={() => setVoiceIntensity('amped')}
                                            disabled={generating}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                voiceIntensity === 'amped'
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                                            } disabled:opacity-50`}
                                        >
                                            Amped
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-3">
                                        {voiceIntensity === 'neutral' && 'Default safe, still specific'}
                                        {voiceIntensity === 'house' && 'RevisionGrade standard (recommended)'}
                                        {voiceIntensity === 'amped' && 'Sharper diction, more motif pressure, less smoothing'}
                                    </p>
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

                                    <Tabs defaultValue="specific" className="space-y-4">
                                    <TabsList className="grid grid-cols-3 w-full">
                                        <TabsTrigger value="specific">One-Sentence</TabsTrigger>
                                        <TabsTrigger value="elevator">Elevator</TabsTrigger>
                                        <TabsTrigger value="hollywood">Hollywood</TabsTrigger>
                                    </TabsList>

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