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
} from "@/components/ui/dropdown-menu";
import { 
    BookOpen, Sparkles, Menu, X, LogOut, BarChart3,
    ChevronDown, FileText, Film, Target, TrendingUp,
    Users, Mail, HelpCircle, FileCheck, User
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import AnalyticsTracker from '@/components/AnalyticsTracker';

const worksPages = [
    { name: 'Manuscripts', page: 'UploadManuscript', icon: BookOpen },
    { name: 'Screenplays', page: 'ScreenplayFormatter', icon: Film },
    { name: 'Chapters/Scenes', page: 'Evaluate', icon: FileText },
];

const evaluatePages = [
    { name: 'New Evaluation', page: 'Evaluate', icon: Sparkles, highlight: true },
    { name: 'Sample Analysis', page: 'SampleAnalysis', icon: FileCheck },
    { name: 'Criteria', page: 'Criteria', icon: FileText },
    { name: 'Pitch Builder', page: 'PitchBuilder', icon: Target },
    { name: 'Synopsis', page: 'Synopsis', icon: FileText },
    { name: 'Biography', page: 'Biography', icon: User },
    { name: 'Comparables', page: 'Comparables', icon: TrendingUp },
    { name: 'Find Agents', page: 'FindAgents', icon: Users },
    { name: 'Query Letter', page: 'QueryLetter', icon: Mail },
    { name: 'Progress Reports', page: 'Progress', icon: BarChart3 },
];

const resourcesPages = [
    { name: 'FAQ', page: 'FAQ', icon: HelpCircle },
    { name: 'Methodology', page: 'Methodology', icon: FileText },
    { name: 'WAVE Criteria', page: 'Criteria', icon: FileCheck },
];

export default function Layout({ children, currentPageName }) {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [expandedMobile, setExpandedMobile] = React.useState({});
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

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

                        {/* Desktop Navigation */}
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

                            {/* Works Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Works <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    {worksPages.map((item) => (
                                        <DropdownMenuItem key={item.page} asChild>
                                            <Link to={createPageUrl(item.page)} className="flex items-center gap-2 cursor-pointer">
                                                <item.icon className="w-4 h-4" />
                                                {item.name}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Evaluate Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-3 text-sm text-slate-600 hover:text-slate-900">
                                        Evaluate <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56 max-h-[320px] overflow-y-auto">
                                    {evaluatePages.map((item) => (
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

                            {/* Pricing Button */}
                            <Link to={createPageUrl('Pricing')}>
                                <Button
                                    className={cn(
                                        "h-9 px-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white",
                                        currentPageName === 'Pricing' && "bg-indigo-700"
                                    )}
                                >
                                    Pricing
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
                                    {resourcesPages.map((item) => (
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

                            {/* Works Section */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('works')}
                                    className="w-full justify-between h-12 text-slate-600"
                                >
                                    <span className="flex items-center">
                                        <BookOpen className="w-5 h-5 mr-3" />
                                        Works
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.works && "rotate-180")} />
                                </Button>
                                {expandedMobile.works && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {worksPages.map((item) => (
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

                            {/* Evaluate Section - HIGHLIGHTED */}
                            <div>
                                <Button
                                    variant="ghost"
                                    onClick={() => toggleMobileSection('evaluate')}
                                    className="w-full justify-between h-12 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                >
                                    <span className="flex items-center font-medium">
                                        <Sparkles className="w-5 h-5 mr-3" />
                                        Evaluate
                                    </span>
                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedMobile.evaluate && "rotate-180")} />
                                </Button>
                                {expandedMobile.evaluate && (
                                    <div className="ml-8 space-y-1 mt-1">
                                        {evaluatePages.map((item) => (
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

                            {/* Pricing Button */}
                            <Link to={createPageUrl('Pricing')} onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full justify-start h-12 bg-indigo-600 hover:bg-indigo-700 text-white">
                                    <Sparkles className="w-5 h-5 mr-3" />
                                    Pricing
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
                            Powered by the WAVE Revision System (61+ Waves) • 12 Story Evaluation Criteria • Professional Editorial Standards
                        </p>
                        <div className="px-6 py-4 rounded-lg bg-slate-50 border border-slate-200 max-w-3xl mx-auto mb-4">
                            <p className="text-sm text-slate-600">
                                <strong>Disclaimer:</strong> RevisionGrade provides AI-generated analysis calibrated against professional editorial standards. It does not replace human editorial judgment—final decisions remain with the author.
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