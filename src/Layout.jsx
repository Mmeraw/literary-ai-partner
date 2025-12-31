import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { 
    BookOpen, Sparkles, Menu, X, LogOut, BarChart3,
    ChevronDown, FileText, Film, Target, TrendingUp,
    Users, Mail, HelpCircle, FileCheck, User, Crown, Package, Edit3, CheckCircle2, Shield
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import AnalyticsTracker from '@/components/AnalyticsTracker';

// CANONICAL WORKFLOW: Upload → Evaluate → Results → Revise → Output
const uploadPages = [
    { name: 'Full Manuscript', page: 'UploadManuscript', icon: BookOpen },
    { name: 'Chapter/Scene', page: 'Evaluate', icon: FileText },
];

const packagePages = [
    { name: 'Agent Package', page: 'CompletePackage', icon: Package, highlight: true },
    { name: 'Film Adaptation Package', page: 'FilmAdaptation', icon: Film, highlight: true },
    { name: 'Query Letter', page: 'QueryLetter', icon: Mail },
    { name: 'Synopsis', page: 'Synopsis', icon: FileText },
    { name: 'Pitch Generator', page: 'PitchGenerator', icon: Target },
    { name: 'Author Biography', page: 'Biography', icon: User },
    { name: 'Market Comparables', page: 'Comparables', icon: TrendingUp },
    { name: 'Find Agents', page: 'FindAgents', icon: Users },
    { name: 'Novel to Screenplay', page: 'ScreenplayFormatter', icon: Film },
];

const resourcesPages = [
    { name: 'Sample Analyses', page: 'SampleAnalyses', icon: FileCheck },
    { name: 'FAQ', page: 'FAQ', icon: HelpCircle },
    { name: 'Methodology', page: 'Methodology', icon: FileText },
    { name: 'WAVE Criteria', page: 'Criteria', icon: FileCheck },
    { name: 'Security & Ethics', page: 'SecurityAndEthics', icon: Shield },
];

export default function Layout({ children, currentPageName }) {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [expandedMobile, setExpandedMobile] = React.useState({});
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    // Kill Unicode y imposters with MutationObserver (survives React re-renders)
    React.useEffect(() => {
        const charMap = new Map([
            ["\u03A5", "Y"], ["\u03C5", "y"], // Greek upsilon
            ["\u0423", "Y"], ["\u0443", "y"], // Cyrillic U
            ["\u042B", "Y"], ["\u044B", "y"], // Cyrillic Yeru
            ["\u00FD", "y"], ["\u00FF", "y"], // ý, ÿ
            ["\u0176", "Y"], ["\u0177", "y"], // Ŷ, ŷ
            ["\u1EF2", "Y"], ["\u1EF3", "y"]  // Ỳ, ỳ
        ]);

        function sanitizeText(root) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const t = node.nodeValue;
                if (!t) continue;
                let out = "";
                let changed = false;
                for (const ch of t) {
                    const rep = charMap.get(ch);
                    if (rep) { out += rep; changed = true; }
                    else out += ch;
                }
                if (changed) node.nodeValue = out;
            }
        }

        // Initial sanitization
        if (document.body) sanitizeText(document.body);

        // Watch for React re-renders and new content
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === "characterData" && m.target?.nodeValue) {
                    sanitizeText(m.target.parentNode || document.body);
                } else if (m.addedNodes?.length) {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType === 3) sanitizeText(node.parentNode || document.body);
                        else if (node.nodeType === 1) sanitizeText(node);
                    });
                }
            }
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true
        });

        return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const userData = await base44.auth.me();
                setUser(userData);
            } catch (err) {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const handleLogout = () => {
        base44.auth.logout();
    };

    const toggleMobileSection = (section) => {
        setExpandedMobile(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center gap-4 h-16">
                        {/* Logo */}
                        <Link to={createPageUrl('Home')} className="flex items-center gap-2 flex-shrink-0">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                                <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div className="hidden lg:block">
                                <div className="font-bold text-lg text-slate-900">
                                    RevisionGrade™
                                </div>
                            </div>
                        </Link>

                        {/* Desktop Navigation - CANONICAL WORKFLOW */}
                        <div className="hidden md:flex items-center gap-1 flex-1">
                            <Link to={createPageUrl('Dashboard')}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-3 text-sm",
                                        currentPageName === 'Dashboard' 
                                            ? "bg-indigo-50 text-indigo-700" 
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    Dashboard
                                </Button>
                            </Link>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Upload <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {uploadPages.map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="flex items-center gap-2 cursor-pointer">
                                                <item.icon className="w-4 h-4" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Link to={createPageUrl('Dashboard')}>
                                <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                    Evaluate
                                </Button>
                            </Link>

                            <Link to={createPageUrl('Revise')}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-3 text-sm",
                                        currentPageName === 'Revise' 
                                            ? "bg-indigo-50 text-indigo-700" 
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    Revise
                                </Button>
                            </Link>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Output <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {packagePages.map((item) => (
                                        <DropdownMenuItem 
                                            key={item.page} 
                                            asChild
                                            className={item.highlight ? "bg-indigo-50" : ""}
                                        >
                                            <Link to={createPageUrl(item.page)} className="flex items-center gap-2 cursor-pointer">
                                                <item.icon className="w-4 h-4" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Link to={createPageUrl('Analytics')}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-3 text-sm",
                                        currentPageName === 'Analytics' 
                                            ? "bg-indigo-50 text-indigo-700" 
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    Analytics
                                </Button>
                            </Link>

                            {/* Pricing & Enterprise */}
                            <Link to={createPageUrl('Pricing')}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-3 text-sm",
                                        currentPageName === 'Pricing' 
                                            ? "bg-indigo-50 text-indigo-700" 
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    Pricing
                                </Button>
                            </Link>

                            <Link to={createPageUrl('StorygateStudio')}>
                                <Button
                                    className={cn(
                                        "h-9 px-3 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white",
                                        currentPageName === 'StorygateStudio' && "from-purple-700 to-pink-700"
                                    )}
                                >
                                    Storygate Studio
                                </Button>
                            </Link>

                            <Link to={createPageUrl('Enterprise')}>
                                <Button
                                    className={cn(
                                        "h-9 px-3 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white",
                                        currentPageName === 'Enterprise' && "from-indigo-700 to-purple-700"
                                    )}
                                >
                                    Enterprise
                                </Button>
                            </Link>

                            {/* Resources Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Resources <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <FileCheck className="w-4 h-4 mr-2" />
                                            Sample Analyses
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuItem asChild>
                                                <Link to={createPageUrl('SampleAnalyses')} className="cursor-pointer">
                                                    Overview
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link to={createPageUrl('SampleChapterAnalysis')} className="cursor-pointer">
                                                    Executive Summary (12 pages)
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link to={createPageUrl('SampleComparativeAnalysis')} className="cursor-pointer">
                                                    Full Pitch Deck (39 pages)
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link to={createPageUrl('SampleFilmPitchDeck')} className="cursor-pointer">
                                                    Film Pitch Deck (Screenplay)
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    {resourcesPages.filter(item => item.page !== 'SampleAnalyses').map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="flex items-center gap-2 cursor-pointer">
                                                <item.icon className="w-4 h-4" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {!loading && (
                                user ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700">
                                                <User className="w-5 h-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem asChild>
                                                <Link to={createPageUrl('Dashboard')} className="cursor-pointer">
                                                    <BarChart3 className="w-4 h-4 mr-2" />
                                                    Profile
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link to={createPageUrl('Pricing')} className="cursor-pointer">
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                    Billing
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                                                <LogOut className="w-4 h-4 mr-2" />
                                                Sign Out
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Button
                                        onClick={() => base44.auth.redirectToLogin()}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        Sign In
                                    </Button>
                                )
                            )}

                            {/* Mobile menu button */}
                            <Button
                                variant="ghost"
                                className="md:hidden h-16 w-16 p-4"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? (
                                    <X className="w-10 h-10" />
                                ) : (
                                    <Menu className="w-10 h-10" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden absolute left-0 right-0 top-16 border-t border-slate-100 bg-white shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
                        <div className="px-4 py-3 space-y-1">
                            {/* Dashboard */}
                            <Link to={createPageUrl('Dashboard')} onClick={() => setMobileMenuOpen(false)}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-12",
                                        currentPageName === 'Dashboard' ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
                                    )}
                                >
                                    <BarChart3 className="w-5 h-5 mr-3" />
                                    Dashboard
                                </Button>
                            </Link>



                            {/* Upload Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('upload')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <BookOpen className="w-5 h-5 mr-3" />
                                        Upload
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.upload && "rotate-180")} />
                                </Button>
                                {expandedMobile.upload && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {uploadPages.map((item) => (
                                            <Link key={item.page} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                    <item.icon className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Evaluate (Direct Link) */}
                            <Link to={createPageUrl('Dashboard')} onClick={() => setMobileMenuOpen(false)}>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start h-12 text-slate-600"
                                >
                                    <Sparkles className="w-5 h-5 mr-3" />
                                    Evaluate
                                </Button>
                            </Link>

                            {/* Revise (Direct Link) */}
                            <Link to={createPageUrl('Revise')} onClick={() => setMobileMenuOpen(false)}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-12",
                                        currentPageName === 'Revise' ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
                                    )}
                                >
                                    <Edit3 className="w-5 h-5 mr-3" />
                                    Revise
                                </Button>
                            </Link>

                            {/* Output Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('output')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <Package className="w-5 h-5 mr-3" />
                                        Output
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.output && "rotate-180")} />
                                </Button>
                                {expandedMobile.output && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {packagePages.map((item) => (
                                            <Link key={item.page} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                <Button 
                                                    variant="ghost" 
                                                    className={cn(
                                                        "w-full justify-start h-10 text-sm",
                                                        item.highlight ? "text-indigo-600" : "text-slate-600"
                                                    )}
                                                >
                                                    <item.icon className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Analytics (Direct Link) */}
                            <Link to={createPageUrl('Analytics')} onClick={() => setMobileMenuOpen(false)}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-12",
                                        currentPageName === 'Analytics' ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
                                    )}
                                >
                                    <BarChart3 className="w-5 h-5 mr-3" />
                                    Analytics
                                </Button>
                            </Link>

                            {/* Pricing & Enterprise */}
                            <Link to={createPageUrl('Pricing')} onClick={() => setMobileMenuOpen(false)}>
                                <Button 
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-12",
                                        currentPageName === 'Pricing' ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
                                    )}
                                >
                                    <Sparkles className="w-5 h-5 mr-3" />
                                    Pricing
                                </Button>
                            </Link>

                            <Link to={createPageUrl('StorygateStudio')} onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full justify-start h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                                    <Crown className="w-5 h-5 mr-3" />
                                    Storygate Studio
                                </Button>
                            </Link>

                            <Link to={createPageUrl('Enterprise')} onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full justify-start h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                                    <Crown className="w-5 h-5 mr-3" />
                                    Enterprise
                                </Button>
                            </Link>

                            <div className="border-t border-slate-200 my-2" />

                            {/* Resources Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('resources')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <FileText className="w-5 h-5 mr-3" />
                                        Resources
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.resources && "rotate-180")} />
                                </Button>
                                {expandedMobile.resources && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        <div>
                                            <Button
                                                variant="ghost"
                                                onClick={() => toggleMobileSection('sampleAnalyses')}
                                                className="w-full justify-between h-10 text-sm text-slate-600"
                                            >
                                                <span className="flex items-center">
                                                    <FileCheck className="w-4 h-4 mr-2" />
                                                    Sample Analyses
                                                </span>
                                                <ChevronDown className={cn("w-4 h-4 transition-transform", expandedMobile.sampleAnalyses && "rotate-180")} />
                                            </Button>
                                            {expandedMobile.sampleAnalyses && (
                                                <div className="ml-6 space-y-1 mt-1">
                                                    <Link to={createPageUrl('SampleAnalyses')} onClick={() => setMobileMenuOpen(false)}>
                                                        <Button variant="ghost" className="w-full justify-start h-9 text-xs text-slate-600">
                                                            Overview
                                                        </Button>
                                                    </Link>
                                                    <Link to={createPageUrl('SampleChapterAnalysis')} onClick={() => setMobileMenuOpen(false)}>
                                                        <Button variant="ghost" className="w-full justify-start h-9 text-xs text-slate-600">
                                                            Executive Summary (12 pages)
                                                        </Button>
                                                    </Link>
                                                    <Link to={createPageUrl('SampleComparativeAnalysis')} onClick={() => setMobileMenuOpen(false)}>
                                                        <Button variant="ghost" className="w-full justify-start h-9 text-xs text-slate-600">
                                                            Full Pitch Deck (39 pages)
                                                        </Button>
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                        {resourcesPages.filter(item => item.page !== 'SampleAnalyses').map((item) => (
                                            <Link key={item.page} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                    <item.icon className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-200 my-2" />

                            {/* Account Section */}
                            {user && (
                                <>
                                    <div>
                                        <Button
                                            variant="ghost"
                                            onClick={() => toggleMobileSection('account')}
                                            className="w-full justify-between h-12 text-slate-600"
                                        >
                                            <span className="flex items-center">
                                                <User className="w-5 h-5 mr-3" />
                                                Account
                                            </span>
                                            <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.account && "rotate-180")} />
                                        </Button>
                                        {expandedMobile.account && (
                                            <div className="ml-8 space-y-1 mt-1">
                                                <Link to={createPageUrl('Dashboard')} onClick={() => setMobileMenuOpen(false)}>
                                                    <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                        <User className="w-4 h-4 mr-2" />
                                                        Profile
                                                    </Button>
                                                </Link>
                                                <Link to={createPageUrl('Pricing')} onClick={() => setMobileMenuOpen(false)}>
                                                    <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                        <Sparkles className="w-4 h-4 mr-2" />
                                                        Billing
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setMobileMenuOpen(false);
                                                        handleLogout();
                                                    }}
                                                    className="w-full justify-start h-10 text-sm text-slate-600"
                                                >
                                                    <LogOut className="w-4 h-4 mr-2" />
                                                    Sign Out
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main>
                <AnalyticsTracker currentPageName={currentPageName} />
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-100 bg-white py-12 mt-auto">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center space-y-4">
                        <p className="text-sm text-slate-500">
                                    Powered by the Proprietary WAVE Revision System • 13 Story Evaluation Criteria • Professional Editorial Standards
                                </p>
                        <p className="text-xs text-slate-500 max-w-3xl mx-auto">
                            <strong>Technology Transparency:</strong> RevisionGrade uses the proprietary WAVE Revision System and 13 Story Evaluation Criteria framework, powered by the RevisionGrade analysis engine. 
                            All processing occurs securely, and no customer data is used to train external models. 
                            Usage is metered to ensure reliability and fair access for all users.
                        </p>
                        <div className="px-6 py-4 rounded-lg bg-slate-50 border border-slate-200 max-w-3xl mx-auto mb-4">
                            <p className="text-sm text-slate-600">
                                <strong>Disclaimer:</strong> RevisionGrade provides framework-driven analysis calibrated against professional editorial standards. It does not replace human editorial judgment—final decisions remain with the author.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-6 text-sm">
                            <Link to={createPageUrl('Contact')} className="text-slate-600 hover:text-indigo-600">
                                Contact
                            </Link>
                            <Link to={createPageUrl('Privacy')} className="text-slate-600 hover:text-indigo-600">
                                Privacy Policy
                            </Link>
                            <Link to={createPageUrl('Terms')} className="text-slate-600 hover:text-indigo-600">
                                Terms of Service
                            </Link>
                        </div>
                        <p className="text-sm text-slate-500">
                            © {new Date().getFullYear()} RevisionGrade™. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}