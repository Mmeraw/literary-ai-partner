import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, Download, Loader2, Package, CheckCircle2, FileText, Film, BookOpen, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { StarRating, CanonAccuracyCheck } from '@/components/FeedbackWidget';
import { useRevisionFlow } from '@/components/useRevisionFlow';
import RevisionViewer from '@/components/RevisionViewer';
import RevisionControls from '@/components/RevisionControls';
import { exportTxt } from '@/components/utils/exportTxt';
import DocumentSelector from '@/components/DocumentSelector';

export default function CompletePackage() {
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
        uniqueHook: '',
        authorName: '',
        authorBio: '',
        publishingCredits: ''
    });

    const [generating, setGenerating] = useState(false);
    const [packageData, setPackageData] = useState(null);
    const [selectedManuscriptId, setSelectedManuscriptId] = useState('');
    const [loadingManuscript, setLoadingManuscript] = useState(false);
    const [loadingBio, setLoadingBio] = useState(false);
    const [includeCreatorMark, setIncludeCreatorMark] = useState(true);
    const [voiceIntensity, setVoiceIntensity] = useState('house');
    
    const packageRevision = useRevisionFlow('complete_submission');

    const handleDocumentSelect = async (docId) => {
        setSelectedDocumentId(docId);
        const doc = await base44.entities.Document.get(docId);
        if (doc.content_reference_id) {
            setSelectedManuscriptId(doc.content_reference_id);
            await loadManuscript(doc.content_reference_id);
        }
    };

    // Fetch user's manuscripts
    const { data: manuscripts = [], isLoading: manuscriptsLoading } = useQuery({
        queryKey: ['manuscripts'],
        queryFn: async () => {
            const data = await base44.entities.Manuscript.list('-created_date');
            return data.sort((a, b) => a.title.localeCompare(b.title));
        },
        initialData: []
    });



    const loadManuscript = async (manuscriptId) => {
        if (manuscriptId === 'new') {
            setManuscriptInfo({
                title: '',
                genre: '',
                wordCount: '',
                logline: '',
                keyThemes: '',
                protagonist: '',
                stakes: '',
                setting: '',
                uniqueHook: '',
                authorName: '',
                authorBio: '',
                publishingCredits: ''
            });
            return;
        }

        const manuscript = manuscripts.find(m => m.id === manuscriptId);
        if (!manuscript) return;

        setLoadingManuscript(true);
        toast.info('Analyzing manuscript and pre-filling fields...');

        try {
            const response = await base44.functions.invoke('prefillPackageFields', {
                manuscript_id: manuscriptId,
                voiceIntensity
            });

            if (response.data.success) {
                setManuscriptInfo({
                    ...manuscriptInfo,
                    ...response.data.fields
                });
                toast.success('All fields populated! Review and edit as needed.');
            } else {
                // Fallback to basic loading
                setManuscriptInfo({
                    ...manuscriptInfo,
                    title: manuscript.title || '',
                    wordCount: manuscript.word_count?.toString() || '',
                    logline: manuscript.spine_evaluation?.logline || '',
                    keyThemes: manuscript.spine_evaluation?.themes?.join(', ') || '',
                    protagonist: manuscript.spine_evaluation?.protagonist || '',
                    stakes: manuscript.spine_evaluation?.stakes || '',
                    setting: manuscript.spine_evaluation?.setting || ''
                });
                toast.warning('Basic info loaded. Please fill in remaining fields.');
            }
        } catch (error) {
            console.error('Load manuscript error:', error);
            toast.error('Failed to analyze manuscript. Please fill fields manually.');
        } finally {
            setLoadingManuscript(false);
        }
    };

    const handleCVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoadingBio(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            const fileName = file.name.toLowerCase();
            const isWordDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc');
            const isPdf = fileName.endsWith('.pdf');
            const isRtf = fileName.endsWith('.rtf');
            const isTxt = fileName.endsWith('.txt');
            
            let cvText = '';
            
            if (isTxt) {
                const response = await fetch(file_url);
                if (!response.ok) throw new Error('Failed to fetch TXT file');
                cvText = await response.text();
            } else if (isWordDoc || isPdf || isRtf) {
                const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
                    file_url,
                    json_schema: { type: "object", properties: { text: { type: "string" } } }
                });
                
                if (extracted.status !== 'success') {
                    throw new Error(`Failed to extract ${isPdf ? 'PDF' : 'RTF'} text`);
                }
                cvText = extracted.output?.text || '';
            } else {
                throw new Error('Unsupported file type. Please upload DOC, DOCX, PDF, RTF, or TXT.');
            }
            
            if (!cvText || cvText.length < 50) {
                throw new Error('CV text too short or empty');
            }
            
            // Generate bio from CV text
            const bio = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a professional author bio (150-200 words) for literary agent submissions based on this CV/resume:

${cvText}

Create a concise, agent-ready bio that:
- Highlights relevant credentials (degrees, professional experience, writing awards)
- Mentions any published work or writing credentials
- Focuses on elements that establish writing authority
- Is written in third person
- Is professional but engaging

Return only the bio text, no additional commentary.`
            });

            setManuscriptInfo(prev => ({ 
                ...prev, 
                authorBio: bio
            }));
            toast.success('Bio generated from CV!');
        } catch (error) {
            console.error('CV upload error:', error);
            toast.error(error.message || 'Failed to process CV');
        } finally {
            setLoadingBio(false);
            e.target.value = '';
        }
    };

    const generateCompletePackage = async () => {
        // Validation
        const missingFields = [];
        if (!manuscriptInfo.title) missingFields.push('Title');
        if (!manuscriptInfo.logline) missingFields.push('Logline');
        if (!manuscriptInfo.authorName) missingFields.push('Author Name');
        if (!manuscriptInfo.wordCount) missingFields.push('Word Count');

        if (missingFields.length > 0) {
            toast.error(
                <div>
                    <div className="font-semibold">Required fields missing:</div>
                    <div className="text-sm mt-1">{missingFields.join(', ')}</div>
                </div>,
                { duration: 4000 }
            );
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateCompletePackage', {
                manuscriptInfo,
                voiceIntensity
            });

            if (response.data.success) {
                const pkg = response.data.package;

                // Check for placeholders
                const hasPlaceholders = 
                    JSON.stringify(pkg).includes('[Author Name]') ||
                    JSON.stringify(pkg).includes('[Word Count]') ||
                    JSON.stringify(pkg).includes('[comparable');

                setPackageData(response.data.package);
                
                // Create baseline OutputVersion
                await packageRevision.createBaseline(pkg.queryLetter, `package_${Date.now()}`);

                // Track behavioral signal - successful generation
                try {
                    await base44.entities.Analytics.create({
                        page: 'CompletePackage',
                        path: '/complete-package/generated',
                        event_type: 'package_generated',
                        metadata: { has_placeholders: hasPlaceholders }
                    });
                } catch (e) {
                    console.error('Analytics error:', e);
                }

                if (hasPlaceholders) {
                    toast.warning(
                        <div>
                            <div className="font-semibold">Package generated with placeholders</div>
                            <div className="text-sm mt-1">Review and fill in missing details before submission</div>
                        </div>,
                        { duration: 5000 }
                    );
                } else {
                    toast.success('Complete submission package generated!');
                }
            } else {
                toast.error(response.data.error || 'Failed to generate package');
            }
        } catch (error) {
            console.error('Package generation error:', error);
            toast.error('Failed to generate package');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = async (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
        
        // Track behavioral signal - user accepted output
        try {
            await base44.entities.Analytics.create({
                page: 'CompletePackage',
                path: '/complete-package/copy',
                event_type: 'content_copied',
                metadata: { content_type: label }
            });
        } catch (e) {
            console.error('Analytics error:', e);
        }
    };

    const downloadAll = async () => {
        if (!packageData) return;
        
        // Track behavioral signal - user downloaded package
        try {
            await base44.entities.Analytics.create({
                page: 'CompletePackage',
                path: '/complete-package/download',
                event_type: 'package_downloaded',
                metadata: { creator_mark_included: includeCreatorMark }
            });
        } catch (e) {
            console.error('Analytics error:', e);
        }
        
        let content = `
COMPLETE SUBMISSION PACKAGE
${manuscriptInfo.title}

================
ONE-SENTENCE PITCHES
================
Specific (Agent Submissions):
${packageData.pitches.oneSentenceSpecific}

General (Networking):
${packageData.pitches.oneSentenceGeneral}

================
ELEVATOR PITCHES
================
Conversational:
${packageData.pitches.conversational}

Structured:
${packageData.pitches.elevator}

================
HOLLYWOOD LOGLINE
================
${packageData.pitches.hollywood}

================
SYNOPSES
================
Query Synopsis (250-300 words):
${packageData.synopses.query}

Standard Synopsis (500-750 words):
${packageData.synopses.standard}

Extended Synopsis (1000-1500 words):
${packageData.synopses.extended}

================
AUTHOR BIO
================
${packageData.authorBio}

================
QUERY LETTER
================
${packageData.queryLetter}
        `.trim();

        // Append creator mark if enabled
        if (includeCreatorMark) {
            content += `\n\n${'='.repeat(60)}\n\nCrafted with RevisionGrade™\nWhere Evolution Meets Soul™`;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manuscriptInfo.title.replace(/\s/g, '_')}_Complete_Package.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Complete package downloaded!');
    };

    const handleRequestRevision = async () => {
        if (!packageData?.queryLetter) return;
        toast.info('Requesting AI revision...');
        const revisedContent = packageData.queryLetter + '\n\n[AI-revised version]';
        await packageRevision.requestRevision(packageData.queryLetter, revisedContent);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Package className="w-4 h-4 mr-2" />
                        Complete Submission Package
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                        Generate Everything at Once
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
                        One form. One click. All pitches, synopses, bio, and query letter—ready in minutes.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
                    {/* Input Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Project Information</CardTitle>
                                <p className="text-sm text-slate-600 mt-1">For manuscripts, screenplays, or any complete work</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DocumentSelector
                                    value={selectedDocumentId}
                                    onChange={handleDocumentSelect}
                                    filterType="MANUSCRIPT"
                                    title="Choose from Dashboard Library"
                                    description="Auto-populates all fields from your stored manuscript"
                                />

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
                                        Word Count *
                                    </label>
                                    <Input
                                        value={manuscriptInfo.wordCount}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, wordCount: e.target.value})}
                                        placeholder="122,000"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Required for query letter closing
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Logline/Pitch *
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
                                        placeholder="Kingdom Lake, British Columbia"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Unique Hook
                                    </label>
                                    <Textarea
                                        value={manuscriptInfo.uniqueHook}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, uniqueHook: e.target.value})}
                                        placeholder="What makes your story different?"
                                        className="h-24"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Author Name *
                                    </label>
                                    <Input
                                        value={manuscriptInfo.authorName}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, authorName: e.target.value})}
                                        placeholder="Michael J. Meraw"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Used for bio and query signature - never fabricated
                                    </p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium text-slate-700">
                                            Author Background
                                        </label>
                                        <div>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.rtf,.txt"
                                                onChange={handleCVUpload}
                                                className="hidden"
                                                id="cv-upload"
                                                disabled={loadingBio}
                                            />
                                            <label htmlFor="cv-upload" className="cursor-pointer inline-block">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={loadingBio}
                                                    asChild
                                                >
                                                    <span>
                                                        {loadingBio ? (
                                                            <>
                                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                Processing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload className="w-3 h-3 mr-1" />
                                                                Upload File
                                                            </>
                                                        )}
                                                    </span>
                                                </Button>
                                            </label>
                                        </div>
                                    </div>
                                    <Textarea
                                        value={manuscriptInfo.authorBio}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, authorBio: e.target.value})}
                                        placeholder="Former pilot, MBA, creative writing background..."
                                        className="h-24"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Publishing Credits (if any)
                                    </label>
                                    <Input
                                        value={manuscriptInfo.publishingCredits}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, publishingCredits: e.target.value})}
                                        placeholder="Short stories in Literary Magazine, etc."
                                    />
                                </div>

                                <Button
                                    onClick={generateCompletePackage}
                                    disabled={generating || loadingManuscript}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Generating Complete Package...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            Generate Complete Submission Package
                                        </>
                                    )}
                                </Button>

                                {packageData && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                            <input
                                                type="checkbox"
                                                id="creator-mark"
                                                checked={includeCreatorMark}
                                                onChange={(e) => setIncludeCreatorMark(e.target.checked)}
                                                className="w-4 h-4 text-indigo-600"
                                            />
                                            <label htmlFor="creator-mark" className="text-sm text-slate-700 cursor-pointer">
                                                Include Creator Mark (Where Evolution Meets Soul™)
                                            </label>
                                        </div>
                                        <Button
                                            onClick={downloadAll}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download Complete Package
                                        </Button>
                                        <Button
                                            onClick={() => window.location.href = createPageUrl(`LogoGenerator?title=${encodeURIComponent(manuscriptInfo.title)}&synopsis=${encodeURIComponent(packageData?.synopses?.query || '')}&genre=${encodeURIComponent(manuscriptInfo.genre)}`)}
                                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Brand Your IP → Create Logo
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Output Section */}
                    <div className="lg:col-span-3 space-y-6">
                        {!packageData ? (
                            <Card className="border-2 border-dashed border-slate-300">
                                <CardContent className="pt-12 pb-8 text-center">
                                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                                        Your Complete Package Will Appear Here
                                    </h3>
                                    <p className="text-slate-600 mb-6">
                                        Fill in the manuscript details and click generate
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                                        {[
                                            'Pitch Variations (5)',
                                            'Synopses (3 lengths)',
                                            'Author Bio',
                                            'Query Letter',
                                            'Market Comps',
                                            'Film Pitch Deck (Pro)'
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Complete Submission Package</CardTitle>
                                        <div className="flex gap-2">
                                            {(JSON.stringify(packageData).includes('[Author Name]') || 
                                              JSON.stringify(packageData).includes('[Word Count]') ||
                                              JSON.stringify(packageData).includes('[comparable')) && (
                                                <Badge className="bg-amber-100 text-amber-700">
                                                    ⚠️ Needs Review
                                                </Badge>
                                            )}
                                            <Badge className="bg-emerald-100 text-emerald-700">
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Generated
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="pitches" className="space-y-4">
                                        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
                                            <TabsTrigger value="pitches">Pitches</TabsTrigger>
                                            <TabsTrigger value="synopses">Synopses</TabsTrigger>
                                            <TabsTrigger value="bio">Bio</TabsTrigger>
                                            <TabsTrigger value="query">Query</TabsTrigger>
                                        </TabsList>

                                        {/* Pitches Tab */}
                                        <TabsContent value="pitches" className="space-y-4">
                                            {[
                                                { label: 'One-Sentence (Specific)', key: 'oneSentenceSpecific' },
                                                { label: 'One-Sentence (General)', key: 'oneSentenceGeneral' },
                                                { label: 'Conversational Elevator', key: 'conversational' },
                                                { label: 'Structured Elevator', key: 'elevator' },
                                                { label: 'Hollywood Logline', key: 'hollywood' }
                                            ].map((pitch) => (
                                                <div key={pitch.key}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Badge variant="outline">{pitch.label}</Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(packageData.pitches[pitch.key], pitch.label)}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                                        <p className="text-slate-800 leading-relaxed">{packageData.pitches[pitch.key]}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </TabsContent>

                                        {/* Synopses Tab */}
                                        <TabsContent value="synopses" className="space-y-4">
                                            {[
                                                { label: 'Query Synopsis (250-300 words)', key: 'query' },
                                                { label: 'Standard Synopsis (500-750 words)', key: 'standard' },
                                                { label: 'Extended Synopsis (1000-1500 words)', key: 'extended' }
                                            ].map((synopsis) => (
                                                <div key={synopsis.key}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Badge variant="outline">{synopsis.label}</Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(packageData.synopses[synopsis.key], synopsis.label)}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-96 overflow-y-auto">
                                                        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{packageData.synopses[synopsis.key]}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </TabsContent>

                                        {/* Author Bio Tab */}
                                        <TabsContent value="bio" className="space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <Badge variant="outline">Professional Author Bio</Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(packageData.authorBio, 'Author bio')}
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{packageData.authorBio}</p>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* Query Letter Tab */}
                                        <TabsContent value="query" className="space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <Badge variant="outline">Draft Query Letter</Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(packageData.queryLetter, 'Query letter')}
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                {packageRevision.showViewer && packageRevision.revisionEventId ? (
                                                    <RevisionViewer
                                                        revisionEventId={packageRevision.revisionEventId}
                                                        onApprove={packageRevision.approveRevision}
                                                    />
                                                ) : (
                                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-96 overflow-y-auto">
                                                        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{packageData.queryLetter}</p>
                                                    </div>
                                                )}
                                                <RevisionControls
                                                    hasBaseline={!!packageRevision.baselineVersionId}
                                                    hasRevision={packageRevision.hasRevision}
                                                    showingViewer={packageRevision.showViewer}
                                                    processing={packageRevision.processing}
                                                    onRequestRevision={handleRequestRevision}
                                                    onShowViewer={() => packageRevision.setShowViewer(true)}
                                                    onApprove={packageRevision.approveRevision}
                                                    onClose={packageRevision.closeViewer}
                                                />
                                            </div>
                                        </TabsContent>
                                        </Tabs>

                                        {/* Feedback Section */}
                                        <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                                        <StarRating
                                           label="Rate this submission package"
                                           onRate={async (rating) => {
                                               try {
                                                   await base44.entities.Analytics.create({
                                                       page: 'CompletePackage',
                                                       path: '/complete-package/rating',
                                                       event_type: 'user_rating',
                                                       metadata: { rating }
                                                   });
                                               } catch (e) {
                                                   console.error('Analytics error:', e);
                                               }
                                           }}
                                        />
                                        <CanonAccuracyCheck
                                           onReport={async () => {
                                               try {
                                                   await base44.entities.Analytics.create({
                                                       page: 'CompletePackage',
                                                       path: '/complete-package/report',
                                                       event_type: 'canon_violation_reported',
                                                       metadata: { package_content: JSON.stringify(packageData).substring(0, 500) }
                                                   });
                                               } catch (e) {
                                                   console.error('Analytics error:', e);
                                               }
                                           }}
                                        />
                                        </div>
                                        </CardContent>
                                        </Card>
                                        )}

                        {/* What's Included */}
                        <Card className="border-indigo-100">
                            <CardHeader>
                                <CardTitle className="text-base">What's Included</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600 mt-0.5" />
                                    <div>
                                        <span className="font-semibold text-slate-800">5 Pitch Variations:</span>
                                        <p className="text-slate-600">Specific, general, conversational, elevator, Hollywood logline</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600 mt-0.5" />
                                    <div>
                                        <span className="font-semibold text-slate-800">3 Synopsis Lengths:</span>
                                        <p className="text-slate-600">Query (250-300w), Standard (500-750w), Extended (1000-1500w)</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600 mt-0.5" />
                                    <div>
                                        <span className="font-semibold text-slate-800">Professional Author Bio:</span>
                                        <p className="text-slate-600">Agent-submission ready</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600 mt-0.5" />
                                    <div>
                                        <span className="font-semibold text-slate-800">Draft Query Letter:</span>
                                        <p className="text-slate-600">Integrated pitch + synopsis + bio</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Film className="w-4 h-4 text-purple-600 mt-0.5" />
                                    <div>
                                        <span className="font-semibold text-slate-800">Film Pitch Content (Pro):</span>
                                        <p className="text-slate-600">12-slide structured text—ready for your design template</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}