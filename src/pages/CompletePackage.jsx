import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, Download, Loader2, Package, CheckCircle2, FileText, Film, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function CompletePackage() {
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

    // Fetch user's manuscripts
    const { data: manuscripts = [], isLoading: manuscriptsLoading } = useQuery({
        queryKey: ['manuscripts'],
        queryFn: () => base44.entities.Manuscript.list('-created_date'),
        initialData: []
    });



    const loadManuscript = async (manuscriptId) => {
        const manuscript = manuscripts.find(m => m.id === manuscriptId);
        if (!manuscript) return;

        setLoadingManuscript(true);
        toast.info('Analyzing manuscript and pre-filling fields...');

        try {
            const response = await base44.functions.invoke('prefillPackageFields', {
                manuscript_id: manuscriptId
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

    const generateCompletePackage = async () => {
        if (!manuscriptInfo.title || !manuscriptInfo.logline) {
            toast.error('Please provide at least a title and logline');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateCompletePackage', {
                manuscriptInfo
            });

            if (response.data.success) {
                setPackageData(response.data.package);
                toast.success('Complete submission package generated!');
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

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const downloadAll = () => {
        if (!packageData) return;
        
        const content = `
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

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manuscriptInfo.title.replace(/\s/g, '_')}_Complete_Package.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Complete package downloaded!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Package className="w-4 h-4 mr-2" />
                        Complete Submission Package
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Generate Everything at Once
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        One form. One click. All pitches, synopses, bio, and query letter—ready in minutes.
                    </p>
                </div>

                <div className="grid lg:grid-cols-5 gap-8">
                    {/* Input Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Project Information</CardTitle>
                                <p className="text-sm text-slate-600 mt-1">For manuscripts, screenplays, or any complete work</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Load from Manuscript */}
                                {manuscriptsLoading || loadingManuscript ? (
                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                                        <p className="text-sm text-slate-600">
                                            {loadingManuscript ? 'Analyzing manuscript and pre-filling fields...' : 'Loading your manuscripts...'}
                                        </p>
                                    </div>
                                ) : manuscripts.length > 0 ? (
                                    <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BookOpen className="w-4 h-4 text-indigo-600" />
                                            <span className="text-sm font-semibold text-slate-800">Load from Existing Project</span>
                                        </div>
                                        <Select 
                                            value={selectedManuscriptId} 
                                            onValueChange={(value) => {
                                                setSelectedManuscriptId(value);
                                                loadManuscript(value);
                                            }}
                                            disabled={loadingManuscript}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a project to auto-populate all fields" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {manuscripts.map((manuscript) => (
                                                    <SelectItem key={manuscript.id} value={manuscript.id}>
                                                        {manuscript.title} ({manuscript.word_count?.toLocaleString()} words)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                        <p className="text-sm text-slate-700 mb-2">
                                            No projects found. <Link to={createPageUrl('UploadManuscript')} className="text-indigo-600 hover:underline font-medium">Upload your work</Link> to auto-fill these fields.
                                        </p>
                                    </div>
                                )}

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
                                        placeholder="122,000"
                                    />
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
                                        Author Name
                                    </label>
                                    <Input
                                        value={manuscriptInfo.authorName}
                                        onChange={(e) => setManuscriptInfo({...manuscriptInfo, authorName: e.target.value})}
                                        placeholder="Michael J. Meraw"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Author Background
                                    </label>
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
                                    disabled={generating || loadingManuscript || !manuscriptInfo.title || !manuscriptInfo.logline}
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
                                    <Button
                                        onClick={downloadAll}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Complete Package
                                    </Button>
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
                                        <Badge className="bg-emerald-100 text-emerald-700">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            Generated
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="pitches" className="space-y-4">
                                        <TabsList className="grid grid-cols-4 w-full">
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
                                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-h-96 overflow-y-auto">
                                                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{packageData.queryLetter}</p>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
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