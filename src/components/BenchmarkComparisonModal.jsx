import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart3, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';

const GENRES = [
    { value: 'thriller', label: 'Thriller' },
    { value: 'psychological_thriller', label: 'Psychological Thriller' },
    { value: 'literary_fiction', label: 'Literary Fiction' },
    { value: 'romance', label: 'Romance' },
    { value: 'mystery', label: 'Mystery' },
    { value: 'sci_fi', label: 'Science Fiction' },
    { value: 'fantasy', label: 'Fantasy' },
    { value: 'horror', label: 'Horror' },
    { value: 'ya', label: 'Young Adult' },
    { value: 'historical', label: 'Historical Fiction' },
    { value: 'contemporary', label: 'Contemporary Fiction' },
    { value: 'crime', label: 'Crime Fiction' },
    { value: 'suspense', label: 'Suspense' }
];

export default function BenchmarkComparisonModal({ manuscriptId, manuscriptTitle }) {
    const [open, setOpen] = useState(false);
    const [genre, setGenre] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!genre) {
            toast.error('Please select a genre');
            return;
        }

        setIsGenerating(true);

        try {
            toast.info('Generating benchmark comparison... this may take 30-60 seconds');
            
            const result = await base44.functions.invoke('generateBenchmarkComparison', {
                manuscript_id: manuscriptId,
                genre: genre,
                subgenre: null
            });

            toast.success('Comparison complete!');
            setOpen(false);
            
            // Navigate to the report
            window.location.href = createPageUrl(`ComparativeReport?id=${result.report_id}`);

        } catch (error) {
            console.error('Comparison error:', error);
            toast.error('Failed to generate comparison. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Compare to Genre Benchmarks
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Comparative Benchmark Report</DialogTitle>
                    <DialogDescription>
                        Compare "{manuscriptTitle}" against typical craft patterns for your genre
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="genre">Select Genre</Label>
                        <Select value={genre} onValueChange={setGenre}>
                            <SelectTrigger id="genre">
                                <SelectValue placeholder="Choose a genre..." />
                            </SelectTrigger>
                            <SelectContent>
                                {GENRES.map(g => (
                                    <SelectItem key={g.value} value={g.value}>
                                        {g.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-600">
                            This analysis compares your manuscript's craft patterns against typical genre standards. 
                            Results are educational and do not guarantee commercial success.
                        </p>
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={!genre || isGenerating}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating Comparison...
                            </>
                        ) : (
                            <>
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Run Comparison
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}