import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, BookOpen, Target, Sparkles, Loader2, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const GENRES_UPLOAD = [
    { value: 'thriller', label: 'Thriller' },
    { value: 'mystery', label: 'Mystery' },
    { value: 'literary_fiction', label: 'Literary Fiction' },
    { value: 'romance', label: 'Romance' },
    { value: 'fantasy', label: 'Fantasy' },
    { value: 'sci_fi', label: 'Science Fiction' },
    { value: 'historical', label: 'Historical Fiction' },
    { value: 'horror', label: 'Horror' },
    { value: 'ya', label: 'Young Adult' },
];

const GENRES_PREVIOUS = [
    { value: 'auto', label: '✨ Let RevisionGrade Choose (Recommended)' },
    ...GENRES_UPLOAD
];

export default function Comparables() {
    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedGenreForPrevious, setSelectedGenreForPrevious] = useState('auto');
    const [generating, setGenerating] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [extractedText, setExtractedText] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);

    // Fetch user's manuscripts
    const { data: manuscripts = [], isLoading } = useQuery({
        queryKey: ['manuscripts'],
        queryFn: async () => {
            const results = await base44.entities.Manuscript.list('-created_date');
            return results.filter(m => m.status === 'ready');
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
        setUploadedFile(file.name);

        try {
            toast.loading('Uploading manuscript...', { id: 'upload' });

            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            const file_url = uploadResult?.file_url;

            if (!file_url) {
                throw new Error('Upload failed');
            }

            toast.loading('Extracting text from manuscript...', { id: 'upload' });

            const ingestionResult = await base44.functions.invoke('ingestUploadedFileToText', { file_url });
            const ingestionData = ingestionResult.data || ingestionResult;

            if (!ingestionData.success) {
                throw new Error(ingestionData.error?.message || 'Text extraction failed');
            }

            setExtractedText(ingestionData.text);
            console.log(`✅ Extracted ${ingestionData.meta.charCount} characters from ${ingestionData.meta.filename}`);
            
            toast.success(`File loaded: ${ingestionData.meta.charCount.toLocaleString()} characters extracted`, { id: 'upload' });
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(`Upload failed: ${error.message}`, { id: 'upload' });
            setUploadedFile(null);
            setExtractedText('');
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleGenerateFromUpload = async () => {
        if (!selectedGenre) {
            toast.error('Please select a genre first');
            return;
        }

        if (!extractedText) {
            toast.error('Please upload a manuscript first');
            return;
        }

        setGenerating(true);
        try {
            console.log('Sending payload:', { manuscriptText: extractedText?.substring(0, 100), uploadedFilename: uploadedFile, genre: selectedGenre });
            const { data } = await base44.functions.invoke('generateComparables', {
                manuscriptText: extractedText,
                uploadedFilename: uploadedFile,
                genre: selectedGenre
            });

            if (data.success) {
                toast.success('Comparables report generated!');
                window.location.href = createPageUrl('ComparativeReport') + `?reportId=${data.report_id}`;
            } else {
                toast.error(data.error || 'Failed to generate comparables');
            }
        } catch (error) {
            console.error('Comparables error:', error);
            console.error('Backend response:', error?.response?.data);
            console.error('Request payload keys:', error?.config?.data ? Object.keys(JSON.parse(error.config.data)) : 'N/A');
            toast.error(error?.response?.data?.error || 'Failed to generate comparables report');
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerate = async (manuscriptId) => {
        if (!selectedGenreForPrevious) {
            toast.error('Please select a genre first');
            return;
        }

        setGenerating(true);
        try {
            console.log('Sending (previous ms):', { manuscriptId, genre: selectedGenreForPrevious });
            const { data } = await base44.functions.invoke('generateComparables', {
                manuscriptId,
                genre: selectedGenreForPrevious
            });

            if (data.success) {
                toast.success('Comparables report generated!');
                window.location.href = createPageUrl('ComparativeReport') + `?reportId=${data.report_id}`;
            } else {
                toast.error(data.error || 'Failed to generate comparables');
            }
        } catch (error) {
            console.error('Comparables error (previous ms):', error);
            console.error('Backend response:', error?.response?.data);
            toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to generate comparables report');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Genre Comparables Analysis
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                        Compare Your Work to Genre Benchmarks
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
                        See how your manuscript stacks up against 100+ bestsellers from 2018-2025. 
                        Get Winslow-style comparative analysis across all 12 story criteria.
                    </p>
                </div>

                {/* How It Works */}
                <Card className="mb-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            How Comparables Work
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                            <div className="space-y-2">
                                <div className="font-semibold text-slate-900">1. Auto-Detect Genre</div>
                                <p className="text-sm text-slate-600">
                                    We analyze your manuscript's WAVE metadata to identify your genre and subgenre.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-slate-900">2. Match 100+ Titles</div>
                                <p className="text-sm text-slate-600">
                                    Compare against bestselling titles (2018-2025) in your genre using our 12 criteria.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-slate-900">3. Positioning Report</div>
                                <p className="text-sm text-slate-600">
                                    Get detailed comparisons showing where you excel and where to improve for agents.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="font-semibold text-indigo-900 mb-2">Example Output:</div>
                            <div className="text-sm space-y-1 text-slate-700">
                                <div>• Hook: Your MS 8.2 vs Genre Avg 7.5 ✓</div>
                                <div>• Pacing: Your MS 7.9 vs Genre Avg 8.1</div>
                                <div>• Voice: Your MS 8.5 vs Genre Avg 7.8 ✓</div>
                                <div>• Market Position: "Thriller lane – stronger voice, tighten pacing"</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Upload Section */}
                <Card className="mb-8 border-2 border-indigo-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5 text-indigo-600" />
                            Upload Manuscript for Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 rounded-lg bg-indigo-50 border-2 border-dashed border-indigo-300">
                            <div className="text-center">
                                <Upload className="w-10 h-10 mx-auto mb-3 text-indigo-600" />
                                <p className="text-sm font-medium text-indigo-900 mb-2">
                                    Upload a DOCX, PDF, or TXT file
                                </p>
                                <p className="text-xs text-indigo-700 mb-4">
                                    We will extract readable text before analysis begins
                                </p>
                                <input
                                    type="file"
                                    id="comparables-upload"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.txt"
                                />
                                <label htmlFor="comparables-upload">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
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
                                                    Choose File
                                                </>
                                            )}
                                        </span>
                                    </Button>
                                </label>
                                <p className="text-xs text-slate-500 mt-3">
                                    Maximum 25MB
                                </p>
                            </div>
                        </div>

                        {uploadedFile && extractedText && (
                            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-green-900 mb-1">
                                            File loaded successfully
                                        </p>
                                        <p className="text-xs text-green-700 mb-2">
                                            Filename: {uploadedFile}
                                        </p>
                                        <p className="text-xs text-green-700">
                                            Text extracted: {extractedText.length.toLocaleString()} characters
                                        </p>
                                        <details className="mt-3">
                                            <summary className="text-xs font-medium text-green-800 cursor-pointer hover:text-green-900">
                                                Preview extracted text
                                            </summary>
                                            <div className="mt-2 p-3 bg-white rounded border border-green-200 max-h-40 overflow-y-auto">
                                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                                    {extractedText.substring(0, 500)}...
                                                </p>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            </div>
                        )}

                        {extractedText && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Select Genre for Analysis
                                    </label>
                                    <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choose your genre..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {GENRES_UPLOAD.map((genre) => (
                                                <SelectItem key={genre.value} value={genre.value}>
                                                    {genre.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={handleGenerateFromUpload}
                                    disabled={!selectedGenre || generating}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Comparables Analysis
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center text-sm text-slate-500 font-medium my-6">
                    OR USE A PREVIOUS MANUSCRIPT
                </div>

                {/* Genre Selection for Previous Manuscripts */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Select Genre for Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedGenreForPrevious} onValueChange={setSelectedGenreForPrevious}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose your genre..." />
                            </SelectTrigger>
                            <SelectContent>
                                {GENRES_PREVIOUS.map((genre) => (
                                    <SelectItem key={genre.value} value={genre.value}>
                                        {genre.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Manuscripts List */}
                <div className="space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Your Ready Manuscripts</h2>
                    
                    {isLoading ? (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                            <p className="text-slate-600 mt-3">Loading manuscripts...</p>
                        </div>
                    ) : manuscripts.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-600 mb-4">No evaluated manuscripts yet</p>
                                <Link to={createPageUrl('UploadManuscript')}>
                                    <Button>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Upload Manuscript
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        manuscripts.map((ms) => (
                            <Card key={ms.id} className="border-2 hover:border-indigo-200 transition-all">
                                <CardContent className="py-6">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">{ms.title}</h3>
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-slate-600">
                                                <span>{ms.word_count?.toLocaleString()} words</span>
                                                {ms.spine_score && (
                                                    <Badge variant="outline">
                                                        Spine Score: {ms.spine_score.toFixed(1)}/10
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleGenerate(ms.id)}
                                            disabled={!selectedGenreForPrevious || generating}
                                            className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
                                        >
                                            {generating ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <TrendingUp className="w-4 h-4 mr-2" />
                                                    Run Comparables
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* CTA */}
                <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 text-center">
                    <Target className="w-12 h-12 mx-auto text-indigo-600 mb-4" />
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                        Position for Agents
                    </h3>
                    <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                        Understanding how your manuscript compares to genre standards helps you pitch confidently 
                        and revise strategically. No competitor offers this level of benchmarking.
                    </p>
                </div>
            </div>
        </div>
    );
}