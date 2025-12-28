import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, Download, Sparkles, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function QueryLetter() {
    const [formData, setFormData] = useState({
        manuscriptTitle: '',
        genre: '',
        wordCount: '',
        synopsis: '',
        bio: '',
        agentName: ''
    });
    const [generating, setGenerating] = useState(false);
    const [queryLetter, setQueryLetter] = useState('');

    const handleGenerate = async () => {
        if (!formData.manuscriptTitle || !formData.synopsis) {
            toast.error('Please provide at least a title and synopsis');
            return;
        }

        setGenerating(true);
        try {
            // Placeholder for future backend integration
            toast.info('Query letter generation coming soon!');
            // const response = await base44.functions.invoke('generateQueryLetter', formData);
        } catch (error) {
            toast.error('Failed to generate query letter');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(queryLetter);
        toast.success('Query letter copied to clipboard!');
    };

    const downloadPDF = () => {
        toast.info('PDF export coming soon!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Mail className="w-4 h-4 mr-2" />
                        Query Letter Builder
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Generate Your Query Letter
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Create professional query letters optimized for literary agents. Follow industry standards with personalized touches.
                    </p>
                </div>

                {/* Input Form */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Query Letter Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Manuscript Title</label>
                                <Input
                                    placeholder="Your manuscript title"
                                    value={formData.manuscriptTitle}
                                    onChange={(e) => setFormData({...formData, manuscriptTitle: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Genre</label>
                                <Input
                                    placeholder="e.g., Literary Thriller"
                                    value={formData.genre}
                                    onChange={(e) => setFormData({...formData, genre: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Word Count</label>
                                <Input
                                    placeholder="e.g., 85,000"
                                    value={formData.wordCount}
                                    onChange={(e) => setFormData({...formData, wordCount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Agent Name (Optional)</label>
                                <Input
                                    placeholder="For personalization"
                                    value={formData.agentName}
                                    onChange={(e) => setFormData({...formData, agentName: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Synopsis/Hook</label>
                            <Textarea
                                placeholder="Your compelling synopsis or pitch (2-3 paragraphs)"
                                value={formData.synopsis}
                                onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                                className="min-h-[150px]"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Author Bio</label>
                            <Textarea
                                placeholder="Your relevant writing credentials, publications, or background"
                                value={formData.bio}
                                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                className="min-h-[100px]"
                            />
                        </div>

                        <Button 
                            onClick={handleGenerate}
                            disabled={generating || !formData.manuscriptTitle || !formData.synopsis}
                            className="w-full"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating Query Letter...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Query Letter
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Generated Query Letter */}
                {queryLetter && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Query Letter</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 whitespace-pre-wrap font-serif">
                                {queryLetter}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={copyToClipboard}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy to Clipboard
                                </Button>
                                <Button variant="outline" onClick={downloadPDF}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export as PDF
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Tips */}
                <Card className="mt-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle>Query Letter Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Keep it to one page (under 400 words)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Personalize each query with agent-specific details</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Start with a compelling hook in your first paragraph</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Include genre, word count, and comparative titles</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Keep your bio relevant to your manuscript</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Coming Soon */}
                <div className="mt-8 p-6 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 text-center">
                        <strong>Coming in Q2:</strong> PDF export with professional formatting and agent-specific customization templates.
                    </p>
                </div>
            </div>
        </div>
    );
}