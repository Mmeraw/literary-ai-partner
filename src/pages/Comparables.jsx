import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, BookOpen, Target, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const GENRES = [
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

export default function Comparables() {
    const [selectedGenre, setSelectedGenre] = useState('');
    const [generating, setGenerating] = useState(false);

    // Fetch user's manuscripts
    const { data: manuscripts = [], isLoading } = useQuery({
        queryKey: ['manuscripts'],
        queryFn: async () => {
            const results = await base44.entities.Manuscript.list('-created_date');
            return results.filter(m => m.status === 'ready');
        }
    });

    const handleGenerate = async (manuscriptId) => {
        if (!selectedGenre) {
            toast.error('Please select a genre first');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateComparables', {
                manuscriptId,
                genre: selectedGenre
            });

            if (response.data.success) {
                toast.success('Comparables report generated!');
                // Navigate to report or show results
            } else {
                toast.error(response.data.error || 'Failed to generate comparables');
            }
        } catch (error) {
            console.error('Comparables error:', error);
            toast.error('Failed to generate comparables report');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Genre Comparables Analysis
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Compare Your Work to Genre Benchmarks
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
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
                        <div className="grid md:grid-cols-3 gap-6">
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

                {/* Genre Selection */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Select Genre for Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose your genre..." />
                            </SelectTrigger>
                            <SelectContent>
                                {GENRES.map((genre) => (
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
                    <h2 className="text-2xl font-bold text-slate-900">Your Ready Manuscripts</h2>
                    
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
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-semibold text-slate-900 mb-2">{ms.title}</h3>
                                            <div className="flex items-center gap-4 text-sm text-slate-600">
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
                                            disabled={!selectedGenre || generating}
                                            className="bg-indigo-600 hover:bg-indigo-700"
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
                <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 text-center">
                    <Target className="w-12 h-12 mx-auto text-indigo-600 mb-4" />
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
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