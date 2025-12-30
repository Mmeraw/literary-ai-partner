import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    BookOpen, 
    FileText, 
    Sparkles, 
    HelpCircle,
    PlayCircle,
    Target,
    Users,
    Mail,
    Search,
    ArrowRight,
    CheckCircle2,
    Zap,
    Award,
    TrendingUp,
    Film
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function HelpCenter() {
    const [searchQuery, setSearchQuery] = useState('');

    const helpCategories = [
        {
            icon: Sparkles,
            title: 'Getting Started',
            description: 'New to RevisionGrade™? Start here',
            color: 'from-indigo-500 to-purple-600',
            articles: [
                { title: 'How RevisionGrade Works', page: 'Methodology', icon: BookOpen },
                { title: 'Understanding Your Scores', page: 'Criteria', icon: Award },
                { title: 'Frequently Asked Questions', page: 'FAQ', icon: HelpCircle },
                { title: 'Pricing & Plans', page: 'Pricing', icon: Target }
            ]
        },
        {
            icon: FileText,
            title: 'Evaluation & Analysis',
            description: 'Understand your manuscript feedback',
            color: 'from-emerald-500 to-teal-600',
            articles: [
                { title: '12 Story Evaluation Criteria', page: 'Criteria', icon: CheckCircle2 },
                { title: 'WAVE Revision System', page: 'Methodology', icon: Zap },
                { title: 'Revision Mode™ Guide', page: 'FAQ', icon: Sparkles, anchor: 'revision-mode' },
                { title: 'Sample Analysis Examples', page: 'SampleAnalysis', icon: FileText }
            ]
        },
        {
            icon: Target,
            title: 'Submission Tools',
            description: 'Create agent-ready packages',
            color: 'from-blue-500 to-cyan-600',
            articles: [
                { title: 'Complete Submission Package', page: 'CompletePackage', icon: Package },
                { title: 'Synopsis Generator', page: 'Synopsis', icon: FileText },
                { title: 'Query Letter Builder', page: 'QueryLetter', icon: Mail },
                { title: 'Find Literary Agents', page: 'FindAgents', icon: Users }
            ]
        },
        {
            icon: Film,
            title: 'Film & TV Adaptation',
            description: 'Hollywood-ready pitch materials',
            color: 'from-purple-500 to-pink-600',
            articles: [
                { title: 'Film Adaptation Package', page: 'FilmAdaptation', icon: Film },
                { title: 'Pitch Deck Generator', page: 'PitchGenerator', icon: Target },
                { title: 'Screenplay Formatting', page: 'ScreenplayFormatter', icon: FileText }
            ]
        },
        {
            icon: TrendingUp,
            title: 'Progress & Reports',
            description: 'Track your writing improvement',
            color: 'from-amber-500 to-orange-600',
            articles: [
                { title: 'Progress Dashboard', page: 'Progress', icon: TrendingUp },
                { title: 'Revision History', page: 'History', icon: FileText },
                { title: 'Comparative Analysis', page: 'Comparables', icon: BarChart3 }
            ]
        },
        {
            icon: Users,
            title: 'Enterprise & Teams',
            description: 'Solutions for organizations',
            color: 'from-slate-600 to-slate-800',
            articles: [
                { title: 'Enterprise Features', page: 'Enterprise', icon: Users },
                { title: 'For Writing Professionals', page: 'ForProfessionals', icon: Award },
                { title: 'Contact Sales', page: 'Contact', icon: Mail }
            ]
        }
    ];

    const quickLinks = [
        { title: 'Upload Manuscript', page: 'UploadManuscript', icon: BookOpen, color: 'indigo' },
        { title: 'Quick Evaluation', page: 'Evaluate', icon: Sparkles, color: 'purple' },
        { title: 'View Pricing', page: 'Pricing', icon: Target, color: 'emerald' },
        { title: 'Contact Support', page: 'Contact', icon: Mail, color: 'blue' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <HelpCircle className="w-4 h-4 mr-2" />
                        Help Center
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        How can we help you?
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Find guides, FAQs, and resources to get the most out of RevisionGrade™
                    </p>

                    {/* Search Bar */}
                    <div className="mt-8 max-w-2xl mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Search help articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-14 text-lg border-slate-300 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    {quickLinks.map((link, idx) => (
                        <Link key={idx} to={createPageUrl(link.page)}>
                            <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer">
                                <CardContent className="p-6 text-center">
                                    <div className={`inline-flex p-3 rounded-xl bg-${link.color}-100 mb-3 group-hover:scale-110 transition-transform`}>
                                        <link.icon className={`w-5 h-5 text-${link.color}-600`} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-900">{link.title}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Help Categories */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {helpCategories.map((category, idx) => (
                        <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
                            <CardHeader>
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${category.color}`}>
                                        <category.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">{category.title}</CardTitle>
                                        <p className="text-sm text-slate-600 mt-1">{category.description}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {category.articles.map((article, articleIdx) => (
                                        <Link 
                                            key={articleIdx} 
                                            to={createPageUrl(article.page) + (article.anchor ? `#${article.anchor}` : '')}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                                        >
                                            <article.icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                            <span className="text-sm text-slate-700 group-hover:text-indigo-600 flex-1">
                                                {article.title}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Popular Resources */}
                <div className="mt-16">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Popular Resources</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <Link to={createPageUrl('FAQ')}>
                            <Card className="border-2 border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <HelpCircle className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-semibold text-slate-900">Frequently Asked Questions</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        Find answers to common questions about pricing, features, and how RevisionGrade™ works
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link to={createPageUrl('Methodology')}>
                            <Card className="border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <BookOpen className="w-5 h-5 text-purple-600" />
                                        <h3 className="font-semibold text-slate-900">Our Methodology</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        Learn how the 12 Story Evaluation Criteria and WAVE Revision System work
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link to={createPageUrl('SampleAnalysis')}>
                            <Card className="border-2 border-emerald-200 hover:border-emerald-400 transition-colors cursor-pointer">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <FileText className="w-5 h-5 text-emerald-600" />
                                        <h3 className="font-semibold text-slate-900">Sample Analysis</h3>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        See example evaluations to understand how your manuscript will be analyzed
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                </div>

                {/* Contact Support */}
                <div className="mt-16">
                    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                        <CardContent className="p-8 text-center">
                            <Mail className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                            <h2 className="text-2xl font-bold text-slate-900 mb-3">
                                Still need help?
                            </h2>
                            <p className="text-slate-600 mb-6 max-w-xl mx-auto">
                                Can't find what you're looking for? Our support team is here to help.
                            </p>
                            <Link to={createPageUrl('Contact')}>
                                <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                                    Contact Support
                                </button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}