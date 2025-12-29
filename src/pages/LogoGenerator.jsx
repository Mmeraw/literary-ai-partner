import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Download, Loader2, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function LogoGenerator() {
    const [formData, setFormData] = useState({
        title: '',
        synopsis: '',
        genre: '',
        themes: ''
    });
    const [generating, setGenerating] = useState(false);
    const [logos, setLogos] = useState(null);
    const [themeAnalysis, setThemeAnalysis] = useState(null);

    // Pre-fill from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const title = params.get('title');
        const synopsis = params.get('synopsis');
        const genre = params.get('genre');

        if (title || synopsis || genre) {
            setFormData({
                title: title || '',
                synopsis: synopsis || '',
                genre: genre || '',
                themes: ''
            });
        }
    }, []);

    const generateLogos = async () => {
        if (!formData.title || !formData.synopsis) {
            toast.error('Title and synopsis required');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateStoryLogo', formData);

            if (response.data.success) {
                setLogos(response.data.logos);
                setThemeAnalysis(response.data.themeAnalysis);
                toast.success('4 logo variations generated!');
            } else {
                toast.error(response.data.error || 'Failed to generate logos');
            }
        } catch (error) {
            console.error('Generation error:', error);
            toast.error('Failed to generate logos');
        } finally {
            setGenerating(false);
        }
    };

    const downloadLogo = async (logoUrl, variant) => {
        try {
            const response = await fetch(logoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${formData.title.replace(/\s/g, '_')}_Logo_${variant.replace(/\s/g, '_')}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success(`${variant} logo downloaded`);
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download logo');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-6xl mx-auto px-6 py-12">
                <Link to={createPageUrl('Dashboard')}>
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </Link>

                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Logo Generator
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Brand Your Story
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Generate professional logos based on your story's themes, symbols, and mood
                    </p>
                </div>

                {!logos ? (
                    <Card className="border-0 shadow-lg max-w-3xl mx-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5" />
                                Story Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Title *
                                </label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="The Lost World of Mythoamphibia"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Genre
                                </label>
                                <Input
                                    value={formData.genre}
                                    onChange={(e) => setFormData(prev => ({ ...prev, genre: e.target.value }))}
                                    placeholder="Eco-horror, Dark Fantasy"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Synopsis or Description *
                                </label>
                                <Textarea
                                    value={formData.synopsis}
                                    onChange={(e) => setFormData(prev => ({ ...prev, synopsis: e.target.value }))}
                                    placeholder="Brief synopsis of your story, key themes, and central conflicts..."
                                    className="min-h-[150px]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Key Themes or Symbols (Optional)
                                </label>
                                <Input
                                    value={formData.themes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, themes: e.target.value }))}
                                    placeholder="ancient ruins, extinction, amphibian empire"
                                />
                            </div>

                            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                                <p className="text-sm text-slate-700">
                                    <strong>How it works:</strong> AI analyzes your story to extract visual themes, 
                                    symbols, and mood, then generates 4 professional logo variations optimized for 
                                    covers, pitch decks, and promotional materials.
                                </p>
                            </div>

                            <Button
                                onClick={generateLogos}
                                disabled={generating || !formData.title || !formData.synopsis}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                                size="lg"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Generating Logos...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5 mr-2" />
                                        Generate 4 Logo Variations
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {/* Theme Analysis */}
                        {themeAnalysis && (
                            <Card className="border-0 shadow-lg">
                                <CardHeader>
                                    <CardTitle>Visual Theme Analysis</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-1">Primary Symbol</div>
                                            <div className="text-slate-900">{themeAnalysis.primary_symbol}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-1">Color Palette</div>
                                            <div className="text-slate-900">{themeAnalysis.color_palette}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-1">Mood</div>
                                            <div className="text-slate-900">{themeAnalysis.mood}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-1">Style</div>
                                            <div className="text-slate-900">{themeAnalysis.style}</div>
                                        </div>
                                    </div>
                                    {themeAnalysis.secondary_elements && themeAnalysis.secondary_elements.length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-sm font-medium text-slate-700 mb-2">Supporting Elements</div>
                                            <div className="flex flex-wrap gap-2">
                                                {themeAnalysis.secondary_elements.map((elem, idx) => (
                                                    <Badge key={idx} variant="outline">{elem}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Logo Grid */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {logos.map((logo, idx) => (
                                <Card key={idx} className="border-0 shadow-lg">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg">{logo.variant}</CardTitle>
                                            <Badge className="bg-emerald-100 text-emerald-700">
                                                Variant {idx + 1}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                                            <img 
                                                src={logo.url} 
                                                alt={`${logo.variant} logo`}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <Button
                                            onClick={() => downloadLogo(logo.url, logo.variant)}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download {logo.variant}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="flex justify-center gap-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setLogos(null);
                                    setThemeAnalysis(null);
                                }}
                            >
                                Generate New Logos
                            </Button>
                            <Link to={createPageUrl('Dashboard')}>
                                <Button>
                                    Back to Dashboard
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}