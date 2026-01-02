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
    Users, Mail, HelpCircle, FileCheck, User, Crown, Package, Edit3, CheckCircle2, Shield, Plus, Upload
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import AnalyticsTracker from '@/components/AnalyticsTracker';
import ScrollToTop from '@/components/ScrollToTop';

// CANONICAL WORKFLOW: Dashboard → Upload → Evaluate → Revise → Convert → Output
const dashboardPages = [
    { name: 'Overview', page: 'Dashboard', icon: BarChart3 },
    { name: 'Analytics', page: 'Analytics', icon: TrendingUp },
];

const evaluatePages = [
    { name: 'Scene(s) — partial or full', page: 'Evaluate', icon: FileText },
    { name: 'Chapter(s) — partial or full', page: 'Evaluate', icon: FileText },
    { name: 'Full Novel / Manuscript', page: 'UploadManuscript', icon: BookOpen },
    { name: 'Full Screenplay', page: 'Evaluate', icon: Film },
    { name: 'Test Upload', page: 'TestUpload', icon: Upload },
];

const revisePages = [
    { name: 'Scene(s) — partial or full', page: 'History', icon: Edit3 },
    { name: 'Chapter(s) — partial or full', page: 'History', icon: Edit3 },
    { name: 'Full Novel', page: 'History', icon: BookOpen },
    { name: 'Full Screenplay', page: 'History', icon: Film },
];

const convertPages = [
    { name: 'Chapter(s) → Scene(s)', page: 'ScreenplayFormatter', icon: Film },
    { name: 'Full Novel → Full Screenplay', page: 'ScreenplayFormatter', icon: Film },
];

const outputPages = [
    { name: 'Synopsis', page: 'Synopsis', icon: FileText },
    { name: 'Pitch Generator', page: 'PitchGenerator', icon: Target },
    { name: 'Market Comparables', page: 'Comparables', icon: TrendingUp },
    { name: 'Author Biography', page: 'Biography', icon: User },
    { name: 'Query Letter', page: 'QueryLetter', icon: Mail },
    { name: 'Agent Package', page: 'CompletePackage', icon: Package },
    { name: 'Film Adaptation Package', page: 'FilmAdaptation', icon: Film },
];

const storygatePages = [
    { name: 'StoryGate Overview', page: 'StoryGate', icon: Shield },
    { name: 'Studio Submission', page: 'StorygateStudio', icon: Crown },
    { name: 'My Listings', page: 'CreatorStoryGate', icon: FileText },
    { name: 'Create Listing', page: 'CreateStoryGateListing', icon: Plus },
    { name: 'Verification Queue', page: 'AdminVerificationQueue', icon: CheckCircle2, adminOnly: true },
];

const resourcesPages = [
    { name: 'FAQ', page: 'FAQ', icon: HelpCircle },
    { name: 'Sample Analyses', page: 'SampleAnalyses', icon: FileCheck },
    { name: 'Methodology', page: 'Methodology', icon: FileText },
];

const pricingPages = [
    { name: 'Plans', page: 'Pricing', icon: Sparkles },
    { name: 'Enterprise', page: 'Enterprise', icon: Crown },
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
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Dashboard <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {dashboardPages.map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Evaluate <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {evaluatePages.map((item, idx) => (
                                        <DropdownMenuItem key={idx} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Revise <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {revisePages.map((item, idx) => (
                                        <DropdownMenuItem key={idx} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Convert <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {convertPages.map((item, idx) => (
                                        <DropdownMenuItem key={idx} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Output <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {outputPages.map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {!loading && user && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                            Storygate Studio™ <ChevronDown className="ml-1 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56">
                                        {storygatePages.map((item) => (
                                            (!item.adminOnly || user.role === 'admin') && (
                                                <DropdownMenuItem key={item.page} asChild>
                                                    <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                        <item.icon className="w-4 h-4 mr-2" />
                                                        {item.name}
                                                    </Link>
                                                </DropdownMenuItem>
                                            )
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Resources <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {resourcesPages.map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Pricing <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {pricingPages.map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="cursor-pointer">
                                                <item.icon className="w-4 h-4 mr-2" />
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
                            {/* Dashboard Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('dashboard')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <BarChart3 className="w-5 h-5 mr-3" />
                                        Dashboard
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.dashboard && "rotate-180")} />
                                </Button>
                                {expandedMobile.dashboard && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        <Link to={createPageUrl('Dashboard')} onClick={() => setMobileMenuOpen(false)}>
                                            <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                Overview
                                            </Button>
                                        </Link>
                                        <Link to={createPageUrl('Analytics')} onClick={() => setMobileMenuOpen(false)}>
                                            <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                Analytics
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>



                            {/* Evaluate Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('evaluate')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <Sparkles className="w-5 h-5 mr-3" />
                                        Evaluate
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.evaluate && "rotate-180")} />
                                </Button>
                                {expandedMobile.evaluate && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {evaluatePages.map((item, idx) => (
                                            <Link key={idx} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                    <item.icon className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Revise Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('revise')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <Edit3 className="w-5 h-5 mr-3" />
                                        Revise
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.revise && "rotate-180")} />
                                </Button>
                                {expandedMobile.revise && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {revisePages.map((item, idx) => (
                                            <Link key={idx} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                    <item.icon className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Convert Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('convert')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <Film className="w-5 h-5 mr-3" />
                                        Convert
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.convert && "rotate-180")} />
                                </Button>
                                {expandedMobile.convert && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {convertPages.map((item, idx) => (
                                            <Link key={idx} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                    <item.icon className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

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
                                        {outputPages.map((item) => (
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

                            {/* Storygate Studio Section */}
                            {user && (
                                <div>
                                    <Button
                                        variant="ghost"
                                        onClick={() => toggleMobileSection('storygate')}
                                        className="w-full justify-between h-12 text-slate-600"
                                    >
                                        <span className="flex items-center">
                                            <Crown className="w-5 h-5 mr-3" />
                                            Storygate Studio
                                        </span>
                                        <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.storygate && "rotate-180")} />
                                    </Button>
                                    {expandedMobile.storygate && (
                                        <div className="ml-8 space-y-1 mt-1">
                                            {storygatePages.map((item) => (
                                                (!item.adminOnly || user.role === 'admin') && (
                                                    <Link key={item.page} to={createPageUrl(item.page)} onClick={() => setMobileMenuOpen(false)}>
                                                        <Button variant="ghost" className="w-full justify-start h-10 text-sm text-slate-600">
                                                            <item.icon className="w-4 h-4 mr-2" />
                                                            {item.name}
                                                        </Button>
                                                    </Link>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

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
                                        {resourcesPages.map((item) => (
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

                            {/* Pricing Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('pricing')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <Sparkles className="w-5 h-5 mr-3" />
                                        Pricing
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.pricing && "rotate-180")} />
                                </Button>
                                {expandedMobile.pricing && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {pricingPages.map((item) => (
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
                <ScrollToTop />
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