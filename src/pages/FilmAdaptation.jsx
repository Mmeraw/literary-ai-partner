import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Film, Sparkles, Check, Download, ArrowRight, 
    FileText, Target, TrendingUp, Zap, BookOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const pdfExamples = [
    {
        title: 'Executive Summary (12 pages)',
        subtitle: 'The Lost World of Mythoamphibia',
        description: 'Streamlined pitch deck for first contact with producers and directors',
        url: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/347d22e50_Meraw_DominatusI_LostWorldOfMythoamphibia_FilmPitchDeck_Exec_Summary.pdf',
        pages: 12,
        useCase: 'Cold outreach, email attachments, producer first-look'
    },
    {
        title: 'Full Pitch Deck (38 pages)',
        subtitle: 'Complete Transmedia Vision',
        description: 'Comprehensive deck including board game, ARG, Rocky Horror positioning, and franchise depth',
        url: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694d42d40ffc7474cd3e624b/d007f1a0e_FilmAdaptationPitchDeckV23V2.pdf',
        pages: 38,
        useCase: 'In-person meetings, franchise discussions, transmedia depth'
    }
];

const features = [
    { icon: FileText, title: 'Literary Agent Package', desc: 'Queries + Synopses auto-generated' },
    { icon: Film, title: '12-Slide Producer Pitch Deck', desc: 'PPTX export, production-ready' },
    { icon: TrendingUp, title: 'Screen Viability Score', desc: '0-100 calibrated rating' },
    { icon: Target, title: '5-Part Mythic Structure', desc: 'Validated against canon' },
    { icon: Sparkles, title: 'Del Toro-Level Tone', desc: 'Enforced across all outputs' }
];

const comparison = [
    { aspect: 'Time to Pitch-Ready', traditional: '6 months', base44: '6 hours' },
    { aspect: 'Tools Required', traditional: '5 apps', base44: '1 tool' },
    { aspect: 'Total Cost', traditional: '$500+', base44: '$99' }
];

export default function FilmAdaptation() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900 py-20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent" />
                
                <div className="relative max-w-6xl mx-auto px-6 text-center">
                    <Badge className="mb-6 px-4 py-2 bg-white/10 text-white border-white/20">
                        <Film className="w-4 h-4 mr-2" />
                        Film Adaptation Package
                    </Badge>
                    
                    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                        From Manuscript to Hollywood Pitch Deck
                    </h1>
                    
                    <p className="text-lg text-indigo-200 max-w-3xl mx-auto mb-6 font-medium tracking-wide">
                        Manuscript Evaluation → Agent Ready™ → Revise → Pitch → Query
                    </p>
                    
                    <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-4">
                        One Tool. One Subscription.
                    </p>
                    
                    <p className="text-2xl text-white font-semibold max-w-3xl mx-auto mb-3">
                        Upload Your Complete Work → Download Agent + Producer Decks
                    </p>
                    
                    <p className="text-base text-slate-300 max-w-2xl mx-auto mb-10">
                        Canon Validated. Production-Ready.
                    </p>

                    <Link to={createPageUrl('Pricing')}>
                        <Button 
                            size="lg" 
                            className="h-14 px-8 bg-white text-slate-900 hover:bg-slate-100"
                        >
                            <Sparkles className="w-5 h-5 mr-2" />
                            Start Free Trial → $99/mo
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Sample Pitch Decks */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        See What's Possible
                    </h2>
                    <p className="text-lg text-slate-600">
                        Review actual pitch decks generated for The Lost World of Mythoamphibia
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {pdfExamples.map((pdf, idx) => (
                        <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-all">
                            <CardHeader>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <CardTitle className="text-xl mb-2">{pdf.title}</CardTitle>
                                        <p className="text-sm text-indigo-600 font-medium">{pdf.subtitle}</p>
                                    </div>
                                    <Badge variant="outline">{pdf.pages} pages</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-slate-600">{pdf.description}</p>
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-xs text-slate-600">
                                        <span className="font-semibold">Best for:</span> {pdf.useCase}
                                    </p>
                                </div>
                                <Button 
                                    className="w-full" 
                                    variant="outline"
                                    onClick={() => window.open(pdf.url, '_blank')}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    View Sample Deck
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Pipeline Visual */}
            <div className="bg-white py-12 border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                        <div className="text-center px-6 py-4 rounded-xl bg-indigo-50 border border-indigo-200">
                            <BookOpen className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                            <div className="font-bold text-slate-900">Manuscript</div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-slate-400 rotate-90 md:rotate-0" />
                        <div className="text-center px-6 py-4 rounded-xl bg-purple-50 border border-purple-200">
                            <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                            <div className="font-bold text-slate-900">Agent Package</div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-slate-400 rotate-90 md:rotate-0" />
                        <div className="text-center px-6 py-4 rounded-xl bg-pink-50 border border-pink-200">
                            <Film className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                            <div className="font-bold text-slate-900">Film Deck</div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-slate-400 rotate-90 md:rotate-0" />
                        <div className="text-center px-6 py-4 rounded-xl bg-emerald-50 border border-emerald-200">
                            <Sparkles className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                            <div className="font-bold text-slate-900">Hollywood</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="bg-white py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">
                            End-to-End IP Translation Engine
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-5 gap-6 mb-12">
                        {features.map((feature, idx) => (
                            <div key={idx} className="text-center">
                                <div className="inline-flex p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 mb-3">
                                    <feature.icon className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-2 text-sm">{feature.title}</h3>
                                <p className="text-xs text-slate-600">{feature.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Comparison Table */}
                    <Card className="border-2 border-indigo-100">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900"></th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Traditional</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-indigo-900">Base44</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {comparison.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-900">{row.aspect}</td>
                                                <td className="px-6 py-4 text-slate-600">{row.traditional}</td>
                                                <td className="px-6 py-4 text-indigo-600 font-semibold">{row.base44}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Pricing Section */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        3-Tier Authority Ladder
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle>Reader</CardTitle>
                            <div className="text-3xl font-bold text-slate-900 mt-2">$29<span className="text-lg text-slate-500">/mo</span></div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700">Literary Evaluation</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700">Agent Queries</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-indigo-500 shadow-xl relative">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <Badge className="bg-indigo-600 text-white">Most Popular</Badge>
                        </div>
                        <CardHeader>
                            <CardTitle>Creator</CardTitle>
                            <div className="text-3xl font-bold text-slate-900 mt-2">$99<span className="text-lg text-slate-500">/mo</span></div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700">All Reader features</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700 font-semibold">Film Pitch Deck (PPTX)</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700 font-semibold">Screen Viability Score</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle>Producer</CardTitle>
                            <div className="text-3xl font-bold text-slate-900 mt-2">$2K<span className="text-lg text-slate-500">/mo</span></div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700">All Creator features</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700">Bulk Processing</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <span className="text-sm text-slate-700">Custom Canon</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Trust Section */}
            <div className="bg-slate-900 py-16">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-6 px-4 py-2 bg-white/10 text-white border-white/20">
                        <Zap className="w-4 h-4 mr-2" />
                        Governed by Production Canon v2.0
                    </Badge>
                    
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        {[
                            'No Hallucinations',
                            'Locked Specifications',
                            'Dual Pipeline Authority',
                            'Studio-Grade Outputs'
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-center gap-2 text-white">
                                <Check className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm">{item}</span>
                            </div>
                        ))}
                    </div>

                    <blockquote className="text-xl text-slate-300 italic mb-8">
                        "Base44 doesn't write stories. It translates them to market reality."
                    </blockquote>

                    <Link to={createPageUrl('Pricing')}>
                        <Button 
                            size="lg" 
                            className="h-14 px-8 bg-white text-slate-900 hover:bg-slate-100"
                        >
                            <BookOpen className="w-5 h-5 mr-2" />
                            Upload Your Screenplay → Get Hollywood-Ready Deck Today
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </Link>

                    <p className="mt-6 text-sm text-slate-400">
                        Powered by FILM_PITCH_MASTER_v2.0 • 30-Day Money Back Guarantee
                    </p>
                </div>
            </div>

            {/* How It Works */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Translation Engine, Not Writing Tool
                    </h2>
                    <p className="text-lg text-slate-600">
                        Authority-first infrastructure for manuscript-to-screen conversion
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { step: '1', title: 'Upload', desc: 'Submit your completed screenplay or manuscript' },
                        { step: '2', title: 'Generate', desc: 'AI translates to agent queries + producer pitch deck' },
                        { step: '3', title: 'Export', desc: 'Download production-ready PPTX + query materials' }
                    ].map((item, idx) => (
                        <div key={idx} className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg mb-4">
                                {item.step}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                            <p className="text-sm text-slate-600">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Final CTA */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-12">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        Upload Manuscript → Get Dual Packages
                    </h2>
                    <p className="text-lg text-indigo-100 mb-8">
                        Agent-Ready Materials + Hollywood Pitch Deck in One Workflow
                    </p>
                    <Link to={createPageUrl('Pricing')}>
                        <Button 
                            size="lg" 
                            className="h-14 px-8 bg-white text-slate-900 hover:bg-slate-100"
                        >
                            Get Started Now
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}