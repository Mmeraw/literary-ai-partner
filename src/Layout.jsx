import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { 
    BookOpen, Sparkles, History, FileText, Film,
    Menu, X, LogOut, BarChart3
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import AnalyticsTracker from '@/components/AnalyticsTracker';

const navItems = [
    { name: 'Home', page: 'Home', icon: BookOpen },
    { name: 'Why RevisionGrade', page: 'WhyRevisionGrade', icon: Sparkles },
    { name: 'For Professionals', page: 'ForProfessionals', icon: Sparkles },
    { name: 'Dashboard', page: 'Dashboard', icon: Sparkles },
    { name: 'Progress', page: 'Progress', icon: BarChart3 },
    { name: 'Quick Eval', page: 'Evaluate', icon: Sparkles },
    { name: 'Manuscript', page: 'UploadManuscript', icon: BookOpen },
    { name: 'Screenplay', page: 'ScreenplayFormatter', icon: FileText },
    { name: 'Sample Analysis', page: 'SampleAnalysis', icon: FileText },
    { name: 'Pricing', page: 'Pricing', icon: Sparkles },
    { name: 'FAQ', page: 'FAQ', icon: FileText },
    { name: 'Criteria', page: 'Criteria', icon: FileText },
    { name: 'History', page: 'History', icon: History },
    { name: 'Analytics', page: 'Analytics', icon: BarChart3, adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const userData = await base44.auth.me();
                console.log('Auth user data:', userData);
                setUser(userData);
            } catch (err) {
                console.log('Auth error:', err);
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
                        <div className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
                            {navItems
                                .filter(item => {
                                    if (item.page === 'History' && !user) return false;
                                    if (item.adminOnly && user?.role !== 'admin') return false;
                                    return true;
                                })
                                .map((item) => (
                                    <Link key={item.page} to={createPageUrl(item.page)}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "h-9 px-2 text-sm whitespace-nowrap flex-shrink-0",
                                                currentPageName === item.page 
                                                    ? "bg-indigo-50 text-indigo-700" 
                                                    : "text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            <item.icon className="w-4 h-4 mr-1" />
                                            {item.name}
                                        </Button>
                                    </Link>
                                ))}
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {!loading && (
                                user ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleLogout}
                                        className="text-slate-500 hover:text-slate-700"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </Button>
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
                                className="md:hidden h-12 w-12"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? (
                                    <X className="w-7 h-7" />
                                ) : (
                                    <Menu className="w-7 h-7" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden absolute left-0 right-0 top-16 border-t border-slate-100 bg-white shadow-lg max-h-screen overflow-y-auto">
                        <div className="px-4 py-3 space-y-1">
                            {navItems
                                .filter(item => {
                                    if (item.page === 'History' && !user) return false;
                                    if (item.adminOnly && user?.role !== 'admin') return false;
                                    return true;
                                })
                                .map((item) => (
                                    <Link 
                                        key={item.page} 
                                        to={createPageUrl(item.page)}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start h-12",
                                                currentPageName === item.page 
                                                    ? "bg-indigo-50 text-indigo-700" 
                                                    : "text-slate-600"
                                            )}
                                        >
                                            <item.icon className="w-5 h-5 mr-3" />
                                            {item.name}
                                        </Button>
                                    </Link>
                                ))}
                            
                            {user && (
                                <>
                                    <div className="border-t border-slate-200 my-2 pt-2" />
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            handleLogout();
                                        }}
                                        className="w-full justify-start h-12 text-slate-600"
                                    >
                                        <LogOut className="w-5 h-5 mr-3" />
                                        Sign Out
                                    </Button>
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